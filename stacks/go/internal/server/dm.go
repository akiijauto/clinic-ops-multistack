package server

import "net/http"

import "clinicops/internal/billing"

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
