package billing

import (
	"clinicops/internal/apperr"
)

// この節は画面（HTML）テンプレートへそのまま渡せる形（View）を組み立てる。
// 「同じ数字を、違う経路で出して突き合わせる」（spec/acceptance.md）を守るため、
// 金額はすべて BillingAmounts / SalesSummary の計算結果をそのまま使い、
// ここでは並び替え・表示用ラベルの付与だけを行う（別計算をしない）。

// AccountingDetailView は会計画面の明細1行。
type AccountingDetailView struct {
	ID        int
	RowNo     int
	PriceCode string
	Name      string
	Quantity  float64
	UnitPrice *int // nil = 未設定（0円として出さない）
	IsTaxable bool
	Amount    *int // Quantity*UnitPrice。UnitPrice が nil なら nil
}

// AccountingCategoryView は料金ピッカーの分類1つぶん。
type AccountingCategoryView struct {
	Category string
	Items    []PriceItem
}

// AccountingView は会計画面（spec/screens.md 14）にそのまま渡す形。
type AccountingView struct {
	KarteNo    string
	PatientNo  string
	OwnerName  string
	OwnerNo    string
	BillingID  int
	SlipNo     string
	Status     string
	BilledOn   string
	Details    []AccountingDetailView
	Categories []AccountingCategoryView

	NetAmount     int
	TaxAmount     int
	TotalAmount   int
	ExcludedCount int

	ErrorMessage   string
	SuccessMessage string
}

// AccountingView は karte_no と（あれば）billingID から会計画面のデータを組み立てる。
// billingID が 0 のときは、その動物の draft 伝票を開くか、無ければ新規に作る
// （spec/screens.md 14「指定が無ければ当日の draft を開くか新規に作る」）。
func (s *Store) AccountingView(karteNo string, billingID int) (AccountingView, error) {
	patient, ok := s.PatientByKarteNo(karteNo)
	if !ok {
		return AccountingView{}, apperr.New(apperr.NotFound)
	}

	var b Billing
	if billingID != 0 {
		found, ok := s.Billing(billingID)
		if !ok || found.PatientID != patient.ID {
			return AccountingView{}, apperr.New(apperr.NotFound)
		}
		b = found
	} else {
		pending, ok := s.PendingBillingForPatient(patient.ID)
		if !ok {
			created, err := s.CreateDraftBilling(patient.ID)
			if err != nil {
				return AccountingView{}, err
			}
			b = created
		} else {
			b = pending
		}
	}

	owner, _ := s.OwnerByID(b.OwnerID)
	amounts, _ := s.BillingAmounts(b.ID)
	details := s.BillingDetails(b.ID)

	views := make([]AccountingDetailView, len(details))
	for i, d := range details {
		var amount *int
		if d.UnitPrice != nil {
			v := int(d.Quantity * float64(*d.UnitPrice))
			amount = &v
		}
		views[i] = AccountingDetailView{
			ID:        d.ID,
			RowNo:     d.RowNo,
			PriceCode: d.PriceCode,
			Name:      d.Name,
			Quantity:  d.Quantity,
			UnitPrice: d.UnitPrice,
			IsTaxable: d.IsTaxable,
			Amount:    amount,
		}
	}

	return AccountingView{
		KarteNo:       patient.KarteNo,
		PatientNo:     patient.NameKanji,
		OwnerName:     owner.NameKanji,
		OwnerNo:       owner.OwnerNo,
		BillingID:     b.ID,
		SlipNo:        b.SlipNo,
		Status:        b.Status,
		BilledOn:      b.BilledOn,
		Details:       views,
		Categories:    s.priceCategories(),
		NetAmount:     amounts.Net,
		TaxAmount:     amounts.Tax,
		TotalAmount:   amounts.Total,
		ExcludedCount: amounts.ExcludedCount,
	}, nil
}

// priceCategories は料金マスタを分類（上位1階層）ごとにまとめる。
func (s *Store) priceCategories() []AccountingCategoryView {
	items := s.PriceItems() // categoryMajor→price_code順に整列済み
	var out []AccountingCategoryView
	for _, it := range items {
		cat := it.categoryMajor()
		if len(out) == 0 || out[len(out)-1].Category != cat {
			out = append(out, AccountingCategoryView{Category: cat})
		}
		out[len(out)-1].Items = append(out[len(out)-1].Items, it)
	}
	return out
}

