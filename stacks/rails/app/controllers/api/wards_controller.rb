# 指定日（既定はJSTの本日）に入院中の患者一覧（spec/openapi.yaml `/api/ward`）。
module Api
  class WardsController < ApiController
    def index
      date = params[:date].present? ? Date.parse(params[:date]) : Date.current
      hospitalizations = Hospitalization.open_on(date).includes(:patient, :care_records)
      render json: { items: hospitalizations.map { |h| hospitalization_json(h) }, total: hospitalizations.size }
    end

    private

    def hospitalization_json(h)
      {
        id: h.id, patient_id: h.patient_id, admitted_on: h.admitted_on,
        discharged_on: h.discharged_on, room: h.room,
        care_records: h.care_records.map { |r| care_record_json(r) }
      }
    end

    def care_record_json(r)
      {
        id: r.id, hospitalization_id: r.hospitalization_id, recorded_at: r.recorded_at,
        kind: r.kind, category: r.kind, content: r.content, performed_by_staff_id: r.performed_by_staff_id
      }
    end
  end
end
