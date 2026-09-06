# DM管理。spec/screens.md #16。次回予定日をもとに、案内対象を検索・CSVへ書き出す。
# 画面（index）とCSV（csv）で同じ絞り込み・同じ並びを使う（openapi.yaml の要求）。
#
# `csv` gem は使わない（settings_controller.rb の import_survey と同じ方針。
# 依存追加はレーンの裁定範囲外——Gemfile変更・bundle installが要るため。qa/lane-b.md参照）。
# 手で組み立てる。値にカンマ・二重引用符・改行が来ないデータ（カルテ番号・氏名・種別・日付）
# のみを扱うため、素朴なエスケープで足りる。
class DmController < ApplicationController
  def index
    @kinds = FixedData::Masters.prevention_kinds
    @field = params[:field] == "performed_date" ? "performed_date" : "next_due_date"
    @rows = query_rows.to_a
  end

  def csv
    rows = query_rows.to_a
    lines = [ %w[karte_no owner_name patient_name kind next_due_date performed_date] ]
    rows.each do |r|
      lines << [ r.patient.karte_no, r.patient.owner.name_kanji, r.patient.name_kanji,
                 r.kind, r.next_due_date, r.performed_date ]
    end
    csv_body = lines.map { |row| row.map { |v| csv_escape(v) }.join(",") }.join("\r\n")
    send_data csv_body, type: "text/csv; charset=utf-8", filename: "dm.csv", disposition: "inline"
  end

  private

  # 次回予定日が入っていない記録・削除済みの患者/飼主に紐づく記録は対象外
  # （spec/screens.md #16「満たすべきこと」）。
  def query_rows
    field = params[:field] == "performed_date" ? "performed_date" : "next_due_date"

    scope = Prevention.joins(patient: :owner)
                       .where(patients: { deleted_at: nil }, owners: { deleted_at: nil })
                       .where.not(next_due_date: nil)

    if params[:type].present?
      code = FixedData::Masters.kind_code_for(params[:type])
      scope = scope.where(kind: code) if code
    end

    from = parse_date(params[:from])
    to = parse_date(params[:to])
    scope = scope.where(field => from..) if from
    scope = scope.where(field => ..to) if to

    scope.includes(patient: :owner).order(field => :asc)
  end

  def parse_date(value)
    return nil if value.blank?

    Date.parse(value)
  rescue ArgumentError
    nil
  end

  def csv_escape(value)
    s = value.to_s
    s.match?(/[",\r\n]/) ? %("#{s.gsub('"', '""')}") : s
  end
end
