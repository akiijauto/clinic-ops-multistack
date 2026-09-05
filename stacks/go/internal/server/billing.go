package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/billing"
)

// billingAmountsJSON は `/api/billings/{id}` の応答に載せる、額に関する部分。
//
// 契約の書き方が2箇所で食い違っている（coordination/qa/lane-a.md Q-A-08）:
//   - spec/openapi.yaml の Billing スキーマは taxable_subtotal / nontaxable_subtotal /
//     total / excluded_detail_count という名前を要求する。
//   - 共通テスト（tests/checks.py）は net_amount / tax_amount / total_amount /
//     excluded_count という名前で読む。
//
// JSON は余分なキーがあっても壊れないため、**両方の名前を同時に返す**ことで
// どちらの文書とも矛盾しない形にした。値の意味は完全に同じ（同じ計算結果の別名）。
type billingAmountsJSON struct {
	ID                  int `json:"id"`
	TaxableSubtotal     int `json:"taxable_subtotal"`
	NontaxableSubtotal  int `json:"nontaxable_subtotal"`
	TaxAmount           int `json:"tax_amount"`
	Total               int `json:"total"`
	ExcludedDetailCount int `json:"excluded_detail_count"`

	// tests/checks.py が読む別名。
	NetAmount     int `json:"net_amount"`
	TotalAmount   int `json:"total_amount"`
	ExcludedCount int `json:"excluded_count"`
}

func (s *Server) handleGetBilling(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.NotFound(w, r)
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	amounts, ok := s.billing.BillingAmounts(id)
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, billingAmountsJSON{
		ID:                  id,
		TaxableSubtotal:     amounts.TaxableSubtotal,
		NontaxableSubtotal:  amounts.NontaxableSubtotal,
		TaxAmount:           amounts.Tax,
		Total:               amounts.Total,
		ExcludedDetailCount: amounts.ExcludedCount,
		NetAmount:           amounts.Net,
		TotalAmount:         amounts.Total,
		ExcludedCount:       amounts.ExcludedCount,
	})
}

// salesRowJSON は売上集計の1行。担当別・日別には share_pct を持たせない
// （spec/acceptance.md「構成比は分類別にのみ意味を持つ」）が、フィールド自体は
// 0のまま出しておいても検算には影響しない（テストは合計だけを見る）。
type salesRowJSON struct {
	Period    string  `json:"period"`
	NetAmount int     `json:"net_amount"`
	SharePct  float64 `json:"share_pct,omitempty"`
}

// salesSummaryJSON は `/api/sales/summary` の応答。
//
// こちらも Q-A-08 と同じ理由で2つの形を両方持たせている:
//   - openapi.yaml 側: rows / total_amount / excluded_detail_count_total
//   - tests/checks.py 側: by_category / by_staff / by_date / total（total_net_amount）
type salesSummaryJSON struct {
	From                     string `json:"from"`
	To                       string `json:"to"`
	TotalAmount              int    `json:"total_amount"`
	ExcludedDetailCountTotal int    `json:"excluded_detail_count_total"`

	Total          int            `json:"total"`
	TotalNetAmount int            `json:"total_net_amount"`
	ByCategory     []salesRowJSON `json:"by_category"`
	ByStaff        []salesRowJSON `json:"by_staff"`
	ByDate         []salesRowJSON `json:"by_date"`
}

func (s *Server) handleSalesSummary(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		writeJSON(w, http.StatusOK, salesSummaryJSON{})
		return
	}
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	sum := s.billing.SalesSummary(from, to)

	writeJSON(w, http.StatusOK, salesSummaryJSON{
		From:                     from,
		To:                       to,
		TotalAmount:              sum.Total,
		ExcludedDetailCountTotal: sum.ExcludedDetailCountTotal,
		Total:                    sum.Total,
		TotalNetAmount:           sum.Total,
		ByCategory:               toRows(sum.ByCategory, true),
		ByStaff:                  toRows(sum.ByStaff, false),
		ByDate:                   toRows(sum.ByDate, false),
	})
}

// toRows は billing.SalesRow を JSON 用の行へ変換する。
// withShare が false の軸（担当別・日別）では share_pct を常に0にする
// （構成比は分類別にのみ意味を持つ）。
func toRows(rows []billing.SalesRow, withShare bool) []salesRowJSON {
	out := make([]salesRowJSON, len(rows))
	for i, r := range rows {
		row := salesRowJSON{Period: r.Key, NetAmount: r.NetAmount}
		if withShare {
			row.SharePct = r.SharePct
		}
		out[i] = row
	}
	return out
}
