# 書類（spec/openapi.yaml `/api/patients/{karte_no}/papers`・`/api/papers/{paper_id}`）。
# 物理削除しない（app/models/paper.rb）。destroy は removed_at を入れるだけ。
module Api
  class PapersController < ApiController
    def index
      patient = Patient.find_by!(karte_no: params[:karte_no])
      papers = patient.papers.active.order(created_at: :desc)
      render json: { items: papers.map { |p| paper_json(p) }, total: papers.size }
    end

    def create
      patient = Patient.find_by!(karte_no: params[:karte_no])
      paper = patient.papers.new(paper_params)
      paper.save!
      render json: paper_json(paper), status: :created
    end

    def show
      paper = Paper.find(params[:paper_id])
      render json: paper_json(paper)
    end

    def destroy
      paper = Paper.find(params[:paper_id])
      paper.remove!
      render json: paper_json(paper)
    end

    private

    def paper_params
      params.permit(:title, :note)
    end

    def paper_json(p)
      {
        id: p.id, patient_id: p.patient_id, title: p.title, note: p.note,
        created_at: p.created_at
      }
    end
  end
end
