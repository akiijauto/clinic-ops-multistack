package settings

import "strings"

// PostalCandidate は /postal が返す住所候補1件。
type PostalCandidate struct {
	PostalCode string `json:"postal_code"`
	Address1   string `json:"address1"`
	Address2   string `json:"address2"`
}

// postalTable は郵便番号->住所の簡易対応（架空データのみ）。
//
// **仮決めしたこと**: 実在の郵便番号APIは課金・外部通信を避けるため使わない
// （coordination/DECISIONS.md 第3節）。data/ にも郵便番号の対応表が無いため、
// ごく少数の架空の対応をここへハードコードする。地名は data/seed.json の
// Clinic住所（架空の「みなも県すみれ市」）に倣い、実在しない地名だけを使う。
var postalTable = map[string]PostalCandidate{
	"9990001": {PostalCode: "999-0001", Address1: "みなも県すみれ市かえで町", Address2: "1丁目"},
	"9990012": {PostalCode: "999-0012", Address1: "みなも県すみれ市もみじ町", Address2: "2丁目"},
	"8880023": {PostalCode: "888-0023", Address1: "はるかぜ県こだま市さくら町", Address2: "3丁目"},
	"7770045": {PostalCode: "777-0045", Address1: "はるかぜ県こだま市ひばり町", Address2: ""},
}

// digitsOnly は郵便番号の入力からハイフン・空白を除いた数字だけを返す。
func digitsOnly(code string) string {
	var b strings.Builder
	for _, r := range code {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// LookupPostal は郵便番号から住所候補を引く。候補が無いときは空配列と理由を返す
// （spec/openapi.yaml /postal：「候補が無いときは candidates が空配列で、reason に理由」）。
func LookupPostal(code string) (candidates []PostalCandidate, reason string) {
	key := digitsOnly(code)
	if c, ok := postalTable[key]; ok {
		return []PostalCandidate{c}, ""
	}
	return []PostalCandidate{}, "該当する住所が見つかりません（この企画では架空の郵便番号を数件だけ持つ簡易対応です）。"
}
