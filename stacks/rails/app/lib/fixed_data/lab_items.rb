# data/lab_items.json を読み込むだけの参照。基準値は保存しない（検算5）。
module FixedData
  class LabItems
    PATH = Rails.root.join("..", "..", "data", "lab_items.json")

    class << self
      def all
        @all ||= JSON.parse(File.read(PATH), symbolize_names: true)
      end

      def find(item_code)
        by_code[item_code]
      end

      # species: "dog"/"cat"/その他は "other" 扱い。sex: "male"/"female"、
      # "unknown" は "any" 扱い（data/README.md）。
      # 一致する組み合わせが無ければ nil を返す（この検算の対象から除外する）。
      def reference_range(item_code, species, sex)
        item = find(item_code)
        return nil if item.nil?

        norm_species = %w[dog cat].include?(species) ? species : "other"
        norm_sex = %w[male female].include?(sex) ? sex : "any"

        ranges = item[:reference_ranges] || []
        row = ranges.find { |r| r[:species] == norm_species && r[:sex] == norm_sex }
        row ||= ranges.find { |r| r[:species] == norm_species && r[:sex] == "any" }
        return nil if row.nil?

        { low: row[:low].to_d, high: row[:high].to_d }
      end

      private

      def by_code
        @by_code ||= all.index_by { |item| item[:item_code] }
      end
    end
  end
end
