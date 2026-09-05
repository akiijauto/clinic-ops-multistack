# 入院。spec/screens.md #18。
class WardsController < ApplicationController
  def today
    @date = params[:date].present? ? Date.parse(params[:date]) : Date.current
    @hospitalizations = Hospitalization.open_on(@date).includes(:patient)
  end

  def animal
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @hospitalizations = @patient.hospitalizations.includes(:care_records).order(admitted_on: :desc)
  end
end
