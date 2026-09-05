package server

import (
	"encoding/json"
	"net/http"
)

// writeJSON は JSON を1本の応答として書く。
//
// json.NewEncoder(w).Encode は末尾に改行を足すので使わない。
// 本文をそのまま突き合わせるテストがあると改行1文字で落ちるため、
// Marshal してから書く形にしてある。
func writeJSON(w http.ResponseWriter, status int, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(b)
}
