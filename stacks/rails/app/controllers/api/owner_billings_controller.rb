# この飼主の会計履歴（複数の動物をまたぐ）。spec/openapi.yaml `/api/owners/{owner_no}/billings`。
module Api
  class OwnerBillingsController < ApiController
    def index
      owner = Owner.kept.find_by!(owner_no: params[:owner_no])
      billings = owner.billings.includes(:billing_details).order(billed_on: :desc, id: :desc)

      total = billings.count
      page = billings.limit(params[:limit].presence || 50).offset(params[:offset].presence || 0)
      render json: { items: page.map { |b| billing_json(b) }, total: total }
    end

    private

    def billing_json(billing)
      calc = billing.calc
      {
        id: billing.id,
        patient_id: billing.patient_id,
        owner_id: billing.owner_id,
        slip_no: billing.slip_no,
        status: billing.status,
        billed_on: billing.billed_on,
        staff_id: billing.staff_id,
        cashier_staff_id: billing.cashier_staff_id,
        paid_amount: billing.paid_amount,
        payment_method: billing.payment_method,
        details: billing.billing_details.map { |d| detail_json(d) },

        taxable_subtotal: calc.taxable_subtotal,
        nontaxable_subtotal: calc.nontaxable_subtotal,
        tax_amount: calc.tax_amount,
        total: calc.total,
        excluded_detail_count: calc.excluded_detail_count,

        net_amount: calc.net_amount,
        excluded_count: calc.excluded_detail_count,
        total_amount: calc.total
      }
    end

    def detail_json(detail)
      {
        id: detail.id,
        price_code: detail.price_code,
        name: detail.name,
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        is_taxable: detail.is_taxable,
        amount: detail.amount&.to_i
      }
    end
  end
end
