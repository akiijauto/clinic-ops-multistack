# 診察（Visit）のデータのルート（spec/openapi.yaml `/api/visits/{visit_id}` 等）。
#
# 物理削除しない（spec/model.md）。destroy は deleted_at を入れるだけで、
# 一覧（index）からは既定で外れるが、他の集計（売上・診察件数）からは消えない（検算9）。
module Api
  class VisitsController < ApiController
    def index
      patient = Patient.find_by!(karte_no: params[:karte_no])
      scope = patient.visits.order(visit_no: :desc)
      scope = scope.kept unless truthy?(params[:include_deleted])

      total = scope.count
      items = scope.limit(limit_param).offset(offset_param)
      render json: { items: items.map { |v| visit_json(v) }, total: total }
    end

    def create
      patient = Patient.find_by!(karte_no: params[:karte_no])
      visit = patient.visits.build(visit_params)
      build_progress_notes(visit, params[:progress_notes])
      visit.save!
      render json: visit_json(visit), status: :created
    end

    def show
      visit = Visit.find(params[:visit_id])
      render json: visit_json(visit)
    end

    def update
      visit = Visit.find(params[:visit_id])
      visit.assign_attributes(visit_params)
      build_progress_notes(visit, params[:progress_notes]) if params[:progress_notes]
      visit.save!
      render json: visit_json(visit)
    end

    def destroy
      visit = Visit.find(params[:visit_id])
      visit.soft_delete!
      render json: visit_json(visit)
    end

    def restore
      visit = Visit.find(params[:visit_id])
      visit.restore!
      render json: visit_json(visit)
    end

    private

    def visit_params
      params.permit(:patient_id, :visit_date, :visit_time, :body_weight_kg, :chief_complaint,
                     :symptom, :diagnosis, :treatment, :staff_id)
    end

    def build_progress_notes(visit, rows)
      return if rows.blank?

      rows.each do |row|
        visit.progress_notes.build(
          row_no: row[:row_no], entry_date: row[:entry_date] || visit.visit_date,
          temperature_c: row[:temperature_c], pulse: row[:pulse], respiration: row[:respiration],
          body_weight_kg: row[:body_weight_kg], symptom_course: row[:symptom_course],
          treatment_rx: row[:treatment_rx], note: row[:note]
        )
      end
    end

    def truthy?(v)
      ActiveModel::Type::Boolean.new.cast(v)
    end

    def limit_param
      [ params[:limit].presence&.to_i || 50, 200 ].min
    end

    def offset_param
      params[:offset].presence&.to_i || 0
    end

    def visit_json(v)
      {
        id: v.id, patient_id: v.patient_id, visit_no: v.visit_no, visit_date: v.visit_date,
        visit_time: v.visit_time, body_weight_kg: v.body_weight_kg, chief_complaint: v.chief_complaint,
        symptom: v.symptom, diagnosis: v.diagnosis, treatment: v.treatment, staff_id: v.staff_id,
        deleted_at: v.deleted_at,
        progress_notes: v.progress_notes.map { |pn| progress_note_json(pn) }
      }
    end

    def progress_note_json(pn)
      {
        id: pn.id, visit_id: pn.visit_id, row_no: pn.row_no, entry_date: pn.entry_date,
        temperature_c: pn.temperature_c, pulse: pn.pulse, respiration: pn.respiration,
        body_weight_kg: pn.body_weight_kg, symptom_course: pn.symptom_course,
        treatment_rx: pn.treatment_rx, note: pn.note
      }
    end
  end
end
