package billing

import "sort"

// sortBillingsDesc は伝票を billed_on 降順（同日なら id 降順）に安定させる。
// 会計履歴の3範囲（動物・飼主・全体）すべてで同じ並びの規則を使う。
func sortBillingsDesc(rows []Billing) {
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].BilledOn != rows[j].BilledOn {
			return rows[i].BilledOn > rows[j].BilledOn
		}
		return rows[i].ID > rows[j].ID
	})
}

// sortPriceItems は料金マスタを分類・項目名の順に安定させる（画面のピッカー用）。
func sortPriceItems(items []PriceItem) {
	sort.Slice(items, func(i, j int) bool {
		ci, cj := items[i].categoryMajor(), items[j].categoryMajor()
		if ci != cj {
			return ci < cj
		}
		if items[i].PriceCode != items[j].PriceCode {
			return items[i].PriceCode < items[j].PriceCode
		}
		return items[i].Name < items[j].Name
	})
}
