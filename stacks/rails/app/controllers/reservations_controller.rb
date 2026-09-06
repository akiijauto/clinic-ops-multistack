# 予約（新）一覧・登録・変更・取消。spec/screens.md #19・検算6。
# 重なり判定そのものは Reservation モデルのバリデーション（no_overlap）に集約済み。
class ReservationsController < ApplicationController
  def index
    @date = params[:from].present? ? Date.parse(params[:from]) : Date.current
    @reservations = Reservation.includes(:patient, :staff).order(:starts_at).limit(50)
  end

  def new
    @selected_karte_no = params[:karte_no]
    load_form_options
  end

  # 保存の成否によらず200。重複がある場合も error-banner に reservation_conflict の文言を出す
  # （spec/openapi.yaml `screen_create_reservation`。HTMLはステータスコードで判定しない）。
  def create
    @reservation = Reservation.new(reservation_params)
    if @reservation.save
      @success = true
    else
      @error = true
      @error_message = error_message_for(@reservation)
    end
    load_form_options
    render :new
  end

  def show
    @reservation = Reservation.find(params[:id])
    load_form_options
  end

  def update
    @reservation = Reservation.find(params[:id])
    if @reservation.update(reservation_params)
      @success = true
    else
      @error = true
      @error_message = error_message_for(@reservation)
    end
    load_form_options
    render :show
  end

  def cancel
    @reservation = Reservation.find(params[:id])
    @reservation.cancel!
    @success = true
    load_form_options
    render :show
  end

  private

  def load_form_options
    @patients = Patient.kept.order(:karte_no)
    @staffs = Staff.active.order(:staff_code)
  end

  def reservation_params
    params.permit(:patient_id, :starts_at, :ends_at, :staff_id, :room, :purpose, :note)
  end

  def error_message_for(reservation)
    if reservation.errors.of_kind?(:base, :reservation_conflict)
      ApiErrors::MESSAGES[:reservation_conflict]
    else
      reservation.errors.full_messages.join("、")
    end
  end
end
