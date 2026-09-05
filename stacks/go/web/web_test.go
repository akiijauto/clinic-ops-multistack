package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAssetPathHasContentDigest(t *testing.T) {
	a, err := NewAssets(Static())
	if err != nil {
		t.Fatalf("静的ファイルの読み込みに失敗: %v", err)
	}
	got := a.Path("app.css")
	if !strings.HasPrefix(got, "/static/app.css?v=") {
		t.Fatalf("URL = %q, 期待は内容ハッシュ付き", got)
	}
}

func TestStaticHandlerServesFile(t *testing.T) {
	a, err := NewAssets(Static())
	if err != nil {
		t.Fatalf("静的ファイルの読み込みに失敗: %v", err)
	}
	rec := httptest.NewRecorder()
	a.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, a.Path("app.css"), nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("状態コード = %d, 期待 %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Cache-Control"); !strings.Contains(got, "immutable") {
		t.Errorf("Cache-Control = %q, 印が一致したときは長く持たせる想定", got)
	}
}
