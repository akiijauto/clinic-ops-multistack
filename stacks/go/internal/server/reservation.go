package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"clinicops/internal/apperr"
	"clinicops/internal/clinical"
)

// この節は「予約」のデータのルート（JSON API）を受け持つ。
// 業務ロジック（半開区間の重複判定・キャンセル済みは対象外）は
// internal/clinical.CreateReservation 等（画面ルートと共通）に集約してある。

type reservationListJSON struct {
	Items []any `json:"items"`
	Total int   `json:"total"`
}

// reservationFilter は `GET /reservations`（画面）・`GET /api/reservations`
// （API）が共通で使う絞り込み条件（spec/openapi.yaml の from/to/staff_id/room/status）。
type reservationFilter struct {
	From, To string // 日付("YYYY-MM-DD")。空なら無制限
	StaffID  string // 空なら絞り込まない
	Room     string
	Status   string
}

func reservationFilterFromQuery(q map[string][]string) reservationFilter {
	get := func(k string) string {
		if v := q[k]; len(v) > 0 {
			return v[0]
		}
		return ""
	}
	return reservationFilter{From: get("from"), To: get("to"), StaffID: get("staff_id"), Room: get("room"), Status: get("status")}
}

// matches は1件の予約が絞り込み条件に合うかを見る。
// StartsAt は "2026-09-01T09:00:00+09:00" 形式で、先頭10文字が暦日
// （from/to と同じ "YYYY-MM-DD" 形式なので文字列のまま比較できる）。
func (f reservationFilter) matches(res clinical.Reservation) bool {
	if f.From != "" && len(res.StartsAt) >= 10 && res.StartsAt[:10] < f.From {
		return false
	}
	if f.To != "" && len(res.StartsAt) >= 10 && res.StartsAt[:10] > f.To {
		return false
	}
	if f.StaffID != "" && (res.StaffID == nil || strconv.Itoa(*res.StaffID) != f.StaffID) {
		return false
	}
	if f.Room != "" && res.Room != f.Room {
		return false
	}
	if f.Status != "" && res.Status != f.Status {
		return false
	}
	return true
}

// handleListReservations は `GET /api/reservations`（読み取り）。
//
// 以前は from/to/staff_id/room/status のいずれも見ておらず、絞り込みが
// 常に無視されていた（レーンR 5巡目レビュー、`spec/openapi.yaml` が
// 「期間・担当・処置室で絞り込み」と明記しているのに反する）。
func (s *Server) handleListReservations(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		writeJSON(w, http.StatusOK, reservationListJSON{Items: []any{}, Total: 0})
		return
	}
	f := reservationFilterFromQuery(r.URL.Query())
	all := s.clinical.Reservations()
	items := make([]any, 0, len(all))
	for _, res := range all {
		if f.matches(res) {
			items = append(items, res)
		}
	}
	writeJSON(w, http.StatusOK, reservationListJSON{Items: items, Total: len(items)})
}

// reservationCreateJSON は spec/openapi.yaml の ReservationCreate スキーマ。
type reservationCreateJSON struct {
	PatientID int     `json:"patient_id"`
	StartsAt  string  `json:"starts_at"`
	EndsAt    string  `json:"ends_at"`
	StaffID   int     `json:"staff_id"`
	Room      string  `json:"room"`
	Purpose   *string `json:"purpose"`
	Note      *string `json:"note"`
}

// handleCreateReservationAPI は `POST /api/reservations`。
// 重なりがあれば 409 reservation_conflict（apperr が status を持つ）。
func (s *Server) handleCreateReservationAPI(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	var in reservationCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	if in.PatientID == 0 || in.StartsAt == "" || in.EndsAt == "" || in.StaffID == 0 || in.Room == "" {
		apperr.Write(w, apperr.New(apperr.InvalidInput).WithDetails(
			apperr.Detail{Field: "patient_id/starts_at/ends_at/staff_id/room", Message: "必須の項目が不足しています。"},
		))
		return
	}
	staffID := in.StaffID
	res, err := s.clinical.CreateReservation(clinical.Reservation{
		PatientID: in.PatientID, StartsAt: in.StartsAt, EndsAt: in.EndsAt,
		StaffID: &staffID, Room: in.Room, Purpose: in.Purpose, Note: in.Note,
	})
	if err != nil {
		if ae, ok := err.(*apperr.Error); ok {
			apperr.Write(w, ae)
		} else {
			apperr.Write(w, apperr.New(apperr.SaveFailed))
		}
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

// handleReservationAPI は `GET/PATCH /api/reservations/{id}`。
func (s *Server) handleReservationAPI(w http.ResponseWriter, r *http.Request) {
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
		res, ok := s.clinical.ReservationByID(id)
		if !ok {
			apperr.Write(w, apperr.New(apperr.NotFound))
			return
		}
		writeJSON(w, http.StatusOK, res)
		return
	}

	// PATCH
	var in reservationCreateJSON
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		apperr.Write(w, apperr.New(apperr.InvalidJSON))
		return
	}
	staffID := in.StaffID
	res, err := s.clinical.UpdateReservation(id, clinical.Reservation{
		PatientID: in.PatientID, StartsAt: in.StartsAt, EndsAt: in.EndsAt,
		StaffID: &staffID, Room: in.Room, Purpose: in.Purpose, Note: in.Note,
	})
	if err != nil {
		if ae, ok := err.(*apperr.Error); ok {
			apperr.Write(w, ae)
		} else {
			apperr.Write(w, apperr.New(apperr.SaveFailed))
		}
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// handleCancelReservationAPI は `POST /api/reservations/{id}/cancel`。
func (s *Server) handleCancelReservationAPI(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	id, convErr := strconv.Atoi(r.PathValue("id"))
	if convErr != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	res, err := s.clinical.CancelReservation(id)
	if err != nil {
		apperr.Write(w, apperr.New(apperr.NotFound))
		return
	}
	writeJSON(w, http.StatusOK, res)
}
