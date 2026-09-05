# 経過記録。行ごとに独立した値を持つ。
#
# 「全患者に同じ体温が印字される」不具合が実システムで実際に起きている
# （spec/model.md 7章・検算3）。この行の値だけを見て、他の行の値を混ぜないこと。
class ProgressNote < ApplicationRecord
  belongs_to :visit

  validates :row_no, presence: true
  validates :entry_date, presence: true

  before_validation :assign_row_no, on: :create

  private

  def assign_row_no
    return if row_no.present?
    return if visit.nil?

    self.row_no = ProgressNote.unscoped.where(visit_id: visit_id).maximum(:row_no).to_i + 1
  end
end
