# 「この子の紙カルテは元から無い」の印（spec/screens.md 13番）。行があれば印が付いている。
class PatientNoPaper < ApplicationRecord
  belongs_to :patient
end
