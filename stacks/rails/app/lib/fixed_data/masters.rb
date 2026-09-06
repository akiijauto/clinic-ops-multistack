# data/masters.json を読み込むだけの参照。編集画面は作らない（spec/README.md）。
#
# prevention_kinds / reception_kinds は "code"（文字列）しか持たないが、
# spec/openapi.yaml は投薬・予防のURLで整数の kind_id を要求している
# （/animals/{karte_no}/dosing/{kind_id} 等）。
# 【仮決め】配列のインデックス+1 を kind_id として採番する（qa/lane-b.md Q11）。
# data/make_data.py の SEED は固定で、生成し直しても並びは変わらない
# （data/README.md「2回流すと完全に同じ出力になる」）ため、この対応は安定する。
#
# 投薬の種別マスタは data/masters.json に無いため、予防の種別を流用する
# （data/README.md「種別は data/masters.json の予防の種別と共通」）。
module FixedData
  class Masters
    PATH = Rails.root.join("..", "..", "data", "masters.json")

    # 【仮決め】予防種別ごとの基本周期（月）。data/masters.json には周期の情報が無いため、
    # spec/screens.md #12「次回予定日の自動計算」を満たすために種別名から妥当な値を当てた。
    # 一般的な予防接種・投薬間隔の目安であり、実在の製品の用法用量ではない。
    PREVENTION_CYCLE_MONTHS = {
      "vaccine_core" => 12,
      "vaccine_rabies" => 12,
      "heartworm" => 1,
      "flea_tick" => 1,
      "deworming" => 3
    }.freeze

    class << self
      def data
        @data ||= JSON.parse(File.read(PATH), symbolize_names: false)
      end

      def prevention_kinds
        indexed(data.fetch("prevention_kinds"))
      end

      def dosing_kinds
        # data/README.md: 投薬の種別は予防の種別と共通。
        prevention_kinds
      end

      def reception_kinds
        indexed(data.fetch("reception_kinds"))
      end

      def departments
        indexed(data.fetch("departments"))
      end

      def phrases
        data.fetch("phrases")
      end

      def price_categories
        data.fetch("price_categories")
      end

      def prevention_cycle_months(code)
        PREVENTION_CYCLE_MONTHS[code]
      end

      # 契約（spec/openapi.yaml DosingKindId / PreventionKindId）は type: integer
      # （マスタの行id）だが、`data/seed.json` の dosings/preventions は数値idを持たず
      # `kind` にコード文字列（例: "heartworm"）しか持たない。共通テストの在庫検査
      # （tests/inventory.py）は実データから引いた値をそのまま埋めるため、
      # 数値id（配列順の1始まり）とコード文字列の両方を受け付ける
      # （Go実装 stacks/go/internal/server/dosing.go の resolveKind と同じ仮決め）。
      def kind_code_for(kind_id)
        key = kind_id.to_s
        by_id = prevention_kinds.find { |k| k[:kind_id].to_s == key }
        return by_id[:code] if by_id

        by_code = prevention_kinds.find { |k| k[:code] == key }
        by_code && by_code[:code]
      end

      def kind_by_code_or_id(kind_id)
        key = kind_id.to_s
        prevention_kinds.find { |k| k[:kind_id].to_s == key || k[:code] == key }
      end

      def reception_kind_label(code)
        reception_kinds.find { |k| k[:code] == code }&.fetch(:name, nil)
      end

      private

      def indexed(list)
        list.each_with_index.map { |row, i| row.symbolize_keys.merge(kind_id: i + 1) }
      end
    end
  end
end
