# スタッフ（一覧・担当選択）。spec/screens.md #21。password_hash は表示しない。
# 認証ではない（coordination/DECISIONS.md 第4節）——申告だけで、パスワードは扱わない。
class StaffsController < ApplicationController
  def index
    @staffs = Staff.active.order(:staff_code)
  end

  # 一覧から選ぶと、以後の登録・修正・削除の記録にその担当が残る（current_staff経由）。
  # 選んだ担当は別の画面へ移っても保持される（session に入れるだけ）。
  def select
    staff = Staff.active.find_by(id: params[:staff_id])
    session[:staff_id] = staff&.id
    redirect_to "/staff"
  end

  # 担当を外す。外しても他の画面の閲覧・保存は妨げられない（担当欄が空のまま記録される）。
  def clear
    session[:staff_id] = nil
    redirect_to "/staff"
  end
end
