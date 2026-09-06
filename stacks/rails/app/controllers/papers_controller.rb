# 書類（紙カルテPDF相当）。spec/screens.md #13。
# 実体（バイナリ）は持たない・物理削除しない（app/models/paper.rb）。
class PapersController < ApplicationController
  def index
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @papers = @patient.papers.active.order(created_at: :desc)
  end

  # 「この子の紙カルテは元から無い」の印を付ける・外す（spec/screens.md #13）。
  def set_no_paper
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    if params[:value] == "1"
      PatientNoPaper.find_or_create_by!(patient: @patient)
    else
      @patient.patient_no_paper&.destroy
    end
    @papers = @patient.papers.active.order(created_at: :desc)
    render :index
  end

  def show
    @paper = Paper.find(params[:paper_id])
    @patient = @paper.patient
  end

  # 保存の成否によらず一覧へ戻る（他の screens 同様、HTMLはステータスコードで判定しない）。
  def create
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @paper = @patient.papers.new(paper_params)
    if @paper.save
      @success = true
    else
      @error = true
      @error_message = @paper.errors.full_messages.join("、")
    end
    @papers = @patient.papers.active.order(created_at: :desc)
    render :index
  end

  # 取消（物理削除しない。行と実体は残る。spec/screens.md #13）。
  def remove
    @paper = Paper.find(params[:paper_id])
    @paper.remove!
    @patient = @paper.patient
    @success = true
    @papers = @patient.papers.active.order(created_at: :desc)
    render :index
  end

  # 対象となる文書が無いことの案内（静的な説明画面）。
  def no_paper
  end

  private

  def paper_params
    params.permit(:title, :note)
  end
end
