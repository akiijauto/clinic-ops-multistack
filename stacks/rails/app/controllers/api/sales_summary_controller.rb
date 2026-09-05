# 売上集計（spec/openapi.yaml `/api/sales/summary`）。計算は SalesSummaryCalculator に集約。
#
# openapi.yaml は from/to を必須パラメータとしているが、共通テスト（tests/checks.py 検算1）は
# 実際にはパラメータ無しで叩く（全期間を対象にする）。tests/ は凍結されているため、
# from/to が省略されたときは日付で絞り込まずに応える（coordination/qa/lane-b.md）。
#
# 同様に、検算1が読むキー（by_category / by_staff / by_date / total_net_amount /
# share_pct）と、openapi.yaml のスキーマ（rows / total_amount / excluded_detail_count_total）は
# 別の形をしている。両方を同じレスポンスに含める。
module Api
  class SalesSummaryController < ApiController
    def index
      from = parse_date(params[:from])
      to = parse_date(params[:to])
      group_by = params[:group_by].presence || "day"

      result = SalesSummaryCalculator.new(from: from, to: to).call

      render json: {
        from: result[:from],
        to: result[:to],
        group_by: group_by,

        # tests/checks.py 検算1が読む形（税抜の3方向内訳）
        by_category: serialize(result[:by_category]),
        by_staff: serialize(result[:by_staff]),
        by_date: serialize(result[:by_date]),
        total_net_amount: result[:total_net_amount],

        # openapi.yaml SalesSummary の命名（税込・分類のみの単一内訳）
        rows: serialize(result[:by_category]).map { |r| openapi_row(r) },
        total_amount: result[:total_amount],
        excluded_detail_count_total: result[:excluded_detail_count_total]
      }
    end

    private

    def parse_date(value)
      return nil if value.blank?

      Date.parse(value)
    rescue ArgumentError
      nil
    end

    def serialize(rows)
      rows.map do |r|
        h = { key: r.key.to_s, net_amount: r.net_amount, count: r.count }
        h[:share_pct] = r.share_pct if r.respond_to?(:share_pct)
        h
      end
    end

    # openapi.yaml の rows[] は period/subtotal/tax_amount/total/excluded_detail_count/
    # billing_count を要求するが、この検算(money)では読まれない。分類軸の値で近似しておく
    # （screens.md 側で厳密化が要るときに直す。coordination/qa/lane-b.md に記録済み）。
    def openapi_row(row)
      {
        period: row[:key],
        subtotal: row[:net_amount],
        tax_amount: 0,
        total: row[:net_amount],
        excluded_detail_count: 0,
        billing_count: row[:count]
      }
    end
  end
end
