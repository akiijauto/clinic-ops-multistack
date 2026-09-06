# 郵便番号→住所の簡易対応（架空データのみ）。spec/openapi.yaml `/postal`。
#
# 【仮決め】実在の郵便番号APIは課金・外部通信を避けるため使わない
# （coordination/DECISIONS.md 第3節）。data/ にも郵便番号の対応表が無いため、
# ごく少数の架空の対応をここへハードコードする。Go実装
# （stacks/go/internal/settings/postal.go）と同じ地名・同じ対応表を使う
# （data/seed.json のClinic住所「みなも県すみれ市」に倣った架空の地名）。
module FixedData
  class Postal
    TABLE = {
      "9990001" => { postal_code: "999-0001", address1: "みなも県すみれ市かえで町", address2: "1丁目" },
      "9990012" => { postal_code: "999-0012", address1: "みなも県すみれ市もみじ町", address2: "2丁目" },
      "8880023" => { postal_code: "888-0023", address1: "はるかぜ県こだま市さくら町", address2: "3丁目" },
      "7770045" => { postal_code: "777-0045", address1: "はるかぜ県こだま市ひばり町", address2: "" }
    }.freeze

    NOT_FOUND_REASON = "該当する住所が見つかりません（この企画では架空の郵便番号を数件だけ持つ簡易対応です）。".freeze

    class << self
      # 候補が無いときは空配列と理由を返す（404にしない。spec/openapi.yaml「候補が無いときは
      # candidatesが空配列で、reasonに理由が入る」）。
      def lookup(code)
        key = digits_only(code)
        row = TABLE[key]
        return [ [ row ], "" ] if row

        [ [], NOT_FOUND_REASON ]
      end

      private

      def digits_only(code)
        code.to_s.gsub(/\D/, "")
      end
    end
  end
end
