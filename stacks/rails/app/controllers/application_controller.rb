class ApplicationController < ActionController::Base
  # allow_browser versions: :modern は外してある。共通テスト（tests/run.py）のクライアントは
  # urllib で、ブラウザを名乗らない（User-Agent が無い）ため、有効にすると全画面が
  # 406 になり検算3・4・5等の画面系がすべて読めなくなる（coordination/qa/lane-b.md）。

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  helper_method :current_staff

  # いまこの端末を使っている担当者（spec/screens.md #21「スタッフ」）。
  # 認証ではない（coordination/DECISIONS.md 第4節）——申告だけで、パスワードは扱わない。
  # 選ばなくても他の画面の閲覧・保存は妨げられない（担当欄が空のまま記録される）。
  def current_staff
    return @current_staff if defined?(@current_staff)

    @current_staff = session[:staff_id].present? ? Staff.active.find_by(id: session[:staff_id]) : nil
  end
end
