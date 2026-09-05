package server

import "net/http"

// この段階（rules/crawl組）で最小限必要な画面だけを用意する。
// 中身の作り込みは spec/screens.md の各節が来てから広げる。
// いまは「404にならず、サーバーエラーの文字列を返さない」ことが満たすべき条件
// （spec/acceptance.md 検算8）。

type navLink struct {
	Href  string
	Label string
}

type topView struct {
	Links []navLink
}

// topNav はトップ画面から辿れる主要画面の一覧。
// spec/screens.md の26画面のうち、この段階で用意したものだけを載せる。
func topNav() []navLink {
	return []navLink{
		{Href: "/about", Label: "このシステムについて"},
		{Href: "/today", Label: "本日の患者"},
		{Href: "/search", Label: "検索"},
		{Href: "/staff", Label: "スタッフ"},
		{Href: "/settings", Label: "設定"},
		{Href: "/settings/features", Label: "機能設定"},
		{Href: "/settings/import", Label: "取込"},
		{Href: "/sales", Label: "売上集計"},
		{Href: "/dm", Label: "DM"},
		{Href: "/ward", Label: "入院"},
		{Href: "/reservations", Label: "予約"},
		{Href: "/animals/10001/karte", Label: "カルテ（例：10001）"},
	}
}

func (s *Server) handleTop(w http.ResponseWriter, r *http.Request) {
	_ = s.views.RenderHTTP(w, http.StatusOK, "top", topView{Links: topNav()})
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
