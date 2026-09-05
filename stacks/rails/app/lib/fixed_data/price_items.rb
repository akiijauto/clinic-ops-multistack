# data/price_items.json を読み込むだけの参照。編集画面は作らない（spec/README.md）。
# 料金項目には単価未設定のものが意図的に混ざっている（検算2）。
module FixedData
  class PriceItems
    PATH = Rails.root.join("..", "..", "data", "price_items.json")

    class << self
      def all
        @all ||= JSON.parse(File.read(PATH), symbolize_names: true)
      end

      def find(price_code)
        by_code[price_code]
      end

      # 分類（2階層のうち上位1階層）。売上集計の分類軸に使う
      # （qa/rulings.md 2：上位1階層のみ）。
      def category_major_for(price_code)
        find(price_code)&.fetch(:category_major, nil)
      end

      def by_category_major
        all.group_by { |item| item[:category_major] }
      end

      private

      def by_code
        @by_code ||= all.index_by { |item| item[:price_code] }
      end
    end
  end
end
