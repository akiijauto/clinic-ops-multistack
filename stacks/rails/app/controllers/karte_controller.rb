# カルテ（spec/screens.md #9）。いまはこの共通テストの検算3・4が読む部分
# （経過記録の data-check 表示・印刷との一致）だけを実装している。
# 保存・新規診察・削除等（openapi.yaml `/animals/{karte_no}/karte/...` の他の操作）は
# 26画面の本実装フェーズで足す。
#
# 画面・印刷とも**同じ全診察分の経過記録を、同じ並びで**表示する
# （検算4は screen と print の data-check 値を突き合わせるため、
# ここで並びをずらすと一致しなくなる。coordination/qa/lane-b.md 参照）。
class KarteController < ApplicationController
  def show
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @visits = @patient.visits.kept.includes(:progress_notes).order(visit_no: :desc)
    render layout: false
  end

  def print
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @visits = @patient.visits.kept.includes(:progress_notes).order(visit_no: :desc)
    render layout: false
  end
end
