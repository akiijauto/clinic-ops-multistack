# 顧客（飼主・動物の詳細）・来院履歴。spec/screens.md #3・#5。
class AnimalsController < ApplicationController
  def show
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner
  end

  # 簡易版: この動物の診察一覧（削除済みも含めて新しい順）。
  # 監査ログ（AuditEntry）を使った完全版は本実装フェーズで足す。
  def history
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @visits = @patient.visits.order(visit_date: :desc, visit_no: :desc)
  end
end
