# 入院。spec/screens.md #18。
class WardsController < ApplicationController
  def today
    @date = params[:date].present? ? Date.parse(params[:date]) : Date.current
    @hospitalizations = Hospitalization.open_on(@date).includes(:patient)
  end

  def day
    @date = params[:date].present? ? Date.parse(params[:date]) : Date.current
    @hospitalizations = Hospitalization.open_on(@date).includes(:patient)
    render :today
  end

  def animal
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @hospitalizations = @patient.hospitalizations.includes(:care_records).order(admitted_on: :desc)
  end

  # 入院の開始（入院登録）。
  def admit
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    hospitalization = @patient.hospitalizations.build(admit_params)
    if hospitalization.save
      @success = true
    else
      @error = true
      @error_message = hospitalization.errors.full_messages.join("、")
    end
    load_hospitalizations
    render :animal
  end

  # ケア記録を1行追加する。実施者が空だと保存できない（検算7・spec/screens.md #18）。
  def add_care_record
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    hospitalization = @patient.hospitalizations.find(params[:hospitalization_id])
    record = hospitalization.care_records.build(care_record_params)
    if record.save
      @success = true
    else
      @error = true
      @error_message = record.errors.full_messages.join("、")
    end
    load_hospitalizations
    render :animal
  end

  # 退院日を入力して入院を終了する。
  def discharge
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    hospitalization = @patient.hospitalizations.find(params[:hospitalization_id])
    if hospitalization.update(discharged_on: params[:discharged_on].presence || Date.current)
      @success = true
    else
      @error = true
      @error_message = hospitalization.errors.full_messages.join("、")
    end
    load_hospitalizations
    render :animal
  end

  private

  def load_hospitalizations
    @hospitalizations = @patient.hospitalizations.includes(:care_records).order(admitted_on: :desc)
  end

  def admit_params
    {
      admitted_on: params[:admitted_on].presence || Date.current,
      room: params[:room]
    }
  end

  def care_record_params
    {
      recorded_at: Time.current,
      kind: params[:kind],
      content: params[:content],
      performed_by_staff_id: params[:performed_by_staff_id].presence
    }
  end
end
