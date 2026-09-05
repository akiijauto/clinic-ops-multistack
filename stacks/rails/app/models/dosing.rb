# 投薬。年度×月のマス目に実施した月へ印を付ける記録（spec/screens.md #11）。
# 予防と違い、担当医・メモは持たない。
class Dosing < ApplicationRecord
  MONTH_COLUMNS = (1..12).map { |i| format("m%02d", i) }.freeze

  belongs_to :patient

  validates :kind, presence: true
  validates :fiscal_year, presence: true
  validates :patient_id, uniqueness: { scope: [ :kind, :fiscal_year ] }

  # 「送られなかった月」と「外した月」を混同しない：外した月は空文字 "" を保存する。
  # 未送信（フォームに項目が無かった）月は既存値をそのまま保持する。
  def apply_month_values!(values_by_month)
    MONTH_COLUMNS.each do |col|
      next unless values_by_month.key?(col)

      write_attribute(col, values_by_month[col].presence || "")
    end
    save!
  end
end
