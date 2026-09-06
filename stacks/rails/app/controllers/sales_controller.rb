# 売上集計（HTML画面）。spec/screens.md #17。
# Api::SalesSummaryController と同じ SalesSummaryCalculator を呼ぶだけで、
# 画面側で別々に計算し直さない（3方向一致が壊れないようにするため）。
class SalesController < ApplicationController
  def index
    @from = parse_date(params[:from])
    @to = parse_date(params[:to])
    @result = SalesSummaryCalculator.new(from: @from, to: @to).call
  end

  private

  def parse_date(value)
    return nil if value.blank?

    Date.parse(value)
  rescue ArgumentError
    nil
  end
end
