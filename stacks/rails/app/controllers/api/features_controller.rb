# 作らないと決めたボタン（todo）・畳んだ機能（folded）の一覧（参照専用）。
# spec/openapi.yaml `/api/features`・`/api/todo/{key}`。
# 画面側の TodosController::ITEMS / FoldedController::ITEMS をそのまま使う
# （中身を二重に持たない）。
module Api
  class FeaturesController < ApiController
    def index
      todo_notes = TodosController::ITEMS.map { |key, item| feature_note(key, "todo", item[:title], item[:message]) }
      folded_notes = FoldedController::ITEMS.map { |item| feature_note(item[:key], "folded", item[:title], item[:message]) }
      render json: { items: todo_notes + folded_notes }
    end

    def todo
      item = TodosController::ITEMS[params[:key]]
      return render_api_error(:not_found) unless item

      render json: feature_note(params[:key], "todo", item[:title], item[:message])
    end

    private

    def feature_note(key, kind, title, message)
      { key: key, kind: kind, title: title, message: message }
    end
  end
end
