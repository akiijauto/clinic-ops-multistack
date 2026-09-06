// Package reception は「受付・患者」領域（本日の患者・新規登録・顧客・検索・
// 来院履歴・削除・折りたたみ表示）を受け持つ。
//
// internal/billing・internal/clinical と同じ理由（保存の道具は未確定）で、
// まずは `data/` を読み込んでメモリ上に持つ形にしてある。ただし本領域は
// 削除（`deleted_at`）・番号変更・上下送り等の書き込みを行うため、
// billing/clinical と違い Store は排他制御（sync.RWMutex）を持つ。
package reception

import "time"

// Staff はスタッフ（担当）。`data/seed.json` の `staff`。
type Staff struct {
	ID        int    `json:"id"`
	StaffCode string `json:"staff_code"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	IsActive  bool   `json:"is_active"`
}

// Owner は飼主（`data/seed.json` の `owners`）。
// **物理削除しない**（spec/model.md）。DeletedAt に日時が入るだけ。
type Owner struct {
	ID         int     `json:"id"`
	OwnerNo    string  `json:"owner_no"`
	NameKana   string  `json:"name_kana"`
	NameKanji  string  `json:"name_kanji"`
	PostalCode string  `json:"postal_code"`
	Address1   string  `json:"address1"`
	Address2   string  `json:"address2"`
	Phone      string  `json:"phone"`
	Mobile     string  `json:"mobile"`
	DeletedAt  *string `json:"deleted_at"`
}

// Patient は動物（`data/seed.json` の `patients`）。
// **物理削除しない**（spec/model.md）。
type Patient struct {
	ID         int     `json:"id"`
	KarteNo    string  `json:"karte_no"`
	OwnerID    int     `json:"owner_id"`
	NameKana   string  `json:"name_kana"`
	NameKanji  string  `json:"name_kanji"`
	Species    string  `json:"species"`
	Breed      string  `json:"breed"`
	Sex        string  `json:"sex"`
	BirthDate  *string `json:"birth_date"`
	NeuterDate *string `json:"neuter_date"`
	DeletedAt  *string `json:"deleted_at"`
}

// Reception は本日の患者（受付）。`data/seed.json` の `receptions`。
//
// 契約上の落とし穴: spec/openapi.yaml の Reception スキーマには「受付区分」に
// 相当する `kind` フィールドが存在しない。しかし spec/screens.md は「本日の患者」
// 画面を受付区分ごとのタブで絞ると定めている。`data/make_data.py`
// （build_receptions）を確認したところ、`medical_purpose` に
// `masters.json` の `reception_kinds[].name` をそのまま入れて生成しているため、
// このコードでは `medical_purpose` をタブの絞り込みキーとして使う
// （最終回答の「自分で仮決めしたこと」に記載）。
type Reception struct {
	ID             int     `json:"id"`
	PatientID      int     `json:"patient_id"`
	DisplayNo      int     `json:"display_no"`
	ReceivedAt     string  `json:"received_at"`
	OwnerPurpose   *string `json:"owner_purpose"`
	MedicalPurpose *string `json:"medical_purpose"`
	Status         string  `json:"status"` // "waiting" | "in_exam" | "done"
	StaffID        *int    `json:"staff_id"`
}

// Visit は診察（`data/seed.json` の `visits`）。
//
// internal/clinical にも同名の型があるが、パッケージを跨いだ依存を作らない
// 方針（各領域は自分の担当分だけ `data/seed.json` を読む。billing/clinical の
// 既存パターンを踏襲）に合わせ、本パッケージが必要とする最小限の項目
// （検索・来院履歴・当日診察件数）だけをここに複製して持つ。
type Visit struct {
	ID             int     `json:"id"`
	PatientID      int     `json:"patient_id"`
	VisitNo        int     `json:"visit_no"`
	VisitDate      string  `json:"visit_date"`
	VisitTime      string  `json:"visit_time"`
	ChiefComplaint string  `json:"chief_complaint"`
	Symptom        string  `json:"symptom"`
	Diagnosis      string  `json:"diagnosis"`
	Treatment      string  `json:"treatment"`
	StaffID        *int    `json:"staff_id"`
	DeletedAt      *string `json:"deleted_at"`
}

// ReceptionKind は `data/masters.json` の `reception_kinds` 1行。
type ReceptionKind struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// seedFile は `data/seed.json` のうち、この領域が要る部分だけを読む。
type seedFile struct {
	AnchorDate string      `json:"anchor_date"`
	Staff      []Staff     `json:"staff"`
	Owners     []Owner     `json:"owners"`
	Patients   []Patient   `json:"patients"`
	Receptions []Reception `json:"receptions"`
	Visits     []Visit     `json:"visits"`
}

// mastersFile は `data/masters.json` のうち、この領域が要る部分だけを読む。
type mastersFile struct {
	ReceptionKinds []ReceptionKind `json:"reception_kinds"`
}

// nowJST は現在時刻を返す（呼び出し側で config.JST へ変換する）。
// テストで固定時刻に差し替えられるよう変数にしてある。
var nowJST = func() time.Time { return time.Now() }

// PatientWithOwner は動物とその飼主をまとめたもの（検索・顧客画面で使う）。
type PatientWithOwner struct {
	Patient Patient
	Owner   Owner
}

// VisitHit は「診察の中身」検索で1件当たった行。
// 当たった欄名（Field）と前後の文字（Excerpt）を持つ
// （spec/screens.md「当たった欄と前後の文字を出す」）。
type VisitHit struct {
	Visit   Visit
	Patient Patient
	Field   string
	Excerpt string
}
