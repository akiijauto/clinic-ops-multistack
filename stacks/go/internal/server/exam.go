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
	// lab_test_id を指定せずに開いたときの既定表示。
	//
	// `spec/openapi.yaml` はこの経路にクエリパラメータを1つも定義しておらず、
	// 既定の中身は各実装の裁量になっている（`spec/screens.md` 10章は
	// 「新規作成」と「保存済みを選んで見る」の両方を「できること」と書くのみ）。
	// カルテ画面（`GET /animals/{karte_no}/karte`）は既定で最新の診察を開き、
	// 空の新規フォームは別の明示的な経路（`/karte/new`）で出す設計なので、
	// 検査画面もそれに揃える: 既定は最新の保存済み検査を表示し、
	// 空の新規フォームは `?new=1` を明示したときだけ出す
	// （以前は既定=空欄だったため、基準外の値・判定色が既定画面には
	// 一切出ず、契約が求める「基準の外にある値は判定欄と色の両方に出る」を
	// 満たす画面に一度もたどり着けなかった — 2026-09-06、在庫検査で発覚）。
	if labTestID == 0 && r.URL.Query().Get("new") != "1" {
		if patient, ok := s.clinical.PatientByKarteNo(karteNo); ok {
			if tests := s.clinical.ListLabTests(patient.ID); len(tests) > 0 {
				labTestID = tests[0].ID
			}
		}
	}
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
