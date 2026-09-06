# 本日の患者（受付）データのルート（spec/openapi.yaml `/api/receptions` 等）。
# `/api/patients/{karte_no}/receptions`（Api::PatientsController#create_reception）とは
# 別オペレーション（`api_create_reception` は患者IDを本文で指定する汎用の受付登録）。
module Api
  class ReceptionsController < ApiController
    def index
      date = params[:date].present? ? Date.parse(params[:date]) : Date.current
      scope = Reception.for_jst_date(date).of_kind(params[:kind])
      receptions = scope.includes(:patient).order(:display_no)
      render json: { items: receptions.map { |r| reception_json(r) }, total: receptions.size }
    end

    def create
      reception = Reception.new(reception_params)
      reception.save!
      render json: reception_json(reception), status: :created
    end

    def show
      reception = Reception.find(params[:id])
      render json: reception_json(reception)
    end

    def update
      reception = Reception.find(params[:id])
      reception.update!(reception_params)
      render json: reception_json(reception)
    end

    private

    def reception_params
      params.permit(:patient_id, :display_no, :received_at, :owner_purpose, :medical_purpose, :status, :staff_id, :kind)
    end

    def reception_json(r)
      {
        id: r.id, patient_id: r.patient_id, display_no: r.display_no, received_at: r.received_at,
        owner_purpose: r.owner_purpose, medical_purpose: r.medical_purpose, status: r.status,
        staff_id: r.staff_id, kind: r.kind
      }
    end
  end
end
