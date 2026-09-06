# 予防（spec/openapi.yaml `/api/patients/{karte_no}/prevention/{kind_id}`）。
# {kind_id} は整数（マスタ行id）とコード文字列の両方を受け付ける（qa/lane-b.md Q11）。
module Api
  class PreventionsController < ApiController
    def index
      patient = Patient.find_by!(karte_no: params[:karte_no])
      kind = kind!

      preventions = patient.preventions.where(kind: kind[:code]).ordered
      render json: { items: preventions.map { |p| prevention_json(p) }, total: preventions.size }
    end

    def create
      patient = Patient.find_by!(karte_no: params[:karte_no])
      kind = kind!

      prevention = patient.preventions.new(prevention_params.merge(kind: kind[:code]))
      prevention.save!
      render json: prevention_json(prevention), status: :created
    end

    private

    def kind!
      kind = FixedData::Masters.kind_by_code_or_id(params[:kind_id])
      raise ActiveRecord::RecordNotFound unless kind

      kind
    end

    def prevention_params
      params.permit(:content, :performed_date, :next_due_date, :staff_id)
    end

    def prevention_json(p)
      {
        id: p.id, patient_id: p.patient_id, kind: p.kind, content: p.content,
        performed_date: p.performed_date, next_due_date: p.next_due_date
      }
    end
  end
end
