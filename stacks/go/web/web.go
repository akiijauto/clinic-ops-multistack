// Package web は画面の素材（テンプレートと静的ファイル）を実行ファイルへ埋め込む。
//
// 埋め込むのは配布のためだけではない。作業ディレクトリがどこであっても
// 同じ素材で動くので、「手元では出るがテストでは出ない」を消せる。
package web

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed templates
var templatesFS embed.FS

//go:embed static
var staticFS embed.FS

// Templates は templates/ を根とするファイルシステムを返す。
func Templates() fs.FS {
	sub, err := fs.Sub(templatesFS, "templates")
	if err != nil {
		panic(fmt.Sprintf("埋め込み templates/ を開けない: %v", err))
	}
	return sub
}

// Static は static/ を根とするファイルシステムを返す。
func Static() fs.FS {
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		panic(fmt.Sprintf("埋め込み static/ を開けない: %v", err))
	}
	return sub
}

// Assets は静的ファイルの内容ハッシュを持つ。
//
// ブラウザは同じURLの古い中身を平気で使い回すので、
// CSS/JS のURLに内容から作った印を付けて、中身が変わればURLも変わるようにする。
// サーバーの応答が新しくても、利用者の画面が古いままになる事故を防ぐため。
type Assets struct {
	fsys    fs.FS
	digests map[string]string
}

// NewAssets は静的ファイルを走査して内容ハッシュを作る。
func NewAssets(fsys fs.FS) (*Assets, error) {
	a := &Assets{fsys: fsys, digests: map[string]string{}}
	err := fs.WalkDir(fsys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		b, err := fs.ReadFile(fsys, p)
		if err != nil {
			return fmt.Errorf("静的ファイル %s を読めない: %w", p, err)
		}
		sum := sha256.Sum256(b)
		a.digests[p] = hex.EncodeToString(sum[:])[:12]
		return nil
	})
	if err != nil {
		return nil, err
	}
	return a, nil
}

// Path は画面から参照するURLを返す。内容が変われば末尾の印も変わる。
// 未知の名前は印を付けずに返す（画面を落とさない）。
func (a *Assets) Path(name string) string {
	clean := strings.TrimPrefix(path.Clean("/"+name), "/")
	if d, ok := a.digests[clean]; ok {
		return "/static/" + clean + "?v=" + d
	}
	return "/static/" + clean
}

// UICSSHandler は共通CSS（`spec/ui.css`）を **`/ui.css` のまま**配る
// http.Handler（内容ハッシュ付きの `/static/...?v=...` は使わない）。
//
// 5実装が同じ `/ui.css` というURLを共有する契約（指揮役の指示）のため、
// 内容ハッシュでURLを変える通常の静的配信の仕組みとは別枠にする。
// 中身はビルド時に `web/static/ui.css` へコピーしたもの（1文字も変えていない）。
func (a *Assets) UICSSHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := fs.ReadFile(a.fsys, "ui.css")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(b)
	})
}

// Handler は静的ファイルを返す http.Handler。
// 印つきで求められたものだけ長く持たせる。印が無いものは毎回確かめさせる。
func (a *Assets) Handler() http.Handler {
	fileServer := http.FileServer(http.FS(a.fsys))
	return http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean("/"+strings.TrimPrefix(r.URL.Path, "/")), "/")
		if d, ok := a.digests[name]; ok && r.URL.Query().Get("v") == d {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fileServer.ServeHTTP(w, r)
	}))
}
