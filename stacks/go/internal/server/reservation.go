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

// handleListReservations は `GET /api/reservations`（読み取り）。
func (s *Server) handleListReservations(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		writeJSON(w, http.StatusOK, reservationListJSON{Items: []any{}, Total: 0})
		return
	}
	rows := s.clinical.Reservations()
	items := make([]any, len(rows))
	for i, res := range rows {
		items[i] = res
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
