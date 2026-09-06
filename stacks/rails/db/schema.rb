# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_06_190000) do
  create_table "audit_entries", force: :cascade do |t|
    t.string "action", null: false
    t.text "changes_json"
    t.datetime "created_at", null: false
    t.datetime "occurred_at", null: false
    t.string "reason"
    t.integer "staff_id"
    t.integer "subject_id", null: false
    t.string "subject_type", null: false
    t.datetime "updated_at", null: false
    t.index ["staff_id"], name: "index_audit_entries_on_staff_id"
    t.index ["subject_type", "subject_id"], name: "index_audit_entries_on_subject_type_and_subject_id"
  end

  create_table "billing_details", force: :cascade do |t|
    t.integer "billing_id", null: false
    t.datetime "created_at", null: false
    t.boolean "is_taxable", default: true, null: false
    t.string "name", null: false
    t.string "price_code", null: false
    t.decimal "quantity", precision: 10, scale: 2, null: false
    t.integer "row_no", null: false
    t.integer "unit_price"
    t.datetime "updated_at", null: false
    t.index ["billing_id"], name: "index_billing_details_on_billing_id"
  end

  create_table "billings", force: :cascade do |t|
    t.date "billed_on", null: false
    t.integer "cashier_staff_id"
    t.datetime "created_at", null: false
    t.integer "owner_id", null: false
    t.integer "paid_amount"
    t.integer "patient_id", null: false
    t.string "payment_method"
    t.string "slip_no"
    t.integer "staff_id"
    t.string "status", default: "draft", null: false
    t.datetime "updated_at", null: false
    t.index ["cashier_staff_id"], name: "index_billings_on_cashier_staff_id"
    t.index ["owner_id"], name: "index_billings_on_owner_id"
    t.index ["patient_id"], name: "index_billings_on_patient_id"
    t.index ["slip_no"], name: "index_billings_on_slip_no", unique: true
    t.index ["staff_id"], name: "index_billings_on_staff_id"
  end

  create_table "care_records", force: :cascade do |t|
    t.string "content"
    t.datetime "created_at", null: false
    t.integer "hospitalization_id", null: false
    t.string "kind", null: false
    t.integer "performed_by_staff_id", null: false
    t.datetime "recorded_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hospitalization_id"], name: "index_care_records_on_hospitalization_id"
    t.index ["performed_by_staff_id"], name: "index_care_records_on_performed_by_staff_id"
  end

  create_table "clinics", force: :cascade do |t|
    t.string "address1"
    t.string "address2"
    t.text "closed_weekdays", default: "[]", null: false
    t.datetime "created_at", null: false
    t.string "director_name"
    t.string "fax"
    t.string "name", null: false
    t.string "phone"
    t.string "postal_code"
    t.integer "reservation_slot_minutes", default: 15, null: false
    t.decimal "tax_rate", precision: 5, scale: 4, default: "0.1", null: false
    t.datetime "updated_at", null: false
  end

  create_table "dosings", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "fiscal_year", null: false
    t.string "kind", null: false
    t.string "m01"
    t.string "m02"
    t.string "m03"
    t.string "m04"
    t.string "m05"
    t.string "m06"
    t.string "m07"
    t.string "m08"
    t.string "m09"
    t.string "m10"
    t.string "m11"
    t.string "m12"
    t.integer "patient_id", null: false
    t.datetime "updated_at", null: false
    t.index ["patient_id", "kind", "fiscal_year"], name: "idx_dosings_unique", unique: true
    t.index ["patient_id"], name: "index_dosings_on_patient_id"
  end

  create_table "hospitalizations", force: :cascade do |t|
    t.date "admitted_on", null: false
    t.datetime "created_at", null: false
    t.date "discharged_on"
    t.integer "patient_id", null: false
    t.string "room", null: false
    t.datetime "updated_at", null: false
    t.index ["patient_id"], name: "index_hospitalizations_on_patient_id"
  end

  create_table "lab_test_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "item_code", null: false
    t.integer "lab_test_id", null: false
    t.datetime "updated_at", null: false
    t.decimal "value_num", precision: 10, scale: 3
    t.string "value_text"
    t.index ["lab_test_id"], name: "index_lab_test_items_on_lab_test_id"
  end

  create_table "lab_tests", force: :cascade do |t|
    t.string "category", null: false
    t.datetime "created_at", null: false
    t.integer "patient_id", null: false
    t.integer "staff_id"
    t.string "tested_at_time"
    t.date "tested_on", null: false
    t.datetime "updated_at", null: false
    t.integer "visit_id", null: false
    t.index ["patient_id"], name: "index_lab_tests_on_patient_id"
    t.index ["staff_id"], name: "index_lab_tests_on_staff_id"
    t.index ["visit_id"], name: "index_lab_tests_on_visit_id"
  end

  create_table "owners", force: :cascade do |t|
    t.string "address1"
    t.string "address2"
    t.datetime "created_at", null: false
    t.datetime "deleted_at"
    t.string "mobile"
    t.string "name_kana", null: false
    t.string "name_kanji", null: false
    t.string "owner_no", null: false
    t.string "phone"
    t.string "postal_code"
    t.datetime "updated_at", null: false
    t.index ["deleted_at"], name: "index_owners_on_deleted_at"
    t.index ["owner_no"], name: "index_owners_on_owner_no", unique: true
  end

  create_table "papers", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "note"
    t.integer "patient_id", null: false
    t.datetime "removed_at"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["patient_id"], name: "index_papers_on_patient_id"
  end

  create_table "patient_no_papers", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "patient_id", null: false
    t.datetime "updated_at", null: false
    t.index ["patient_id"], name: "index_patient_no_papers_on_patient_id", unique: true
  end

  create_table "patients", force: :cascade do |t|
    t.date "birth_date"
    t.string "breed"
    t.datetime "created_at", null: false
    t.datetime "deleted_at"
    t.string "karte_no", null: false
    t.string "name_kana", null: false
    t.string "name_kanji", null: false
    t.date "neuter_date"
    t.integer "owner_id", null: false
    t.string "sex", null: false
    t.string "species", null: false
    t.datetime "updated_at", null: false
    t.index ["deleted_at"], name: "index_patients_on_deleted_at"
    t.index ["karte_no"], name: "index_patients_on_karte_no", unique: true
    t.index ["owner_id"], name: "index_patients_on_owner_id"
  end

  create_table "preventions", force: :cascade do |t|
    t.string "content"
    t.datetime "created_at", null: false
    t.string "kind", null: false
    t.date "next_due_date"
    t.integer "patient_id", null: false
    t.date "performed_date", null: false
    t.integer "staff_id"
    t.datetime "updated_at", null: false
    t.index ["patient_id"], name: "index_preventions_on_patient_id"
    t.index ["staff_id"], name: "index_preventions_on_staff_id"
  end

  create_table "progress_notes", force: :cascade do |t|
    t.decimal "body_weight_kg", precision: 6, scale: 2
    t.datetime "created_at", null: false
    t.date "entry_date", null: false
    t.string "note"
    t.integer "pulse"
    t.integer "respiration"
    t.integer "row_no", null: false
    t.string "symptom_course"
    t.decimal "temperature_c", precision: 4, scale: 1
    t.string "treatment_rx"
    t.datetime "updated_at", null: false
    t.integer "visit_id", null: false
    t.index ["visit_id"], name: "index_progress_notes_on_visit_id"
  end

  create_table "receptions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "display_no", null: false
    t.string "kind"
    t.string "medical_purpose"
    t.string "owner_purpose"
    t.integer "patient_id", null: false
    t.datetime "received_at", null: false
    t.integer "staff_id"
    t.string "status", default: "waiting", null: false
    t.datetime "updated_at", null: false
    t.index ["patient_id"], name: "index_receptions_on_patient_id"
    t.index ["staff_id"], name: "index_receptions_on_staff_id"
  end

  create_table "reservations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "ends_at", null: false
    t.string "note"
    t.integer "patient_id", null: false
    t.string "purpose"
    t.string "room", null: false
    t.integer "staff_id", null: false
    t.datetime "starts_at", null: false
    t.string "status", default: "booked", null: false
    t.datetime "updated_at", null: false
    t.index ["patient_id"], name: "index_reservations_on_patient_id"
    t.index ["room", "starts_at"], name: "index_reservations_on_room_and_starts_at"
    t.index ["staff_id", "starts_at"], name: "index_reservations_on_staff_id_and_starts_at"
    t.index ["staff_id"], name: "index_reservations_on_staff_id"
  end

  create_table "staffs", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "is_active", default: true, null: false
    t.string "name", null: false
    t.string "password_hash"
    t.string "role", null: false
    t.string "staff_code", null: false
    t.datetime "updated_at", null: false
    t.index ["staff_code"], name: "index_staffs_on_staff_code", unique: true
  end

  create_table "visits", force: :cascade do |t|
    t.decimal "body_weight_kg", precision: 6, scale: 2
    t.string "chief_complaint"
    t.datetime "created_at", null: false
    t.datetime "deleted_at"
    t.string "diagnosis"
    t.integer "patient_id", null: false
    t.integer "staff_id"
    t.string "symptom"
    t.string "treatment"
    t.datetime "updated_at", null: false
    t.date "visit_date", null: false
    t.integer "visit_no", null: false
    t.string "visit_time"
    t.index ["deleted_at"], name: "index_visits_on_deleted_at"
    t.index ["patient_id", "visit_no"], name: "index_visits_on_patient_id_and_visit_no", unique: true
    t.index ["patient_id"], name: "index_visits_on_patient_id"
    t.index ["staff_id"], name: "index_visits_on_staff_id"
  end

  add_foreign_key "audit_entries", "staffs"
  add_foreign_key "billing_details", "billings"
  add_foreign_key "billings", "owners"
  add_foreign_key "billings", "patients"
  add_foreign_key "billings", "staffs"
  add_foreign_key "billings", "staffs", column: "cashier_staff_id"
  add_foreign_key "care_records", "hospitalizations"
  add_foreign_key "care_records", "staffs", column: "performed_by_staff_id"
  add_foreign_key "dosings", "patients"
  add_foreign_key "hospitalizations", "patients"
  add_foreign_key "lab_test_items", "lab_tests"
  add_foreign_key "lab_tests", "patients"
  add_foreign_key "lab_tests", "staffs"
  add_foreign_key "lab_tests", "visits"
  add_foreign_key "papers", "patients"
  add_foreign_key "patient_no_papers", "patients"
  add_foreign_key "patients", "owners"
  add_foreign_key "preventions", "patients"
  add_foreign_key "preventions", "staffs"
  add_foreign_key "progress_notes", "visits"
  add_foreign_key "receptions", "patients"
  add_foreign_key "receptions", "staffs"
  add_foreign_key "reservations", "patients"
  add_foreign_key "reservations", "staffs"
  add_foreign_key "visits", "patients"
  add_foreign_key "visits", "staffs"
end
