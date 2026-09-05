# 入院。spec/screens.md #18。ケア記録は追加した順（時系列）で表示する。並べ替えは無い。
class Hospitalization < ApplicationRecord
  belongs_to :patient
  has_many :care_records, -> { order(:recorded_at, :id) }, dependent: :destroy

  validates :admitted_on, presence: true
  validates :room, presence: true

  def open?
    discharged_on.nil?
  end

  scope :open_on, ->(date) {
    where(discharged_on: nil).or(where("discharged_on >= ?", date)).where("admitted_on <= ?", date)
  }
end
