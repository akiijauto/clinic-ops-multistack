# 検査。spec/screens.md #10。基準値は data/lab_items.json から都度引く（保存しない）。
class ExamsController < ApplicationController
  def show
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @lab_tests = @patient.lab_tests.includes(:lab_test_items).order(tested_on: :desc)
  end
end
