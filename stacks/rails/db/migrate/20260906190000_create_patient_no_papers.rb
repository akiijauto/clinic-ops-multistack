# 「この子の紙カルテは元から無い」の印（spec/screens.md 13番「できること」）。
#
# 契約は文言だけを求めていて、保存の形までは決めていない。Patient に直接
# boolean 列を足す案もあったが、Next.js が別テーブル（patient_no_paper）で
# 持っているのに合わせた（2026-09-06 指揮役の指摘・「どちらかの形に合わせるのが揃う」）。
# 印が付いている＝行がある、付いていない＝行が無い、という形にして、
# 「未設定」と「外した」を区別する必要が無いようにする。
class CreatePatientNoPapers < ActiveRecord::Migration[8.1]
  def change
    create_table :patient_no_papers do |t|
      t.references :patient, null: false, foreign_key: true, index: { unique: true }
      t.timestamps
    end
  end
end
