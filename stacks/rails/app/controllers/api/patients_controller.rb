# 動物のデータのルート（spec/openapi.yaml `/api/patients` 等）。
#
# 物理削除しない（spec/model.md）。destroy / restore は deleted_at を切り替えるだけ。
# `create_reception` は「この動物を本日の受付に登録する」専用の経路
# （generic な `/api/receptions` とは別オペレーション。spec/openapi.yaml
# `api_create_patient_reception`）。
module Api
  class PatientsController < ApiController
    def index
      scope = Patient.includes(:owner)
      scope = scope.visible(truthy?(params[:include_deleted]))
      if params[:q].present?
        q = "%#{params[:q]}%"
        scope = scope.where("name_kanji LIKE :q OR name_kana LIKE :q OR karte_no LIKE :q", q: q)
      end

      total = scope.count
      items = scope.order(:karte_no).limit(limit_param).offset(offset_param)
      render json: { items: items.map { |p| patient_json(p, with_owner: true) }, total: total }
    end

    def show
      patient = Patient.includes(:owner).find_by!(karte_no: params[:karte_no])
      render json: patient_json(patient, with_owner: true)
    end

    def update
      patient = Patient.kept.find_by!(karte_no: params[:karte_no])
      patient.update!(patient_params)
      render json: patient_json(patient)
    end

    def destroy
      patient = Patient.kept.find_by!(karte_no: params[:karte_no])
      patient.soft_delete!
      render json: patient_json(patient)
    end

    def restore
      patient = Patient.find_by!(karte_no: params[:karte_no])
      patient.restore!
      render json: patient_json(patient)
    end

    # この動物を本日の受付に登録する（screens#1 の Reception を1件作る）。
    def create_reception
      patient = Patient.kept.find_by!(karte_no: params[:karte_no])
      reception = patient.receptions.create!(reception_params.merge(received_at: reception_params[:received_at].presence || Time.current))
      render json: reception_json(reception), status: :created
    end

    private

    def truthy?(v)
      ActiveModel::Type::Boolean.new.cast(v)
    end

    def limit_param
      [ params[:limit].presence&.to_i || 50, 200 ].min
    end

    def offset_param
      params[:offset].presence&.to_i || 0
    end

    def patient_params
      params.permit(:name_kana, :name_kanji, :species, :breed, :sex, :birth_date, :neuter_date)
    end

    def reception_params
      params.permit(:kind, :owner_purpose, :medical_purpose, :staff_id, :received_at)
    end

    def patient_json(p, with_owner: false)
      base = {
        id: p.id, karte_no: p.karte_no, owner_id: p.owner_id, name_kana: p.name_kana,
        name_kanji: p.name_kanji, species: p.species, breed: p.breed, sex: p.sex,
        birth_date: p.birth_date, neuter_date: p.neuter_date, deleted_at: p.deleted_at
      }
      base[:owner] = owner_json(p.owner) if with_owner && p.owner
      base
    end

    def owner_json(o)
      {
        id: o.id, owner_no: o.owner_no, name_kana: o.name_kana, name_kanji: o.name_kanji,
        postal_code: o.postal_code, address1: o.address1, address2: o.address2,
        phone: o.phone, mobile: o.mobile, deleted_at: o.deleted_at
      }
    end

    def reception_json(r)
      {
        id: r.id, patient_id: r.patient_id, display_no: r.display_no, received_at: r.received_at,
        owner_purpose: r.owner_purpose, medical_purpose: r.medical_purpose, status: r.status,
        staff_id: r.staff_id
      }
    end
  end
end
