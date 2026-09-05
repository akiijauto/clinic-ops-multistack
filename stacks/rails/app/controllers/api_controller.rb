# JSON の契約（spec/openapi.yaml）に応える側の土台。
#
# 画面（ERB / Hotwire）は ApplicationController を使う。こちらを分けているのは、
# 画面向けの既定（ブラウザ判定・CSRF トークン・レイアウト）が、
# UA を名乗らない共通テストのクライアントに対して余計な分岐を生むため。
class ApiController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "not_found" }, status: :not_found
  end
end
