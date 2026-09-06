package server

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"clinicops/internal/apperr"
	"clinicops/internal/clinical"
	"clinicops/internal/config"
)

// todayJST はJSTの本日を "YYYY-MM-DD" で返す。
func todayJST() string {
	return time.Now().In(config.JST).Format("2006-01-02")
}

// この節は「診療」領域の残りのデータのルート（診察・検査・投薬・予防・書類・
// 入院のJSON API）を持つ。画面（HTML）ルートと同じ internal/clinical.Store を
// そのまま使うため、計算の二重実装は無い。

// ---- 診察（Visit） ----

type progressNoteJSON struct {
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

type visitJSON struct {
	ID             int                `json:"id"`
	PatientID      int                `json:"patient_id"`
	VisitNo        int                `json:"visit_no"`
	VisitDate      string             `json:"visit_date"`
	VisitTime      *string            `json:"visit_time"`
	BodyWeightKg   *float64           `json:"body_weight_kg"`
	ChiefComplaint *string            `json:"chief_complaint"`
	Symptom        *string            `json:"symptom"`
	Diagnosis      *string            `json:"diagnosis"`
	Treatment      *string            `json:"treatment"`
	StaffID        *int               `json:"staff_id"`
	DeletedAt      *string            `json:"deleted_at"`
	ProgressNotes  []progressNoteJSON `json:"progress_notes"`
}

func (s *Server) buildVisitJSON(v clinical.Visit) visitJSON {
	notes := s.clinical.ProgressNotes(v.ID)
	out := make([]progressNoteJSON, len(notes))
	for i, n := range notes {
		out[i] = progressNoteJSON{
			ID: n.ID, VisitID: n.VisitID, RowNo: n.RowNo, EntryDate: n.EntryDate,
			TemperatureC: n.TemperatureC, Pulse: n.Pulse, Respiration: n.Respiration,
			BodyWeightKg: n.BodyWeightKg, SymptomCourse: n.SymptomCourse,
			TreatmentRx: n.TreatmentRx, Note: n.Note,
		}
	}
	return visitJSON{
		ID: v.ID, PatientID: v.PatientID, VisitNo: v.VisitNo, VisitDate: v.VisitDate,
		VisitTime: strPtrOrNil(v.VisitTime), BodyWeightKg: v.BodyWeightKg,
		ChiefComplaint: strPtrOrNil(v.ChiefComplaint), Symptom: strPtrOrNil(v.Symptom),
		Diagnosis: strPtrOrNil(v.Diagnosis), Treatment: strPtrOrNil(v.Treatment),
		StaffID: v.StaffID, DeletedAt: v.DeletedAt, ProgressNotes: out,
	}
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// visitCreateJSON は spec/openapi.yaml VisitCreate（Visitと同形。id/visit_no/deleted_atは無視）。
type visitCreateJSON struct {
	VisitDate      string             `json:"visit_date"`
	VisitTime      *string            `json:"visit_time"`
	BodyWeightKg   *float64           `json:"body_weight_kg"`
	ChiefComplaint *string            `json:"chief_complaint"`
	Symptom        *string            `json:"symptom"`
	Diagnosis      *string            `json:"diagnosis"`
	Treatment      *string            `json:"treatment"`
	StaffID        *int               `json:"staff_id"`
	ProgressNotes  []progressNoteJSON `json:"progress_notes"`
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (in visitCreateJSON) toVisit() (clinical.Visit, []clinical.ProgressNote) {
	visitTime := ""
	if in.VisitTime != nil {
		visitTime = *in.VisitTime
	}
	v := clinical.Visit{
		VisitDate: in.VisitDate, VisitTime: visitTime, BodyWeightKg: in.BodyWeightKg,
		ChiefComplaint: derefStr(in.ChiefComplaint), Symptom: derefStr(in.Symptom),
		Diagnosis: derefStr(in.Diagnosis), Treatment: derefStr(in.Treatment), StaffID: in.StaffID,
	}
	notes := make([]clinical.ProgressNote, len(in.ProgressNotes))
	for i, n := range in.ProgressNotes {
		notes[i] = clinical.ProgressNote{
			EntryDate: n.EntryDate, TemperatureC: n.TemperatureC, Pulse: n.Pulse,
			Respiration: n.Respiration, BodyWeightKg: n.BodyWeightKg,
			SymptomCourse: n.SymptomCourse, TreatmentRx: n.TreatmentRx, Note: n.Note,
		}
	}
	return v, notes
}

// handleAPIListVisits は GET /api/patients/{karte_no}/visits。
func (s *Server) handleAPIListVisits(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	includeDeleted := r.URL.Query().Get("include_deleted") == "true" || r.URL.Query().Get("include_deleted") == "1"
	visits := s.clinical.Visits(patient.ID, includeDeleted)
	items := make([]visitJSON, len(visits))
	for i, v := range visits {
		items[i] = s.buildVisitJSON(v)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

// handleAPICreateVisit は POST /api/patients/{karte_no}/visits。
func (s *Server) handleAPICreateVisit(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in visitCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	v, notes := in.toVisit()
	saved, err := s.clinical.SaveVisit(patient.ID, 0, v, notes)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s.buildVisitJSON(saved))
}

// handleAPIVisit は GET/PATCH /api/visits/{visit_id}。
func (s *Server) handleAPIVisit(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("visit_id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if r.Method == http.MethodGet {
		v, ok := s.clinical.VisitByID(id)
		if !ok {
			apperr.Write(w, apperr.New(apperr.NotFound))
			return
		}
		writeJSON(w, http.StatusOK, s.buildVisitJSON(v))
		return
	}
	existing, ok := s.clinical.VisitByID(id)
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in visitCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	v, notes := in.toVisit()
	saved, err := s.clinical.SaveVisit(existing.PatientID, id, v, notes)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.buildVisitJSON(saved))
}

// handleAPIVisitDelete は POST /api/visits/{visit_id}/delete。
func (s *Server) handleAPIVisitDelete(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("visit_id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	v, err := s.clinical.DeleteVisit(id)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.buildVisitJSON(v))
}

// handleAPIVisitRestore は POST /api/visits/{visit_id}/restore。
func (s *Server) handleAPIVisitRestore(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("visit_id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	v, err := s.clinical.RestoreVisit(id)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.buildVisitJSON(v))
}

func writeClinicalErr(w http.ResponseWriter, err error) {
	if ae, ok := err.(*apperr.Error); ok {
		apperr.Write(w, ae)
		return
	}
	apperr.Write(w, apperr.New(apperr.SaveFailed))
}

// ---- 検査（LabTest） ----

// handleAPIListLabTests は GET /api/patients/{karte_no}/lab-tests。
func (s *Server) handleAPIListLabTests(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	tests := s.clinical.ListLabTests(patient.ID)
	items := make([]labTestJSON, len(tests))
	for i, t := range tests {
		items[i] = s.buildLabTestJSON(t)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

type labTestCreateJSON struct {
	VisitID      int     `json:"visit_id"`
	Category     string  `json:"category"`
	TestedOn     string  `json:"tested_on"`
	TestedAtTime *string `json:"tested_at_time"`
	StaffID      *int    `json:"staff_id"`
	Items        []struct {
		ItemCode  string   `json:"item_code"`
		ValueNum  *float64 `json:"value_num"`
		ValueText *string  `json:"value_text"`
	} `json:"items"`
}

// handleAPICreateLabTest は POST /api/patients/{karte_no}/lab-tests。
func (s *Server) handleAPICreateLabTest(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in labTestCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	if len(in.Items) == 0 {
		apperr.Write(w, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "items", Message: "検査項目を最低1件指定してください。"},
		))
		return
	}
	items := make([]clinical.LabTestItem, len(in.Items))
	for i, it := range in.Items {
		items[i] = clinical.LabTestItem{ItemCode: it.ItemCode, ValueNum: it.ValueNum, ValueText: it.ValueText}
	}
	test, err := s.clinical.CreateLabTest(patient.ID, clinical.LabTest{
		VisitID: in.VisitID, Category: in.Category, TestedOn: in.TestedOn,
		TestedAtTime: in.TestedAtTime, StaffID: in.StaffID,
	}, items)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s.buildLabTestJSON(test))
}

// ---- 投薬（Dosing） ----

type dosingJSON struct {
	ID         int    `json:"id"`
	PatientID  int    `json:"patient_id"`
	Kind       string `json:"kind"`
	FiscalYear int    `json:"fiscal_year"`
	M01        string `json:"m01"`
	M02        string `json:"m02"`
	M03        string `json:"m03"`
	M04        string `json:"m04"`
	M05        string `json:"m05"`
	M06        string `json:"m06"`
	M07        string `json:"m07"`
	M08        string `json:"m08"`
	M09        string `json:"m09"`
	M10        string `json:"m10"`
	M11        string `json:"m11"`
	M12        string `json:"m12"`
}

func toDosingJSON(d clinical.Dosing) dosingJSON {
	return dosingJSON{
		ID: d.ID, PatientID: d.PatientID, Kind: d.Kind, FiscalYear: d.FiscalYear,
		M01: d.M01, M02: d.M02, M03: d.M03, M04: d.M04, M05: d.M05, M06: d.M06,
		M07: d.M07, M08: d.M08, M09: d.M09, M10: d.M10, M11: d.M11, M12: d.M12,
	}
}

// handleAPIDosing は GET/PATCH /api/patients/{karte_no}/dosing/{kind_id}。
func (s *Server) handleAPIDosing(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	kind, ok := s.resolveKind(r.PathValue("kind_id"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}

	if r.Method == http.MethodGet {
		fiscalYear, _ := strconv.Atoi(r.URL.Query().Get("fiscal_year"))
		rows := s.clinical.Dosings(patient.ID, kind.Code)
		for _, d := range rows {
			if fiscalYear == 0 || d.FiscalYear == fiscalYear {
				writeJSON(w, http.StatusOK, toDosingJSON(d))
				return
			}
		}
		// まだ記録が無い年度（患者×種別の組み合わせ自体は存在する）。
		// 404にはせず、空欄（月はすべてnull）の年間記録として200で返す
		// （画面側（GET /animals/{karte_no}/dosing/{kind_id}）も記録0件を
		// 404にはせず空のマス目で描画しており、それと揃える）。
		if fiscalYear == 0 {
			fiscalYear = time.Now().In(config.JST).Year()
		}
		writeJSON(w, http.StatusOK, dosingJSON{PatientID: patient.ID, Kind: kind.Code, FiscalYear: fiscalYear})
		return
	}

	var in dosingJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	months := [12]string{in.M01, in.M02, in.M03, in.M04, in.M05, in.M06, in.M07, in.M08, in.M09, in.M10, in.M11, in.M12}
	saved, err := s.clinical.SaveDosing(patient.ID, kind.Code, in.FiscalYear, months)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toDosingJSON(saved))
}

// ---- 予防（Prevention） ----

type preventionJSON struct {
	ID            int     `json:"id"`
	PatientID     int     `json:"patient_id"`
	Kind          string  `json:"kind"`
	Content       *string `json:"content"`
	PerformedDate string  `json:"performed_date"`
	NextDueDate   *string `json:"next_due_date"`
}

func toPreventionJSON(p clinical.Prevention) preventionJSON {
	return preventionJSON{
		ID: p.ID, PatientID: p.PatientID, Kind: p.Kind, Content: strPtrOrNil(p.Content),
		PerformedDate: p.PerformedDate, NextDueDate: p.NextDueDate,
	}
}

// handleAPIPrevention は GET/POST /api/patients/{karte_no}/prevention/{kind_id}。
func (s *Server) handleAPIPrevention(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	kind, ok := s.resolveKind(r.PathValue("kind_id"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}

	if r.Method == http.MethodGet {
		rows := s.clinical.Preventions(patient.ID, kind.Code)
		items := make([]preventionJSON, len(rows))
		for i, p := range rows {
			items[i] = toPreventionJSON(p)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
		return
	}

	var in preventionJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	created, err := s.clinical.CreatePrevention(patient.ID, clinical.Prevention{
		Kind: kind.Code, Content: derefStr(in.Content), PerformedDate: in.PerformedDate, NextDueDate: in.NextDueDate,
	})
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toPreventionJSON(created))
}

// ---- 書類（Paper） ----

type paperJSON struct {
	ID        int     `json:"id"`
	PatientID int     `json:"patient_id"`
	Title     string  `json:"title"`
	Note      *string `json:"note"`
	CreatedAt string  `json:"created_at"`
}

func toPaperJSON(p clinical.Paper) paperJSON {
	return paperJSON{ID: p.ID, PatientID: p.PatientID, Title: p.Title, Note: p.Note, CreatedAt: p.CreatedAt}
}

// handleAPIPapers は GET/POST /api/patients/{karte_no}/papers。
func (s *Server) handleAPIPapers(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if r.Method == http.MethodGet {
		rows := s.clinical.Papers(patient.ID)
		items := make([]paperJSON, len(rows))
		for i, p := range rows {
			items[i] = toPaperJSON(p)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
		return
	}
	var in paperJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	created, err := s.clinical.CreatePaper(patient.ID, in.Title, in.Note)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toPaperJSON(created))
}

// handleAPIPaper は GET/DELETE /api/papers/{paper_id}。
func (s *Server) handleAPIPaper(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("paper_id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if r.Method == http.MethodGet {
		p, ok := s.clinical.Paper(id)
		if !ok {
			apperr.Write(w, apperr.New(apperr.NotFound))
			return
		}
		writeJSON(w, http.StatusOK, toPaperJSON(p))
		return
	}
	// DELETE（取消。物理削除しない——spec/screens.md「行と実体は残る」）。
	p, err := s.clinical.RemovePaper(id)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPaperJSON(p))
}

// ---- 入院（Hospitalization / CareRecord） ----

type careRecordJSON struct {
	ID                 int     `json:"id"`
	HospitalizationID  int     `json:"hospitalization_id"`
	RecordedAt         string  `json:"recorded_at"`
	Category           string  `json:"category"`
	Content            *string `json:"content"`
	PerformedByStaffID *int    `json:"performed_by_staff_id"`
}

func toCareRecordJSON(hospID int, c clinical.CareRecord) careRecordJSON {
	return careRecordJSON{
		ID: c.ID, HospitalizationID: hospID, RecordedAt: c.RecordedAt, Category: c.Category,
		Content: strPtrOrNil(c.Content), PerformedByStaffID: c.PerformedByStaffID,
	}
}

type hospitalizationJSON struct {
	ID           int              `json:"id"`
	PatientID    int              `json:"patient_id"`
	AdmittedOn   string           `json:"admitted_on"`
	DischargedOn *string          `json:"discharged_on"`
	Room         string           `json:"room"`
	CareRecords  []careRecordJSON `json:"care_records"`
}

func toHospitalizationJSON(h clinical.Hospitalization) hospitalizationJSON {
	records := make([]careRecordJSON, len(h.CareRecords))
	for i, c := range h.CareRecords {
		records[i] = toCareRecordJSON(h.ID, c)
	}
	return hospitalizationJSON{
		ID: h.ID, PatientID: h.PatientID, AdmittedOn: h.AdmittedOn,
		DischargedOn: h.DischargedOn, Room: h.Room, CareRecords: records,
	}
}

// handleAPIWard は GET /api/ward（指定日の入院中の患者一覧。既定はJSTの本日）。
func (s *Server) handleAPIWard(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		writeJSON(w, http.StatusOK, map[string]any{"items": []any{}, "total": 0})
		return
	}
	date := r.URL.Query().Get("date")
	if date == "" {
		date = todayJST()
	}
	rows := s.clinical.HospitalizationsOnDate(date)
	items := make([]hospitalizationJSON, len(rows))
	for i, h := range rows {
		items[i] = toHospitalizationJSON(h)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

// handleAPIPatientHospitalizations は GET/POST /api/patients/{karte_no}/hospitalizations。
func (s *Server) handleAPIPatientHospitalizations(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	patient, ok := s.clinical.PatientByKarteNo(r.PathValue("karte_no"))
	if !ok {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if r.Method == http.MethodGet {
		rows := s.clinical.HospitalizationsForPatient(patient.ID)
		items := make([]hospitalizationJSON, len(rows))
		for i, h := range rows {
			items[i] = toHospitalizationJSON(h)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
		return
	}
	var in struct {
		AdmittedOn   string  `json:"admitted_on"`
		DischargedOn *string `json:"discharged_on"`
		Room         string  `json:"room"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	created, err := s.clinical.CreateHospitalization(patient.ID, in.AdmittedOn, in.Room)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	if in.DischargedOn != nil {
		created, err = s.clinical.DischargeHospitalization(created.ID, *in.DischargedOn)
		if err != nil {
			writeClinicalErr(w, err)
			return
		}
	}
	writeJSON(w, http.StatusCreated, toHospitalizationJSON(created))
}

// handleAPIHospitalization は GET/PATCH /api/hospitalizations/{id}。
func (s *Server) handleAPIHospitalization(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	if r.Method == http.MethodGet {
		h, ok := s.clinical.Hospitalization(id)
		if !ok {
			apperr.Write(w, apperr.New(apperr.NotFound))
			return
		}
		writeJSON(w, http.StatusOK, toHospitalizationJSON(h))
		return
	}
	var in struct {
		DischargedOn *string `json:"discharged_on"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	dischargedOn := ""
	if in.DischargedOn != nil {
		dischargedOn = *in.DischargedOn
	}
	updated, err := s.clinical.DischargeHospitalization(id, dischargedOn)
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toHospitalizationJSON(updated))
}

// handleAPICareRecords は GET/POST /api/hospitalizations/{id}/care-records。
// GET は既存の internal/server/hospitalization.go にあるため、ここは POST のみを持つ。
func (s *Server) handleAPICreateCareRecord(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	hospID, convErr := strconv.Atoi(r.PathValue("id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in struct {
		RecordedAt         string  `json:"recorded_at"`
		Category           string  `json:"category"`
		Content            *string `json:"content"`
		PerformedByStaffID *int    `json:"performed_by_staff_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	created, err := s.clinical.AddCareRecord(hospID, clinical.CareRecord{
		RecordedAt: in.RecordedAt, Category: in.Category,
		Content: derefStr(in.Content), PerformedByStaffID: in.PerformedByStaffID,
	})
	if err != nil {
		writeClinicalErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toCareRecordJSON(hospID, created))
}

// ---- ToDo（JSON） ----

type todoJSON struct {
	Key    string `json:"key"`
	Title  string `json:"title"`
	Where  string `json:"where"`
	Reason string `json:"reason"`
}

// handleAPITodo は GET /api/todo/{key}。
func (s *Server) handleAPITodo(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	for _, it := range todoItems() {
		if it.Key == key {
			writeJSON(w, http.StatusOK, todoJSON{Key: it.Key, Title: it.Title, Where: it.Where, Reason: it.Reason})
			return
		}
	}
	apperr.Write(w, apperr.New(apperr.NotFound))
}
