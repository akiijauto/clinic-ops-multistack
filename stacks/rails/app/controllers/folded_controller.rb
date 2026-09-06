# 折りたたみ表示（spec/screens.md #7）。この企画では扱わないと決めたもの（B）の
# 一覧。個別のボタン（分院の切り替え等）を押したときの着地点でもある。
#
# spec/model.md「落としたもの」表をそのまま転記したもの。settings_controller.rb の
# FOLDED_ITEMS（機能設定画面）と同じ元データだが、独立に持ってよい（各領域の担当が
# 別々に実装したため。中身は一致させてある）。
class FoldedController < ApplicationController
  ITEMS = [
    { key: "hospital_division", title: "分院（hospital_division）",
      message: "病院は1件だけ扱う。複数拠点は比較の題材にならない",
      appears: "本日の患者の分院欄" },
    { key: "clinic_feature", title: "ClinicFeature（機能の出し分け）",
      message: "題材の運用固有の事情。他所で意味を持たない", appears: "機能設定" },
    { key: "staff_position", title: "StaffPosition（役職マスタ）",
      message: "Staff.role で足りる", appears: "スタッフ" },
    { key: "karte_draft", title: "KarteDraft（書きかけの自動保存）",
      message: "題材が「手で押す保存は作らない」と決めている。自動保存もこの企画では外す",
      appears: "カルテ" },
    { key: "audit_log", title: "AuditLog（監査ログ）",
      message: "業務では重要だが、5実装で比べる題材にはならない", appears: "—" },
    { key: "karte_pdf", title: "KartePdf（紙カルテの取込）",
      message: "ファイルの取り扱いが主題になってしまう", appears: "書類（タイトル・メモのみで代替）" },
    { key: "lab_item_master", title: "LabItemMaster / LabRefRange / LabAgeBand",
      message: "固定データへ移した。参照はする。編集画面は作らない", appears: "マスタ" },
    { key: "billing_category", title: "BillingCategory / DepartmentMaster / PhraseMaster",
      message: "固定データへ移した。参照はする。編集画面は作らない", appears: "マスタ" },
    { key: "price_item_hierarchy", title: "PriceItem の4階層分類",
      message: "2階層に減らした。階層の深さは比較の題材にならない", appears: "会計・マスタ" },
    { key: "receipt", title: "レセプト（保険請求）",
      message: "制度の知識が要り、間違えると害がある。手を出さない", appears: "—" },
    { key: "clinic_points", title: "病院設定のポイント",
      message: "会員制度の設計が要る。5実装で比べる題材にならない", appears: "設定" },
    { key: "clinic_last_slip_no", title: "病院設定の最終伝票番号",
      message: "伝票番号は Billing.slip_no が持つ。採番の続きを設定で持つのは運用移行のための" \
               "仕組みで、新規に作るこの企画には要らない", appears: "設定" },
    { key: "clinic_institution_code", title: "病院設定の機関コード",
      message: "保険請求で使う番号。レセプトを外したので使い道が無い", appears: "設定" },
    { key: "clinic_logo", title: "病院設定のロゴ画像",
      message: "画像の取り扱いが主題になってしまう（紙カルテの取込を外したのと同じ理由）",
      appears: "設定" }
  ].freeze

  def show
    @key = params[:key]
    @item = ITEMS.find { |i| i[:key] == @key }
    @items = ITEMS
  end
end
