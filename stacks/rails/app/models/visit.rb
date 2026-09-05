# 診察。物理削除しない（spec/model.md）。
class Visit < ApplicationRecord
  include SoftDeletable

  belongs_to :patient
  belongs_to :staff, optional: true
  has_many :progress_notes, -> { order(:row_no) }, dependent: :destroy
  has_many :lab_tests

  accepts_nested_attributes_for :progress_notes, allow_destroy: false

  validates :visit_date, presence: true

  before_validation :assign_visit_no, on: :create

  private

  def assign_visit_no
    return if visit_no.present?
    return if patient.nil?

    self.visit_no = Visit.unscoped.where(patient_id: patient_id).maximum(:visit_no).to_i + 1
  end
end
