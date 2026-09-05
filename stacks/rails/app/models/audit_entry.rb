# 来院履歴（spec/screens.md #5）向けの変更履歴。Owner / Patient / Visit の
# 登録・修正・削除・復元を記録する裏方テーブル。他レーンには影響しない。
class AuditEntry < ApplicationRecord
  ACTIONS = %w[created updated deleted restored].freeze

  belongs_to :staff, optional: true

  validates :subject_type, presence: true
  validates :subject_id, presence: true
  validates :action, inclusion: { in: ACTIONS }
  validates :occurred_at, presence: true

  serialize :changes_json, coder: JSON, type: Array

  scope :for_subject, ->(type, id) { where(subject_type: type, subject_id: id) }
  scope :recent_first, -> { order(occurred_at: :desc) }

  # changed_fields: [{field:, before:, after:}, ...]
  def self.record!(subject:, action:, staff: nil, reason: nil, changed_fields: [])
    create!(
      subject_type: subject.class.name,
      subject_id: subject.id,
      action: action,
      staff: staff,
      reason: reason,
      changes_json: changed_fields,
      occurred_at: Time.current
    )
  end
end
