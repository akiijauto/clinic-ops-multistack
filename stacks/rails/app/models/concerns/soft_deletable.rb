# Owner / Patient / Visit は物理削除しない（spec/model.md「消さずに印を付ける」）。
#
# 一覧では既定で隠し、「削除済みも表示」を選べば見える。集計（件数・金額）からは
# 消えない——`deleted_at` で絞る scope を用意するだけで、他の集計クエリは
# `deleted_at` を無視して素通りできるようにしておく（検算9）。
module SoftDeletable
  extend ActiveSupport::Concern

  included do
    scope :kept, -> { where(deleted_at: nil) }
    scope :discarded, -> { where.not(deleted_at: nil) }
    # 一覧画面の「削除済みも表示」チェックボックス用。true なら絞り込まない。
    scope :visible, ->(include_deleted = false) { include_deleted ? all : kept }
  end

  def deleted?
    deleted_at.present?
  end

  def soft_delete!
    update!(deleted_at: Time.current)
  end

  def restore!
    update!(deleted_at: nil)
  end
end
