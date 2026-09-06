# 新規登録・顧客（飼主・動物の詳細）・来院履歴・削除。spec/screens.md #2・#3・#5・#6。
class AnimalsController < ApplicationController
  # 品種の入力候補（入力の手掛かり）。品種欄はマスタで縛らない自由入力のまま
  # （spec/screens.md #3「品種リスト」）。data/masters.json に品種の情報は無いため、
  # 一般的な候補をここに直書きする。実在の製品・マスタの複製ではない。
  BREED_CANDIDATES = {
    "dog" => %w[柴犬 トイプードル チワワ ミニチュアダックスフンド ポメラニアン
                 ミックス（犬） ラブラドールレトリバー フレンチブルドッグ 秋田犬],
    "cat" => %w[雑種（猫） アメリカンショートヘア スコティッシュフォールド
                 ロシアンブルー ノルウェージャンフォレストキャット],
    "rabbit" => %w[ネザーランドドワーフ ホーランドロップ ミニレッキス],
    "bird" => %w[セキセイインコ オカメインコ ブンチョウ]
  }.freeze

  def new
    @owner = params[:owner].present? ? Owner.kept.find_by(owner_no: params[:owner]) : nil
    @patient = Patient.new
    @next_karte_no = next_karte_no
    @breed_candidates = BREED_CANDIDATES
  end

  # 登録（spec/screens.md #2）。飼主だけが存在してPatientが無い状態を作らない
  # ——動物欄が空なら保存を成立させない（Patient のバリデーションで担保される）。
  def create
    if params[:owner].present?
      @owner = Owner.kept.find_by(owner_no: params[:owner])
      if @owner.nil?
        @patient = Patient.new(patient_params)
        @next_karte_no = next_karte_no
        @breed_candidates = BREED_CANDIDATES
        flash.now[:error] = "指定された飼主（#{params[:owner]}）が見つかりません。"
        return render :new, status: :ok
      end
      creating_owner = false
    else
      @owner = Owner.new(owner_params)
      creating_owner = true
    end

    ActiveRecord::Base.transaction do
      @owner.save! if creating_owner
      @patient = @owner.patients.new(patient_params)
      @patient.save!
    end

    AuditEntry.record!(subject: @patient, action: "created", staff: current_staff,
                        reason: "新規登録", changed_fields: patient_params.to_h.map { |k, v| { field: k, before: nil, after: v } })
    redirect_to "/animals/#{@patient.karte_no}"
  rescue ActiveRecord::RecordInvalid
    @patient ||= Patient.new(patient_params)
    @next_karte_no = next_karte_no
    @breed_candidates = BREED_CANDIDATES
    flash.now[:error] = validation_error_message(@owner, @patient)
    render :new, status: :ok
  end

  def show
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner
    @breed_candidates = BREED_CANDIDATES
    @unpaid = unpaid_summary(@patient)

    if params[:print] == "card"
      render :card, layout: false
    elsif params[:print] == "document"
      @phrases = FixedData::Masters.phrases
      render :document, layout: false
    end
  end

  # 保存（spec/screens.md #3）。Owner / Patient の項目を更新する。
  def update
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner
    @breed_candidates = BREED_CANDIDATES

    before = { owner: @owner.attributes.slice(*owner_params.keys.map(&:to_s)),
               patient: @patient.attributes.slice(*patient_params.keys.map(&:to_s)) }

    ActiveRecord::Base.transaction do
      @owner.update!(owner_params) if owner_params.present?
      @patient.update!(patient_params) if patient_params.present?
    end

    AuditEntry.record!(subject: @patient, action: "updated", staff: current_staff, reason: "顧客画面から保存",
                        changed_fields: changed_fields_from(before[:patient], patient_params.to_h) +
                                        changed_fields_from(before[:owner], owner_params.to_h))
    flash.now[:success] = "保存しました。"
    @unpaid = unpaid_summary(@patient)
    render :show, status: :ok
  rescue ActiveRecord::RecordInvalid
    @unpaid = unpaid_summary(@patient)
    flash.now[:error] = validation_error_message(@owner, @patient)
    render :show, status: :ok
  end

  # 番号変更（spec/screens.md #3）。未使用の値にだけ付け替える。
  def renumber
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner
    @breed_candidates = BREED_CANDIDATES
    @unpaid = unpaid_summary(@patient)

    ok = true
    old_karte_no = @patient.karte_no
    old_owner_no = @owner.owner_no

    if params[:new_karte_no].present?
      ok &&= @patient.change_karte_no!(params[:new_karte_no])
    end
    if ok && params[:new_owner_no].present?
      ok &&= @owner.change_owner_no!(params[:new_owner_no])
    end

    if ok
      AuditEntry.record!(subject: @patient, action: "updated", staff: current_staff, reason: "番号変更",
                          changed_fields: [
                            { field: "karte_no", before: old_karte_no, after: @patient.karte_no },
                            { field: "owner_no", before: old_owner_no, after: @owner.owner_no }
                          ].select { |c| c[:before] != c[:after] })
      redirect_to "/animals/#{@patient.karte_no}"
    else
      flash.now[:error] = "指定した番号は既に使われています。変更を取り消しました。"
      render :show, status: :ok
    end
  end

  # 削除（確認画面）。spec/screens.md #3。
  def delete_confirm
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner
  end

  # 削除（実行）。Patient.deleted_at に日時を入れる。最後の1頭ならOwnerも。
  # 物理削除はしない（spec/model.md）。
  def destroy
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner

    @patient.soft_delete!
    AuditEntry.record!(subject: @patient, action: "deleted", staff: current_staff, reason: "顧客画面から削除")

    if @owner.patients.kept.none?
      @owner.soft_delete!
      AuditEntry.record!(subject: @owner, action: "deleted", staff: current_staff, reason: "最後の1頭の削除に伴う飼主の削除")
    end

    @deleted = true
    render :delete_confirm, status: :ok
  end

  # 来院履歴（spec/screens.md #5）。登録・修正・削除・復元を新しいものから並べる。
  def history
    @patient = Patient.kept.find_by!(karte_no: params[:karte_no])
    @owner = @patient.owner
    @visits = @patient.visits.visible(true).order(visit_date: :desc, visit_no: :desc)
    @deleted_visits = @patient.visits.discarded.order(visit_date: :desc, visit_no: :desc)

    subject_ids = [@patient.id]
    subject_ids << @owner.id
    visit_ids = @patient.visits.visible(true).pluck(:id)

    @audit_entries = AuditEntry.where(subject_type: "Patient", subject_id: @patient.id)
                               .or(AuditEntry.where(subject_type: "Owner", subject_id: @owner.id))
                               .or(AuditEntry.where(subject_type: "Visit", subject_id: visit_ids))
                               .recent_first
  end

  # 元に戻す（spec/screens.md #5）。削除した診察の Visit.deleted_at を消す。
  def restore_from_history
    visit = Visit.discarded.find(params[:visit_id])
    visit.restore!
    AuditEntry.record!(subject: visit, action: "restored", staff: current_staff, reason: params[:reason].presence)
    redirect_to "/animals/#{visit.patient.karte_no}/history"
  end

  private

  def next_karte_no
    last = Patient.unscoped.order(Arel.sql("CAST(karte_no AS INTEGER) DESC")).first
    last ? (last.karte_no.to_i + 1).to_s : "10001"
  end

  def owner_params
    params.fetch(:owner_attrs, {}).permit(:name_kana, :name_kanji, :postal_code, :address1, :address2, :phone, :mobile)
  end

  def patient_params
    params.fetch(:patient_attrs, {}).permit(:name_kana, :name_kanji, :species, :breed, :sex, :birth_date, :neuter_date)
  end

  def unpaid_summary(patient)
    confirmed = patient.billings.where(status: "confirmed")
    rows = confirmed.map { |b| { billing: b, unpaid: b.calc.total - (b.paid_amount || 0) } }
    { count: rows.count { |r| r[:unpaid] > 0 }, total: rows.sum { |r| [r[:unpaid], 0].max } }
  end

  def changed_fields_from(before, after)
    after.to_h.filter_map do |k, v|
      next if before[k.to_s] == v

      { field: k.to_s, before: before[k.to_s], after: v }
    end
  end

  def validation_error_message(owner, patient)
    (owner.errors.full_messages + patient.errors.full_messages).presence&.join(" / ") || "保存に失敗しました。入力内容を確認してください。"
  end
end
