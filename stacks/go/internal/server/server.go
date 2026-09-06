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
	"clinicops/internal/reception"
	"clinicops/internal/settings"
	"clinicops/internal/view"
)

// Server は依存をまとめて持つ。
// ハンドラは Server のメソッドとして書き、グローバル変数を作らない。
type Server struct {
	cfg       config.Config
	log       *slog.Logger
	views     *view.Set
	static    http.Handler
	uiCSS     http.Handler
	billing   *billing.Store
	clinical  *clinical.Store
	reception *reception.Handlers
	settings  *settings.Handlers
	routes    []Route
}

// Route は登録済みの経路。死んだリンクの機械的な確認に使うため、
// 登録と同時に控えておく（spec/README.md 完了の判定 5）。
type Route struct {
	Method  string
	Pattern string
}

// New は Server を組み立てる。
// static は /static/ 以下を返す http.Handler（内容ハッシュ付きURLに対応したもの）。
// uiCSS は 5実装共通のスタイル（`spec/ui.css`）を **`/ui.css` のまま**配る
// http.Handler（nilなら /ui.css は登録しない）。
// billingStore・clinicalStore・receptionHandlers・settingsHandlers は nil でもよい
// （対応する経路はその場合 404 を返す。テストで一部の依存を使わない組み立てを
// 許すため — internal/server/server_test.go）。
func New(cfg config.Config, log *slog.Logger, views *view.Set, static http.Handler, uiCSS http.Handler, billingStore *billing.Store, clinicalStore *clinical.Store, receptionHandlers *reception.Handlers, settingsHandlers *settings.Handlers) *Server {
	return &Server{cfg: cfg, log: log, views: views, static: static, uiCSS: uiCSS, billing: billingStore, clinical: clinicalStore, reception: receptionHandlers, settings: settingsHandlers}
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
	if s.uiCSS != nil {
		s.handleRaw(mux, "GET /ui.css", s.uiCSS)
	}

	s.handle(mux, "GET /api/billings/{id}", s.handleGetBilling)
	s.handle(mux, "PATCH /api/billings/{id}", s.handleAPIPatchBilling)
	s.handle(mux, "GET /api/billings", s.handleAPIListBillings)
	s.handle(mux, "GET /api/patients/{karte_no}/billings", s.handleAPIPatientBillings)
	s.handle(mux, "POST /api/patients/{karte_no}/billings", s.handleAPIPatientBillings)
	s.handle(mux, "GET /api/owners/{owner_no}/billings", s.handleAPIOwnerBillings)
	s.handle(mux, "GET /api/sales/summary", s.handleSalesSummary)
	s.handle(mux, "GET /api/dm", s.handleAPIDM)
	s.handle(mux, "GET /api/lab-tests/{id}", s.handleGetLabTest)
	s.handle(mux, "GET /api/reservations", s.handleListReservations)
	s.handle(mux, "POST /api/reservations", s.handleCreateReservationAPI)
	s.handle(mux, "GET /api/reservations/{id}", s.handleReservationAPI)
	s.handle(mux, "PATCH /api/reservations/{id}", s.handleReservationAPI)
	s.handle(mux, "POST /api/reservations/{id}/cancel", s.handleCancelReservationAPI)
	s.handle(mux, "GET /api/hospitalizations/{id}/care-records", s.handleListCareRecords)
	s.handle(mux, "GET /animals/{karte_no}/karte", s.handleKarte)
	s.handle(mux, "POST /animals/{karte_no}/karte", s.handleKarteSave)
	s.handle(mux, "GET /animals/{karte_no}/karte/new", s.handleKarteNew)
	s.handle(mux, "GET /animals/{karte_no}/karte/copy_prev", s.handleKarteCopyPrev)
	s.handle(mux, "POST /animals/{karte_no}/karte/cancel", s.handleKarteCancel)
	s.handle(mux, "GET /animals/{karte_no}/karte/print", s.handleKartePrint)
	s.handle(mux, "GET /animals/{karte_no}/karte/{visit_id}/print", s.handleVisitPrint)
	s.handle(mux, "POST /animals/{karte_no}/karte/{visit_id}/delete", s.handleVisitDelete)
	s.handle(mux, "POST /animals/{karte_no}/karte/{visit_id}/restore", s.handleVisitRestore)
	s.handle(mux, "GET /animals/{karte_no}/exam", s.handleExam)
	s.handle(mux, "POST /animals/{karte_no}/exam", s.handleExam)
	s.handle(mux, "GET /animals/{karte_no}/dosing/{kind_id}", s.handleDosing)
	s.handle(mux, "POST /animals/{karte_no}/dosing/{kind_id}", s.handleDosing)
	s.handle(mux, "GET /animals/{karte_no}/prevention/{kind_id}", s.handlePrevention)
	s.handle(mux, "POST /animals/{karte_no}/prevention/{kind_id}", s.handlePrevention)
	s.handle(mux, "GET /animals/{karte_no}/papers", s.handlePapers)
	s.handle(mux, "POST /animals/{karte_no}/papers", s.handlePapers)
	// 固定パス "GET /papers/no-paper" は "GET /papers/{paper_id}" より先に
	// 書く必要は無い（http.ServeMux はリテラルをワイルドカードより優先する）が、
	// 紛らわしいので隣に置く。無いと "no-paper" が paper_id 扱いされ 404 になる。
	s.handle(mux, "GET /papers/no-paper", s.handlePapersNoPaperScreen)
	s.handle(mux, "GET /papers/{paper_id}", s.handlePaperDetail)
	s.handle(mux, "POST /papers/{paper_id}/remove", s.handlePaperRemove)
	s.handle(mux, "POST /papers/no-paper", s.handleNoPaper)

	s.handle(mux, "GET /api/patients/{karte_no}/visits", s.handleAPIListVisits)
	s.handle(mux, "POST /api/patients/{karte_no}/visits", s.handleAPICreateVisit)
	s.handle(mux, "GET /api/visits/{visit_id}", s.handleAPIVisit)
	s.handle(mux, "PATCH /api/visits/{visit_id}", s.handleAPIVisit)
	s.handle(mux, "POST /api/visits/{visit_id}/delete", s.handleAPIVisitDelete)
	s.handle(mux, "POST /api/visits/{visit_id}/restore", s.handleAPIVisitRestore)
	s.handle(mux, "GET /api/patients/{karte_no}/lab-tests", s.handleAPIListLabTests)
	s.handle(mux, "POST /api/patients/{karte_no}/lab-tests", s.handleAPICreateLabTest)
	s.handle(mux, "GET /api/patients/{karte_no}/dosing/{kind_id}", s.handleAPIDosing)
	s.handle(mux, "PATCH /api/patients/{karte_no}/dosing/{kind_id}", s.handleAPIDosing)
	s.handle(mux, "GET /api/patients/{karte_no}/prevention/{kind_id}", s.handleAPIPrevention)
	s.handle(mux, "POST /api/patients/{karte_no}/prevention/{kind_id}", s.handleAPIPrevention)
	s.handle(mux, "GET /api/patients/{karte_no}/papers", s.handleAPIPapers)
	s.handle(mux, "POST /api/patients/{karte_no}/papers", s.handleAPIPapers)
	s.handle(mux, "GET /api/papers/{paper_id}", s.handleAPIPaper)
	s.handle(mux, "DELETE /api/papers/{paper_id}", s.handleAPIPaper)
	s.handle(mux, "GET /api/ward", s.handleAPIWard)
	s.handle(mux, "GET /api/patients/{karte_no}/hospitalizations", s.handleAPIPatientHospitalizations)
	s.handle(mux, "POST /api/patients/{karte_no}/hospitalizations", s.handleAPIPatientHospitalizations)
	s.handle(mux, "GET /api/hospitalizations/{id}", s.handleAPIHospitalization)
	s.handle(mux, "PATCH /api/hospitalizations/{id}", s.handleAPIHospitalization)
	s.handle(mux, "POST /api/hospitalizations/{id}/care-records", s.handleAPICreateCareRecord)
	s.handle(mux, "GET /api/todo/{key}", s.handleAPITodo)

	// "GET /" は net/http.ServeMux の仕様上、末尾が "/" のパターンは
	// 「他に合う登録が無いときの受け皿」になり、**存在しないパス・
	// メソッド不一致のパスも全部トップ画面(200)に落ちてしまう**
	// （2026-09-06 実測。POST専用の /animals/{karte_no}/karte/cancel 等へ
	// GETすると screen-top が200で返り、本来のスクリーンの目印(screen-*)を
	// 出していないと誤検出される — 在庫検査「data-testidが画面に出ている」で発覚）。
	// "{$}" を付けてトップを"/"の完全一致だけに絞り、それ以外は
	// net/httpの既定の404に落とす。
	s.handle(mux, "GET /{$}", s.handleTop)
	s.handle(mux, "GET /reservations", s.handleReservationsScreen)
	s.handle(mux, "POST /reservations", s.handleReservationsScreen)
	s.handle(mux, "GET /reservations/new", s.handleReservationNew)
	s.handle(mux, "GET /reservations/{id}", s.handleReservationDetail)
	s.handle(mux, "POST /reservations/{id}", s.handleReservationDetail)
	s.handle(mux, "POST /reservations/{id}/cancel", s.handleReservationCancel)
	s.handle(mux, "GET /todo/{key}", s.handleTodo)
	s.handle(mux, "GET /ward", s.handleWardToday)
	s.handle(mux, "GET /ward/day", s.handleWardDay)
	s.handle(mux, "GET /animals/{karte_no}/ward", s.handleAnimalWard)
	s.handle(mux, "POST /animals/{karte_no}/ward", s.handleAnimalWard)
	s.handle(mux, "GET /staff", s.handleStaff)
	s.handle(mux, "POST /staff", s.handleStaff)

	if s.reception != nil {
		s.handle(mux, "GET /today", s.reception.Today)
		s.handle(mux, "POST /today", s.reception.TodayMove)
		s.handle(mux, "GET /animals/new", s.reception.NewPatientForm)
		s.handle(mux, "POST /animals/new", s.reception.CreatePatient)
		s.handle(mux, "GET /animals/{karte_no}", s.reception.Owner)
		s.handle(mux, "POST /animals/{karte_no}", s.reception.OwnerSave)
		s.handle(mux, "GET /search", s.reception.Search)
		s.handle(mux, "GET /animals/{karte_no}/history", s.reception.History)
		s.handle(mux, "GET /animals/{karte_no}/delete", s.reception.DeleteConfirm)
		s.handle(mux, "POST /animals/{karte_no}/delete", s.reception.DeleteConfirm)
		s.handle(mux, "GET /folded/{key}", s.reception.Folded)
		s.handle(mux, "GET /api/patients", s.reception.APIListPatients)
		s.handle(mux, "GET /api/patients/{karte_no}", s.reception.APIGetPatient)
		s.handle(mux, "POST /api/patients/{karte_no}/delete", s.reception.APIDeletePatient)
		s.handle(mux, "POST /api/patients/{karte_no}/restore", s.reception.APIRestorePatient)
		s.handle(mux, "GET /api/owners/{owner_no}", s.reception.APIGetOwner)
		s.handle(mux, "POST /api/owners/{owner_no}/delete", s.reception.APIDeleteOwner)
		s.handle(mux, "GET /api/receptions", s.reception.APIListReceptions)
		s.handle(mux, "POST /api/receptions", s.reception.APICreateReception)
		s.handle(mux, "POST /api/patients/{karte_no}/receptions", s.reception.APICreatePatientReception)
		s.handle(mux, "GET /api/receptions/{id}", s.reception.APIGetReception)
		s.handle(mux, "PATCH /api/receptions/{id}", s.reception.APIUpdateReception)
		s.handle(mux, "PATCH /api/patients/{karte_no}", s.reception.APIPatchPatient)
		s.handle(mux, "PATCH /api/owners/{owner_no}", s.reception.APIPatchOwner)
		s.handle(mux, "GET /api/staff", s.reception.APIListStaff)
	} else {
		s.handle(mux, "GET /today", s.stubHandler("本日の患者", "受付一覧はこれから作り込む。"))
		s.handle(mux, "GET /search", s.stubHandler("検索", "検索条件の入力欄はこれから作り込む。"))
	}

	if s.settings != nil {
		s.handle(mux, "GET /about", s.settings.About)
		s.handle(mux, "GET /settings", s.settings.Settings)
		s.handle(mux, "POST /settings", s.settings.Settings)
		s.handle(mux, "GET /settings/features", s.settings.Features)
		s.handle(mux, "GET /settings/import", s.settings.Import)
		s.handle(mux, "GET /settings/master", s.settings.Master)
		s.handle(mux, "GET /settings/master/{key}", s.settings.MasterDetail)
		s.handle(mux, "GET /postal", s.settings.Postal)
		s.handle(mux, "GET /api/features", s.settings.APIFeatures)
		s.handle(mux, "GET /api/masters/{key}", s.settings.APIMaster)
	} else {
		s.handle(mux, "GET /about", s.stubHandler("このシステムについて", "この企画の範囲・落としたものは spec/model.md を参照。"))
		s.handle(mux, "GET /settings", s.stubHandler("設定", "病院設定の保存はこれから作り込む。"))
		s.handle(mux, "GET /settings/features", s.stubHandler("機能設定", "表示のみ（この企画では機能の出し分けを扱わない）。"))
		s.handle(mux, "GET /settings/import", s.stubHandler("取込", "表示のみ（何を取り込めるかの説明に留める）。"))
	}

	if s.billing != nil {
		s.handle(mux, "GET /animals/{karte_no}/accounting", s.handleAccounting)
		s.handle(mux, "POST /animals/{karte_no}/accounting", s.handleAccounting)
		s.handle(mux, "GET /animals/{karte_no}/accounting/history", s.handleAccountingHistory)
		s.handle(mux, "GET /sales", s.handleSales)
		s.handle(mux, "GET /dm", s.handleDM)
		s.handle(mux, "GET /dm.csv", s.handleDMCSV)
	} else {
		s.handle(mux, "GET /sales", s.stubHandler("売上集計", "集計そのものは GET /api/sales/summary を参照。画面はこれから作り込む。"))
		s.handle(mux, "GET /dm", s.stubHandler("DM", "DM一覧はこれから作り込む。"))
	}

	// 全26画面の配線が完了。

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
