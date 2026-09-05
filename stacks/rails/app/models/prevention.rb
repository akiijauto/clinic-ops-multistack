# 予防（ワクチン等）の実施記録。spec/screens.md #12。
class Prevention < ApplicationRecord
  belongs_to :patient
  belongs_to :staff, optional: true # 担当医は未選択でも保存できる

  validates :kind, presence: true
  validates :performed_date, presence: true

  before_validation :fill_next_due_date

  scope :ordered, -> { order(performed_date: :desc) }

  private

  # 次回予定日を空で保存すると、種別の基本周期（月数）が設定されている場合に限り
  # 「実施日＋周期」が自動的に入る。入力値があれば、それを優先する
  # （spec/screens.md #12「満たすべきこと」）。
  def fill_next_due_date
    return if next_due_date.present?
    return if performed_date.blank?

    months = FixedData::Masters.prevention_cycle_months(kind)
    self.next_due_date = performed_date + months.months if months
  end
end
