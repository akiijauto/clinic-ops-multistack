# 予約（新）一覧。spec/screens.md #19。新規作成・変更フォームは本実装フェーズで足す。
class ReservationsController < ApplicationController
  def index
    @date = params[:from].present? ? Date.parse(params[:from]) : Date.current
    @reservations = Reservation.includes(:patient, :staff).order(:starts_at).limit(50)
  end
end
