package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/clinical"
)

// この節は「検査」画面（GET+POST /animals/{karte_no}/exam）を受け持つ。

type examItemView struct {
	ItemCode string
	Name     string
	Unit     string
	Low      string
	High     string
	Value    string
	Judgment string // "" | "H" | "L"
	Flag     string // "normal" | "high" | "low" | "unknown"
}

type examTestView struct {
	ID        int
	Category  string
	TestedOn  string
	IsCurrent bool
}

type examView struct {
	KarteNo      string
	PatientName  string
	Tests        []examTestView
	CurrentID    int
	Category     string
	TestedOn     string
	Items        []examItemView
	ErrorMessage string
}

// buildExamView は karte_no と（あれば）lab_test_id から検査画面を組み立てる。
// lab_test_id が 0 のときは、全項目マスタを基準値付きの空欄一覧として出す
// （spec/screens.md「結果値を入力していない項目行も、項目自体は表示される」）。
func (s *Server) buildExamView(karteNo string, labTestID int) (examView, bool) {
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		return examView{}, false
	}
	tests := s.clinical.ListLabTests(patient.ID)
	testViews := make([]examTestView, len(tests))
	for i, t := range tests {
		testViews[i] = examTestView{ID: t.ID, Category: t.Category, TestedOn: t.TestedOn, IsCurrent: t.ID == labTestID}
	}

	view := examView{KarteNo: patient.KarteNo, PatientName: patient.NameKanji, Tests: testViews, CurrentID: labTestID}

	if labTestID != 0 {
		test, ok := s.clinical.LabTest(labTestID)
		if !ok || test.PatientID != patient.ID {
			return examView{}, false
		}
		view.Category = test.Category
		view.TestedOn = test.TestedOn
		items := s.clinical.LabTestItems(labTestID)
		view.Items = make([]examItemView, len(items))
		for i, it := range items {
			view.Items[i] = examItemFrom(s, it, patient)
		}
		return view, true
	}

	// 新規: 全項目マスタを空欄で並べる。
	for _, m := range s.clinical.AllLabItemMasters() {
		item := clinical.LabTestItem{ItemCode: m.ItemCode}
		view.Items = append(view.Items, examItemFrom(s, item, patient))
	}
	return view, true
}

func examItemFrom(s *Server, it clinical.LabTestItem, patient clinical.Patient) examItemView {
	master, _ := s.clinical.LabItemMasterFor(it.ItemCode)
	j := s.clinical.Evaluate(it, patient.Species, patient.Sex)
	v := examItemView{
		ItemCode: it.ItemCode,
		Name:     master.Name,
		Unit:     master.Unit,
		Value:    formatNum(it.ValueNum),
		Judgment: j.Value,
		Flag:     j.Flag,
	}
	if it.ValueText != nil && *it.ValueText != "" {
		v.Value = *it.ValueText
	}
	if j.Low != nil {
		v.Low = formatNum(j.Low)
	}
	if j.High != nil {
		v.High = formatNum(j.High)
	}
	return v
}

func (s *Server) handleExam(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")

	if r.Method == http.MethodPost {
		s.handleExamPost(w, r, karteNo)
		return
	}

	labTestID, _ := strconv.Atoi(r.URL.Query().Get("lab_test_id"))
	data, ok := s.buildExamView(karteNo, labTestID)
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "exam", data)
}

func (s *Server) handleExamPost(w http.ResponseWriter, r *http.Request, karteNo string) {
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()

	codes := r.Form["item_code"]
	values := r.Form["value"]
	items := make([]clinical.LabTestItem, 0, len(codes))
	for i, code := range codes {
		if code == "" {
			continue
		}
		v := at(values, i)
		if v == "" {
			continue // 未入力の項目は保存しない（項目自体は毎回マスタから出す）
		}
		item := clinical.LabTestItem{ItemCode: code}
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			item.ValueNum = &f
		} else {
			item.ValueText = &v
		}
		items = append(items, item)
	}

	test, err := s.clinical.CreateLabTest(patient.ID, clinical.LabTest{
		Category: r.FormValue("category"),
		TestedOn: r.FormValue("tested_on"),
	}, items)

	if err != nil {
		data, ok := s.buildExamView(karteNo, 0)
		if ok {
			data.ErrorMessage = messageFor(err)
		}
		_ = s.views.RenderHTTP(w, http.StatusOK, "exam", data)
		return
	}

	data, _ := s.buildExamView(karteNo, test.ID)
	_ = s.views.RenderHTTP(w, http.StatusOK, "exam", data)
}
