# 本日の患者（受付一覧）。spec/screens.md #1。
class ReceptionsController < ApplicationController
  STATUS_LABELS = { "waiting" => "受付待ち", "in_exam" => "診察中", "done" => "完了" }.freeze

  def index
    # spec/screens.md #1: 「対象日の診察件数」は Visit の件数で、Reception の完了件数とは別の数値。
    # 削除済み（deleted_at あり）の Visit も含めて数える（検算9: 削除しても実績としての
    # 件数は減らない）。
    @today_count = Visit.unscoped.where(visit_date: Date.current).count

    # spec/openapi.yaml「省略時はマスタの1つ目。マスタに無い区分が来たら空一覧を出さずに
    # 1つ目へ戻す」。「すべて」という絞らない状態は契約に無い（2026-09-06 指揮役の指摘。
    # 5実装のうちRailsだけが持っていた）。
    @kinds = FixedData::Masters.reception_kinds
    @kind = params[:kind].presence
    @kind = @kinds.first[:code] unless @kinds.any? { |k| k[:code] == @kind }

    @hide_done = params[:hide] == "1"
    @selected_id = params[:selected].presence&.to_i
    @status_labels = STATUS_LABELS

    base = Reception.for_jst_date(Date.current).of_kind(@kind)
    @receptions = base.hide_done(@hide_done).includes(patient: :owner).order(:display_no)
    @done_count = base.where(status: "done").count
  end

  # 上へ／下へ（spec/screens.md #1）。選択行と隣接する行の display_no を入れ替える。
  def move
    reception = Reception.find(params[:id])
    reception.swap_with_neighbor!(params[:direction] == "up" ? :up : :down)
    redirect_to today_return_path(selected: reception.id)
  end

  private

  def today_return_path(selected:)
    query = { kind: params[:kind], hide: params[:hide], selected: selected }.compact
    "/today?#{query.to_query}"
  end
end
