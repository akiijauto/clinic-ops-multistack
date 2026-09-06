# 入院の一覧・登録・更新・実施記録（spec/openapi.yaml `/api/patients/{karte_no}/hospitalizations`・
# `/api/hospitalizations/{id}` ・`/api/hospitalizations/{id}/care-records`）。
#
# CareRecord について: spec/openapi.yaml の CareRecord は `category` という名前だが、
# DB列・screens側（WardsController）は `kind`（db/schema.rb 変更不可のため揃えられない）。
# lab_test の judgement/judgment と同じ理由で、入力は両方受け、出力も両方の名前で返す。
module Api
  class HospitalizationsController < ApiController
    def index
      patient = Patient.find_by!(karte_no: params[:karte_no])
      hospitalizations = patient.hospitalizations.includes(:care_records).order(admitted_on: :desc)
      render json: { items: hospitalizations.map { |h| hospitalization_json(h) }, total: hospitalizations.size }
    end

    def create
      patient = Patient.find_by!(karte_no: params[:karte_no])
      hospitalization = patient.hospitalizations.new(hospitalization_params)
      hospitalization.save!
      render json: hospitalization_json(hospitalization), status: :created
    end

    def show
      h = Hospitalization.includes(:care_records).find(params[:id])
      render json: hospitalization_json(h)
    end

    def update
      h = Hospitalization.find(params[:id])
      h.update!(hospitalization_params)
      render json: hospitalization_json(h)
    end

    def care_records
      h = Hospitalization.find(params[:hospitalization_id])
      records = h.care_records
      render json: { items: records.map { |r| care_record_json(r) }, total: records.size }
    end

    def create_care_record
      h = Hospitalization.find(params[:hospitalization_id])
      record = h.care_records.new(care_record_params)
      record.save!
      render json: care_record_json(record), status: :created
    end

    private

    def hospitalization_params
      params.permit(:admitted_on, :discharged_on, :room)
    end

    def care_record_params
      kind = params[:kind].presence || params[:category].presence
      { recorded_at: params[:recorded_at].presence || Time.current, kind: kind,
        content: params[:content], performed_by_staff_id: params[:performed_by_staff_id] }
    end

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
