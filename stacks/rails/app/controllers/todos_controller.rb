# ToDo（spec/screens.md #20）。状態C（あえて動かさないと決めたボタン）を
# 押したときの着地点。押しても保存されない灰色のボタンは3つだけ
# （一時保存／完了全削除／完了削除）——押しても何も起きないのではなく、
# 押すと決めた理由が読める（vet-karte/docs/実装分担-2026-09-05.md）。
class TodosController < ApplicationController
  ITEMS = {
    "temp_save" => {
      title: "一時保存",
      message: "書きかけは自動で控えている。手で押す保存も置くと、どちらを押せば残るのかを覚える" \
                "ことになり、残るものは変わらない。"
    },
    "reception_done_all_delete" => {
      title: "完了全削除",
      message: "消すとその日に何件診たかが数えられなくなる。稼働の前後を比べる作りにしてある。"
    },
    "reception_done_delete" => {
      title: "完了削除",
      message: "消すとその日に何件診たかが数えられなくなる。稼働の前後を比べる作りにしてある。"
    }
  }.freeze

  def show
    @key = params[:key]
    @item = ITEMS[@key]
    if @item.nil?
      render plain: "指定されたデータが見つかりません。", status: :not_found
    end
  end
end
