package server

import (
	"net/http"
	"strconv"
)

type reservationRowView struct {
	ID      int
	Starts  string
	Ends    string
	StaffID string
	Room    string
	Status  string
}

type reservationsView struct {
	Rows []reservationRowView
}

// handleReservationsScreen は「予約」画面（spec/screens.md 19）の一覧表示部分だけ。
// 新規作成・キャンセルは保存先が決まってから足す（internal/store/doc.go）。
func (s *Server) handleReservationsScreen(w http.ResponseWriter, r *http.Request) {
	var rows []reservationRowView
	if s.clinical != nil {
		for _, res := range s.clinical.Reservations() {
			staff := ""
			if res.StaffID != nil {
				staff = strconv.Itoa(*res.StaffID)
			}
			rows = append(rows, reservationRowView{
				ID:      res.ID,
				Starts:  res.StartsAt,
				Ends:    res.EndsAt,
				StaffID: staff,
				Room:    res.Room,
				Status:  res.Status,
			})
		}
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "reservations", reservationsView{Rows: rows})
}
