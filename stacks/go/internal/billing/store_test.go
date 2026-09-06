package billing

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// newTestStore は最小限のデータで Store を組み立てる。
// 各テストが自分の検算に要る行だけを足せるよう、ここでは骨組みだけ用意する。
func newTestStore(t *testing.T, seed map[string]any, priceItems []map[string]any, masters map[string]any) *Store {
	t.Helper()
	dir := t.TempDir()
	writeJSON(t, filepath.Join(dir, "seed.json"), seed)
	writeJSON(t, filepath.Join(dir, "price_items.json"), priceItems)
	writeJSON(t, filepath.Join(dir, "masters.json"), masters)

	s, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return s
}

func writeJSON(t *testing.T, path string, v any) {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal %s: %v", path, err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func baseSeed() map[string]any {
	return map[string]any{
		"clinic": map[string]any{"tax_rate": 0.10},
		"owners": []map[string]any{
			{"id": 1, "owner_no": "O-00001", "name_kanji": "山田 太郎", "deleted_at": nil},
			{"id": 2, "owner_no": "O-00002", "name_kanji": "削除済み飼主", "deleted_at": "2026-01-01T00:00:00+09:00"},
		},
		"patients": []map[string]any{
			{"id": 10, "karte_no": "10010", "owner_id": 1, "name_kanji": "ポチ", "deleted_at": nil},
			{"id": 11, "karte_no": "10011", "owner_id": 1, "name_kanji": "タマ", "deleted_at": nil},
			{"id": 12, "karte_no": "10012", "owner_id": 2, "name_kanji": "削除済み動物", "deleted_at": nil},
		},
		"preventions":     []map[string]any{},
		"billings":        []map[string]any{},
		"billing_details": []map[string]any{},
	}
}

func basePriceItems() []map[string]any {
	return []map[string]any{
		{"price_code": "PR001", "name": "初診料", "unit_price": 1100, "is_taxable": true, "category_major": "診察料", "category": "診察料"},
		{"price_code": "PR002", "name": "非課税品", "unit_price": 500, "is_taxable": false, "category_major": "物品販売", "category": "物品販売"},
		{"price_code": "PR003", "name": "単価未設定", "unit_price": nil, "is_taxable": true, "category_major": "検査料", "category": "検査料"},
	}
}

func baseMasters() map[string]any {
	return map[string]any{
		"prevention_kinds": []map[string]any{
			{"code": "vaccine_core", "name": "混合ワクチン"},
			{"code": "deworming", "name": "内部寄生虫駆除"},
		},
	}
}

// --- 会計の額の計算 ---

func TestBillingAmounts_ExcludesUnsetUnitPriceAndFloorsTaxOnce(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "", "status": "draft", "billed_on": "2026-09-01"},
	}
	seed["billing_details"] = []map[string]any{
		// 課税: 1100 * 3 = 3300
		{"id": 1, "billing_id": 1, "row_no": 1, "price_code": "PR001", "name": "初診料", "quantity": 3, "unit_price": 1100, "is_taxable": true},
		// 非課税: 500 * 2 = 1000
		{"id": 2, "billing_id": 1, "row_no": 2, "price_code": "PR002", "name": "非課税品", "quantity": 2, "unit_price": 500, "is_taxable": false},
		// 単価未設定: 合計に入れない。1行として数える
		{"id": 3, "billing_id": 1, "row_no": 3, "price_code": "PR003", "name": "単価未設定", "quantity": 1, "unit_price": nil, "is_taxable": true},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	amounts, ok := s.BillingAmounts(1)
	if !ok {
		t.Fatal("billing 1 が見つからない")
	}
	if amounts.ExcludedCount != 1 {
		t.Errorf("ExcludedCount = %d, want 1", amounts.ExcludedCount)
	}
	if amounts.Net != 4300 {
		t.Errorf("Net = %d, want 4300", amounts.Net)
	}
	// 課税対象額3300 * 0.10 = 330（端数無し）
	if amounts.Tax != 330 {
		t.Errorf("Tax = %d, want 330", amounts.Tax)
	}
	if amounts.Total != 4630 {
		t.Errorf("Total = %d, want 4630", amounts.Total)
	}
}

func TestBillingAmounts_TaxFlooredOncePerBilling(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "", "status": "draft", "billed_on": "2026-09-01"},
	}
	// 課税対象 999 * 3 = 2997。2997*0.10=299.7 -> 切り捨て299。
	// 明細ごとに丸めると 999*0.10=99.9->99 が3行分=297 になり、伝票丸めの297と食い違う。
	seed["billing_details"] = []map[string]any{
		{"id": 1, "billing_id": 1, "row_no": 1, "price_code": "PR999", "name": "商品", "quantity": 3, "unit_price": 999, "is_taxable": true},
	}
	items := basePriceItems()
	items = append(items, map[string]any{"price_code": "PR999", "name": "商品", "unit_price": 999, "is_taxable": true, "category_major": "物品販売", "category": "物品販売"})
	s := newTestStore(t, seed, items, baseMasters())

	amounts, ok := s.BillingAmounts(1)
	if !ok {
		t.Fatal("billing 1 が見つからない")
	}
	if amounts.Tax != 299 {
		t.Errorf("Tax = %d, want 299 (伝票につき1回だけ切り捨て)", amounts.Tax)
	}
}

