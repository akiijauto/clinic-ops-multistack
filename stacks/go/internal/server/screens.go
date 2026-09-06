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
	Links           []navLink
	VisitCountToday int
}

// topNav はトップ画面から辿れる26画面（＋新規2画面）への入口。
// 死んだリンクの検算（検算8）が「28画面分以上」を求めるため、個別画面
// （動物・伝票・予約IDに依存するもの）は例のIDで実在するものを1つ載せる。
func topNav() []navLink {
	return []navLink{
		{Href: "/about", Label: "このシステムについて"},
		{Href: "/today", Label: "本日の患者"},
		{Href: "/animals/new", Label: "新規登録"},
		{Href: "/animals/10001", Label: "顧客（例：10001）"},
		{Href: "/search", Label: "検索"},
		{Href: "/animals/10001/history", Label: "来院履歴（例：10001）"},
		{Href: "/animals/10001/delete", Label: "削除（例：10001）"},
		{Href: "/folded/audit_log", Label: "折りたたみ表示"},
		{Href: "/animals/10001/karte", Label: "カルテ（例：10001）"},
		{Href: "/animals/10001/exam", Label: "検査（例：10001）"},
		{Href: "/animals/10001/dosing/1", Label: "投薬（例：10001）"},
		{Href: "/animals/10001/prevention/1", Label: "予防（例：10001）"},
		{Href: "/animals/10001/papers", Label: "書類（例：10001）"},
		{Href: "/animals/10001/accounting", Label: "会計（例：10001）"},
		{Href: "/animals/10001/accounting/history", Label: "会計履歴（例：10001）"},
		{Href: "/dm", Label: "DM"},
		{Href: "/sales", Label: "売上集計"},
		{Href: "/animals/10001/ward", Label: "入院（例：10001）"},
		{Href: "/reservations", Label: "予約"},
		{Href: "/todo/temp_save", Label: "ToDo（例：一時保存）"},
		{Href: "/staff", Label: "スタッフ"},
		{Href: "/settings", Label: "設定"},
		{Href: "/settings/features", Label: "機能設定"},
		{Href: "/settings/import", Label: "取込"},
		{Href: "/settings/master", Label: "マスタ"},
	}
}

func (s *Server) handleTop(w http.ResponseWriter, r *http.Request) {
	count := 0
	if s.reception != nil {
		count = s.reception.VisitCountToday()
	}
	_ = s.views.RenderHTTP(w, http.StatusOK, "top", topView{Links: topNav(), VisitCountToday: count})
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
