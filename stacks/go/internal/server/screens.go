package server

import "net/http"

// この段階（rules/crawl組）で最小限必要な画面だけを用意する。
// 中身の作り込みは spec/screens.md の各節が来てから広げる。
// いまは「404にならず、サーバーエラーの文字列を返さない」ことが満たすべき条件
// （spec/acceptance.md 検算8）。

type topView struct {
	VisitCountToday int
}

// かつてここに topNav()（トップ画面から辿れる26画面への入口）があったが、
// spec/screens.md「トップ画面の本文」（2026-09-06追記）でトップの本文は
// h1・説明・本日の患者への導線1本だけと決まったため撤去した
// （coordination/qa/lane-a.md に理由を記録）。個別画面（動物・伝票IDに
// 依存するもの）への導線は、本日の患者・検索など他画面が自然に持つものに
// 任せる。検算8（死んだリンクが無い）はそれで足りることを実測済み。
func (s *Server) handleTop(w http.ResponseWriter, r *http.Request) {
	count := 0
	if s.reception != nil {
		count = s.reception.VisitCountToday()
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "top", topView{VisitCountToday: count})
}

// stubView は、まだ作り込んでいない画面の最小表示。
// 「B/C（この企画では作らない）」ではなく単に着手順の都合なので、
// 押せるボタンや保存フォームは置かない（spec/screens.md「できます」と
// 見せて出来ていない状態を作らない、と同じ考え方を適用する）。
type stubView struct {
	Title string
	Note  string
}

// stubHandler は Server のメソッドではなく、Handler() の中で複数の経路に
// 使い回すためのちょっとした工場関数。View の描画だけなので依存は views で足りる。
func (s *Server) stubHandler(title, note string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_ = s.views.RenderHTTP(w, http.StatusOK, "stub", stubView{Title: title, Note: note})
	}
}
