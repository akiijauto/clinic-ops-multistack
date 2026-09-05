# 検査の項目値。基準値は保存しない——都度 data/lab_items.json から引く（検算5）。
class LabTestItem < ApplicationRecord
  belongs_to :lab_test

  validates :item_code, presence: true

  # その患者の種別・性別で基準値を引き、範囲外なら high/low、無ければ unknown を返す。
  # 両端（min・max ちょうど）は範囲内として扱う（spec/acceptance.md 検算5）。
  def judgement(patient)
    return "unknown" if value_num.nil?

    range = FixedData::LabItems.reference_range(item_code, patient.species, patient.sex)
    return "unknown" if range.nil?

    if value_num < range[:low]
      "low"
    elsif value_num > range[:high]
      "high"
    else
      "normal"
    end
  end

  def out_of_range?(patient)
    %w[low high].include?(judgement(patient))
  end

  def reference_range(patient)
    FixedData::LabItems.reference_range(item_code, patient.species, patient.sex)
  end
end
