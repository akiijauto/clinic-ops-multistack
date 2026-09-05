package server

import "net/http"

type reservationListJSON struct {
	Items []any `json:"items"`
	Total int   `json:"total"`
}

// handleListReservations は `GET /api/reservations` の最小実装（読み取りのみ）。
// spec/acceptance.md 検算6 が求めるのは「重なりが無いこと」の確認で、
// `data/seed.json` 自体がすでに重なりの無いデータであることを前提にしている
// （tests/expected.py `reservation_conflicts()` が0件を返す）。
// 作成・重複拒否（409 reservation_conflict）は保存先が決まってから足す
// （internal/store/doc.go と同じ理由）。
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
