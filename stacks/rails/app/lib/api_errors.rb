# spec/openapi.yaml「エラーの文言（一字一句、これを使う）」を1箇所に集約する。
# 画面（HTML）・データ（JSON）の両ルートで、この文言をそのまま使うこと
# （coordination/DECISIONS.md 第4節：独自の文言を作らない）。
module ApiErrors
  MESSAGES = {
    invalid_json: "リクエストの本文がJSONとして壊れています。書き方を確認してください。",
    invalid_input: "入力の形式が正しくありません。必須の項目や値の型を確認してください。",
    not_found: "指定されたデータが見つかりません。",
    forbidden: "この操作を行う権限がありません。",
    save_failed: "保存に失敗しました。時間をおいてもう一度お試しください。",
    reservation_conflict: "指定した時間帯は、担当または処置室の予定と重なっています。"
  }.freeze

  STATUSES = {
    invalid_json: :bad_request,
    invalid_input: :unprocessable_entity,
    not_found: :not_found,
    forbidden: :forbidden,
    save_failed: :internal_server_error,
    reservation_conflict: :conflict
  }.freeze
end
