# 本日の患者（受付一覧）。spec/screens.md #1。
class ReceptionsController < ApplicationController
  def index
    @today_count = Reception.for_jst_date(Date.current).count
    @receptions = Reception.for_jst_date(Date.current)
                            .hide_done(params[:hide] == "1")
                            .includes(patient: :owner)
                            .order(:display_no)
  end
end
