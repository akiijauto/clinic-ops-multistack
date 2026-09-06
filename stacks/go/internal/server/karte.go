package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/clinical"
)

// karteView はカルテ画面に渡すデータ。通常画面と印刷画面は
// **同じ組み立て関数から同じ値**を作る（spec/acceptance.md 検算4）。
// 別々に計算すると、印刷側だけ古い計算式が残るような食い違いが起きるため。
//
// Form/ErrorMessage/SuccessMessage は画面（karte）だけが使う書き込み用の
// 追加フィールド。karte_print・karte_body（両画面共通の部分テンプレート）は
// これらを参照しないので、印刷側の一致（検算4）には影響しない。
type karteView struct {
	Patient patientView
	Visits  []visitView

	Form           karteFormView
	ErrorMessage   string
	SuccessMessage string
}

// karteFormView は「いま編集している回」の入力欄。
type karteFormView struct {
	VisitID        string // 空 = 新規診察
	VisitDate      string
	VisitTime      string
	BodyWeightKg   string
	ChiefComplaint string
	Symptom        string
	Diagnosis      string
	Treatment      string
	Notes          []noteFormView
	PreviousExists bool
}

type noteFormView struct {
	EntryDate     string
	TemperatureC  string
	Pulse         string
	Respiration   string
	BodyWeightKg  string
	SymptomCourse string
	TreatmentRx   string
	Note          string
}

type patientView struct {
	KarteNo   string
	NameKanji string
	NameKana  string
	Species   string
	Breed     string
	Sex       string
}

type visitView struct {
	ID             int
	VisitDate      string
	VisitTime      string
	BodyWeightKg   string
	ChiefComplaint string
	Symptom        string
	Diagnosis      string
	Treatment      string
	Notes          []noteView
}

type noteView struct {
	EntryDate     string
	TemperatureC  string
	Pulse         string
	Respiration   string
	BodyWeightKg  string
	SymptomCourse string
	TreatmentRx   string
	Note          string
}

// formatNum は数値をテンプレート表示用に整える。無い値は空文字
// （0円/0件と紛れないよう、「未入力」と「0」を区別する — spec/README.md と同じ考え方）。
func formatNum(v *float64) string {
	if v == nil {
		return ""
	}
	return strconv.FormatFloat(*v, 'f', -1, 64)
}

// buildKarteView はカルテ番号から画面用データを組み立てる。
// 削除済みの Visit は含めない（spec/screens.md「削除された Visit は
// カルテ本体にも出ない」）。
func (s *Server) buildKarteView(karteNo string) (karteView, bool) {
	return s.buildKarteViewFocused(karteNo, 0)
}

// buildKarteViewFocused は focusVisitID で「いま開いている回」を指定できる版。
// 0 なら最新の回（Visits は新しい順で返る）。
func (s *Server) buildKarteViewFocused(karteNo string, focusVisitID int) (karteView, bool) {
	if s.clinical == nil {
		return karteView{}, false
	}
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		return karteView{}, false
	}

	visits := s.clinical.Visits(patient.ID, false)
	out := make([]visitView, len(visits))
	for i, v := range visits {
		notes := s.clinical.ProgressNotes(v.ID)
		nv := make([]noteView, len(notes))
		for j, n := range notes {
			nv[j] = noteView{
				EntryDate:     n.EntryDate,
				TemperatureC:  formatNum(n.TemperatureC),
				Pulse:         formatNum(n.Pulse),
				Respiration:   formatNum(n.Respiration),
				BodyWeightKg:  formatNum(n.BodyWeightKg),
				SymptomCourse: n.SymptomCourse,
				TreatmentRx:   n.TreatmentRx,
				Note:          n.Note,
			}
		}
		out[i] = visitView{
			ID:             v.ID,
			VisitDate:      v.VisitDate,
			VisitTime:      v.VisitTime,
			BodyWeightKg:   formatNum(v.BodyWeightKg),
			ChiefComplaint: v.ChiefComplaint,
			Symptom:        v.Symptom,
			Diagnosis:      v.Diagnosis,
			Treatment:      v.Treatment,
			Notes:          nv,
		}
	}

	form := karteFormView{PreviousExists: len(visits) > 0}
	var focus *clinical.Visit
	if focusVisitID != 0 {
		for i := range visits {
			if visits[i].ID == focusVisitID {
				focus = &visits[i]
				break
			}
		}
	} else if len(visits) > 0 {
		focus = &visits[0] // Visits は新しい順
	}
	if focus != nil {
		form.VisitID = strconv.Itoa(focus.ID)
		form.VisitDate = focus.VisitDate
		form.VisitTime = focus.VisitTime
		form.BodyWeightKg = formatNum(focus.BodyWeightKg)
		form.ChiefComplaint = focus.ChiefComplaint
		form.Symptom = focus.Symptom
		form.Diagnosis = focus.Diagnosis
		form.Treatment = focus.Treatment
		for _, n := range s.clinical.ProgressNotes(focus.ID) {
			form.Notes = append(form.Notes, noteFormView{
				EntryDate:     n.EntryDate,
				TemperatureC:  formatNum(n.TemperatureC),
				Pulse:         formatNum(n.Pulse),
				Respiration:   formatNum(n.Respiration),
				BodyWeightKg:  formatNum(n.BodyWeightKg),
				SymptomCourse: n.SymptomCourse,
				TreatmentRx:   n.TreatmentRx,
				Note:          n.Note,
			})
		}
	}
	if len(form.Notes) == 0 {
		form.Notes = append(form.Notes, noteFormView{})
	}

	return karteView{
		Patient: patientView{
			KarteNo:   patient.KarteNo,
			NameKanji: patient.NameKanji,
			NameKana:  patient.NameKana,
			Species:   patient.Species,
			Breed:     patient.Breed,
			Sex:       patient.Sex,
		},
		Visits: out,
		Form:   form,
	}, true
}

// buildNewVisitForm は「新しい診察を起こす」（空のフォーム。GET /karte/new）の
// 画面データを作る。copyFrom が true なら直前の診察の内容を写す（GET /karte/copy_prev）。
func (s *Server) buildNewVisitForm(karteNo string, copyFrom bool) (karteView, bool) {
	data, ok := s.buildKarteView(karteNo)
	if !ok {
		return karteView{}, false
	}
	patient, _ := s.clinical.PatientByKarteNo(karteNo)
	prev, hasPrev := s.clinical.PreviousVisit(patient.ID)

	form := karteFormView{PreviousExists: hasPrev}
	if copyFrom && hasPrev {
		form.VisitDate = prev.VisitDate
		form.BodyWeightKg = formatNum(prev.BodyWeightKg)
		form.ChiefComplaint = prev.ChiefComplaint
		form.Symptom = prev.Symptom
		form.Diagnosis = prev.Diagnosis
		form.Treatment = prev.Treatment
	}
	form.Notes = []noteFormView{{}}
	data.Form = form
	return data, true
}

func (s *Server) handleKarte(w http.ResponseWriter, r *http.Request) {
	focus, _ := strconv.Atoi(r.URL.Query().Get("visit_id"))
	data, ok := s.buildKarteViewFocused(r.PathValue("karte_no"), focus)
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

func (s *Server) handleKartePrint(w http.ResponseWriter, r *http.Request) {
	data, ok := s.buildKarteView(r.PathValue("karte_no"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte_print", data)
}
