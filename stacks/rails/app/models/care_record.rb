# 入院中のケア記録（投薬・給餌・計測）。
#
# **実施者が空の行を作らない**（spec/model.md 15章・検算7）。performed_by_staff_id は必須。
class CareRecord < ApplicationRecord
  KINDS = %w[medication feeding measurement].freeze

  belongs_to :hospitalization
  belongs_to :performed_by_staff, class_name: "Staff"

  validates :recorded_at, presence: true
  validates :kind, inclusion: { in: KINDS }
  validates :performed_by_staff_id, presence: true
  validate :hospitalization_must_be_open, on: :create

  private

  # 退院日が入っている入院には、新しいケア記録を追加できない
  # （在室中の入院にだけ記録が足せる。spec/screens.md #18）。
  def hospitalization_must_be_open
    return if hospitalization.nil?

    errors.add(:base, "退院済みの入院には記録を追加できません") if hospitalization.discharged_on.present?
  end
end
