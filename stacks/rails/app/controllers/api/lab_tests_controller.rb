# 検査1件の詳細（spec/openapi.yaml `/api/lab-tests/{id}`）。
#
# フィールド名について: openapi.yaml の LabTestItem は `judgement`
# （low/normal/high/unknown）+ `out_of_range`（真偽）という命名だが、
# 共通テスト（tests/checks.py 検算5）が実際に読むのは `judgment`
# （空 / "H" / "L"）という別名・別語彙。両方を返す（coordination/qa/lane-b.md）。
module Api
  class LabTestsController < ApiController
    def index
      patient = Patient.find_by!(karte_no: params[:karte_no])
      scope = patient.lab_tests.includes(:lab_test_items).order(tested_on: :desc, id: :desc)

      total = scope.count
      items = scope.limit(limit_param).offset(offset_param)
      render json: { items: items.map { |t| lab_test_json(t, patient) }, total: total }
    end

    def create
      patient = Patient.find_by!(karte_no: params[:karte_no])
      lab_test = patient.lab_tests.new(lab_test_params)
      (params[:items] || []).each do |row|
        lab_test.lab_test_items.build(item_code: row[:item_code], value_num: row[:value_num], value_text: row[:value_text])
      end
      lab_test.save!
      render json: lab_test_json(lab_test.reload, patient), status: :created
    end

    def show
      lab_test = LabTest.includes(:lab_test_items, :patient).find(params[:id])
      render json: lab_test_json(lab_test, lab_test.patient)
    end

    private

    def limit_param
      [ params[:limit].presence&.to_i || 50, 200 ].min
    end

    def offset_param
      params[:offset].presence&.to_i || 0
    end

    def lab_test_params
      params.permit(:visit_id, :category, :tested_on, :tested_at_time, :staff_id)
    end

    def lab_test_json(lab_test, patient)
      {
        id: lab_test.id,
        patient_id: lab_test.patient_id,
        visit_id: lab_test.visit_id,
        category: lab_test.category,
        tested_on: lab_test.tested_on,
        tested_at_time: lab_test.tested_at_time,
        staff_id: lab_test.staff_id,
        items: lab_test.lab_test_items.map { |item| item_json(item, patient) }
      }
    end

    def item_json(item, patient)
      judgement = item.judgement(patient) # low/normal/high/unknown
      range = item.reference_range(patient)

      {
        id: item.id,
        lab_test_id: item.lab_test_id,
        item_code: item.item_code,
        value_num: item.value_num,
        value_text: item.value_text,
        reference_low: range&.dig(:low),
        reference_high: range&.dig(:high),

        # openapi.yaml の命名
        judgement: judgement,
        out_of_range: item.out_of_range?(patient),

        # tests/checks.py 検算5が読む別名（空 / "H" / "L"）
        judgment: { "high" => "H", "low" => "L" }.fetch(judgement, ""),
        data_check_flag: { "high" => "high", "low" => "low", "normal" => "normal" }.fetch(judgement, nil)
      }
    end
  end
end
