// Package settings は領域5「設定」（設定・機能設定・取込・マスタ・
// このシステムについて）を受け持つ。
//
// マスタ管理は一覧・参照のみで、編集画面は作らない（spec/README.md
// 「マスタ管理の画面：一覧と参照は作る。編集は作らない」）。
// 「機能設定」「取込」も表示のみ。実際に保存できるのは「設定」画面
// （Clinic）だけである。
package settings

// Clinic は病院設定（data/seed.json の "clinic"、spec/model.md 1章）。
// 1件だけ存在する。複数病院・分院は扱わない。
type Clinic struct {
	ID                     int     `json:"id"`
	Name                   string  `json:"name"`
	PostalCode             string  `json:"postal_code"`
	Address1               string  `json:"address1"`
	Address2               string  `json:"address2"`
	Phone                  string  `json:"phone"`
	Fax                    string  `json:"fax"`
	DirectorName           string  `json:"director_name"`
	ReservationSlotMinutes int     `json:"reservation_slot_minutes"`
	TaxRate                float64 `json:"tax_rate"`
	ClosedWeekdays         []int   `json:"closed_weekdays"`
}

// PriceItem は料金マスタ1件（data/price_items.json）。
// UnitPrice は未設定の項目が意図的に混在する（spec/model.md「変わらないもの」）。
type PriceItem struct {
	PriceCode     string `json:"price_code"`
	Name          string `json:"name"`
	UnitPrice     *int   `json:"unit_price"`
	IsTaxable     bool   `json:"is_taxable"`
	CategoryMajor string `json:"category_major"`
	Category      string `json:"category"`
}

// LabItem は検査項目マスタ1件（data/lab_items.json）。
// 基準値は種別・性別で変わるが、マスタの一覧では項目名までを見せれば足り、
// 個々の基準値は「検査」画面（領域外）の役割なのでここでは持たない。
type LabItem struct {
	ItemCode string `json:"item_code"`
	Name     string `json:"name"`
	Unit     string `json:"unit"`
	Category string `json:"category"`
}

// masterEntry は data/masters.json の code/name 形式の1件
// （予防種別・受付種別・診療科）。
type masterEntry struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// mastersFile は data/masters.json 全体の形。
// price_categories・phrases はマスタ画面では使わないため素通りでよい項目のみ持つ。
type mastersFile struct {
	PreventionKinds []masterEntry       `json:"prevention_kinds"`
	ReceptionKinds  []masterEntry       `json:"reception_kinds"`
	Departments     []masterEntry       `json:"departments"`
	Phrases         map[string][]string `json:"phrases"`
}

// FeatureNote は「この企画では扱わない」機能の説明1件
// （spec/model.md「落としたもの」＝画面23「機能設定」・GET /api/features の元データ）。
type FeatureNote struct {
	Key     string `json:"key"`
	Kind    string `json:"kind"` // "todo" | "folded"（この設定領域が扱うのは常に "folded"）
	Title   string `json:"title"`
	Message string `json:"message"`
}
