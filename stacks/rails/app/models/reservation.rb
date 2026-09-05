# 予約（新規画面）。spec/screens.md #19・検算6。
#
# 同じ担当・同じ処置室について、status=booked の予約どうしの時間帯が重ならないこと。
# 重なりの定義は半開区間（qa/rulings.md 6）：終了時刻＝次の開始時刻は重ならない扱い。
class Reservation < ApplicationRecord
  STATUSES = %w[booked cancelled].freeze

  belongs_to :patient
  belongs_to :staff

  validates :starts_at, presence: true
  validates :ends_at, presence: true
  validates :room, presence: true
  validates :status, inclusion: { in: STATUSES }
  validate :ends_after_starts
  validate :no_overlap, if: -> { status == "booked" }

  scope :booked, -> { where(status: "booked") }

  def cancel!
    update!(status: "cancelled")
  end

  private

  def ends_after_starts
    return if starts_at.blank? || ends_at.blank?

    errors.add(:ends_at, "は開始時刻より後である必要があります") if ends_at <= starts_at
  end

  # 半開区間の重なり判定: starts1 < ends2 かつ starts2 < ends1
  def no_overlap
    return if starts_at.blank? || ends_at.blank?

    base = Reservation.booked.where.not(id: id)

    staff_conflict = base.where(staff_id: staff_id)
                          .where("starts_at < ? AND ends_at > ?", ends_at, starts_at)
                          .exists?
    room_conflict = base.where(room: room)
                         .where("starts_at < ? AND ends_at > ?", ends_at, starts_at)
                         .exists?

    return unless staff_conflict || room_conflict

    # :reservation_conflict という種類で追加しておく。openapi.yaml の 409
    # （エラーコード reservation_conflict）を判定する側（Api::BaseController）が
    # 「ただの入力エラー（422）」と区別できるようにするため。
    errors.add(:base, :reservation_conflict,
               message: ApiErrors::MESSAGES[:reservation_conflict])
  end
end
