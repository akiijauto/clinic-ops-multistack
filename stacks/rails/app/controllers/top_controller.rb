# トップ／このシステムについて（spec/screens.md #7・#8）。
class TopController < ApplicationController
  def index
    @today_count = Reception.for_jst_date(Date.current).count
  end

  # DBに繋がらなくても開ける画面（spec/screens.md #8）。DBを参照しない。
  def about
  end
end
