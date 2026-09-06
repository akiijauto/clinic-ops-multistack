# 投薬。年度×月のマス目に実施した月へ印を付ける記録。spec/screens.md #11。
# {kind_id} は整数（マスタ行id。配列順1始まり）とコード文字列の両方を受け付ける
# （FixedData::Masters.kind_by_code_or_id。qa/lane-b.md Q11）。
class DosingsController < ApplicationController
  before_action :set_patient
  before_action :set_kind

  def show
    return render_kind_not_found unless @kind

    load_dosings
  end

  # 保存の成否によらず200（screens-clinical契約の共通ルール）。
  # 年度を入れずに送信しても新しい行は増えない（spec/screens.md #11）。
  def save
    return render_kind_not_found unless @kind

    fiscal_year = params[:fiscal_year].presence

    if fiscal_year.blank?
      @error = true
      @error_message = "年度を入力してください。"
    else
      dosing = @patient.dosings.find_or_initialize_by(kind: @kind[:code], fiscal_year: fiscal_year)
      begin
        dosing.apply_month_values!(month_values)
        @success = true
      rescue ActiveRecord::RecordInvalid => e
        @error = true
        @error_message = e.record.errors.full_messages.join("、")
      end
    end

    load_dosings
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

  def load_dosings
    @dosings = @patient.dosings.where(kind: @kind[:code]).order(:fiscal_year)
  end

  def month_values
    Dosing::MONTH_COLUMNS.index_with { |col| params[col] }
  end
end
