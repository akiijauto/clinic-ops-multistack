# スタッフ。担当者の申告のみで、認証は扱わない
# （coordination/DECISIONS.md 第4節「認証はこの計画では扱わない」）。
class Staff < ApplicationRecord
  ROLES = %w[vet nurse office].freeze

  has_many :receptions
  has_many :visits
  has_many :lab_tests
  has_many :preventions
  has_many :billings
  has_many :cashier_billings, class_name: "Billing", foreign_key: :cashier_staff_id, inverse_of: :cashier_staff
  has_many :reservations
  has_many :performed_care_records, class_name: "CareRecord", foreign_key: :performed_by_staff_id,
                                     inverse_of: :performed_by_staff
  has_many :audit_entries

  validates :staff_code, presence: true, uniqueness: true
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  scope :active, -> { where(is_active: true) }

  # password_hash は画面のどこにも表示・送信しない（spec/screens.md #21）。
  def as_json(options = {})
    super(options.merge(except: [ *(options[:except] || []), :password_hash ]))
  end
end
