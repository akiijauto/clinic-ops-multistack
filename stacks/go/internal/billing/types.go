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

// Owner は飼主。会計・DM画面の表示（氏名・削除有無）にだけ要るので、
// internal/reception が持つであろう完全な形とは別に、この範囲だけを
// 自前で読む（internal/clinical が Patient を自前で持つのと同じ考え方）。
type Owner struct {
	ID        int     `json:"id"`
	OwnerNo   string  `json:"owner_no"`
	NameKanji string  `json:"name_kanji"`
	DeletedAt *string `json:"deleted_at"`
}

// Patient は動物。会計・DM画面の表示にだけ要る範囲。
type Patient struct {
	ID        int     `json:"id"`
	KarteNo   string  `json:"karte_no"`
	OwnerID   int     `json:"owner_id"`
	NameKanji string  `json:"name_kanji"`
	DeletedAt *string `json:"deleted_at"`
}

// Prevention は予防の実施記録（`data/seed.json` の `preventions`）。
// DM画面（次回予定日をもとにした案内対象の検索）が読む。
type Prevention struct {
	ID            int     `json:"id"`
	PatientID     int     `json:"patient_id"`
	Kind          string  `json:"kind"` // data/masters.json prevention_kinds の code
	Content       string  `json:"content"`
	PerformedDate string  `json:"performed_date"`
	NextDueDate   *string `json:"next_due_date"` // 未設定がありうる（DM対象から外れる）
}

// PreventionKind は `data/masters.json` の `prevention_kinds` の1行。
// 画面からは編集しない（spec/model.md「変わらないもの」）。
type PreventionKind struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// mastersFile は `data/masters.json` のうち、この計算に要る部分だけを読む。
type mastersFile struct {
	PreventionKinds []PreventionKind `json:"prevention_kinds"`
}

// seedFile は `data/seed.json` のうち、この計算に要る部分だけを読む。
// 他のキー（診察等）は他の領域が契約に沿って別途読み込む前提で、ここでは無視する。
type seedFile struct {
	Clinic         Clinic          `json:"clinic"`
	Owners         []Owner         `json:"owners"`
	Patients       []Patient       `json:"patients"`
	Preventions    []Prevention    `json:"preventions"`
	Billings       []Billing       `json:"billings"`
	BillingDetails []BillingDetail `json:"billing_details"`
}
