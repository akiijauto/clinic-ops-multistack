package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"clinicops/internal/config"
	"clinicops/internal/view"
	"clinicops/web"
)

// newTestHandler は本番と同じ組み立てでハンドラを作る。
// テストだけ別の組み立てにすると、テストが通っても本番で落ちる余地が残るため。
func newTestHandler(t *testing.T) http.Handler {
	t.Helper()

	assets, err := web.NewAssets(web.Static())
	if err != nil {
		t.Fatalf("静的ファイルの読み込みに失敗: %v", err)
	}
	views, err := view.Parse(web.Templates(), map[string]any{"asset": assets.Path})
	if err != nil {
		t.Fatalf("テンプレートの解析に失敗: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return New(config.Config{}, log, views, assets.Handler(), nil, nil).Handler()
}

func TestHealth(t *testing.T) {
	for _, path := range []string{"/healthz", "/health"} {
		t.Run(path, func(t *testing.T) { assertHealth(t, path) })
	}
}

func assertHealth(t *testing.T, path string) {
	t.Helper()
	rec := httptest.NewRecorder()
	newTestHandler(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

	if rec.Code != http.StatusOK {
		t.Errorf("状態コード = %d, 期待 %d", rec.Code, http.StatusOK)
	}
	if got, want := rec.Body.String(), `{"status":"ok"}`; got != want {
		t.Errorf("本文 = %q, 期待 %q", got, want)
	}
	if got, want := rec.Header().Get("Content-Type"), "application/json"; got != want {
		t.Errorf("Content-Type = %q, 期待 %q", got, want)
	}
}

// TestHealthRejectsPost は、メソッド付きパターンで登録した経路が
// 別のメソッドを断ることを確かめる。
func TestHealthRejectsPost(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler(t).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/healthz", nil))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("状態コード = %d, 期待 %d", rec.Code, http.StatusMethodNotAllowed)
	}
}

// TestRoutesAreRecorded は、登録した経路が一覧にも載ることを確かめる。
// 死んだリンクの機械的な確認がこの一覧に依るため。
func TestRoutesAreRecorded(t *testing.T) {
	s := New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil, nil, nil, nil)
	s.Handler()

	found := false
	for _, r := range s.Routes() {
		if r.Method == http.MethodGet && r.Pattern == "/healthz" {
			found = true
		}
	}
	if !found {
		t.Errorf("GET /healthz が経路一覧に無い: %+v", s.Routes())
	}
}

// TestPanicBecomes500 は、ハンドラが panic してもプロセスが落ちず
// 500 が返ることを確かめる。
func TestPanicBecomes500(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := chain(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("わざと落とす")
	}), recoverPanic(log), requestID, logRequests(log))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("状態コード = %d, 期待 %d", rec.Code, http.StatusInternalServerError)
	}
}
