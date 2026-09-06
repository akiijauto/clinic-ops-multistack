package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"clinicops/internal/apperr"
	"clinicops/internal/billing"
)

// この節は「会計・売上」領域の残りのデータのルート（伝票の一覧・作成・変更）を
// 持つ。既存の `GET /api/billings/{id}`（internal/server/billing.go）は
// 額の計算だけを返す最小実装のまま残し、ここでは spec/openapi.yaml の
// Billing スキーマに沿ったフル表現（details を含む）を新規に組み立てる。

type billingDetailJSON struct {
	ID        int     `json:"id"`
	BillingID int     `json:"billing_id"`
	RowNo     int     `json:"row_no"`
	PriceCode string  `json:"price_code"`
	Name      string  `json:"name"`
	Quantity  float64 `json:"quantity"`
	UnitPrice *int    `json:"unit_price"`
	IsTaxable bool    `json:"is_taxable"`
	Amount    *int    `json:"amount"`
}

type billingJSON struct {
	ID                  int                 `json:"id"`
	PatientID           int                 `json:"patient_id"`
	OwnerID             int                 `json:"owner_id"`
	SlipNo              string              `json:"slip_no"`
	Status              string              `json:"status"`
	BilledOn            string              `json:"billed_on"`
	StaffID             *int                `json:"staff_id"`
	CashierStaffID      *int                `json:"cashier_staff_id"`
	PaidAmount          *int                `json:"paid_amount"`
	PaymentMethod       *string             `json:"payment_method"`
	Details             []billingDetailJSON `json:"details"`
	TaxableSubtotal     int                 `json:"taxable_subtotal"`
	NontaxableSubtotal  int                 `json:"nontaxable_subtotal"`
	TaxAmount           int                 `json:"tax_amount"`
	Total               int                 `json:"total"`
	ExcludedDetailCount int                 `json:"excluded_detail_count"`
}

// buildBillingJSON は Billing を契約どおりのフル表現（details・4種の集計込み）に
// 組み立てる。額の計算は internal/billing.Store.BillingAmounts をそのまま使う
// （画面・他のAPIと同じ計算結果——別計算をしない）。
func (s *Server) buildBillingJSON(b billing.Billing) billingJSON {
	details := s.billing.BillingDetails(b.ID)
	amounts, _ := s.billing.BillingAmounts(b.ID)
	out := make([]billingDetailJSON, len(details))
	for i, d := range details {
		var amount *int
		if d.UnitPrice != nil {
			v := int(d.Quantity * float64(*d.UnitPrice))
			amount = &v
		}
		out[i] = billingDetailJSON{
			ID: d.ID, BillingID: d.BillingID, RowNo: d.RowNo, PriceCode: d.PriceCode,
			Name: d.Name, Quantity: d.Quantity, UnitPrice: d.UnitPrice, IsTaxable: d.IsTaxable, Amount: amount,
		}
	}
	return billingJSON{
		ID: b.ID, PatientID: b.PatientID, OwnerID: b.OwnerID, SlipNo: b.SlipNo,
		Status: b.Status, BilledOn: b.BilledOn, StaffID: b.StaffID, CashierStaffID: b.CashierStaffID,
		PaidAmount: b.PaidAmount, PaymentMethod: b.PaymentMethod, Details: out,
		TaxableSubtotal: amounts.TaxableSubtotal, NontaxableSubtotal: amounts.NontaxableSubtotal,
		TaxAmount: amounts.Tax, Total: amounts.Total, ExcludedDetailCount: amounts.ExcludedCount,
	}
}

func writeBillingErr(w http.ResponseWriter, err error) {
	if ae, ok := err.(*apperr.Error); ok {
		apperr.Write(w, ae)
		return
	}
	apperr.Write(w, apperr.New(apperr.SaveFailed))
}

// handleAPIListBillings は GET /api/billings（病院全体）。
func (s *Server) handleAPIListBillings(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		writeJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0})
		return
	}
	from, to := r.URL.Query().Get("from"), r.URL.Query().Get("to")
	all := s.billing.AllBillings()
	items := make([]billingJSON, 0, len(all))
	for _, b := range all {
		if from != "" && b.BilledOn < from {
			continue
		}
		if to != "" && b.BilledOn > to {
			continue
		}
		items = append(items, s.buildBillingJSON(b))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

type billingCreateJSON struct {
	BilledOn       string  `json:"billed_on"`
	Status         string  `json:"status"`
	StaffID        *int    `json:"staff_id"`
	CashierStaffID *int    `json:"cashier_staff_id"`
	PaidAmount     *int    `json:"paid_amount"`
	PaymentMethod  *string `json:"payment_method"`
	Details        []struct {
		PriceCode string  `json:"price_code"`
		Name      string  `json:"name"`
		Quantity  float64 `json:"quantity"`
		UnitPrice *int    `json:"unit_price"`
		IsTaxable bool    `json:"is_taxable"`
	} `json:"details"`
}

// handleAPIPatientBillings は GET/POST /api/patients/{karte_no}/billings。
func (s *Server) handleAPIPatientBillings(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.billing.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if r.Method == http.MethodGet {
		rows := s.billing.BillingsForPatient(patient.ID)
		items := make([]billingJSON, len(rows))
		for i, b := range rows {
			items[i] = s.buildBillingJSON(b)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
		return
	}

	var in billingCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	created, err := s.billing.CreateDraftBilling(patient.ID)
	if err != nil {
		writeBillingErr(w, err)
		return
	}
	for _, d := range in.Details {
		if _, addErr := s.billing.AddDetail(created.ID, d.PriceCode, d.Quantity); addErr != nil {
			writeBillingErr(w, addErr)
			return
		}
	}
	if in.PaidAmount != nil || in.PaymentMethod != nil {
		if err := s.billing.RecordPayment(created.ID, in.PaidAmount, in.PaymentMethod, in.CashierStaffID); err != nil {
			writeBillingErr(w, err)
			return
		}
	}
	if in.Status == "confirmed" {
		if err := s.billing.ConfirmBilling(created.ID); err != nil {
			writeBillingErr(w, err)
			return
		}
	}
	final, _ := s.billing.Billing(created.ID)
	writeJSON(w, http.StatusCreated, s.buildBillingJSON(final))
}

// handleAPIOwnerBillings は GET /api/owners/{owner_no}/billings。
func (s *Server) handleAPIOwnerBillings(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	o, ok := s.billing.OwnerByNo(r.PathValue("owner_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	rows := s.billing.BillingsForOwner(o.ID)
	items := make([]billingJSON, len(rows))
	for i, b := range rows {
		items[i] = s.buildBillingJSON(b)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

// handleAPIPatchBilling は PATCH /api/billings/{id}（支払い記録・確定など）。
func (s *Server) handleAPIPatchBilling(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if _, ok := s.billing.Billing(id); !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in billingCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	if in.PaidAmount != nil || in.PaymentMethod != nil || in.CashierStaffID != nil {
		if err := s.billing.RecordPayment(id, in.PaidAmount, in.PaymentMethod, in.CashierStaffID); err != nil {
			writeBillingErr(w, err)
			return
		}
	}
	if in.Status == "confirmed" {
		if err := s.billing.ConfirmBilling(id); err != nil {
			writeBillingErr(w, err)
			return
		}
	}
	final, _ := s.billing.Billing(id)
	writeJSON(w, http.StatusOK, s.buildBillingJSON(final))
}
