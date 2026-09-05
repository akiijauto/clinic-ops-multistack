# 検索（spec/screens.md #4）。飼主・動物と、診察の中身を独立に検索する。
class SearchController < ApplicationController
  def index
    @q = params[:q].to_s.strip
    if @q.present?
      @patients = Patient.kept.includes(:owner)
                          .where("name_kanji LIKE :q OR name_kana LIKE :q OR karte_no LIKE :q",
                                 q: "%#{@q}%")
                          .limit(20)
      @visits = Visit.kept.includes(:patient)
                     .where("chief_complaint LIKE :q OR symptom LIKE :q OR diagnosis LIKE :q OR treatment LIKE :q",
                            q: "%#{@q}%")
                     .limit(20)
    else
      @patients = []
      @visits = []
    end
  end
end
