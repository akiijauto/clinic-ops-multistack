package billing

import (
	"math"
	"sort"
	"strconv"
)

// Amounts は伝票1件ぶんの税抜合計・消費税額・税込合計・未算入行数。
// spec/acceptance.md「数値の規則」「消費税の計算順序」に従う。
type Amounts struct {
	TaxableSubtotal    int // 課税対象の税抜小計（丸め後）
	NontaxableSubtotal int // 非課税の税抜小計（丸め後）
	Net                int // 税抜合計 = TaxableSubtotal + NontaxableSubtotal
	Tax                int // 消費税額。課税対象額×税率を伝票につき1回だけ切り捨て
	Total              int // 税込合計 = Net + Tax
	ExcludedCount      int // unit_price 未設定で、上記のどの額にも含めなかった行数
}

// floorYen は円未満の切り捨て。浮動小数の誤差で 12.9999999 のような値が
// 11 に落ちないよう、ごく小さいイプシロンを足してから切り捨てる。
func floorYen(v float64) int {
	return int(math.Floor(v + 1e-9))
}

// BillingAmounts は1枚の伝票の額を計算する。存在しない ID なら ok=false。
//
// 手順（acceptance.md「消費税の計算順序」）:
//  1. unit_price が未設定の明細は除外し、件数だけ数える（0円として足さない）。
//  2. 明細小計（quantity×unit_price）は丸めずに合計する。
//  3. 税抜合計・非課税小計・消費税額は、表示する最後の1回だけ切り捨てる。
func (s *Store) BillingAmounts(id int) (Amounts, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.billings[id]; !ok {
		return Amounts{}, false
	}
	var taxableSum, nontaxableSum float64
	excluded := 0
	for _, d := range s.detailsByID[id] {
		up := s.unitPrice(d)
		if up == nil {
			excluded++
			continue
		}
		amount := d.Quantity * float64(*up)
		if d.taxable() {
			taxableSum += amount
		} else {
			nontaxableSum += amount
		}
	}
	rate := s.clinic.TaxRate

	taxable := floorYen(taxableSum)
	nontaxable := floorYen(nontaxableSum)
	tax := floorYen(taxableSum * rate) // 伝票につき1回だけ。明細ごとには丸めない
	net := taxable + nontaxable

	return Amounts{
		TaxableSubtotal:    taxable,
		NontaxableSubtotal: nontaxable,
		Net:                net,
		Tax:                tax,
		Total:              net + tax,
		ExcludedCount:      excluded,
	}, true
}

// SalesRow は売上集計の1行（分類別・担当別・日別のいずれか）。
type SalesRow struct {
	Key       string // 分類名 / スタッフID（文字列化） / 日付
	NetAmount int
	SharePct  float64 // by_category にのみ意味を持つ
}

// Summary は `/api/sales/summary` の中身。
// spec/openapi.yaml の SalesSummary（rows/total_amount 系）と、
// 共通テスト（tests/checks.py）が読む by_category/by_staff/by_date 系の
// 両方の形を満たすため、Server 側で JSON に組み立て直す前提の中間形として持つ。
type Summary struct {
	ByCategory               []SalesRow
	ByStaff                  []SalesRow
	ByDate                   []SalesRow
	Total                    int
	ExcludedDetailCountTotal int
}

// SalesSummary は対象期間（JST の暦日、両端含む）の税抜売上を3つの切り口で集計する。
// from/to が空文字なら、その側は無制限として扱う
// （coordination/qa/lane-a.md Q-A-08: 共通テストは from/to 無指定で呼ぶため）。
//
// 対象は Billing.status = "confirmed" のみ（spec/acceptance.md 検算1）。
func (s *Store) SalesSummary(from, to string) Summary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	catTotals := map[string]float64{}
	staffTotals := map[string]float64{}
	dateTotals := map[string]float64{}
	var grandTotal float64
	excludedTotal := 0

	for _, id := range s.billingOrder {
		b := s.billings[id]
		if b.Status != "confirmed" {
			continue
		}
		day := b.BilledOn
		if from != "" && day < from {
			continue
		}
		if to != "" && day > to {
			continue
		}

		for _, d := range s.detailsByID[id] {
			up := s.unitPrice(d)
			if up == nil {
				excludedTotal++
				continue
			}
			amount := d.Quantity * float64(*up)
			grandTotal += amount
			dateTotals[day] += amount
			staffTotals[staffKey(b.StaffID)] += amount
			if cat := s.categoryMajor(d); cat != "" {
				catTotals[cat] += amount
			}
		}
	}

	total := floorYen(grandTotal)

	return Summary{
		ByCategory:               shareRows(catTotals, grandTotal),
		ByStaff:                  plainRows(staffTotals),
		ByDate:                   plainRows(dateTotals),
		Total:                    total,
		ExcludedDetailCountTotal: excludedTotal,
	}
}

func staffKey(id *int) string {
	if id == nil {
		return ""
	}
	return strconv.Itoa(*id)
}

// plainRows は構成比を持たない内訳（担当別・日別）を、値の大きい順に並べて返す。
// 並び順は検算に影響しない（テストは合計だけを見る）が、応答を安定させるため決めておく。
func plainRows(totals map[string]float64) []SalesRow {
	rows := make([]SalesRow, 0, len(totals))
	for k, v := range totals {
		rows = append(rows, SalesRow{Key: k, NetAmount: floorYen(v)})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].NetAmount != rows[j].NetAmount {
			return rows[i].NetAmount > rows[j].NetAmount
		}
		return rows[i].Key < rows[j].Key
	})
	return rows
}

// shareRows は分類別の内訳を作り、構成比を最大剰余法で丸める
// （spec/acceptance.md「構成比の丸め」）。合計がちょうど100.0%になるようにする。
func shareRows(totals map[string]float64, grandTotal float64) []SalesRow {
	keys := make([]string, 0, len(totals))
	for k := range totals {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	rows := make([]SalesRow, len(keys))
	if grandTotal <= 0 {
		// 対象期間の税抜合計が0円のときは構成比の検算自体が対象外
		// （acceptance.md「構成比の丸め」4）。0.0のまま返す。
		for i, k := range keys {
			rows[i] = SalesRow{Key: k, NetAmount: floorYen(totals[k])}
		}
		return rows
	}

	type remainder struct {
		idx int
		rem float64
	}
	rems := make([]remainder, len(keys))
	flooredSum := 0.0
	for i, k := range keys {
		raw := totals[k] / grandTotal * 100
		floor10 := math.Floor(raw*10) / 10
		rows[i] = SalesRow{Key: k, NetAmount: floorYen(totals[k]), SharePct: floor10}
		rems[i] = remainder{idx: i, rem: raw - floor10}
		flooredSum += floor10
	}

	// 100.0 との差を 0.1 単位に直し、剰余が大きい順に配る。
	diffUnits := int(math.Round((100.0 - flooredSum) / 0.1))
	sort.SliceStable(rems, func(a, b int) bool { return rems[a].rem > rems[b].rem })
	for i := 0; i < diffUnits && i < len(rems); i++ {
		rows[rems[i].idx].SharePct = math.Round((rows[rems[i].idx].SharePct+0.1)*10) / 10
	}
	return rows
}
