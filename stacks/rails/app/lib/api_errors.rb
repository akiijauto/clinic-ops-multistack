# エラーの文言（spec/openapi.yaml「エラーの文言（一字一句、これを使う）」表）を1箇所に集約。
# ステータスコードごとに文言・error.code が固定されているので、ここ以外では書かない。
module ApiErrors
  MESSAGES = {
    invalid_json: "リクエストの本文がJSONとして壊れています。書き方を確認してください。",
    invalid_input: "入力の形式が正しくありません。必須の項目や値の型を確認してください。",
    not_found: "指定されたデータが見つかりません。",
    forbidden: "この操作を行う権限がありません。",
    save_failed: "保存に失敗しました。時間をおいてもう一度お試しください。",
    reservation_conflict: "指定した時間帯は、担当または処置室の予定と重なっています。"
  }.freeze

  def self.body(code, details: nil)
    error = { code: code.to_s, message: MESSAGES.fetch(code) }
    error[:details] = details if details.present?
    { error: error }
  end
end
