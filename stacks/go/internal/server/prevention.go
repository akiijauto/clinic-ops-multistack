package server

import (
	"net/http"

	"clinicops/internal/clinical"
)

// この節は「予防」画面（GET+POST /animals/{karte_no}/prevention/{kind_id}）を受け持つ。
//
// 仮決め: spec/screens.md は担当医（Staff）の選択欄を求めるが、internal/clinical は
// スタッフ一覧を読み込んでいない（他領域の担当データのため、パッケージを跨いだ依存を
// 作らない方針——internal/reception・internal/billing も同様に Staff を自前で
// 最小限だけ複製する設計になっている）。この画面では担当医をIDの自由入力欄とし、
// 氏名表示は行わない（未選択でも保存できる、という契約は満たす）。

type preventionRowView struct {
	ID            int
	Content       string
	PerformedDate string
	NextDueDate   string
}

type preventionView struct {
	KindID       int
	KindName     string
	KarteNo      string
	Rows         []preventionRowView
	ErrorMessage string
}

func (s *Server) handlePrevention(w http.ResponseWriter, r *http.Request) {
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
	kind, ok := s.resolveKind(r.PathValue("kind_id"))
	if !ok {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		var nextDue *string
		if v := r.FormValue("next_due_date"); v != "" {
			nextDue = &v
		}
		_, _ = s.clinical.CreatePrevention(patient.ID, clinical.Prevention{
			Kind:          kind.Code,
			Content:       r.FormValue("content"),
			PerformedDate: r.FormValue("performed_date"),
			NextDueDate:   nextDue,
		})
	}

	data := preventionView{KindID: kind.ID, KindName: kind.Name, KarteNo: karteNo}
	for _, p := range s.clinical.Preventions(patient.ID, kind.Code) {
		row := preventionRowView{ID: p.ID, Content: p.Content, PerformedDate: p.PerformedDate}
		if p.NextDueDate != nil {
			row.NextDueDate = *p.NextDueDate
		}
		data.Rows = append(data.Rows, row)
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "prevention", data)
}
