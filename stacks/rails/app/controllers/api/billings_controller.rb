# 会計伝票1件の詳細（spec/openapi.yaml `/api/billings/{id}`）。
# 金額計算は BillingCalculator に集約済み。ここでは結果を JSON に整形するだけ。
#
# フィールド名について: openapi.yaml の Billing スキーマは
# taxable_subtotal / nontaxable_subtotal / total / excluded_detail_count という命名だが、
# 共通テスト（tests/checks.py 検算2）が実際に読むのは net_amount / total_amount /
# excluded_count という別名。tests/ は凍結されているため、両方の名前で同じ値を返す
# （coordination/qa/lane-b.md に記録）。
module Api
  class BillingsController < ApiController
    def index
      billings = Billing.includes(:billing_details)
      billings = billings.where(billed_on: parse_date(params[:from])..) if params[:from].present?
      billings = billings.where(billed_on: ..parse_date(params[:to])) if params[:to].present?
      billings = billings.order(billed_on: :desc, id: :desc)

      total = billings.count
      page = billings.limit(params[:limit].presence || 50).offset(params[:offset].presence || 0)
      render json: { items: page.map { |b| billing_json(b) }, total: total }
    end

    def update
      billing = Billing.includes(:billing_details).find(params[:id])

      ActiveRecord::Base.transaction do
        billing.assign_attributes(update_params)

        if params[:details]
          billing.billing_details.destroy_all
          params[:details].each do |d|
            billing.billing_details.build(d.permit(:price_code, :name, :quantity, :unit_price, :is_taxable))
          end
        end

        billing.save!
      end

      render json: billing_json(billing.reload)
    end

    def show
      billing = Billing.includes(:billing_details).find(params[:id])
      render json: billing_json(billing)
    end

    private

    def parse_date(value)
      Date.parse(value)
    rescue ArgumentError
      nil
    end

    def update_params
      params.permit(:billed_on, :status, :staff_id, :cashier_staff_id, :paid_amount, :payment_method)
    end

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

        # openapi.yaml の命名
        taxable_subtotal: calc.taxable_subtotal,
        nontaxable_subtotal: calc.nontaxable_subtotal,
        tax_amount: calc.tax_amount,
        total: calc.total,
        excluded_detail_count: calc.excluded_detail_count,

        # tests/checks.py が読む別名（同じ値）
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