// --- 明細の追加・確定・確定後の禁止操作 ---

func TestAddDetail_SnapshotsMasterAndRejectsAfterConfirm(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "", "status": "draft", "billed_on": "2026-09-01"},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	d, err := s.AddDetail(1, "PR001", 2)
	if err != nil {
		t.Fatalf("AddDetail: %v", err)
	}
	if d.RowNo != 1 || d.Name != "初診料" || d.UnitPrice == nil || *d.UnitPrice != 1100 {
		t.Errorf("追加した明細の内容が期待と違う: %+v", d)
	}

	if err := s.ConfirmBilling(1); err != nil {
		t.Fatalf("ConfirmBilling: %v", err)
	}
	b, _ := s.Billing(1)
	if b.Status != "confirmed" {
		t.Errorf("Status = %q, want confirmed", b.Status)
	}
	if b.SlipNo == "" {
		t.Error("確定後の伝票番号が空のまま")
	}

	if _, err := s.AddDetail(1, "PR001", 1); err == nil {
		t.Error("確定済みの伝票に明細を追加できてしまった")
	}
	if err := s.RemoveDetail(1, d.ID); err == nil {
		t.Error("確定済みの伝票の明細を削除できてしまった")
	}
	if err := s.ClearDetails(1); err == nil {
		t.Error("確定済みの伝票を全削除できてしまった")
	}
}

func TestConfirmBilling_RejectsEmptyBilling(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "", "status": "draft", "billed_on": "2026-09-01"},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	if err := s.ConfirmBilling(1); err == nil {
		t.Error("明細が1行も無い伝票を確定できてしまった")
	}
}

func TestAccountingView_MatchesAccountingHistoryView(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "B-20260901-0001", "status": "confirmed", "billed_on": "2026-09-01"},
	}
	seed["billing_details"] = []map[string]any{
		{"id": 1, "billing_id": 1, "row_no": 1, "price_code": "PR001", "name": "初診料", "quantity": 1, "unit_price": 1100, "is_taxable": true},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	acc, err := s.AccountingView("10010", 1)
	if err != nil {
		t.Fatalf("AccountingView: %v", err)
	}
	hist, err := s.AccountingHistoryView("10010", "patient")
	if err != nil {
		t.Fatalf("AccountingHistoryView: %v", err)
	}
	if len(hist.Rows) != 1 {
		t.Fatalf("会計履歴の件数 = %d, want 1", len(hist.Rows))
	}
	row := hist.Rows[0]
	if row.NetAmount != acc.NetAmount || row.TaxAmount != acc.TaxAmount ||
		row.TotalAmount != acc.TotalAmount || row.ExcludedCount != acc.ExcludedCount {
		t.Errorf("会計画面と会計履歴で額が食い違う: 会計=%+v 履歴=%+v", acc, row)
	}
}

func TestAccountingHistoryView_ScopesAreNested(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "S1", "status": "confirmed", "billed_on": "2026-09-01"},
		{"id": 2, "patient_id": 11, "owner_id": 1, "slip_no": "S2", "status": "confirmed", "billed_on": "2026-09-02"},
		{"id": 3, "patient_id": 12, "owner_id": 2, "slip_no": "S3", "status": "confirmed", "billed_on": "2026-09-03"},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	patientScope, _ := s.AccountingHistoryView("10010", "patient")
	if len(patientScope.Rows) != 1 {
		t.Errorf("動物範囲の件数 = %d, want 1（他の動物の伝票が混ざっている）", len(patientScope.Rows))
	}
	ownerScope, _ := s.AccountingHistoryView("10010", "owner")
	if len(ownerScope.Rows) != 2 {
		t.Errorf("飼主範囲の件数 = %d, want 2", len(ownerScope.Rows))
	}
	allScope, _ := s.AccountingHistoryView("10010", "all")
	if len(allScope.Rows) != 3 {
		t.Errorf("全体範囲の件数 = %d, want 3", len(allScope.Rows))
	}
}

// --- DM ---

