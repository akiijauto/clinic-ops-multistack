package server

import "net/http"

// handleHealth は死活監視。契約（spec/openapi.yaml の /healthz）で
// 「認証を素通しする唯一のルート」と定められている。本文は {"status":"ok"} だけ。
//
// 起動文面は /health と書いていたが、契約と共通テスト（tests/run.py）は
// どちらも /healthz である。**契約が正**なので /healthz を本体とし、
// /health は起動文面との行き違いを吸収する別名として残す
// （coordination/qa/lane-a.md Q-A-07）。
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
