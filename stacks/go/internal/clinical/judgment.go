package clinical

// Judgment は検査項目1件の判定結果。
//
// spec/acceptance.md 検算5 の言い方に合わせ、Judgment は "" / "H" / "L" を持つ
// （openapi.yaml の `judgement` 列挙 low/normal/high/unknown とは別名。
// coordination/qa/lane-a.md Q-A-09 参照。共通テストが読む名前を主にしている）。
type Judgment struct {
	Value  string // "" | "H" | "L"
	Flag   string // "normal" | "high" | "low"（基準値が無いときは "unknown"）
	Low    *float64
	High   *float64
	HasRef bool
}

// Evaluate は検査項目1件の値を基準値と比べて判定する。
//
// - value_num が無い行（value_text のみ）は判定の対象外。
// - 基準値の組み合わせが無い項目は「判定なし」（不合格にしない — spec/acceptance.md 検算5）。
// - 範囲は両端を含む（min <= value <= max が「範囲内」）。
func (s *Store) Evaluate(item LabTestItem, species, sex string) Judgment {
	if item.ValueNum == nil {
		return Judgment{Flag: "unknown"}
	}
	ref, ok := s.RefRangeFor(item.ItemCode, species, sex)
	if !ok {
		return Judgment{Flag: "unknown"}
	}
	v := *item.ValueNum
	low, high := ref.Low, ref.High
	j := Judgment{Low: &low, High: &high, HasRef: true}
	switch {
	case v > high:
		j.Value = "H"
		j.Flag = "high"
	case v < low:
		j.Value = "L"
		j.Flag = "low"
	default:
		j.Value = ""
		j.Flag = "normal"
	}
	return j
}