// AccountingHistoryRow は会計履歴の1行。
type AccountingHistoryRow struct {
	BillingID     int
	SlipNo        string
	Status        string
	BilledOn      string
	PatientName   string
	OwnerName     string
	IsCurrent     bool // 現在開いている動物の行かどうか（飼主・全体範囲での目印）
	NetAmount     int
	TaxAmount     int
	TotalAmount   int
	ExcludedCount int
}

// AccountingHistoryView は会計履歴画面（spec/screens.md 15）にそのまま渡す形。
type AccountingHistoryView struct {
	KarteNo string
	Scope   string // "patient" | "owner" | "all"
	Rows    []AccountingHistoryRow
}

// AccountingHistoryView は範囲（scope）に応じた伝票一覧を組み立てる。
// 空文字・未知の値は "patient"（既定）として扱う。
func (s *Store) AccountingHistoryView(karteNo, scope string) (AccountingHistoryView, error) {
	patient, ok := s.PatientByKarteNo(karteNo)
	if !ok {
		return AccountingHistoryView{}, apperr.New(apperr.NotFound)
	}

	var billings []Billing
	switch scope {
	case "owner":
		billings = s.BillingsForOwner(patient.OwnerID)
	case "all":
		billings = s.AllBillings()
	default:
		scope = "patient"
		billings = s.BillingsForPatient(patient.ID)
	}

	rows := make([]AccountingHistoryRow, len(billings))
	for i, b := range billings {
		p, _ := s.PatientByID(b.PatientID)
		o, _ := s.OwnerByID(b.OwnerID)
		amounts, _ := s.BillingAmounts(b.ID)
		rows[i] = AccountingHistoryRow{
			BillingID:     b.ID,
			SlipNo:        b.SlipNo,
			Status:        b.Status,
			BilledOn:      b.BilledOn,
			PatientName:   p.NameKanji,
			OwnerName:     o.NameKanji,
			IsCurrent:     b.PatientID == patient.ID,
			NetAmount:     amounts.Net,
			TaxAmount:     amounts.Tax,
			TotalAmount:   amounts.Total,
			ExcludedCount: amounts.ExcludedCount,
		}
	}

	return AccountingHistoryView{KarteNo: karteNo, Scope: scope, Rows: rows}, nil
}

// SalesRowView は売上集計の1行。
type SalesRowView struct {
	Key       string
	NetAmount int
	SharePct  float64
	HasShare  bool // 分類別の行にだけ true（構成比は分類別にのみ意味を持つ）
}

// SalesTableView は3方向（分類別・担当別・日別）のうちの1つ。
type SalesTableView struct {
	Axis string // "category" | "staff" | "date"
	Rows []SalesRowView
}

// SalesView は売上集計画面（spec/screens.md 17）にそのまま渡す形。
type SalesView struct {
	From          string
	To            string
	Tables        []SalesTableView
	TotalAmount   int
	ExcludedCount int
}

// SalesView は Store.SalesSummary をそのまま画面用の形に写す（別計算をしない）。
func (s *Store) SalesView(from, to string) SalesView {
	sum := s.SalesSummary(from, to)
	return SalesView{
		From: from,
		To:   to,
		Tables: []SalesTableView{
			{Axis: "category", Rows: toSalesRowViews(sum.ByCategory, true)},
			{Axis: "staff", Rows: toSalesRowViews(sum.ByStaff, false)},
			{Axis: "date", Rows: toSalesRowViews(sum.ByDate, false)},
		},
		TotalAmount:   sum.Total,
		ExcludedCount: sum.ExcludedDetailCountTotal,
	}
}

func toSalesRowViews(rows []SalesRow, hasShare bool) []SalesRowView {
	out := make([]SalesRowView, len(rows))
	for i, r := range rows {
		out[i] = SalesRowView{Key: r.Key, NetAmount: r.NetAmount, SharePct: r.SharePct, HasShare: hasShare}
	}
	return out
}

// DMScreenView は DM画面（spec/screens.md 16）にそのまま渡す形。
type DMScreenView struct {
	Kind  string
	Field string
	From  string
	To    string
	Rows  []DMRow
	Total int
}

// DMScreenView は DMRows を画面向けの形にまとめる（CSVも同じ DMRows を使う —
// 画面とCSVの件数・並びを一致させるため、絞り込みロジックを2箇所に書かない）。
func (s *Store) DMScreenView(f DMFilter) DMScreenView {
	rows := s.DMRows(f)
	return DMScreenView{
		Kind:  f.Kind,
		Field: f.normalizedField(),
		From:  f.From,
		To:    f.To,
		Rows:  rows,
		Total: len(rows),
	}
}
