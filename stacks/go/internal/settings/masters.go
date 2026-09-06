package settings

import (
	"fmt"
	"sort"
)

// MasterItem はマスタ一覧の1行。JSON では code/label が必須で、
// それ以外は自由（spec/openapi.yaml `additionalProperties: true`）。
// Detail はこの領域が付け足す補足列（一覧画面の表示用）。
type MasterItem struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Detail string `json:"detail,omitempty"`
}

// masterCategories はこの契約が扱うマスタの語彙（spec/openapi.yaml MasterKey）。
// 順序は「マスタ」画面のカテゴリ切り替えに使う既定の並び。
var masterCategories = []string{
	"price_item",
	"lab_item",
	"reception_kind",
	"prevention_kind",
	"department",
	"phrase",
}

// defaultMasterKey は /settings/master（key指定なし）で使う既定のカテゴリ。
const defaultMasterKey = "price_item"

// phraseCategoryLabels は data/masters.json の phrases のキーを
// 画面表示用の日本語名へ対応させる。
var phraseCategoryLabels = map[string]string{
	"chief_complaint": "主訴",
	"symptom":         "症状",
	"diagnosis":       "診断",
	"treatment":       "処置",
}

// Items はカテゴリ key に属するマスタ項目を返す。未知の key は
// (nil, false)。
func (s *Store) MasterItems(key string) ([]MasterItem, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	switch key {
	case "price_item":
		out := make([]MasterItem, 0, len(s.priceItems))
		for _, p := range s.priceItems {
			price := "未設定"
			if p.UnitPrice != nil {
				price = fmt.Sprintf("¥%d", *p.UnitPrice)
			}
			tax := "課税"
			if !p.IsTaxable {
				tax = "非課税"
			}
			out = append(out, MasterItem{
				Code:   p.PriceCode,
				Label:  p.Name,
				Detail: fmt.Sprintf("分類:%s 単価:%s 区分:%s", p.Category, price, tax),
			})
		}
		return out, true

	case "lab_item":
		out := make([]MasterItem, 0, len(s.labItems))
		for _, it := range s.labItems {
			out = append(out, MasterItem{
				Code:   it.ItemCode,
				Label:  it.Name,
				Detail: fmt.Sprintf("分類:%s 単位:%s", it.Category, it.Unit),
			})
		}
		return out, true

	case "reception_kind":
		return masterEntriesToItems(s.masters.ReceptionKinds), true

	case "prevention_kind":
		return masterEntriesToItems(s.masters.PreventionKinds), true

	case "department":
		return masterEntriesToItems(s.masters.Departments), true

	case "phrase":
		return s.phraseItems(), true

	default:
		return nil, false
	}
}

func masterEntriesToItems(entries []masterEntry) []MasterItem {
	out := make([]MasterItem, 0, len(entries))
	for _, e := range entries {
		out = append(out, MasterItem{Code: e.Code, Label: e.Name})
	}
	return out
}

// phraseItems は data/masters.json の phrases（カテゴリ -> 定型文の配列。
// code を持たない生のリスト）を、他カテゴリと同じ code/label 形へ組み立てる。
//
// **仮決めしたこと**: 元データに code が無いため、
// "<カテゴリ>-<連番>" を code として合成する。
func (s *Store) phraseItems() []MasterItem {
	categories := make([]string, 0, len(s.masters.Phrases))
	for cat := range s.masters.Phrases {
		categories = append(categories, cat)
	}
	sort.Strings(categories)

	out := make([]MasterItem, 0)
	for _, cat := range categories {
		label := phraseCategoryLabels[cat]
		if label == "" {
			label = cat
		}
		for i, text := range s.masters.Phrases[cat] {
			out = append(out, MasterItem{
				Code:   fmt.Sprintf("%s-%02d", cat, i+1),
				Label:  text,
				Detail: label,
			})
		}
	}
	return out
}

// FeatureNotes はこの企画で扱わないと決めた機能の説明一覧
// （spec/model.md「落としたもの」がそのまま元データ。screens.md 23章
// 「機能設定」・「折りたたみ表示」で共有する）。
//
// 個々の画面のボタン単位の理由（②ToDo・kind="todo"）は各領域が持つため、
// ここには含めない。ここに置くのは一覧向け（③折りたたみ表示・kind="folded"）だけ。
func FeatureNotes() []FeatureNote {
	return []FeatureNote{
		{Key: "hospital_division", Kind: "folded", Title: "分院",
			Message: "病院は1件だけ扱う。複数拠点は比較の題材にならないため、この企画では扱わない。"},
		{Key: "clinic_feature", Kind: "folded", Title: "機能の出し分け",
			Message: "運用固有の事情であり、他所では意味を持たないため、この企画では扱わない。"},
		{Key: "staff_position", Kind: "folded", Title: "役職マスタ",
			Message: "スタッフの役割区分で足りるため、この企画では別マスタを持たない。"},
		{Key: "karte_draft", Kind: "folded", Title: "書きかけの自動保存",
			Message: "手で押す保存だけを扱う方針のため、この企画では自動保存を持たない。"},
		{Key: "audit_log", Kind: "folded", Title: "監査ログ",
			Message: "業務では重要だが、5つの実装を比べる題材にはならないため、この企画では扱わない。"},
		{Key: "karte_pdf", Kind: "folded", Title: "紙カルテの取込",
			Message: "ファイルの取り扱いが主題になってしまうため、この企画では扱わない。"},
		{Key: "lab_item_master", Kind: "folded", Title: "検査基準値マスタの編集",
			Message: "固定データへ移した。参照はできるが、編集する画面は作らない。"},
		{Key: "billing_category_master", Kind: "folded", Title: "会計分類・診療科・定型文マスタの編集",
			Message: "固定データへ移した。参照はできるが、編集する画面は作らない。"},
		{Key: "price_item_hierarchy", Kind: "folded", Title: "料金分類の4階層",
			Message: "2階層に減らした。階層の深さは比較の題材にならないため。"},
		{Key: "receipt", Kind: "folded", Title: "レセプト（保険請求）",
			Message: "制度の知識が要り、間違えると害があるため、この企画では扱わない。"},
		{Key: "clinic_point", Kind: "folded", Title: "病院設定のポイント（会員制度）",
			Message: "会員制度の設計が要り、比較の題材にならないため、この企画では扱わない。"},
		{Key: "clinic_last_slip_no", Kind: "folded", Title: "病院設定の最終伝票番号",
			Message: "伝票番号は会計データ自身が持つ。採番の続きを設定で持つのは運用移行のための仕組みで、新規に作るこの企画には要らない。"},
		{Key: "clinic_org_code", Kind: "folded", Title: "病院設定の機関コード",
			Message: "保険請求で使う番号。レセプトを扱わないため使い道が無い。"},
		{Key: "clinic_logo", Kind: "folded", Title: "病院設定のロゴ画像",
			Message: "画像の取り扱いが主題になってしまうため、この企画では扱わない。"},
	}
}
