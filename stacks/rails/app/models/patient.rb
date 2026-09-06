# 動物。物理削除しない（spec/model.md）。karte_no がカルテ番号で、画面のURLに出る。
class Patient < ApplicationRecord
  include SoftDeletable

  SEXES = %w[male female unknown].freeze

  belongs_to :owner
  has_many :receptions
  has_many :visits
  has_many :lab_tests
  has_many :preventions
  has_many :dosings
  has_many :billings
  has_many :reservations
  has_many :hospitalizations
  has_many :papers
  has_one :patient_no_paper, dependent: :destroy

  # 【仮決め】spec/openapi.yaml の KarteNo パターンは "^[0-9]+-[0-9]+$"（例:1001-1）
  # だが、data/seed.json の karte_no はハイフン無しの数字だけ（例: "10001"）。
  # 共通テストは data/seed.json の実値をそのまま突き合わせるはずなので、
  # 実データに合わせて「数字だけ」を受け付ける（qa/lane-b.md Q13）。
  validates :karte_no, presence: true, uniqueness: true, format: { with: /\A[0-9]+\z/ }
  validates :name_kana, presence: true
  validates :name_kanji, presence: true
  validates :species, presence: true
  validates :sex, inclusion: { in: SEXES }

  before_validation :assign_karte_no, on: :create

  # 「この子の紙カルテは元から無い」の印（spec/screens.md #13）。
  def no_paper?
    patient_no_paper.present?
  end

  # 番号変更（spec/screens.md #3）：未使用の値にだけ付け替える。
  def change_karte_no!(new_no)
    return false if new_no.blank?
    return false if Patient.where.not(id: id).exists?(karte_no: new_no)

    update(karte_no: new_no)
  end

  private

  # 既存データ（data/seed.json）と同じ形（数字だけ）で連番を振る。
  def assign_karte_no
    return if karte_no.present?

    last = Patient.unscoped.order(Arel.sql("CAST(karte_no AS INTEGER) DESC")).first
    next_seq = last ? last.karte_no.to_i + 1 : 10001
    self.karte_no = next_seq.to_s
  end
end
