# 会計伝票1枚の金額計算。spec/acceptance.md「消費税の計算順序」を1箇所に集約する。
#
# **この手順以外で計算しないこと。** 明細ごとに税額を計算して積み上げる方式は、
# 実装間で1円単位のズレを生む（伝票につき1回だけ切り捨てる、と契約で固定されている）。
#
#   1. 課税対象額 = is_taxable かつ unit_price 設定済みの明細の quantity×unit_price の合計（丸めない）
#   2. 消費税額   = 課税対象額 × Clinic.tax_rate を、伝票につき1回だけ円未満切り捨て
#   3. 税抜合計（net_amount）= 課税対象額 + 非課税明細の合計。**この和を最後に1回だけ切り捨てる**
#   4. 税込合計   = 税抜合計 + 消費税額
#   5. unit_price が未設定の明細は、どの合計にも含めない（未算入件数として別に数える）
#
# taxable_subtotal / nontaxable_subtotal は openapi.yaml のスキーマ上 integer で
# 個別に返す必要があるが、それぞれを別々に切り捨てると
# 「税抜合計は和を1回だけ丸める」という規則と食い違いうる
# （floor(a)+floor(b) と floor(a+b) が一致しない端数のケースがあるため）。
# taxable_subtotal は素直に floor し、nontaxable_subtotal は
# 「net_amount − taxable_subtotal」で残差を吸収させることで、
# 2つの合計が必ず net_amount と一致するようにしてある。
class BillingCalculator
  Result = Struct.new(
    :taxable_subtotal, :nontaxable_subtotal, :tax_amount, :net_amount, :total, :excluded_detail_count,
    keyword_init: true
  )

  def initialize(billing, tax_rate: nil)
    @billing = billing
    @tax_rate = tax_rate || Clinic.current.tax_rate
  end

  def call
    included = @billing.billing_details.select { |d| d.unit_price.present? }
    excluded_count = @billing.billing_details.size - included.size

    taxable = included.select(&:is_taxable)
    nontaxable = included.reject(&:is_taxable)

    # 丸めない。明細小計は quantity（小数可） × unit_price のまま合計する。
    taxable_raw = sum_amount(taxable)
    nontaxable_raw = sum_amount(nontaxable)

    # 消費税額はここで**1回だけ**切り捨てる（未丸めの課税対象額を使う）。
    tax_amount = (taxable_raw * @tax_rate.to_d).floor

    # 税抜合計は「課税対象額＋非課税」の和を、表示の最後に1回だけ切り捨てる。
    net_amount = (taxable_raw + nontaxable_raw).floor

    taxable_subtotal = taxable_raw.floor
    nontaxable_subtotal = net_amount - taxable_subtotal

    total = net_amount + tax_amount

    Result.new(
      taxable_subtotal: taxable_subtotal,
      nontaxable_subtotal: nontaxable_subtotal,
      tax_amount: tax_amount,
      net_amount: net_amount,
      total: total,
      excluded_detail_count: excluded_count
    )
  end

  private

  def sum_amount(details)
    details.sum { |d| d.quantity.to_d * d.unit_price.to_d }
  end
end
