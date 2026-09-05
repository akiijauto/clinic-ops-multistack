class HealthController < ApiController
  # GET /health
  def show
    render json: { status: "ok" }
  end
end
