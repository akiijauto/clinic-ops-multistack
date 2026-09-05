# スタッフ（一覧）。spec/screens.md #21。password_hash は表示しない。
class StaffsController < ApplicationController
  def index
    @staffs = Staff.active.order(:staff_code)
  end
end
