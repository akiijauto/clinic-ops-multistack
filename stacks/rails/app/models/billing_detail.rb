# 会計の明細。unit_price が未設定（null）の行がありうる。
# **0円として合計に入れてはならない**（spec/model.md 13章・検算2）。
class BillingDetail < ApplicationRecord
  belongs_to :billing

  validates :price_code, presence: true
  validates :name, presence: true
  validates :quantity, numericality: { greater_than: 0 }

  before_validation :assign_row_no, on: :create

  # quantity × unit_price。unit_price が無ければ nil（合計に含めない）。
  def amount
    return nil if unit_price.nil?

    (quantity.to_d * unit_price.to_d)
  end

  private

  def assign_row_no
    return if row_no.present?
    return if billing.nil?

    self.row_no = BillingDetail.unscoped.where(billing_id: billing_id).maximum(:row_no).to_i + 1
  end
end
