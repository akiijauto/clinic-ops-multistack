# 検査（spec/screens.md #10）。基準値は data/lab_items.json から引く。保存はしない。
class LabTest < ApplicationRecord
  belongs_to :patient
  belongs_to :visit
  belongs_to :staff, optional: true
  has_many :lab_test_items, -> { order(:id) }, dependent: :destroy

  accepts_nested_attributes_for :lab_test_items

  validates :category, presence: true
  validates :tested_on, presence: true
end
