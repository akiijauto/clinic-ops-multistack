# 予約の一覧（spec/openapi.yaml `/api/reservations`）。
# 重なり判定そのものは Reservation モデルのバリデーション（no_overlap）に集約済み
# （spec/acceptance.md 検算6）。ここでは一覧を返すだけ。
module Api
  class ReservationsController < ApiController
    def index
      scope = Reservation.all
      scope = scope.where(staff_id: params[:staff_id]) if params[:staff_id].present?
      scope = scope.where(room: params[:room]) if params[:room].present?
      scope = scope.where(status: params[:status]) if params[:status].present?
      scope = scope.where("starts_at >= ?", params[:from]) if params[:from].present?
      scope = scope.where("starts_at < ?", Date.parse(params[:to]) + 1) if params[:to].present?

      total = scope.count
      limit = params[:limit].presence&.to_i || 100
      offset = params[:offset].presence&.to_i || 0
      items = scope.order(:starts_at).limit(limit).offset(offset)

      render json: { items: items.map { |r| reservation_json(r) }, total: total }
    end

    def show
      reservation = Reservation.find(params[:id])
      render json: reservation_json(reservation)
    end

    def create
      reservation = Reservation.new(reservation_params)
      reservation.save!
      render json: reservation_json(reservation), status: :created
    end

    def update
      reservation = Reservation.find(params[:id])
      reservation.update!(reservation_params)
      render json: reservation_json(reservation)
    end

    def cancel
      reservation = Reservation.find(params[:id])
      reservation.cancel!
      render json: reservation_json(reservation)
    end

    private

    def reservation_params
      params.permit(:patient_id, :starts_at, :ends_at, :staff_id, :room, :purpose, :note)
    end

    def reservation_json(r)
      {
        id: r.id, patient_id: r.patient_id, starts_at: r.starts_at, ends_at: r.ends_at,
        staff_id: r.staff_id, room: r.room, purpose: r.purpose, note: r.note, status: r.status
      }
    end
  end
end
