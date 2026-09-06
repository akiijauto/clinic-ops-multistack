package server

import (
	"net/http"
	"strconv"

	"clinicops/internal/apperr"
	"clinicops/internal/clinical"
)

// この節は「カルテ」画面の書き込み系（保存・新規・前回コピー・取消・削除・復元・
// 1診察分の印刷）を受け持つ。表示の組み立ては karte.go の buildKarteView(Focused)
// をそのまま使い、画面ごとに別計算をしない（spec/acceptance.md 検算4と同じ考え方）。

// handleKarteSave は保存（POST /animals/{karte_no}/karte）。
// 保存の成否によらず200を返し、失敗時は打った値のままフォームを再描画する
// （spec/openapi.yaml「HTMLフォーム送信時のエラーの出し方」）。
func (s *Server) handleKarteSave(w http.ResponseWriter, r *http.Request) {
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
	_ = r.ParseForm()

	visitID, _ := strconv.Atoi(r.FormValue("visit_id"))
	in := clinical.Visit{
		VisitDate:      r.FormValue("visit_date"),
		VisitTime:      r.FormValue("visit_time"),
		BodyWeightKg:   parseOptFloat(r.FormValue("body_weight_kg")),
		ChiefComplaint: r.FormValue("chief_complaint"),
		Symptom:        r.FormValue("symptom"),
		Diagnosis:      r.FormValue("diagnosis"),
		Treatment:      r.FormValue("treatment"),
	}
	notes := parseNoteRows(r)

	_, err := s.clinical.SaveVisit(patient.ID, visitID, in, notes)

	data, ok := s.buildKarteViewFocused(karteNo, visitID)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		data.ErrorMessage = messageFor(err)
		// 打った値のまま再描画する（確定済みの値で上書きしない）。
		data.Form = formFromRequest(r, notes)
	} else {
		data.SuccessMessage = "保存しました。"
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

// handleKarteNew は新規診察の入力フォーム（GET /animals/{karte_no}/karte/new）。
func (s *Server) handleKarteNew(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	data, ok := s.buildNewVisitForm(r.PathValue("karte_no"), false)
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

// handleKarteCopyPrev は前回コピー（GET /animals/{karte_no}/karte/copy_prev）。
// 直前の診察が無いときは 404 にせず、空のフォームで返す
// （契約は「直前の診察が無いときだけ灰色でよい」＝ボタン側の話であり、
// 直接叩かれた場合にサーバー側が落ちてよい理由にはならない）。
func (s *Server) handleKarteCopyPrev(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	data, ok := s.buildNewVisitForm(r.PathValue("karte_no"), true)
	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

// handleKarteCancel は取消（POST /animals/{karte_no}/karte/cancel）。
// この実装では書きかけをサーバー側に保持していない（自動保存＝KarteDraftは
// spec/model.md「落としたもの」）ため、「捨てる」操作は最新の保存済みの回を
// 開き直すだけになる（仮決め。coordination/qa/lane-a.md へ記録）。
func (s *Server) handleKarteCancel(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	data, ok := s.buildKarteView(r.PathValue("karte_no"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	data.SuccessMessage = "入力を取り消しました。"
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

// handleVisitDelete は診察の削除（論理削除。POST /animals/{karte_no}/karte/{visit_id}/delete）。
func (s *Server) handleVisitDelete(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")
	visitID, _ := strconv.Atoi(r.PathValue("visit_id"))
	_, err := s.clinical.DeleteVisit(visitID)

	data, ok := s.buildKarteView(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		data.ErrorMessage = messageFor(err)
	} else {
		data.SuccessMessage = "削除しました（一覧からは隠れます。データは残ります）。"
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

// handleVisitRestore は削除の取り消し（POST /animals/{karte_no}/karte/{visit_id}/restore）。
func (s *Server) handleVisitRestore(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	karteNo := r.PathValue("karte_no")
	visitID, _ := strconv.Atoi(r.PathValue("visit_id"))
	_, err := s.clinical.RestoreVisit(visitID)

	data, ok := s.buildKarteView(karteNo)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		data.ErrorMessage = messageFor(err)
	} else {
		data.SuccessMessage = "元に戻しました。"
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "karte", data)
}

// handleVisitPrint は1診察分の印刷（GET /animals/{karte_no}/karte/{visit_id}/print）。
// カルテ本体（karte_print）と同じ部分テンプレート・同じ組み立て関数を使い、
// 対象を1件に絞る（検算4「画面と印刷で同じ値」を1件単位でも保つ）。
func (s *Server) handleVisitPrint(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	visitID, _ := strconv.Atoi(r.PathValue("visit_id"))
	data, ok := s.buildKarteView(r.PathValue("karte_no"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	for _, v := range data.Visits {
		if v.ID == visitID {
			data.Visits = []visitView{v}
			_ = s.views.RenderHTTP(w, http.StatusOK, "karte_print", data)
			return
		}
	}
	http.NotFound(w, r)
}

func messageFor(err error) string {
	if ae, ok := err.(*apperr.Error); ok {
		return ae.Message
	}
	return apperr.Message(apperr.SaveFailed)
}

func parseOptFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}

// parseNoteRows は経過記録の行を、同じ index 同士で束ねて読む。
// HTML側は同名の input を複数並べるだけでよい（name="note_entry_date" 等）。
func parseNoteRows(r *http.Request) []clinical.ProgressNote {
	dates := r.Form["note_entry_date"]
	temps := r.Form["note_temperature_c"]
	pulses := r.Form["note_pulse"]
	resps := r.Form["note_respiration"]
	weights := r.Form["note_body_weight_kg"]
	courses := r.Form["note_symptom_course"]
	rx := r.Form["note_treatment_rx"]
	notes := r.Form["note_note"]

	n := len(dates)
	out := make([]clinical.ProgressNote, 0, n)
	for i := 0; i < n; i++ {
		if dates[i] == "" {
			continue // 空行は保存しない
		}
		out = append(out, clinical.ProgressNote{
			EntryDate:     dates[i],
			TemperatureC:  parseOptFloat(at(temps, i)),
			Pulse:         parseOptFloat(at(pulses, i)),
			Respiration:   parseOptFloat(at(resps, i)),
			BodyWeightKg:  parseOptFloat(at(weights, i)),
			SymptomCourse: at(courses, i),
			TreatmentRx:   at(rx, i),
			Note:          at(notes, i),
		})
	}
	return out
}

func at(s []string, i int) string {
	if i < len(s) {
		return s[i]
	}
	return ""
}

// formFromRequest は保存に失敗したとき、打った値のままフォームへ戻すための変換。
func formFromRequest(r *http.Request, notes []clinical.ProgressNote) karteFormView {
	form := karteFormView{
		VisitID:        r.FormValue("visit_id"),
		VisitDate:      r.FormValue("visit_date"),
		VisitTime:      r.FormValue("visit_time"),
		BodyWeightKg:   r.FormValue("body_weight_kg"),
		ChiefComplaint: r.FormValue("chief_complaint"),
		Symptom:        r.FormValue("symptom"),
		Diagnosis:      r.FormValue("diagnosis"),
		Treatment:      r.FormValue("treatment"),
	}
	for _, n := range notes {
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
	if len(form.Notes) == 0 {
		form.Notes = append(form.Notes, noteFormView{})
	}
	return form
}
