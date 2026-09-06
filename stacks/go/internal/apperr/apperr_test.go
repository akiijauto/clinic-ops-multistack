package apperr

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteUsesFixedMessage(t *testing.T) {
	rec := httptest.NewRecorder()
	Write(rec, New(NotFound))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, 期待 %d", rec.Code, http.StatusNotFound)
	}
	want := `{"error":{"code":"not_found","message":"指定されたデータが見つかりません。"}}`
	if got := rec.Body.String(); got != want {
		t.Errorf("body = %q, 期待 %q", got, want)
	}
}

func TestWithDetailsRequiresAtLeastOne(t *testing.T) {
	e := New(InvalidInput).WithDetails(Detail{Field: "staff_id", Message: "実施者（staff_id）は必須です。"})
	if len(e.Details) != 1 {
		t.Fatalf("Details = %v", e.Details)
	}
	// 0件を渡したら付けない（契約は「最低1件」を求めるので、0件の details 配列を作らない）。
	e2 := New(InvalidInput).WithDetails()
	if e2.Details != nil {
		t.Errorf("Details = %v, 期待 nil", e2.Details)
	}
}

func TestMessageMatchesAllCodes(t *testing.T) {
	for _, c := range []Code{InvalidJSON, InvalidInput, NotFound, Forbidden, SaveFailed, ReservationConflict} {
		if Message(c) == "" {
			t.Errorf("Code %q に文言が無い", c)
		}
		if New(c).Status() == http.StatusInternalServerError && c != SaveFailed {
			t.Errorf("Code %q の Status が既定(500)にフォールバックしている = 未登録の疑い", c)
		}
	}
}
