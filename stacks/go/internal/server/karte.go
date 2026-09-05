package server

import (
	"net/http"
	"strconv"
)

// karteView はカルテ画面に渡すデータ。通常画面と印刷画面は
// **同じ組み立て関数から同じ値**を作る（spec/acceptance.md 検算4）。
// 別々に計算すると、印刷側だけ古い計算式が残るような食い違いが起きるため。
type karteView struct {
	Patient patientView
	Visits  []visitView
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
	}, true
}

func (s *Server) handleKarte(w http.ResponseWriter, r *http.Request) {
	data, ok := s.buildKarteView(r.PathValue("karte_no"))
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
