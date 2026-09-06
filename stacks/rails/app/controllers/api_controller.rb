# JSON の契約（spec/openapi.yaml）に応える側の土台。
#
# 画面（ERB / Hotwire）は ApplicationController を使う。こちらを分けているのは、
# 画面向けの既定（ブラウザ判定・CSRF トークン・レイアウト）が、
# UA を名乗らない共通テストのクライアントに対して余計な分岐を生むため。
#
# エラーの形・文言は spec/openapi.yaml「エラーの文言」節を一字一句使う
# （ApiErrors に集約）。各コントローラは自前で rescue せず、この仕組みに乗ること。
class ApiController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound do
    render_api_error(:not_found)
  end

  rescue_from ActionController::ParameterMissing do |e|
    render_api_error(:invalid_input, details: [ { field: e.param.to_s, message: "#{e.param} は必須です。" } ])
  end

  rescue_from ActiveRecord::RecordInvalid do |e|
    handle_record_invalid(e.record)
  end

  rescue_from ActionDispatch::Http::Parameters::ParseError do
    render_api_error(:invalid_json)
  end

  # spec/openapi.yaml でPOST専用のパス（削除・復元・取消等）にGETで来たとき用。
  # ApplicationController#method_not_allowed のJSON版（tests/inventory.py 参照）。
  def method_not_allowed
    head :method_not_allowed
  end

  private

  def handle_record_invalid(record)
    if record.errors.of_kind?(:base, :reservation_conflict)
      render_api_error(:reservation_conflict)
    else
      details = record.errors.map { |e| { field: e.attribute.to_s, message: e.full_message } }
      render_api_error(:invalid_input, details: details)
    end
  end

  # code: :invalid_json / :invalid_input / :not_found / :forbidden / :save_failed / :reservation_conflict
  def render_api_error(code, details: nil)
    body = { error: { code: code.to_s, message: ApiErrors::MESSAGES.fetch(code) } }
    body[:error][:details] = details if details.present?
    render json: body, status: ApiErrors::STATUSES.fetch(code)
  end
end
