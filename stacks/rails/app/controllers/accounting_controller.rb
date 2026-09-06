# 会計（伝票への明細の積み上げ・確定）。spec/screens.md #14。
# 金額計算はここでは一切行わない。BillingCalculator（Billing#calc）を呼ぶだけ。
class AccountingController < ApplicationController
  def show
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @billing = find_or_init_billing
    @price_categories = FixedData::PriceItems.by_category_major
  end

  def save
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @billing = find_or_init_billing
    @price_categories = FixedData::PriceItems.by_category_major
    @op = params[:op]

    case @op
    when "add_detail" then add_detail
    when "copy_detail" then copy_detail
    when "delete_detail" then delete_detail
    when "delete_all" then delete_all
    when "confirm" then confirm
    end

    render :show
  end

  # 会計履歴（spec/screens.md #15）。動物／飼主／全体の3範囲。
  def history
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @scope = %w[patient owner all].include?(params[:scope]) ? params[:scope] : "patient"

    @billings =
      case @scope
      when "owner"
        Billing.where(owner_id: @patient.owner_id)
      when "all"
        Billing.all
      else
        Billing.where(patient_id: @patient.id)
      end.includes(:billing_details, :patient).order(billed_on: :desc, id: :desc)
  end

  private

  # slip 指定があればその伝票を開き直す。無ければ当日以降の draft を開くか、新規に作る。
  def find_or_init_billing
    if params[:slip].present?
      Billing.includes(:billing_details).find(params[:slip])
    else
      Billing.includes(:billing_details)
             .where(patient_id: @patient.id, status: "draft")
             .order(id: :desc).first ||
        Billing.new(patient_id: @patient.id, owner_id: @patient.owner_id,
                    billed_on: Date.current, status: "draft", staff_id: current_staff&.id)
    end
  end

  # 分類から項目を選ぶ→明細行を1行追加する。confirmed の伝票には行えない。
  def add_detail
    return unless @billing.status == "draft"

    item = FixedData::PriceItems.find(params[:price_code])
    return unless item

    @billing.billing_details.build(
      price_code: item[:price_code],
      name: item[:name],
      quantity: params[:quantity].presence || 1,
      unit_price: item[:unit_price],
      is_taxable: item[:is_taxable]
    )
    @billing.save
  end

  # 明細を複写する。confirmed の伝票には行えない。
  def copy_detail
    return unless @billing.persisted? && @billing.status == "draft"

    detail = @billing.billing_details.find_by(id: params[:detail_id])
    return unless detail

    @billing.billing_details.create(
      price_code: detail.price_code, name: detail.name, quantity: detail.quantity,
      unit_price: detail.unit_price, is_taxable: detail.is_taxable
    )
    @billing.billing_details.reload
  end

  # 明細を1行取り消す。confirmed の伝票には行えない。
  def delete_detail
    return unless @billing.persisted? && @billing.status == "draft"

    @billing.billing_details.find_by(id: params[:detail_id])&.destroy
    @billing.billing_details.reload
  end

  # draft の伝票の明細をすべて取り消す。
  def delete_all
    return unless @billing.persisted? && @billing.status == "draft"

    @billing.billing_details.destroy_all
  end

  # 伝票を確定する。明細が1行も無ければ Billing のバリデーションが拒否する。
  def confirm
    return unless @billing.persisted?

    @billing.update(status: "confirmed")
  end
end
