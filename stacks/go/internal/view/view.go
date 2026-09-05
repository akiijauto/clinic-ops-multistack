// Package view は html/template を束ねる。
//
// テンプレートエンジンは html/template だけを使う。
// レイアウトの継承・部分テンプレートの読み込み・関数の登録は、
// フレームワークが肩代わりしている部分なので自分で書く。
package view

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"path"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"clinicops/internal/config"
)

// Set は解析済みのテンプレートの集まり。
//
// 1つの template.Template に全部を入れる形は採らない。
// 画面が26枚あると同名のブロック（"content" など）が衝突するため、
// 「レイアウト＋部分テンプレート＋画面1枚」を画面ごとに別の集合として持つ。
type Set struct {
	pages map[string]*template.Template
}

// FuncMap はテンプレートから呼べる関数。
//
// ここに入れる関数は「表示の都合」だけにする。
// 金額の丸めや集計の規則は spec/acceptance.md が決めるので、
// テンプレート側で勝手に丸めないよう、丸める関数は置かない。
func FuncMap() template.FuncMap {
	return template.FuncMap{
		// jst は時刻を JST の指定書式で出す。
		"jst": func(layout string, t time.Time) string {
			return t.In(config.JST).Format(layout)
		},
		// runelen は文字数を数える。バイト数ではない
		// （spec/README.md「文字数で数える。バイト数で数えない」）。
		"runelen": func(s string) int { return utf8.RuneCountInString(s) },
	}
}

// Parse は fsys からテンプレートを読み込む。extra で追加の関数を渡せる
// （静的ファイルのURLを作る関数など、実行時の値に依る関数のため）。
//
//	layouts/*.html   画面を包む枠
//	partials/*.html  複数の画面から使う部品
//	pages/**/*.html  画面1枚ずつ
//
// 画面は "pages/" を除いた相対パスから ".html" を落とした名前で引く。
// 例: pages/patients/list.html → "patients/list"
func Parse(fsys fs.FS, extra template.FuncMap) (*Set, error) {
	funcs := FuncMap()
	for k, v := range extra {
		funcs[k] = v
	}
	base := template.New("base").Funcs(funcs)

	shared, err := parseIfAny(base, fsys, "layouts/*.html", "partials/*.html")
	if err != nil {
		return nil, err
	}

	pages, err := fs.Glob(fsys, "pages/*.html")
	if err != nil {
		return nil, fmt.Errorf("画面テンプレートの走査に失敗: %w", err)
	}
	nested, err := fs.Glob(fsys, "pages/*/*.html")
	if err != nil {
		return nil, fmt.Errorf("画面テンプレートの走査に失敗: %w", err)
	}
	pages = append(pages, nested...)
	sort.Strings(pages)

	set := &Set{pages: make(map[string]*template.Template, len(pages))}
	for _, p := range pages {
		clone, err := shared.Clone()
		if err != nil {
			return nil, fmt.Errorf("共通テンプレートの複製に失敗: %w", err)
		}
		t, err := clone.ParseFS(fsys, p)
		if err != nil {
			return nil, fmt.Errorf("テンプレート %s の解析に失敗: %w", p, err)
		}
		name := strings.TrimSuffix(strings.TrimPrefix(p, "pages/"), path.Ext(p))
		set.pages[name] = t
	}
	return set, nil
}

// parseIfAny は該当するファイルが1つも無くても失敗しない ParseFS。
// html/template の ParseFS は0件だとエラーになるので、その差を吸収する。
func parseIfAny(t *template.Template, fsys fs.FS, patterns ...string) (*template.Template, error) {
	for _, pat := range patterns {
		matches, err := fs.Glob(fsys, pat)
		if err != nil {
			return nil, fmt.Errorf("%s の走査に失敗: %w", pat, err)
		}
		if len(matches) == 0 {
			continue
		}
		t, err = t.ParseFS(fsys, pat)
		if err != nil {
			return nil, fmt.Errorf("%s の解析に失敗: %w", pat, err)
		}
	}
	return t, nil
}

// Names は読み込めた画面テンプレートの名前を並べて返す。
func (s *Set) Names() []string {
	out := make([]string, 0, len(s.pages))
	for name := range s.pages {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// Render は画面を w へ書く。
//
// テンプレートへ直接書かず一度 buffer に貯める。
// 途中でテンプレートの実行が失敗したとき、
// half-written の本文に 200 が付いたまま出るのを防ぐため。
func (s *Set) Render(w io.Writer, name string, data any) error {
	t, ok := s.pages[name]
	if !ok {
		return fmt.Errorf("画面テンプレート %q が無い", name)
	}
	entry := "layout"
	if t.Lookup(entry) == nil {
		entry = path.Base(name) + ".html"
		if t.Lookup(entry) == nil {
			entry = t.Name()
		}
	}
	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, entry, data); err != nil {
		return fmt.Errorf("画面 %s の描画に失敗: %w", name, err)
	}
	_, err := buf.WriteTo(w)
	return err
}

// RenderHTTP は Render の結果を HTTP 応答として返す。
// 失敗したときは 500 を返し、途中まで書かれた本文は出さない。
func (s *Set) RenderHTTP(w http.ResponseWriter, status int, name string, data any) error {
	var buf bytes.Buffer
	if err := s.Render(&buf, name, data); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return err
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, err := buf.WriteTo(w)
	return err
}
