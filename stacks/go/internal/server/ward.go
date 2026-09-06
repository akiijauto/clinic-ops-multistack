package server

import (
	"net/http"
	"strconv"
	"time"

	"clinicops/internal/clinical"
	"clinicops/internal/config"
)

// この節は「入院」画面（本日の入院患者一覧・1動物の入院記録）を受け持つ
// （spec/screens.md 18章）。

type careRecordView struct {
	RecordedAt string
	Category   string
	Content    string
	StaffName  string
}

type hospitalizationRowView struct {
	ID           int
	KarteNo      string
	PatientName  string
	AdmittedOn   string
	DischargedOn string
	Room         string
}

// ---- 本日の入院患者一覧（GET /ward, /ward/day） ----

type wardDayView struct {
	Date string
	Rows []hospitalizationRowView
}

func (s *Server) handleWardToday(w http.ResponseWriter, r *http.Request) {
	date := time.Now().In(config.JST).Format("2006-01-02")
	s.renderWardDay(w, date)
}

func (s *Server) handleWardDay(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().In(config.JST).Format("2006-01-02")
	}
	s.renderWardDay(w, date)
}

func (s *Server) renderWardDay(w http.ResponseWriter, date string) {
	var rows []hospitalizationRowView
	if s.clinical != nil {
		for _, h := range s.clinical.HospitalizationsOnDate(date) {
			p, _ := s.clinical.PatientByID(h.PatientID)
			discharged := ""
			if h.DischargedOn != nil {
				discharged = *h.DischargedOn
			}
			rows = append(rows, hospitalizationRowView{
				ID: h.ID, KarteNo: p.KarteNo, PatientName: p.NameKanji,
				AdmittedOn: h.AdmittedOn, DischargedOn: discharged, Room: h.Room,
			})
		}
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "ward_day", wardDayView{Date: date, Rows: rows})
}

// ---- 1動物の入院記録（GET+POST /animals/{karte_no}/ward） ----

type animalWardView struct {
	KarteNo          string
	Hospitalizations []animalWardHospView
	ErrorMessage     string
	SuccessMessage   string
}

type animalWardHospView struct {
	ID           int
	AdmittedOn   string
	DischargedOn string
	Room         string
	Records      []careRecordView
	InProgress   bool
}

func (s *Server) buildAnimalWardView(karteNo string) (animalWardView, bool) {
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		return animalWardView{}, false
	}
	data := animalWardView{KarteNo: karteNo}
	for _, h := range s.clinical.HospitalizationsForPatient(patient.ID) {
		hv := animalWardHospView{ID: h.ID, AdmittedOn: h.AdmittedOn, Room: h.Room, InProgress: h.DischargedOn == nil}
		if h.DischargedOn != nil {
			hv.DischargedOn = *h.DischargedOn
		}
		for _, c := range h.CareRecords {
			hv.Records = append(hv.Records, careRecordView{
				RecordedAt: c.RecordedAt, Category: c.Category, Content: c.Content,
				StaffName: s.staffLabel(c.PerformedByStaffID),
			})
		}
		data.Hospitalizations = append(data.Hospitalizations, hv)
	}
	return data, true
}

// staffLabel は実施者IDから氏名を引く。氏名が引けない（reception未初期化・
// 未知のID）場合はIDの文字列にフォールバックする——空文字は返さない
// （spec/acceptance.md 検算7「実施者名の要素のテキストが空でないこと」）。
func (s *Server) staffLabel(id *int) string {
	if id == nil {
		return ""
	}
	if s.reception != nil {
		if st, ok := s.reception.StaffByID(*id); ok {
			return st.Name
		}
	}
	return strconv.Itoa(*id)
}

func (s *Server) handleAnimalWard(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}

	var errMsg, successMsg string
	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		switch r.FormValue("action") {
		case "care_record":
			hospID, _ := strconv.Atoi(r.FormValue("hospitalization_id"))
			var staffID *int
			if v, err := strconv.Atoi(r.FormValue("performed_by_staff_id")); err == nil && v != 0 {
				staffID = &v
			}
			_, err := s.clinical.AddCareRecord(hospID, clinical.CareRecord{
				RecordedAt:         time.Now().In(config.JST).Format(time.RFC3339),
				Category:           r.FormValue("category"),
				Content:            r.FormValue("content"),
				PerformedByStaffID: staffID,
			})
			if err != nil {
				errMsg = messageFor(err)
			} else {
				successMsg = "記録しました。"
			}
		case "discharge":
			hospID, _ := strconv.Atoi(r.FormValue("hospitalization_id"))
			if _, err := s.clinical.DischargeHospitalization(hospID, r.FormValue("discharged_on")); err != nil {
				errMsg = messageFor(err)
			} else {
				successMsg = "退院を記録しました。"
			}
		case "admit":
			if _, err := s.clinical.CreateHospitalization(patient.ID, r.FormValue("admitted_on"), r.FormValue("room")); err != nil {
				errMsg = messageFor(err)
			} else {
				successMsg = "入院を登録しました。"
			}
		}
	}

	data, ok := s.buildAnimalWardView(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	data.ErrorMessage, data.SuccessMessage = errMsg, successMsg
	_ = s.views.RenderHTTP(w, http.StatusOK, "ward", data)
}
