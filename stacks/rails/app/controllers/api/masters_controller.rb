# 固定データ（マスタ）の一覧（参照専用）。spec/openapi.yaml `/api/masters/{key}`。
# 書き込み（POST/PATCH/DELETE）は無い（spec/README.md）。
class Api::MastersController < ApplicationController
  KEYS = %w[price_item lab_item reception_kind prevention_kind department phrase].freeze

  def show
    key = params[:key]
    unless KEYS.include?(key)
      render json: { error: "not_found" }, status: :not_found
      return
    end

    items = rows_for(key)
    limit = params[:limit].presence&.to_i
    offset = params[:offset].presence&.to_i || 0
    page = limit ? items.drop(offset).first(limit) : items.drop(offset)

    render json: { key: key, items: page, total: items.size }
  end

  private

  def rows_for(key)
    case key
    when "price_item"      then FixedData::PriceItems.all
    when "lab_item"        then FixedData::LabItems.all
    when "reception_kind"  then FixedData::Masters.reception_kinds
    when "prevention_kind" then FixedData::Masters.prevention_kinds
    when "department"      then FixedData::Masters.departments
    when "phrase"          then FixedData::Masters.phrases
    end
  end
end
