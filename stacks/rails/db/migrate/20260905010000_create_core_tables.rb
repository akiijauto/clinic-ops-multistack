# 契約（spec/model.md）の15モデル＋care_records（16テーブル）をまとめて作る。
#
# 生成のたびにコード全文を書き直すより差分が追いやすいので、1本の migration に
# まとめた（このリポジトリはゼロから作る新規アプリのため、複数 migration に
# 分ける実益が薄い）。
class CreateCoreTables < ActiveRecord::Migration[8.1]
  def change
    # 1. Clinic — 1件だけ存在する
    create_table :clinics do |t|
      t.string  :name, null: false
      t.string  :postal_code
      t.string  :address1
      t.string  :address2
      t.string  :phone
      t.string  :fax
      t.string  :director_name
      t.integer :reservation_slot_minutes, null: false, default: 15
      t.decimal :tax_rate, null: false, default: "0.10", precision: 5, scale: 4
      # 休診日（0=月…6=日）。SQLite に配列型は無いので JSON テキストで持つ。
      t.text    :closed_weekdays, null: false, default: "[]"
      t.timestamps
    end

    # 2. Staff
    create_table :staffs do |t|
      t.string  :staff_code, null: false
      t.string  :name, null: false
      t.string  :role, null: false # vet / nurse / office
      t.boolean :is_active, null: false, default: true
      t.string  :password_hash
      t.timestamps
    end
    add_index :staffs, :staff_code, unique: true

    # 3. Owner — 物理削除しない（deleted_at）
    create_table :owners do |t|
      t.string   :owner_no, null: false
      t.string   :name_kana, null: false
      t.string   :name_kanji, null: false
      t.string   :postal_code
      t.string   :address1
      t.string   :address2
      t.string   :phone
      t.string   :mobile
      t.datetime :deleted_at
      t.timestamps
    end
    add_index :owners, :owner_no, unique: true
    add_index :owners, :deleted_at

    # 4. Patient — 物理削除しない
    create_table :patients do |t|
      t.string   :karte_no, null: false
      t.references :owner, null: false, foreign_key: true
      t.string   :name_kana, null: false
      t.string   :name_kanji, null: false
      t.string   :species, null: false
      t.string   :breed
      t.string   :sex, null: false # male / female / unknown
      t.date     :birth_date
      t.date     :neuter_date
      t.datetime :deleted_at
      t.timestamps
    end
    add_index :patients, :karte_no, unique: true
    add_index :patients, :deleted_at

    # 5. Reception — 本日の患者
    create_table :receptions do |t|
      t.references :patient, null: false, foreign_key: true
      t.integer  :display_no, null: false
      t.datetime :received_at, null: false
      t.string   :kind # data/masters.json の reception_kinds.code
      t.string   :owner_purpose
      t.string   :medical_purpose
      t.string   :status, null: false, default: "waiting" # waiting/in_exam/done
      t.references :staff, null: true, foreign_key: true
      t.timestamps
    end

    # 6. Visit — 物理削除しない
    create_table :visits do |t|
      t.references :patient, null: false, foreign_key: true
      t.integer  :visit_no, null: false
      t.date     :visit_date, null: false
      t.string   :visit_time
      t.decimal  :body_weight_kg, precision: 6, scale: 2
      t.string   :chief_complaint
      t.string   :symptom
      t.string   :diagnosis
      t.string   :treatment
      t.references :staff, null: true, foreign_key: true
      t.datetime :deleted_at
      t.timestamps
    end
    add_index :visits, [ :patient_id, :visit_no ], unique: true
    add_index :visits, :deleted_at

    # 7. ProgressNote
    create_table :progress_notes do |t|
      t.references :visit, null: false, foreign_key: true
      t.integer  :row_no, null: false
      t.date     :entry_date, null: false
      t.decimal  :temperature_c, precision: 4, scale: 1
      t.integer  :pulse
      t.integer  :respiration
      t.decimal  :body_weight_kg, precision: 6, scale: 2
      t.string   :symptom_course
      t.string   :treatment_rx
      t.string   :note
      t.timestamps
    end

    # 8. Prevention
    # 【仮決め】staff_id は openapi.yaml のスキーマに無いが、screens.md #12 が
    # 担当医の入力・表示を要求しているため追加した（qa/lane-b.md Q9）。
    create_table :preventions do |t|
      t.references :patient, null: false, foreign_key: true
      t.string   :kind, null: false # data/masters.json prevention_kinds.code
      t.string   :content
      t.date     :performed_date, null: false
      t.date     :next_due_date
      t.references :staff, null: true, foreign_key: true
      t.timestamps
    end

    # 9. Dosing
    create_table :dosings do |t|
      t.references :patient, null: false, foreign_key: true
      t.string  :kind, null: false
      t.integer :fiscal_year, null: false
      t.string  :m01
      t.string  :m02
      t.string  :m03
      t.string  :m04
      t.string  :m05
      t.string  :m06
      t.string  :m07
      t.string  :m08
      t.string  :m09
      t.string  :m10
      t.string  :m11
      t.string  :m12
      t.timestamps
    end
    add_index :dosings, [ :patient_id, :kind, :fiscal_year ], unique: true, name: "idx_dosings_unique"

    # 10. LabTest / 11. LabTestItem
    create_table :lab_tests do |t|
      t.references :patient, null: false, foreign_key: true
      t.references :visit, null: false, foreign_key: true
      t.string :category, null: false
      t.date   :tested_on, null: false
      t.string :tested_at_time
      t.references :staff, null: true, foreign_key: true
      t.timestamps
    end

    create_table :lab_test_items do |t|
      t.references :lab_test, null: false, foreign_key: true
      t.string  :item_code, null: false
      t.decimal :value_num, precision: 10, scale: 3
      t.string  :value_text
      t.timestamps
    end

    # 12. Billing / 13. BillingDetail
    create_table :billings do |t|
      t.references :patient, null: false, foreign_key: true
      t.references :owner, null: false, foreign_key: true
      t.string  :slip_no # 確定するまで空
      t.string  :status, null: false, default: "draft" # draft/confirmed
      t.date    :billed_on, null: false
      t.references :staff, null: true, foreign_key: true
      t.references :cashier_staff, null: true, foreign_key: { to_table: :staffs }
      t.integer :paid_amount
      t.string  :payment_method
      t.timestamps
    end
    add_index :billings, :slip_no, unique: true

    create_table :billing_details do |t|
      t.references :billing, null: false, foreign_key: true
      t.integer :row_no, null: false
      t.string  :price_code, null: false
      t.string  :name, null: false
      t.decimal :quantity, null: false, precision: 10, scale: 2
      t.integer :unit_price # null = 未設定。0円として扱わない
      t.boolean :is_taxable, null: false, default: true
      t.timestamps
    end

    # 14. Reservation
    create_table :reservations do |t|
      t.references :patient, null: false, foreign_key: true
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.references :staff, null: false, foreign_key: true
      t.string   :room, null: false
      t.string   :purpose
      t.string   :note
      t.string   :status, null: false, default: "booked" # booked/cancelled
      t.timestamps
    end
    add_index :reservations, [ :staff_id, :starts_at ]
    add_index :reservations, [ :room, :starts_at ]

    # 15. Hospitalization / care_records
    create_table :hospitalizations do |t|
      t.references :patient, null: false, foreign_key: true
      t.date   :admitted_on, null: false
      t.date   :discharged_on
      t.string :room, null: false
      t.timestamps
    end

    # care_records の kind は openapi.yaml の CareRecord.kind に合わせた
    # （data/seed.json 側は同じ語彙を category というキーで持つ。qa/lane-b.md Q10）。
    create_table :care_records do |t|
      t.references :hospitalization, null: false, foreign_key: true
      t.datetime :recorded_at, null: false
      t.string   :kind, null: false # medication/feeding/measurement
      t.string   :content
      t.references :performed_by_staff, null: false, foreign_key: { to_table: :staffs }
      t.timestamps
    end

    # 書類（紙カルテPDF）— 実体（バイナリ）は持たない（qa/lane-b.md Q8）。
    # model.md の「落としたもの」（KartePdf）とは異なり、screens.md #13 /
    # openapi.yaml の Paper スキーマが要求する「タイトル・メモだけの記録」として作る。
    create_table :papers do |t|
      t.references :patient, null: false, foreign_key: true
      t.string :title, null: false
      t.string :note
      t.datetime :removed_at # 取り消し（物理削除しない。model.md 13章）
      t.timestamps
    end

    # 来院履歴（画面5）向けの変更履歴。Visit / Owner / Patient への
    # 登録・修正・削除・復元を記録する。他レーンには影響しない、この画面専用の裏方テーブル。
    create_table :audit_entries do |t|
      t.string :subject_type, null: false # "Visit" / "Owner" / "Patient"
      t.integer :subject_id, null: false
      t.string :action, null: false # created/updated/deleted/restored
      t.references :staff, null: true, foreign_key: true
      t.string :reason
      t.text   :changes_json # [{field:, before:, after:}, ...] を JSON で
      t.datetime :occurred_at, null: false
      t.timestamps
    end
    add_index :audit_entries, [ :subject_type, :subject_id ]
  end
end
