package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/apperr"
)

// この節は「会計・売上」領域のうち、画面（HTML）のルートを受け持つ。
//
// internal/billing.Store は既存の GET /api/billings/{id}（internal/server/billing.go）
// と同じインスタンスを使う（s.billing）。画面と API で別々に Store を持つと、
// 会計画面で足した明細が API 側に反映されない食い違いが起きるため、
// 必ずこの1つを両方から使う。

// handleAccounting は会計画面（GET+POST /animals/{karte_no}/accounting）。
func (s *Server) handleAccounting(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")

	if r.Method == http.MethodPost {
		s.handleAccountingPost(w, r, karteNo)
		return
	}

	billingID, _ := strconv.Atoi(r.URL.Query().Get("slip"))
	data, err := s.billing.AccountingView(karteNo, billingID)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "accounting", data)
}

func (s *Server) handleAccountingPost(w http.ResponseWriter, r *http.Request, karteNo string) {
	_ = r.ParseForm()
	billingID, _ := strconv.Atoi(r.FormValue("billing_id"))
	action := r.FormValue("action")

	var opErr error
	var successMessage string

	switch action {
	case "add_detail":
		quantity, convErr := strconv.ParseFloat(r.FormValue("quantity"), 64)
		if convErr != nil {
			opErr = apperr.New(apperr.InvalidInput).WithDetails(
				apperr.Detail{Field: "quantity", Message: "数量は数値で入力してください。"},
			)
		} else {
			_, opErr = s.billing.AddDetail(billingID, r.FormValue("price_code"), quantity)
		}
	case "duplicate_detail":
		detailID, _ := strconv.Atoi(r.FormValue("detail_id"))
		_, opErr = s.billing.DuplicateDetail(billingID, detailID)
	case "remove_detail":
		detailID, _ := strconv.Atoi(r.FormValue("detail_id"))
		opErr = s.billing.RemoveDetail(billingID, detailID)
	case "clear_details":
		opErr = s.billing.ClearDetails(billingID)
	case "confirm":
		opErr = s.billing.ConfirmBilling(billingID)
		if opErr == nil {
			successMessage = "確定しました。"
		}
	default:
		opErr = apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "action", Message: "不明な操作です。"},
		)
	}

	data, viewErr := s.billing.AccountingView(karteNo, billingID)
	if viewErr != nil {
		http.NotFound(w, r)
		return
	}
	if opErr != nil {
		if ae, ok := opErr.(*apperr.Error); ok {
			data.ErrorMessage = ae.Message
		} else {
			data.ErrorMessage = apperr.Message(apperr.SaveFailed)
		}
	} else if successMessage != "" {
		data.SuccessMessage = successMessage
	}
	// 保存の成否によらず200のままフォームを再描画する
	// （spec/openapi.yaml「HTMLフォーム送信時のエラーの出し方」）。
	_ = s.views.RenderHTTP(w, http.StatusOK, "accounting", data)
}

// handleAccountingHistory は会計履歴（GET /animals/{karte_no}/accounting/history）。
func (s *Server) handleAccountingHistory(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")
	scope := r.URL.Query().Get("scope")
	data, err := s.billing.AccountingHistoryView(karteNo, scope)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "accounting_history", data)
}
