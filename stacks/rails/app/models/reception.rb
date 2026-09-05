# 本日の患者（受付）。spec/screens.md #1。
class Reception < ApplicationRecord
  STATUSES = %w[waiting in_exam done].freeze

  belongs_to :patient
  belongs_to :staff, optional: true

  validates :display_no, presence: true
  validates :received_at, presence: true
  validates :status, inclusion: { in: STATUSES }

  before_validation :assign_display_no, on: :create

  # JST の当日ぶんだけ（spec/screens.md #1「当日（JSTの0:00〜24:00）に受け付けた行だけが出る」）。
  scope :for_jst_date, ->(date) {
    range = date.in_time_zone("Tokyo").beginning_of_day..date.in_time_zone("Tokyo").end_of_day
    where(received_at: range)
  }
  scope :of_kind, ->(kind) { kind.present? ? where(kind: kind) : all }
  scope :hide_done, ->(hide) { hide ? where.not(status: "done") : all }

  # 上へ／下へ：選択行と隣接する行の display_no を入れ替える（他の行は変わらない）。
  def swap_with_neighbor!(direction)
    scope = Reception.order(:display_no)
    ordered = scope.to_a
    idx = ordered.index { |r| r.id == id }
    return false if idx.nil?

    neighbor_idx = direction == :up ? idx - 1 : idx + 1
    return false if neighbor_idx.negative? || neighbor_idx >= ordered.size

    neighbor = ordered[neighbor_idx]
    Reception.transaction do
      my_no = display_no
      update!(display_no: neighbor.display_no)
      neighbor.update!(display_no: my_no)
    end
    true
  end

  private

  def assign_display_no
    return if display_no.present?

    self.display_no = (Reception.maximum(:display_no) || 0) + 1
  end
end
