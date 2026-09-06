# 予防（ワクチン等）の実施記録。spec/screens.md #12。
# {kind_id} は整数（マスタ行id。配列順1始まり）とコード文字列の両方を受け付ける
# （FixedData::Masters.kind_by_code_or_id。qa/lane-b.md Q11）。
class PreventionsController < ApplicationController
  before_action :set_patient
  before_action :set_kind

  def show
    return render_kind_not_found unless @kind

    @preventions = @patient.preventions.where(kind: @kind[:code]).ordered
    @staffs = Staff.active.order(:staff_code)
  end

  # 保存の成否によらず200（screens-clinical契約の共通ルール）。
  def save
    return render_kind_not_found unless @kind

    prevention = @patient.preventions.new(prevention_params.merge(kind: @kind[:code]))
    if prevention.save
      @success = true
    else
      @error = true
      @error_message = prevention.errors.full_messages.join("、")
    end
    @preventions = @patient.preventions.where(kind: @kind[:code]).ordered
    @staffs = Staff.active.order(:staff_code)
    render :show
  end

  private

  def set_patient
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
  end

  def set_kind
    @kind = FixedData::Masters.kind_by_code_or_id(params[:kind_id])
  end

  def render_kind_not_found
    render plain: "指定されたデータが見つかりません。", status: :not_found
  end

  def prevention_params
    params.permit(:content, :performed_date, :next_due_date, :staff_id)
  end
end
