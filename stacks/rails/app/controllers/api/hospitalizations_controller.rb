# 入院1件の詳細・実施記録一覧（spec/openapi.yaml `/api/hospitalizations/{id}` ・
# `/api/hospitalizations/{id}/care-records`）。
module Api
  class HospitalizationsController < ApiController
    def show
      h = Hospitalization.includes(:care_records).find(params[:id])
      render json: hospitalization_json(h)
    end

    def care_records
      h = Hospitalization.find(params[:hospitalization_id])
      records = h.care_records
      render json: { items: records.map { |r| care_record_json(r) }, total: records.size }
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
        kind: r.kind, content: r.content, performed_by_staff_id: r.performed_by_staff_id
      }
    end
  end
end
