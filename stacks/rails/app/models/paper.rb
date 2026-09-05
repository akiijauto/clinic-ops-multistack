# 書類（紙カルテPDF相当の記録）。実体（バイナリ）は持たない
# （qa/lane-b.md Q8。model.md「落としたもの」の KartePdf とは異なる、タイトル・メモだけの記録）。
# 物理削除しない——取り消しても行は残る（spec/screens.md #13）。
class Paper < ApplicationRecord
  belongs_to :patient

  validates :title, presence: true

  scope :active, -> { where(removed_at: nil) }

  def removed?
    removed_at.present?
  end

  def remove!
    update!(removed_at: Time.current)
  end
end
