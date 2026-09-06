# カルテ（spec/screens.md #9）。1回の診察（Visit）と経過記録（ProgressNote）をまとめて記録する。
#
# 画面・印刷とも**同じ全診察分の経過記録を、同じ並びで**表示する
# （検算4は screen と print の data-check 値を突き合わせるため、
# ここで並びをずらすと一致しなくなる。coordination/qa/lane-b.md 参照）。
class KarteController < ApplicationController
  before_action :set_patient

  def show
    load_visits
    @form_visit = selected_visit || @patient.visits.build(visit_date: Date.current)
    render :show
  end

  def new_visit
    load_visits
    @form_visit = @patient.visits.build(visit_date: Date.current)
    render :show
  end

  # 直前の診察が無いときは新規診察フォームをそのまま開く（灰色にする判断は
  # 画面側＝リンクの見た目に任せる。ここでは404にしない）。
  def copy_prev
    load_visits
    prev = @patient.visits.kept.order(visit_no: :desc).first
    @form_visit = @patient.visits.build(
      visit_date: Date.current,
      body_weight_kg: prev&.body_weight_kg,
      chief_complaint: prev&.chief_complaint,
      symptom: prev&.symptom,
      diagnosis: prev&.diagnosis,
      treatment: prev&.treatment
    )
    render :show
  end

  # 書きかけの自動保存（/karte/draft系）はこの企画では作らない（model.md）ため、
  # サーバ側に捨てる状態は無い。フォームを空へ戻すだけの操作。
  def cancel
    load_visits
    @form_visit = @patient.visits.build(visit_date: Date.current)
    @notice = "入力を破棄しました。"
    render :show
  end

  def save
    visit = params[:visit_id].presence ? @patient.visits.kept.find(params[:visit_id]) : @patient.visits.build
    visit.assign_attributes(visit_form_params)

    if visit.save
      load_visits
      @form_visit = visit
      @notice = "保存しました。"
    else
      load_visits
      @form_visit = visit
      @error = visit.errors.full_messages.to_sentence
    end
    render :show
  end

  def print
    load_visits
    render layout: false
  end

  def print_visit
    @visits = [ @patient.visits.kept.find(params[:visit_id]) ]
    render :print, layout: false
  end

  def delete_visit
    visit = @patient.visits.find(params[:visit_id])
    visit.soft_delete!
    load_visits
    @form_visit = @patient.visits.build(visit_date: Date.current)
    @notice = "削除しました。"
    render :show
  end

  def restore_visit
    visit = @patient.visits.find(params[:visit_id])
    visit.restore!
    load_visits
    @form_visit = visit
    @notice = "元に戻しました。"
    render :show
  end

  private

  def set_patient
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
  end

  def load_visits
    @visits = @patient.visits.kept.includes(:progress_notes).order(visit_no: :desc)
  end

  def selected_visit
    return nil if params[:visit_id].blank?

    @patient.visits.kept.find_by(id: params[:visit_id])
  end

  # 経過記録は行ごとに独立した値として保存する（検算3）。全項目が空の新規行は
  # 送らなかったものとして無視する（entry_date 必須のバリデーションに引っかけない）。
  def visit_form_params
    raw = params.require(:visit).permit(
      :visit_date, :visit_time, :body_weight_kg, :chief_complaint, :symptom, :diagnosis, :treatment, :staff_id,
      progress_notes_attributes: [ :id, :entry_date, :temperature_c, :pulse, :respiration, :body_weight_kg,
                                    :symptom_course, :treatment_rx, :note ]
    )

    if raw[:progress_notes_attributes]
      visit_date = raw[:visit_date].presence
      filtered = {}
      raw[:progress_notes_attributes].to_h.each do |idx, row|
        row = row.to_h
        next if row["id"].blank? && row.except("id").values.all?(&:blank?)

        row["entry_date"] = visit_date if row["entry_date"].blank? && visit_date.present?
        filtered[idx] = row
      end
      raw[:progress_notes_attributes] = filtered
    end

    raw
  end
end
