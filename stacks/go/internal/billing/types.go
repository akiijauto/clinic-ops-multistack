// Package billing は会計（Billing）と売上集計の計算を受け持つ。
//
// 保存の道具はまだ決めていない（internal/store/doc.go）。契約が凍っていない
// マスタ管理・保存系に手を出さず、まずは検算（spec/acceptance.md 検算1・2）が
// 通る最小限として、`data/` の合成データを読み込むだけの形にしてある。
// 書き込み（会計の確定・支払い記録）は保存先が決まってから足す。
package billing

// Clinic は病院の設定のうち、この計算に要る部分だけ。
type Clinic struct {
	TaxRate float64 `json:"tax_rate"`
}

// PriceItem は固定データ `data/price_items.json` の1行。
// 画面からは編集しない（spec/model.md「変わらないもの」）。
type PriceItem struct {
	PriceCode     string `json:"price_code"`
	Name          string `json:"name"`
	UnitPrice     *int   `json:"unit_price"` // 未設定の項目が意図的に混ざっている
	IsTaxable     bool   `json:"is_taxable"`
	CategoryMajor string `json:"category_major"`
	Category      string `json:"category"`
}

// categoryMajor は上位1階層の分類名。category_major が無ければ category で代える
// （spec/acceptance.md 検算1「分類は category_major と呼ぶ」）。
func (p PriceItem) categoryMajor() string {
	if p.CategoryMajor != "" {
		return p.CategoryMajor
	}
	return p.Category
}

// Billing は会計伝票（`data/seed.json` の `billings`）。
type Billing struct {
	ID             int     `json:"id"`
	PatientID      int     `json:"patient_id"`
	OwnerID        int     `json:"owner_id"`
	SlipNo         string  `json:"slip_no"`
	Status         string  `json:"status"` // "draft" | "confirmed"
	BilledOn       string  `json:"billed_on"`
	StaffID        *int    `json:"staff_id"`
	CashierStaffID *int    `json:"cashier_staff_id"`
	PaidAmount     *int    `json:"paid_amount"`
	PaymentMethod  *string `json:"payment_method"`
}

// BillingDetail は会計の明細行（`data/seed.json` の `billing_details`）。
type BillingDetail struct {
	ID        int     `json:"id"`
	BillingID int     `json:"billing_id"`
	RowNo     int     `json:"row_no"`
	PriceCode string  `json:"price_code"`
	Name      string  `json:"name"`
	Quantity  float64 `json:"quantity"`
	UnitPrice *int    `json:"unit_price"` // null がありうる。0円として扱わない
	IsTaxable bool    `json:"is_taxable"`
}

// seedFile は `data/seed.json` のうち、この計算に要る部分だけを読む。
// 他のキー（患者・診察等）は他の領域が契約に沿って別途読み込む前提で、ここでは無視する。
type seedFile struct {
	Clinic         Clinic          `json:"clinic"`
	Billings       []Billing       `json:"billings"`
	BillingDetails []BillingDetail `json:"billing_details"`
}
