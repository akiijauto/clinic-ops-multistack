package reception

// FoldedItem は「この企画では扱わない」と決めたものの1件
// （spec/model.md「落としたもの」表の1行に対応）。
type FoldedItem struct {
	Key       string // URLの {key} と画面内アンカーに使う
	Title     string
	Reason    string
	WhereSeen string // この企画のどこで見えるか
}

// FoldedItems は spec/model.md「落としたもの」表をそのまま列挙したもの。
// 項目数は表と完全に一致させること（spec/screens.md 画面7「満たすべきこと」）。
func FoldedItems() []FoldedItem {
	return []FoldedItem{
		{
			Key:       "hospital_division",
			Title:     "分院（hospital_division）",
			Reason:    "病院は1件だけ扱う。複数拠点は比較の題材にならない。",
			WhereSeen: "「本日の患者」画面の分院切り替えボタン",
		},
		{
			Key:       "clinic_feature",
			Title:     "ClinicFeature（機能の出し分け）",
			Reason:    "題材の運用固有の事情。他所で意味を持たない。",
			WhereSeen: "「機能設定」画面",
		},
		{
			Key:       "staff_position",
			Title:     "StaffPosition（役職マスタ）",
			Reason:    "Staff.role で足りる。",
			WhereSeen: "「スタッフ」画面",
		},
		{
			Key:       "karte_draft",
			Title:     "KarteDraft（書きかけの自動保存）",
			Reason:    "題材が「手で押す保存は作らない」と決めている。自動保存もこの企画では外す。",
			WhereSeen: "「カルテ」画面",
		},
		{
			Key:       "audit_log",
			Title:     "AuditLog（監査ログ）",
			Reason:    "業務では重要だが、5実装で比べる題材にはならない。",
			WhereSeen: "「来院履歴」画面",
		},
		{
			Key:       "karte_pdf",
			Title:     "KartePdf（紙カルテの取込）",
			Reason:    "ファイルの取り扱いが主題になってしまう。",
			WhereSeen: "「書類」画面",
		},
		{
			Key:       "lab_item_master",
			Title:     "LabItemMaster / LabRefRange / LabAgeBand",
			Reason:    "固定データへ移した。参照はする。編集画面は作らない。",
			WhereSeen: "「マスタ」画面",
		},
		{
			Key:       "billing_category_master",
			Title:     "BillingCategory / DepartmentMaster / PhraseMaster",
			Reason:    "固定データへ移した。参照はする。編集画面は作らない。",
			WhereSeen: "「マスタ」画面",
		},
		{
			Key:       "price_item_4_layer",
			Title:     "PriceItem の4階層分類",
			Reason:    "2階層に減らした。階層の深さは比較の題材にならない。",
			WhereSeen: "「会計」画面の料金項目ピッカー",
		},
		{
			Key:       "receipt_claim",
			Title:     "レセプト（保険請求）",
			Reason:    "制度の知識が要り、間違えると害がある。手を出さない。",
			WhereSeen: "「会計」「売上集計」画面",
		},
		{
			Key:       "clinic_setting_points",
			Title:     "病院設定のポイント",
			Reason:    "会員制度の設計が要る。5実装で比べる題材にならない。",
			WhereSeen: "「設定」画面",
		},
		{
			Key:       "clinic_setting_last_slip_no",
			Title:     "病院設定の最終伝票番号",
			Reason:    "伝票番号は Billing.slip_no が持つ。採番の続きを設定で持つのは運用移行のための仕組みで、新規に作るこの企画には要らない。",
			WhereSeen: "「設定」画面",
		},
		{
			Key:       "clinic_setting_institution_code",
			Title:     "病院設定の機関コード",
			Reason:    "保険請求で使う番号。レセプトを外したので使い道が無い。",
			WhereSeen: "「設定」画面",
		},
		{
			Key:       "clinic_setting_logo",
			Title:     "病院設定のロゴ画像",
			Reason:    "画像の取り扱いが主題になってしまう（紙カルテの取込を外したのと同じ理由）。",
			WhereSeen: "「設定」画面",
		},
	}
}
