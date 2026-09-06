# 設定・機能設定・取込・マスタ（spec/screens.md #22〜25）。
class SettingsController < ApplicationController
  # spec/model.md「落としたもの」表をそのまま転記したもの（機能設定・折りたたみ表示の元データ）。
  # 領域1の FoldedController も同じ元データを別に持つ（同じ内容であれば独立に定義してよい、と
  # 指示されている）。
  FOLDED_ITEMS = [
    { key: "hospital_division", title: "分院（hospital_division）",
      message: "病院は1件だけ扱う。複数拠点は比較の題材にならない" },
    { key: "clinic_feature", title: "ClinicFeature（機能の出し分け）",
      message: "題材の運用固有の事情。他所で意味を持たない" },
    { key: "staff_position", title: "StaffPosition（役職マスタ）",
      message: "Staff.role で足りる" },
    { key: "karte_draft", title: "KarteDraft（書きかけの自動保存）",
      message: "題材が「手で押す保存は作らない」と決めている。自動保存もこの企画では外す" },
    { key: "audit_log", title: "AuditLog（監査ログ）",
      message: "業務では重要だが、5実装で比べる題材にはならない" },
    { key: "karte_pdf", title: "KartePdf（紙カルテの取込）",
      message: "ファイルの取り扱いが主題になってしまう" },
    { key: "lab_item_master", title: "LabItemMaster / LabRefRange / LabAgeBand",
      message: "固定データへ移した。参照はする。編集画面は作らない" },
    { key: "billing_category", title: "BillingCategory / DepartmentMaster / PhraseMaster",
      message: "固定データへ移した。参照はする。編集画面は作らない" },
    { key: "price_item_hierarchy", title: "PriceItem の4階層分類",
      message: "2階層に減らした。階層の深さは比較の題材にならない" },
    { key: "receipt", title: "レセプト（保険請求）",
      message: "制度の知識が要り、間違えると害がある。手を出さない" },
    { key: "clinic_points", title: "病院設定のポイント",
      message: "会員制度の設計が要る。5実装で比べる題材にならない" },
    { key: "clinic_last_slip_no", title: "病院設定の最終伝票番号",
      message: "伝票番号は Billing.slip_no が持つ。採番の続きを設定で持つのは運用移行のための" \
               "仕組みで、新規に作るこの企画には要らない" },
    { key: "clinic_institution_code", title: "病院設定の機関コード",
      message: "保険請求で使う番号。レセプトを外したので使い道が無い" },
    { key: "clinic_logo", title: "病院設定のロゴ画像",
      message: "画像の取り扱いが主題になってしまう（紙カルテの取込を外したのと同じ理由）" }
  ].freeze

  MASTER_KEYS = %w[price_item lab_item reception_kind prevention_kind department phrase].freeze

  IMPORT_COUNTS = [
    { label: "飼主", model: "Owner" },
    { label: "動物", model: "Patient" },
    { label: "受付", model: "Reception" },
    { label: "診察", model: "Visit" },
    { label: "経過記録", model: "ProgressNote" },
    { label: "検査", model: "LabTest" },
    { label: "予防", model: "Prevention" },
    { label: "投薬", model: "Dosing" },
    { label: "会計", model: "Billing" },
    { label: "予約", model: "Reservation" },
    { label: "入院", model: "Hospitalization" },
    { label: "スタッフ", model: "Staff" },
    { label: "書類", model: "Paper" }
  ].freeze

  before_action :load_import_counts, only: %i[import_form import_survey]

  def show
    @clinic = Clinic.current
  end

  def save
    @clinic = Clinic.current
    if @clinic.update(clinic_params)
      @success = true
    else
      @error = true
    end
    render :show
  end

  def features
    @items = FOLDED_ITEMS
  end

  def import_form
  end

  # CSVの列名と件数だけを読む。保存はしない（spec/screens.md #24、spec/openapi.yaml）。
  # csv gem を Gemfile に追加しない方針（依存追加は指揮役の裁定範囲外）のため、
  # 列名と行数だけを手で数える素朴な読み方にしてある。
  def import_survey
    file = params[:file]
    if file.blank?
      @error = true
    else
      lines = file.read.encode("UTF-8", invalid: :replace, undef: :replace).each_line.map(&:chomp)
      lines.reject!(&:blank?)
      if lines.empty?
        @error = true
      else
        @headers = lines.first.split(",")
        @row_count = lines.size - 1
        @success = true
      end
    end
    render :import_form
  end

  def master_default
    redirect_to "/settings/master/#{MASTER_KEYS.first}"
  end

  def master
    @key = params[:key]
    unless MASTER_KEYS.include?(@key)
      render plain: "not found", status: :not_found
      return
    end
    @rows = master_rows(@key)
  end

  private

  def load_import_counts
    @counts = IMPORT_COUNTS.map { |row| row.merge(count: row[:model].constantize.count) }
    # 「読み込み日時」を記録する専用の列は無い（db/migrate・db/seeds.rb は変更禁止のため
    # 追加できない）。seed投入時に最初に作られる行の created_at を読み込み日時の近似値として使う。
    @loaded_at = Owner.minimum(:created_at)
  end

  def clinic_params
    permitted = params.require(:clinic).permit(
      :name, :postal_code, :address1, :address2, :phone, :fax,
      :director_name, :reservation_slot_minutes, :tax_rate,
      closed_weekdays: []
    )
    permitted[:closed_weekdays] = Array(permitted[:closed_weekdays]).reject(&:blank?).map(&:to_i)
    permitted
  end

  def master_rows(key)
    case key
    when "price_item"      then FixedData::PriceItems.all
    when "lab_item"        then FixedData::LabItems.all
    when "reception_kind"  then FixedData::Masters.reception_kinds
    when "prevention_kind" then FixedData::Masters.prevention_kinds
    when "department"      then FixedData::Masters.departments
    when "phrase"          then phrase_rows
    end
  end

  # FixedData::Masters.phrases はカテゴリ名 => 定型文の配列 というハッシュなので、
  # 他のマスタと同じ「行の配列」の形に均す（一覧表示を1つのテンプレートで共通化するため）。
  def phrase_rows
    FixedData::Masters.phrases.flat_map do |category, phrases|
      phrases.map { |phrase| { category: category, phrase: phrase } }
    end
  end
end
