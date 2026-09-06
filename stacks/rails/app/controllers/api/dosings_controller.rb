# 投薬（spec/openapi.yaml `/api/patients/{karte_no}/dosing/{kind_id}`）。
# {kind_id} は整数（マスタ行id）とコード文字列の両方を受け付ける（qa/lane-b.md Q11）。
module Api
  class DosingsController < ApiController
    # まだ記録が無い年度（患者×種別の組み合わせ自体は存在する）は404にせず、
    # 空欄（月はすべて空）の年間記録を200で返す（画面側 DosingsController#show も
    # 記録0件を404にはせず空のマス目で描画しており、それと揃える。Go実装
    # `clinical_api.go` handleAPIDosing と同じ仮決め）。
    def show
      patient = Patient.find_by!(karte_no: params[:karte_no])
      kind = kind!

      fiscal_year = params[:fiscal_year].presence
      scope = patient.dosings.where(kind: kind[:code])
      dosing = fiscal_year ? scope.find_by(fiscal_year: fiscal_year) : scope.order(fiscal_year: :desc).first
      dosing ||= Dosing.new(patient_id: patient.id, kind: kind[:code], fiscal_year: fiscal_year || Time.current.year)

      render json: dosing_json(dosing)
    end

    def update
      patient = Patient.find_by!(karte_no: params[:karte_no])
      kind = kind!

      fiscal_year = params[:fiscal_year].presence || Time.current.year
      dosing = patient.dosings.find_or_initialize_by(kind: kind[:code], fiscal_year: fiscal_year)
      dosing.apply_month_values!(month_values)
      render json: dosing_json(dosing)
    end

    private

    def kind!
      kind = FixedData::Masters.kind_by_code_or_id(params[:kind_id])
      raise ActiveRecord::RecordNotFound unless kind

      kind
    end

    def month_values
      Dosing::MONTH_COLUMNS.index_with { |col| params[col] }
    end

    def dosing_json(d)
      {
        id: d.id, patient_id: d.patient_id, kind: d.kind, fiscal_year: d.fiscal_year
      }.merge(Dosing::MONTH_COLUMNS.index_with { |col| d[col] })
    end
  end
end
