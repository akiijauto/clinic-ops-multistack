package server

import (
	"net/http"
	"strconv"
	"strings"

	"clinicops/internal/clinical"
)

// この節は「予約（新）」画面（一覧・新規作成・詳細変更・取消）を受け持つ
// （spec/screens.md 19章）。重複判定（半開区間・担当/処置室ごと）は
// internal/clinical.CreateReservation/UpdateReservation が持つ
// （coordination/qa/rulings.md「終了時刻＝次の開始時刻は重ならない扱い」）。

type reservationRowView struct {
	ID      int
	Starts  string
	Ends    string
	StaffID string
	Room    string
	Status  string
}

type reservationsView struct {
	Rows           []reservationRowView
	ErrorMessage   string
	SuccessMessage string
}

// handleReservationsScreen は GET+POST /reservations。
func (s *Server) handleReservationsScreen(w http.ResponseWriter, r *http.Request) {
	var errMsg, successMsg string

	if r.Method == http.MethodPost && s.clinical != nil {
		_ = r.ParseForm()
		in, convErr := reservationFromForm(r)
		if convErr != "" {
			errMsg = convErr
		} else {
			_, err := s.clinical.CreateReservation(in)
			if err != nil {
				errMsg = messageFor(err)
			} else {
				successMsg = "登録しました。"
			}
		}
	}

	var rows []reservationRowView
	if s.clinical != nil {
		for _, res := range s.clinical.Reservations() {
			staff := ""
			if res.StaffID != nil {
				staff = strconv.Itoa(*res.StaffID)
			}
			rows = append(rows, reservationRowView{
				ID: res.ID, Starts: res.StartsAt, Ends: res.EndsAt,
				StaffID: staff, Room: res.Room, Status: res.Status,
			})
		}
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "reservations", reservationsView{
		Rows: rows, ErrorMessage: errMsg, SuccessMessage: successMsg,
	})
}

func reservationFromForm(r *http.Request) (clinical.Reservation, string) {
	patientID, _ := strconv.Atoi(r.FormValue("patient_id"))
	if patientID == 0 {
		return clinical.Reservation{}, "動物を指定してください。"
	}
	staffID, err := strconv.Atoi(r.FormValue("staff_id"))
	if err != nil || staffID == 0 {
		return clinical.Reservation{}, "担当を指定してください。"
	}
	in := clinical.Reservation{
		PatientID: patientID,
		StartsAt:  normalizeJSTDateTime(r.FormValue("starts_at")),
		EndsAt:    normalizeJSTDateTime(r.FormValue("ends_at")),
		StaffID:   &staffID,
		Room:      r.FormValue("room"),
	}
	if v := r.FormValue("purpose"); v != "" {
		in.Purpose = &v
	}
	if v := r.FormValue("note"); v != "" {
		in.Note = &v
	}
	return in, ""
}

// normalizeJSTDateTime は HTML の <input type="datetime-local"> が送る値
// （タイムゾーンのオフセットを持たない。例 "2026-09-01T09:30"）に、契約が
// 前提とする "+09:00" を補う。
//
// これが無いと、seed.json 側の値（オフセット付き）と文字列のまま比較する
// 半開区間の重複判定（internal/clinical.overlaps）で、"09:30" が
// "09:30:00+09:00" の**前方一致の接頭辞**になり、本来は等しい時刻なのに
// 「短い方が辞書順で小さい」という文字列比較の性質のせいで
// 「重ならない」はずの境界がずれて「重なる」と誤判定される
// （実測で確認・修正: 2026-09-06）。秒が無ければ ":00" も補う。
func normalizeJSTDateTime(v string) string {
	if v == "" {
		return v
	}
	if strings.HasSuffix(v, "Z") {
		return v // 明示的にUTCで来た値は書き換えない（この画面では基本的に来ない想定）。
	}
	// 既にオフセットが付いている（"T" の後ろに "+" か "-" がある）ならそのまま。
	if idx := strings.IndexByte(v, 'T'); idx >= 0 {
		if strings.ContainsAny(v[idx:], "+-") {
			return v
		}
	}
	if strings.Count(v, ":") == 1 {
		v += ":00" // 秒が無い（"09:30" 形式）
	}
	return v + "+09:00"
}

// handleReservationNew は予約の新規作成フォーム（GET /reservations/new）。
func (s *Server) handleReservationNew(w http.ResponseWriter, r *http.Request) {
	karteNo := r.URL.Query().Get("karte_no")
	_ = s.views.RenderHTTP(w, http.StatusOK, "reservation_form", reservationFormView{KarteNo: karteNo})
}

type reservationFormView struct {
	KarteNo        string
	Reservation    *reservationRowView
	ErrorMessage   string
	SuccessMessage string
}

// handleReservationDetail は詳細／変更（GET+POST /reservations/{id}）。
func (s *Server) handleReservationDetail(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	id, _ := strconv.Atoi(r.PathValue("id"))
	res, ok := s.clinical.ReservationByID(id)
	if !ok {
		http.NotFound(w, r)
		return
	}

	var errMsg, successMsg string
	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		in, convErr := reservationFromForm(r)
		if convErr != "" {
			errMsg = convErr
		} else {
			updated, err := s.clinical.UpdateReservation(id, in)
			if err != nil {
				errMsg = messageFor(err)
			} else {
				res = updated
				successMsg = "変更しました。"
			}
		}
	}

	staff := ""
	if res.StaffID != nil {
		staff = strconv.Itoa(*res.StaffID)
	}
	row := reservationRowView{ID: res.ID, Starts: res.StartsAt, Ends: res.EndsAt, StaffID: staff, Room: res.Room, Status: res.Status}
	_ = s.views.RenderHTTP(w, http.StatusOK, "reservation_form", reservationFormView{
		Reservation: &row, ErrorMessage: errMsg, SuccessMessage: successMsg,
	})
}

// handleReservationCancel は取消（POST /reservations/{id}/cancel）。行は残す。
func (s *Server) handleReservationCancel(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	id, _ := strconv.Atoi(r.PathValue("id"))
	if _, err := s.clinical.CancelReservation(id); err != nil {
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, "/reservations", http.StatusSeeOther)
}