func TestDMRows_ExcludesMissingDueDateAndDeleted(t *testing.T) {
	seed := baseSeed()
	seed["preventions"] = []map[string]any{
		{"id": 1, "patient_id": 10, "kind": "vaccine_core", "content": "混合ワクチン", "performed_date": "2026-08-01", "next_due_date": "2026-09-01"},
		{"id": 2, "patient_id": 11, "kind": "vaccine_core", "content": "混合ワクチン", "performed_date": "2026-08-01", "next_due_date": nil},
		{"id": 3, "patient_id": 12, "kind": "vaccine_core", "content": "混合ワクチン", "performed_date": "2026-08-01", "next_due_date": "2026-09-05"},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	rows := s.DMRows(DMFilter{})
	if len(rows) != 1 {
		t.Fatalf("件数 = %d, want 1 (次回予定日なし・削除済み動物の飼主を除く)", len(rows))
	}
	if rows[0].KarteNo != "10010" {
		t.Errorf("残った行 = %+v, want karte_no 10010", rows[0])
	}
}

func TestDMRows_DateRangeInclusiveBothEnds(t *testing.T) {
	seed := baseSeed()
	seed["preventions"] = []map[string]any{
		{"id": 1, "patient_id": 10, "kind": "vaccine_core", "content": "", "performed_date": "2026-08-01", "next_due_date": "2026-09-01"},
		{"id": 2, "patient_id": 11, "kind": "vaccine_core", "content": "", "performed_date": "2026-08-01", "next_due_date": "2026-09-30"},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	rows := s.DMRows(DMFilter{From: "2026-09-01", To: "2026-09-30"})
	if len(rows) != 2 {
		t.Errorf("両端含む件数 = %d, want 2", len(rows))
	}
	rows = s.DMRows(DMFilter{From: "2026-09-02", To: "2026-09-29"})
	if len(rows) != 0 {
		t.Errorf("範囲外を除いた件数 = %d, want 0", len(rows))
	}
}

func TestDMCSV_CountMatchesScreenRows(t *testing.T) {
	seed := baseSeed()
	seed["preventions"] = []map[string]any{
		{"id": 1, "patient_id": 10, "kind": "vaccine_core", "content": "", "performed_date": "2026-08-01", "next_due_date": "2026-09-01"},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())
	view := s.DMScreenView(DMFilter{})
	csv := DMCSV(view.Rows)

	lines := 0
	for _, c := range csv {
		if c == '\n' {
			lines++
		}
	}
	// ヘッダ1行 + データ行
	if lines != view.Total+1 {
		t.Errorf("CSVの行数 = %d, 画面の件数(+ヘッダ) = %d", lines, view.Total+1)
	}
}

// --- 構成比の丸め ---

func TestSalesView_CategorySharesSumTo100(t *testing.T) {
	seed := baseSeed()
	seed["billings"] = []map[string]any{
		{"id": 1, "patient_id": 10, "owner_id": 1, "slip_no": "S1", "status": "confirmed", "billed_on": "2026-09-01", "staff_id": 5},
		{"id": 2, "patient_id": 11, "owner_id": 1, "slip_no": "S2", "status": "confirmed", "billed_on": "2026-09-01", "staff_id": 6},
		{"id": 3, "patient_id": 12, "owner_id": 2, "slip_no": "S3", "status": "draft", "billed_on": "2026-09-01", "staff_id": 6},
	}
	seed["billing_details"] = []map[string]any{
		{"id": 1, "billing_id": 1, "row_no": 1, "price_code": "PR001", "name": "初診料", "quantity": 1, "unit_price": 1100, "is_taxable": true},
		{"id": 2, "billing_id": 2, "row_no": 1, "price_code": "PR002", "name": "非課税品", "quantity": 3, "unit_price": 500, "is_taxable": false},
		// draft の伝票は売上に数えない
		{"id": 3, "billing_id": 3, "row_no": 1, "price_code": "PR001", "name": "初診料", "quantity": 100, "unit_price": 1100, "is_taxable": true},
	}
	s := newTestStore(t, seed, basePriceItems(), baseMasters())

	view := s.SalesView("2026-09-01", "2026-09-01")
	var catTotal int
	var shareSum float64
	for _, table := range view.Tables {
		if table.Axis != "category" {
			continue
		}
		for _, row := range table.Rows {
			catTotal += row.NetAmount
			shareSum += row.SharePct
		}
	}
	if catTotal != view.TotalAmount {
		t.Errorf("分類別合計 = %d, 総合計 = %d", catTotal, view.TotalAmount)
	}
	if shareSum != 100.0 {
		t.Errorf("構成比の合計 = %v, want 100.0", shareSum)
	}
	for _, table := range view.Tables {
		var axisTotal int
		for _, row := range table.Rows {
			axisTotal += row.NetAmount
		}
		if axisTotal != view.TotalAmount {
			t.Errorf("軸 %s の合計 = %d, 総合計 = %d（3表とも同じ総額であるべき）", table.Axis, axisTotal, view.TotalAmount)
		}
	}
}
