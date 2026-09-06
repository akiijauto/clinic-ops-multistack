package server

import (
	"net/http"
	"strconv"
)

// この節は「書類（紙カルテPDF）」画面を受け持つ。
// spec/screens.md 13章: 取込・取消（論理）・「元から無い」印の付け外し。

type paperRowView struct {
	ID        int
	Title     string
	Note      string
	CreatedAt string
}

type papersView struct {
	KarteNo        string
	Rows           []paperRowView
	NoPaper        bool
	ErrorMessage   string
	SuccessMessage string
}

func (s *Server) buildPapersView(karteNo string) (papersView, bool) {
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		return papersView{}, false
	}
	data := papersView{KarteNo: karteNo, NoPaper: s.clinical.IsNoPaper(patient.ID)}
	for _, p := range s.clinical.Papers(patient.ID) {
		note := ""
		if p.Note != nil {
			note = *p.Note
		}
		data.Rows = append(data.Rows, paperRowView{ID: p.ID, Title: p.Title, Note: note, CreatedAt: p.CreatedAt})
	}
	return data, true
}

// handlePapers は GET+POST /animals/{karte_no}/papers。
// POST は取込（PDFのみ受け付ける）。
func (s *Server) handlePapers(w http.ResponseWriter, r *http.Request) {
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
		title := r.FormValue("title")
		var note *string
		if v := r.FormValue("note"); v != "" {
			note = &v
		}
		if _, err := s.clinical.CreatePaper(patient.ID, title, note); err != nil {
			errMsg = messageFor(err)
		} else {
			successMsg = "取り込みました。"
		}
	}

	data, ok := s.buildPapersView(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	data.ErrorMessage, data.SuccessMessage = errMsg, successMsg
	_ = s.views.RenderHTTP(w, http.StatusOK, "papers", data)
}

// handlePaperRemove は POST /papers/{paper_id}/remove（取消。論理削除）。
func (s *Server) handlePaperRemove(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	id, _ := strconv.Atoi(r.PathValue("paper_id"))
	paper, err := s.clinical.RemovePaper(id)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	patient, _ := s.clinical.PatientByID(paper.PatientID)
	http.Redirect(w, r, "/animals/"+patient.KarteNo+"/papers", http.StatusSeeOther)
}

// handleNoPaper は POST /papers/no-paper（「元から無い」印の付け外し。
// karte_no はフォームで渡す — 契約上パス変数を持たないため）。
func (s *Server) handleNoPaper(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	karteNo := r.FormValue("karte_no")
	patient, ok := s.clinical.PatientByKarteNo(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	s.clinical.SetNoPaper(patient.ID, r.FormValue("value") == "1")
	http.Redirect(w, r, "/animals/"+karteNo+"/papers", http.StatusSeeOther)
}
