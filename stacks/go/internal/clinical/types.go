// Package clinical はカルテ・検査など、診療に関わるデータの読み込みと
// 判定ロジックを受け持つ。internal/billing と同じ理由（保存先が未確定・
// 検算に読み取りだけで足りる）で、いまは `data/` を読み込むだけの形にしてある。
package clinical

// Patient は動物（`data/seed.json` の `patients`）。
type Patient struct {
	ID        int     `json:"id"`
	KarteNo   string  `json:"karte_no"`
	OwnerID   int     `json:"owner_id"`
	NameKana  string  `json:"name_kana"`
	NameKanji string  `json:"name_kanji"`
	Species   string  `json:"species"`
	Breed     string  `json:"breed"`
	Sex       string  `json:"sex"`
	BirthDate string  `json:"birth_date"`
	DeletedAt *string `json:"deleted_at"`
}

// Visit は診察（`data/seed.json` の `visits`）。
type Visit struct {
	ID             int      `json:"id"`
	PatientID      int      `json:"patient_id"`
	VisitNo        int      `json:"visit_no"`
	VisitDate      string   `json:"visit_date"`
	VisitTime      string   `json:"visit_time"`
	BodyWeightKg   *float64 `json:"body_weight_kg"`
	ChiefComplaint string   `json:"chief_complaint"`
	Symptom        string   `json:"symptom"`
	Diagnosis      string   `json:"diagnosis"`
	Treatment      string   `json:"treatment"`
	StaffID        *int     `json:"staff_id"`
	DeletedAt      *string  `json:"deleted_at"`
}

// ProgressNote は経過記録（`data/seed.json` の `progress_notes`）。
// 4値（体温・脈拍・呼吸・体重）は**行ごとに独立して**持つ。
// 題材の実システムで実際に起きた「全患者に同じ体温が印字される」不具合
// （spec/model.md 7章）の再発防止が、この構造をそのまま保つ理由。
type ProgressNote struct {
	ID            int      `json:"id"`
	VisitID       int      `json:"visit_id"`
	RowNo         int      `json:"row_no"`
	EntryDate     string   `json:"entry_date"`
	TemperatureC  *float64 `json:"temperature_c"`
	Pulse         *float64 `json:"pulse"`
	Respiration   *float64 `json:"respiration"`
	BodyWeightKg  *float64 `json:"body_weight_kg"`
	SymptomCourse string   `json:"symptom_course"`
	TreatmentRx   string   `json:"treatment_rx"`
	Note          string   `json:"note"`
}

// LabTest は検査（`data/seed.json` の `lab_tests`）。
type LabTest struct {
	ID           int     `json:"id"`
	PatientID    int     `json:"patient_id"`
	VisitID      int     `json:"visit_id"`
	Category     string  `json:"category"`
	TestedOn     string  `json:"tested_on"`
	TestedAtTime *string `json:"tested_at_time"`
	StaffID      *int    `json:"staff_id"`
}

// LabTestItem は検査の項目値（`data/seed.json` の `lab_test_items`）。
type LabTestItem struct {
	ID        int      `json:"id"`
	LabTestID int      `json:"lab_test_id"`
	ItemCode  string   `json:"item_code"`
	ValueNum  *float64 `json:"value_num"`
	ValueText *string  `json:"value_text"`
}

// RefRange は基準値の1行（`data/lab_items.json` の `reference_ranges`）。
type RefRange struct {
	Species string  `json:"species"`
	Sex     string  `json:"sex"` // "any" または特定の性別
	Low     float64 `json:"low"`
	High    float64 `json:"high"`
}

// LabItemMaster は検査項目の固定データ（`data/lab_items.json`）。
// 画面からは編集しない（spec/model.md「変わらないもの」）。
type LabItemMaster struct {
	ItemCode        string     `json:"item_code"`
	Name            string     `json:"name"`
	Unit            string     `json:"unit"`
	Category        string     `json:"category"`
	ReferenceRanges []RefRange `json:"reference_ranges"`
}

// Reservation は予約（`data/seed.json` の `reservations`）。
type Reservation struct {
	ID        int     `json:"id"`
	PatientID int     `json:"patient_id"`
	StartsAt  string  `json:"starts_at"`
	EndsAt    string  `json:"ends_at"`
	StaffID   *int    `json:"staff_id"`
	Room      string  `json:"room"`
	Purpose   *string `json:"purpose"`
	Note      *string `json:"note"`
	Status    string  `json:"status"` // "booked" | "cancelled"
}

// CareRecord は入院中のケア記録1行（`data/seed.json` の
// `hospitalizations[].care_records`）。実施者は必須
// （spec/model.md「実施者が空の記録行を作らないこと」）。
type CareRecord struct {
	ID                 int    `json:"id"`
	RecordedAt         string `json:"recorded_at"`
	Category           string `json:"category"`
	Content            string `json:"content"`
	PerformedByStaffID *int   `json:"performed_by_staff_id"`
}

// Hospitalization は入院（`data/seed.json` の `hospitalizations`）。
type Hospitalization struct {
	ID           int          `json:"id"`
	PatientID    int          `json:"patient_id"`
	AdmittedOn   string       `json:"admitted_on"`
	DischargedOn *string      `json:"discharged_on"`
	Room         string       `json:"room"`
	CareRecords  []CareRecord `json:"care_records"`
}

// seedFile は `data/seed.json` のうち、この計算に要る部分だけを読む。
type seedFile struct {
	Patients         []Patient         `json:"patients"`
	Visits           []Visit           `json:"visits"`
	ProgressNotes    []ProgressNote    `json:"progress_notes"`
	LabTests         []LabTest         `json:"lab_tests"`
	LabTestItems     []LabTestItem     `json:"lab_test_items"`
	Reservations     []Reservation     `json:"reservations"`
	Hospitalizations []Hospitalization `json:"hospitalizations"`
}
