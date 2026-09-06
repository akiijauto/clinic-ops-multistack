package server

import "net/http"

import (
	"clinicops/internal/apperr"
	"clinicops/internal/billing"
)

// handleDM は DM画面（GET /dm）。
func (s *Server) handleDM(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.NotFound(w, r)
		return
	}
	f := dmFilterFromQuery(r)
	data := s.billing.DMScreenView(f)
	_ = s.views.RenderHTTP(w, http.StatusOK, "dm", data)
}

// handleDMCSV は DMのCSV書き出し（GET /dm.csv）。
// 画面と同じ DMRows を使う（絞り込みロジックを2箇所に書かない）。
func (s *Server) handleDMCSV(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.NotFound(w, r)
		return
	}
	f := dmFilterFromQuery(r)
	rows := s.billing.DMRows(f)
	body := billing.DMCSV(rows)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="dm.csv"`)
	w.WriteHeader(http.StatusOK)
	// spec/README.md「CSVの文字コード」: UTF-8はBOMつき、改行はCRLF。
	// 以前はBOM無し・LFのみで、Excelで開いたときの文字化けを防げていなかった
	// （レーンR 5巡目レビュー）。改行(CRLF)は billing.DMCSV 側で対応済み。
	_, _ = w.Write([]byte(billing.UTF8BOM))
	_, _ = w.Write([]byte(body))
}

func dmFilterFromQuery(r *http.Request) billing.DMFilter {
	q := r.URL.Query()
	return billing.DMFilter{
		Kind:  q.Get("type"),
		Field: q.Get("field"),
		From:  q.Get("from"),
		To:    q.Get("to"),
	}
}

// dmRowJSON は spec/openapi.yaml の DmRow スキーマに対応するJSON表現。
type dmRowJSON struct {
	KarteNo          string  `json:"karte_no"`
	OwnerNameKanji   string  `json:"owner_name_kanji"`
	PatientNameKanji string  `json:"patient_name_kanji"`
	Kind             *string `json:"kind"`
	NextDueDate      *string `json:"next_due_date"`
	PerformedDate    *string `json:"performed_date"`
}

func toDMRowJSON(r billing.DMRow) dmRowJSON {
	out := dmRowJSON{
		KarteNo:          r.KarteNo,
		OwnerNameKanji:   r.OwnerNameKanji,
		PatientNameKanji: r.PatientNameKanji,
		NextDueDate:      r.NextDueDate,
	}
	if r.Kind != "" {
		out.Kind = &r.Kind
	}
	if r.PerformedDate != "" {
		out.PerformedDate = &r.PerformedDate
	}
	return out
}

// handleAPIDM は GET /api/dm。
// 画面（GET /dm）・CSV書き出し（GET /dm.csv）と**同じ絞り込み**を使う
// （billing.Store.DMRows。ロジックを3箇所に書かない）。
func (s *Server) handleAPIDM(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	f := dmFilterFromQuery(r)
	rows := s.billing.DMRows(f)
	items := make([]dmRowJSON, len(rows))
	for i, row := range rows {
		items[i] = toDMRowJSON(row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

// handleSales は売上集計画面（GET /sales）。
// GET /api/sales/summary（既存 internal/server/sales_summary.go 相当）と
// 同じ Store.SalesSummary をそのまま使う（別計算をしない）。
func (s *Server) handleSales(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.NotFound(w, r)
		return
	}
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	data := s.billing.SalesView(from, to)
	_ = s.views.RenderHTTP(w, http.StatusOK, "sales", data)
}
