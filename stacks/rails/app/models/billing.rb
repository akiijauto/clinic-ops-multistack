# 会計（伝票）。spec/screens.md #14。金額の計算は BillingCalculator に集約する。
class Billing < ApplicationRecord
  STATUSES = %w[draft confirmed].freeze

  belongs_to :patient
  belongs_to :owner
  belongs_to :staff, optional: true
  belongs_to :cashier_staff, class_name: "Staff", optional: true, inverse_of: :cashier_billings
  has_many :billing_details, -> { order(:row_no) }, dependent: :destroy

  accepts_nested_attributes_for :billing_details, allow_destroy: true

  validates :billed_on, presence: true
  validates :status, inclusion: { in: STATUSES }
  validate :details_present_to_confirm
  validate :immutable_details_when_confirmed, on: :update

  before_validation :assign_owner_from_patient, on: :create
  before_save :assign_slip_no_on_confirm

  scope :confirmed, -> { where(status: "confirmed") }
  scope :draft, -> { where(status: "draft") }

  def calc
    @calc ||= BillingCalculator.new(self).call
  end

  def confirmed?
    status == "confirmed"
  end

  private

  def assign_owner_from_patient
    self.owner_id ||= patient&.owner_id
  end

  def details_present_to_confirm
    return unless status == "confirmed"

    errors.add(:base, "明細が1行も無い伝票は確定できません") if billing_details.reject(&:marked_for_destruction?).empty?
  end

  def immutable_details_when_confirmed
    return unless status_was == "confirmed"

    if billing_details.any? { |d| d.new_record? || d.marked_for_destruction? || d.changed? }
      errors.add(:base, "確定済みの伝票の明細は追加・複写・削除できません")
    end
  end

  def assign_slip_no_on_confirm
    return unless status == "confirmed" && slip_no.blank?

    self.slip_no = "B-#{billed_on.strftime('%Y%m%d')}-#{format('%04d', (Billing.unscoped.maximum(:id) || 0) + 1)}"
  end
end
