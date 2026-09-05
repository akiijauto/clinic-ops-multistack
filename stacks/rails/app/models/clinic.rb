# 病院設定。常に1件だけ存在する（spec/model.md）。
class Clinic < ApplicationRecord
  validates :name, presence: true
  validates :reservation_slot_minutes, numericality: { greater_than: 0 }
  validates :tax_rate, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }

  validate :only_one_record_exists, on: :create

  serialize :closed_weekdays, coder: JSON, type: Array

  # 複数件化・新規作成を許さない（screens.md #22）。
  # 無ければここで作る（seed 前でも動かせるように）。
  def self.current
    first_or_create!(
      name: "未設定の病院",
      reservation_slot_minutes: 15,
      tax_rate: 0.10,
      closed_weekdays: []
    )
  end

  private

  def only_one_record_exists
    errors.add(:base, "Clinic は既に1件存在します") if Clinic.exists?
  end
end
