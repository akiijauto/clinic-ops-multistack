// Package server は HTTP の入口。
//
// ルーティングのライブラリは使わない。Go 1.22 以降の net/http.ServeMux が
// 持つメソッド付きパターン（"GET /path/{id}"）だけで組み立てる。
package server

import (
	"log/slog"
	"net/http"

	"clinicops/internal/billing"
	"clinicops/internal/clinical"
	"clinicops/internal/config"
	"clinicops/internal/view"
)

// Server は依存をまとめて持つ。
// ハンドラは Server のメソッドとして書き、グローバル変数を作らない。
type Server struct {
	cfg      config.Config
	log      *slog.Logger
	views    *view.Set
	static   http.Handler
	billing  *billing.Store
	clinical *clinical.Store
	routes   []Route
}

// Route は登録済みの経路。死んだリンクの機械的な確認に使うため、
// 登録と同時に控えておく（spec/README.md 完了の判定 5）。
type Route struct {
	Method  string
	Pattern string
}

// New は Server を組み立てる。
// static は /static/ 以下を返す http.Handler（内容ハッシュ付きURLに対応したもの）。
// billingStore・clinicalStore は nil でもよい（対応する経路はその場合 404 を返す。
// テストで一部の依存を使わない組み立てを許すため — internal/server/server_test.go）。
func New(cfg config.Config, log *slog.Logger, views *view.Set, static http.Handler, billingStore *billing.Store, clinicalStore *clinical.Store) *Server {
	return &Server{cfg: cfg, log: log, views: views, static: static, billing: billingStore, clinical: clinicalStore}
}

// Handler はミドルウェアを巻いた http.Handler を返す。
// 経路の登録はここに集約する。領域ごとの登録関数を足すのはこの1か所だけにして、
// 経路表が散らばらないようにする。
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	s.handle(mux, "GET /healthz", s.handleHealth)
	s.handle(mux, "GET /health", s.handleHealth)

	if s.static != nil {
		s.handleRaw(mux, "GET /static/", s.static)
	}

	s.handle(mux, "GET /api/billings/{id}", s.handleGetBilling)
	s.handle(mux, "GET /api/sales/summary", s.handleSalesSummary)
	s.handle(mux, "GET /api/lab-tests/{id}", s.handleGetLabTest)
	s.handle(mux, "GET /api/reservations", s.handleListReservations)
	s.handle(mux, "GET /api/hospitalizations/{id}/care-records", s.handleListCareRecords)
	s.handle(mux, "GET /animals/{karte_no}/karte", s.handleKarte)
	s.handle(mux, "GET /animals/{karte_no}/karte/print", s.handleKartePrint)

	s.handle(mux, "GET /", s.handleTop)
	s.handle(mux, "GET /reservations", s.handleReservationsScreen)
	s.handle(mux, "GET /about", s.stubHandler("このシステムについて", "この企画の範囲・落としたものは spec/model.md を参照。"))
	s.handle(mux, "GET /today", s.stubHandler("本日の患者", "受付一覧はこれから作り込む。"))
	s.handle(mux, "GET /search", s.stubHandler("検索", "検索条件の入力欄はこれから作り込む。"))
	s.handle(mux, "GET /staff", s.stubHandler("スタッフ", "担当選択はこれから作り込む。"))
	s.handle(mux, "GET /settings", s.stubHandler("設定", "病院設定の保存はこれから作り込む。"))
	s.handle(mux, "GET /settings/features", s.stubHandler("機能設定", "表示のみ（この企画では機能の出し分けを扱わない）。"))
	s.handle(mux, "GET /settings/import", s.stubHandler("取込", "表示のみ（何を取り込めるかの説明に留める）。"))
	s.handle(mux, "GET /sales", s.stubHandler("売上集計", "集計そのものは GET /api/sales/summary を参照。画面はこれから作り込む。"))
	s.handle(mux, "GET /dm", s.stubHandler("DM", "DM一覧はこれから作り込む。"))
	s.handle(mux, "GET /ward", s.stubHandler("入院", "入院の一覧・記録追加はこれから作り込む。"))

	// 残りの領域ごとの経路は spec/screens.md の指示が来てから足す。

	return chain(mux,
		recoverPanic(s.log),
		requestID,
		logRequests(s.log),
	)
}

// Routes は登録済みの経路の一覧を返す。
func (s *Server) Routes() []Route {
	out := make([]Route, len(s.routes))
	copy(out, s.routes)
	return out
}

// handle は経路を登録し、同時に一覧へ控える。
// mux.HandleFunc を直接呼ばず必ずここを通すことで、
// 「登録したのに一覧に無い」経路が生まれないようにする。
func (s *Server) handle(mux *http.ServeMux, pattern string, h http.HandlerFunc) {
	method, path := splitPattern(pattern)
	s.routes = append(s.routes, Route{Method: method, Pattern: path})
	mux.HandleFunc(pattern, h)
}

// handleRaw は http.Handler をそのまま登録する版。
func (s *Server) handleRaw(mux *http.ServeMux, pattern string, h http.Handler) {
	method, path := splitPattern(pattern)
	s.routes = append(s.routes, Route{Method: method, Pattern: path})
	mux.Handle(pattern, h)
}

// splitPattern は "GET /health" を ("GET", "/health") に分ける。
// メソッドが無い場合は空文字を返す。
func splitPattern(pattern string) (method, path string) {
	for i := 0; i < len(pattern); i++ {
		if pattern[i] == ' ' {
			return pattern[:i], pattern[i+1:]
		}
	}
	return "", pattern
}
