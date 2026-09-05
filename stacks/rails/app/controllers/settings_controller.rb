# 設定（病院設定）。spec/screens.md #22。保存機能は本実装フェーズで足す。
class SettingsController < ApplicationController
  def show
    @clinic = Clinic.current
  end
end
