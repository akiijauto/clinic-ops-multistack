// clinicops は動物病院の窓口業務システム（Go 実装）の起動口。
//
// 起動・停止・依存の組み立てをここに集約する。
// 各パッケージは自分でグローバルな状態を持たない。
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"clinicops/internal/billing"
	"clinicops/internal/clinical"
	"clinicops/internal/config"
	"clinicops/internal/server"
	"clinicops/internal/view"
	"clinicops/web"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "起動に失敗:", err)
		os.Exit(1)
	}
}

func run() error {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	assets, err := web.NewAssets(web.Static())
	if err != nil {
		return err
	}

	views, err := view.Parse(web.Templates(), map[string]any{
		"asset": assets.Path,
	})
	if err != nil {
		return err
	}

	dataDir, err := billing.ResolveDataDir(cfg.DataDir)
	if err != nil {
		return err
	}
	billingStore, err := billing.Load(dataDir)
	if err != nil {
		return err
	}
	clinicalStore, err := clinical.Load(dataDir)
	if err != nil {
		return err
	}
	log.Info("data loaded", "dir", dataDir)

	srv := server.New(cfg, log, views, assets.Handler(), billingStore, clinicalStore)

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// 停止要求を受けたら、処理中の要求を待ってから閉じる。
	// フレームワークが用意している部分なので自分で書く。
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", cfg.Addr, "read_only", cfg.ReadOnly)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		log.Info("stopping")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := httpSrv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("停止に失敗: %w", err)
		}
		return <-errCh
	}
}
