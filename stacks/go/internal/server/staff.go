package server

import (
	"net/http"
	"strconv"
	"time"
)

// この節は「スタッフ（担当選択）」画面を受け持つ（spec/screens.md 21章）。
//
// 認証ではない（coordination/DECISIONS.md「この計画では認証を扱わない」）。
// 「選んだ担当は、別の画面へ移っても保持される」を満たすため、Cookieに
// staff_id だけを持つ（パスワードは一切扱わない。Staff.password_hash は
// この画面のどこにも出さない・送信しない）。

const staffCookieName = "clinicops_staff_id"

type staffRowView struct {
	ID       int
	Name     string
	Role     string
	Selected bool
}

type staffView struct {
	Rows     []staffRowView
	Selected int
}

// currentStaffID は Cookie から選択中の担当IDを読む（無ければ0）。
func currentStaffID(r *http.Request) int {
	c, err := r.Cookie(staffCookieName)
	if err != nil {
		return 0
	}
	id, err := strconv.Atoi(c.Value)
	if err != nil {
		return 0
	}
	return id
}

func (s *Server) handleStaff(w http.ResponseWriter, r *http.Request) {
	if s.reception == nil {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		if r.FormValue("action") == "clear" {
			http.SetCookie(w, &http.Cookie{Name: staffCookieName, Value: "", Path: "/", MaxAge: -1})
		} else if idStr := r.FormValue("staff_id"); idStr != "" {
			if _, ok := s.reception.StaffByID(atoiOr0(idStr)); ok {
				http.SetCookie(w, &http.Cookie{
					Name: staffCookieName, Value: idStr, Path: "/",
					Expires: time.Now().Add(365 * 24 * time.Hour),
				})
			}
		}
	}

	selected := currentStaffID(r)
	var rows []staffRowView
	for _, st := range s.reception.AllStaff() {
		if !st.IsActive {
			continue
		}
		rows = append(rows, staffRowView{ID: st.ID, Name: st.Name, Role: st.Role, Selected: st.ID == selected})
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "staff", staffView{Rows: rows, Selected: selected})
}

func atoiOr0(s string) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}
