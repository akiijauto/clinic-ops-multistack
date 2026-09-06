# 郵便番号から住所候補を引く（spec/openapi.yaml `/postal`。api-misc扱いだが
# パスは `/api` 配下ではない）。実データ・外部通信は使わない
# （FixedData::Postal 参照）。
class PostalController < ApplicationController
  def show
    code = params[:code]
    if code.blank?
      # code省略時も「候補が無い」の形で200を返す（裁定R-20と同じ考え方。
      # 空を422にすると /postal 単体を叩いただけの死活確認まで失敗させてしまう）。
      render json: { candidates: [], reason: "codeが指定されていません。" }
      return
    end

    candidates, reason = FixedData::Postal.lookup(code)
    render json: { candidates: candidates, reason: reason }
  end
end
