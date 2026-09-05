package server

import (
	"net/http"
	"strconv"
)

type careRecordListJSON struct {
	Items []any `json:"items"`
	Total int   `json:"total"`
}

// handleListCareRecords は `GET /api/hospitalizations/{id}/care-records`。
// 実施者（`performed_by_staff_id`）は `data/seed.json` の時点で全行に入っている
// （spec/acceptance.md 検算7）。作成時の拒否（実施者が空の行を保存させない）は
// 保存先が決まってから足す。
func (s *Server) handleListCareRecords(w http.ResponseWriter, r *http.Request) {
	if s.clinical == nil {
		http.NotFound(w, r)
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	h, ok := s.clinical.Hospitalization(id)
	if !ok {
		http.NotFound(w, r)
		return
	}
	items := make([]any, len(h.CareRecords))
	for i, cr := range h.CareRecords {
		items[i] = cr
	}
	writeJSON(w, http.StatusOK, careRecordListJSON{Items: items, Total: len(items)})
}
