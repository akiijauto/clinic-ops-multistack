# 売上集計（分類別・担当別・日別の3方向）。spec/acceptance.md 検算1。
#
# - 対象は Billing.status = "confirmed" の伝票のみ
# - unit_price 未設定の明細はどの内訳にも含めない（未算入件数として別に数える）
# - 担当は Billing.staff_id（診療担当）を使う。cashier_staff_id は使わない（qa/rulings.md 1）
# - 分類は data/price_items.json の category_major（上位1階層のみ。qa/rulings.md 2）
# - 消費税は伝票単位で1回だけ切り捨てるため、この集計は**税抜売上のみ**を3方向に分解する
#   （qa/rulings.md 3）。税込の総額は「税抜合計＋全伝票の消費税額の合計」の1本の等式のみ
class SalesSummaryCalculator
  Row = Struct.new(:key, :net_amount, :count, keyword_init: true)

  # from / to は省略できる（tests/checks.py の検算1は日付を指定せず全期間を見る）。
  # 省略時は日付で絞り込まない。
  def initialize(from: nil, to: nil)
    @from = from
    @to = to
  end

  def call
    billings = Billing.confirmed.includes(:billing_details)
    billings = billings.where(billed_on: @from..) if @from
    billings = billings.where(billed_on: ..@to) if @to

    by_category = Hash.new { |h, k| h[k] = { net: 0.to_d, count: 0 } }
    by_staff = Hash.new { |h, k| h[k] = { net: 0.to_d, count: 0 } }
    by_date = Hash.new { |h, k| h[k] = { net: 0.to_d, count: 0 } }

    total_net_raw = 0.to_d
    total_tax = 0
    excluded_count = 0

    billings.find_each do |billing|
      calc = billing.calc
      total_tax += calc.tax_amount
      excluded_count += calc.excluded_detail_count

      billing.billing_details.each do |detail|
        next if detail.unit_price.nil? # 未算入。既に excluded_detail_count で数えている

        amount = detail.quantity.to_d * detail.unit_price.to_d
        total_net_raw += amount

        category = FixedData::PriceItems.category_major_for(detail.price_code) || "分類なし"
        by_category[category][:net] += amount
        by_category[category][:count] += 1

        staff_key = billing.staff_id || "未設定"
        by_staff[staff_key][:net] += amount
        by_staff[staff_key][:count] += 1

        by_date[billing.billed_on.to_s][:net] += amount
        by_date[billing.billed_on.to_s][:count] += 1
      end
    end

    total_net = total_net_raw.floor

    {
      from: @from,
      to: @to,
      total_net_amount: total_net,
      total_tax_amount: total_tax,
      total_amount: total_net + total_tax,
      excluded_detail_count_total: excluded_count,
      by_category: finalize_rows(by_category, total_net),
      by_staff: finalize_rows(by_staff, total_net, with_share: false),
      by_date: finalize_rows(by_date, total_net, with_share: false)
    }
  end

  private

  # 丸めた値を積み上げて再合計しない。行ごとの net はここで初めて1回だけ丸める。
  def finalize_rows(hash, total_net, with_share: true)
    rows = hash.map { |key, v| Row.new(key: key, net_amount: v[:net].floor, count: v[:count]) }

    if with_share
      apply_largest_remainder_share!(hash, rows, total_net)
    end

    rows
  end

  # 構成比（%）を最大剰余法で丸める（spec/acceptance.md「構成比の丸め」）。
  # 対象期間の税抜合計が0円のときはこの検算自体を対象外とする＝share を付けない。
  #
  # 0.1%（千分率の1単位）ごとの整数で扱い、切り捨てた分の合計と100.0%の差ぶんだけ、
  # 剰余（raw − floor）が大きい分類から順に0.1%を1回ずつ足す。
  def apply_largest_remainder_share!(hash, rows, total_net)
    return if total_net.zero?

    raw_permille = hash.transform_values { |v| (v[:net] / total_net.to_d) * 1000 }
    floor_permille = raw_permille.transform_values(&:floor)
    remainder_units = 1000 - floor_permille.values.sum

    ordered_keys = raw_permille.keys.sort_by { |k| -(raw_permille[k] - floor_permille[k]) }
    final_permille = floor_permille.dup
    ordered_keys.first(remainder_units).each { |k| final_permille[k] += 1 } if remainder_units.positive?

    rows.each { |row| row.define_singleton_method(:share_pct) { final_permille[row.key] / 10.0 } }
  end
end
