# DM対象の一覧（spec/openapi.yaml `/api/dm`）。`/dm` 画面・`/dm.csv` と同じ絞り込みを使う。
module Api
  class DmController < ApiController
    def index
      rows = query_rows.to_a
      render json: { items: rows.map { |r| dm_row_json(r) }, total: rows.size }
    end

    private

    def query_rows
      field = params[:field] == "performed_date" ? "performed_date" : "next_due_date"

      scope = Prevention.joins(patient: :owner)
                         .where(patients: { deleted_at: nil }, owners: { deleted_at: nil })
                         .where.not(next_due_date: nil)

      if params[:type].present?
        code = FixedData::Masters.kind_code_for(params[:type])
        scope = scope.where(kind: code) if code
      end

      from = parse_date(params[:from])
      to = parse_date(params[:to])
      scope = scope.where(field => from..) if from
      scope = scope.where(field => ..to) if to

      scope.includes(patient: :owner).order(field => :asc)
    end

    def parse_date(value)
      return nil if value.blank?

      Date.parse(value)
    rescue ArgumentError
      nil
    end

    def dm_row_json(r)
      {
        karte_no: r.patient.karte_no,
        owner_name_kanji: r.patient.owner.name_kanji,
        patient_name_kanji: r.patient.name_kanji,
        kind: r.kind,
        next_due_date: r.next_due_date,
        performed_date: r.performed_date
      }
    end
  end
end
