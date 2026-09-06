# スタッフ一覧（spec/openapi.yaml `/api/staff`）。password_hash は返さない
# （Staff#as_json で除外済み。spec/screens.md #21）。
module Api
  class StaffController < ApiController
    def index
      scope = Staff.all
      if params[:is_active].present?
        active = ActiveModel::Type::Boolean.new.cast(params[:is_active])
        scope = scope.where(is_active: active)
      end
      staffs = scope.order(:staff_code)
      render json: { items: staffs.map { |s| staff_json(s) }, total: staffs.size }
    end

    private

    def staff_json(s)
      { id: s.id, staff_code: s.staff_code, name: s.name, role: s.role, is_active: s.is_active }
    end
  end
end
