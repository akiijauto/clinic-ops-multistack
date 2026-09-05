# 検査1件の詳細（spec/openapi.yaml `/api/lab-tests/{id}`）。
#
# フィールド名について: openapi.yaml の LabTestItem は `judgement`
# （low/normal/high/unknown）+ `out_of_range`（真偽）という命名だが、
# 共通テスト（tests/checks.py 検算5）が実際に読むのは `judgment`
# （空 / "H" / "L"）という別名・別語彙。両方を返す（coordination/qa/lane-b.md）。
module Api
  class LabTestsController < ApiController
    def show
      lab_test = LabTest.includes(:lab_test_items, :patient).find(params[:id])
      patient = lab_test.patient

      render json: {
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

    private

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
