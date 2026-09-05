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
    def show
      billing = Billing.includes(:billing_details).find(params[:id])
      calc = billing.calc

      render json: {
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

    private

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
