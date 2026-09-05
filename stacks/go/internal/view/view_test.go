package view

import (
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"clinicops/internal/config"
)

func TestParseAndRender(t *testing.T) {
	fsys := fstest.MapFS{
		"layouts/base.html": {Data: []byte(`{{define "layout"}}<html><body>{{block "content" .}}{{end}}</body></html>{{end}}`)},
		"pages/sample.html": {Data: []byte(`{{define "content"}}<p>{{.Name}} {{runelen .Name}}</p>{{end}}`)},
	}
	set, err := Parse(fsys, nil)
	if err != nil {
		t.Fatalf("解析に失敗: %v", err)
	}

	var sb strings.Builder
	if err := set.Render(&sb, "sample", map[string]string{"Name": "犬猫"}); err != nil {
		t.Fatalf("描画に失敗: %v", err)
	}
	// 文字数で数える。バイト数（6）ではない。
	if want := "<p>犬猫 2</p>"; !strings.Contains(sb.String(), want) {
		t.Errorf("出力 = %q, %q を含むはず", sb.String(), want)
	}
}

func TestRenderUnknownPage(t *testing.T) {
	set, err := Parse(fstest.MapFS{}, nil)
	if err != nil {
		t.Fatalf("解析に失敗: %v", err)
	}
	var sb strings.Builder
	if err := set.Render(&sb, "ない画面", nil); err == nil {
		t.Error("無い画面を描画してエラーにならなかった")
	}
}

func TestJSTFunc(t *testing.T) {
	fn := FuncMap()["jst"].(func(string, time.Time) string)
	// UTC 2026-09-05 15:30 は JST では翌日 00:30。
	utc := time.Date(2026, 9, 5, 15, 30, 0, 0, time.UTC)
	if got, want := fn("2006-01-02 15:04", utc), "2026-09-06 00:30"; got != want {
		t.Errorf("jst = %q, 期待 %q", got, want)
	}
	if config.JST.String() != "JST" {
		t.Errorf("JST の名前 = %q", config.JST.String())
	}
}
