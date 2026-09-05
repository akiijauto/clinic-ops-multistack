# 飼主。物理削除しない（spec/model.md）。
class Owner < ApplicationRecord
  include SoftDeletable

  has_many :patients
  has_many :billings

  validates :owner_no, presence: true, uniqueness: true
  validates :name_kana, presence: true
  validates :name_kanji, presence: true

  before_validation :assign_owner_no, on: :create

  # 番号変更（spec/screens.md #3）：未使用の値にだけ付け替える。
  def change_owner_no!(new_no)
    return false if new_no.blank?
    return false if Owner.where.not(id: id).exists?(owner_no: new_no)

    update(owner_no: new_no)
  end

  private

  def assign_owner_no
    return if owner_no.present?

    last = Owner.unscoped.order(Arel.sql("CAST(SUBSTR(owner_no, 3) AS INTEGER) DESC")).first
    next_seq = last ? last.owner_no.delete_prefix("O-").to_i + 1 : 1
    self.owner_no = format("O-%05d", next_seq)
  end
end
