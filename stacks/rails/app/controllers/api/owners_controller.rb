# 飼主のデータのルート（spec/openapi.yaml `/api/owners/{owner_no}` 等）。
# 会計履歴（billings）は Api::OwnerBillingsController が別に受け持つ。
# 物理削除しない（spec/model.md）。destroy は deleted_at を入れるだけ。
module Api
  class OwnersController < ApiController
    def show
      owner = Owner.find_by!(owner_no: params[:owner_no])
      render json: owner_json(owner)
    end

    def update
      owner = Owner.kept.find_by!(owner_no: params[:owner_no])
      owner.update!(owner_params)
      render json: owner_json(owner)
    end

    def destroy
      owner = Owner.kept.find_by!(owner_no: params[:owner_no])
      owner.soft_delete!
      render json: owner_json(owner)
    end

    private

    def owner_params
      params.permit(:name_kana, :name_kanji, :postal_code, :address1, :address2, :phone, :mobile)
    end

    def owner_json(o)
      {
        id: o.id, owner_no: o.owner_no, name_kana: o.name_kana, name_kanji: o.name_kanji,
        postal_code: o.postal_code, address1: o.address1, address2: o.address2,
        phone: o.phone, mobile: o.mobile, deleted_at: o.deleted_at
      }
    end
  end
end
