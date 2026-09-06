package server

import "net/http"

// この節は「ToDo（個別の理由表示）」画面を受け持つ（spec/screens.md 20章）。
//
// 状態C（あえて動かさないと決めたもの）の理由を、押したボタン1つについて表示する。
// key の語彙はこの実装で決める（spec/openapi.yaml「key の語彙は spec/screens.md /
// spec/acceptance.md を正とする」とあるが、具体的な文字列はどこにも列挙されて
// いないため、題材（docs/実装分担）にある3つの名前——一時保存／完了全削除／
// 完了削除——から素直に採った。仮決め。coordination/qa/lane-a.md に記録）。

type todoItem struct {
	Key    string
	Title  string
	Where  string
	Reason string
}

func todoItems() []todoItem {
	return []todoItem{
		{
			Key:    "temp_save",
			Title:  "一時保存",
			Where:  "カルテ画面",
			Reason: "書きかけは自動で控えています。手で押す保存も置くと、どちらを押せば残るのかを覚えることになり、残るものは変わりません。",
		},
		{
			Key:    "done_all",
			Title:  "完了全削除",
			Where:  "本日の患者画面",
			Reason: "消すとその日に何件診たかが数えられなくなります。稼働の前後を比べられるようにするため、あえて塞んであります。",
		},
		{
			Key:    "done",
			Title:  "完了削除",
			Where:  "本日の患者画面",
			Reason: "同上。1件だけでも消すと実績の件数と一覧の見え方がずれるため、あえて塞んであります。",
		},
	}
}

// handleTodo は GET /todo/{key}。未知の key は404。
func (s *Server) handleTodo(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	for _, it := range todoItems() {
		if it.Key == key {
			_ = s.views.RenderHTTP(w, http.StatusOK, "todo", it)
			return
		}
	}
	http.NotFound(w, r)
}
