# data/seed.json（リポジトリ直下、5レーン共通）を読み込む。
#
# 何度流しても同じ結果になるように、まず自分のテーブルを空にしてから入れ直す
# （このアプリの範囲＝stacks/rails 配下のDBだけを触る。他レーンのDBには触れない）。
require "json"

SEED_PATH = Rails.root.join("..", "..", "data", "seed.json")
seed = JSON.parse(File.read(SEED_PATH))

puts "== data/seed.json を読み込み中（anchor_date=#{seed['anchor_date']}） =="

ActiveRecord::Base.transaction do
  # 依存の無い順に消す
  %w[
    AuditEntry CareRecord Hospitalization Paper Reservation
    BillingDetail Billing LabTestItem LabTest Dosing Prevention ProgressNote
    Visit Reception Patient Owner Staff Clinic
  ].each { |name| name.constantize.delete_all }

  clinic = seed["clinic"]
  Clinic.create!(
    id: clinic["id"], name: clinic["name"], postal_code: clinic["postal_code"],
    address1: clinic["address1"], address2: clinic["address2"], phone: clinic["phone"],
    fax: clinic["fax"], director_name: clinic["director_name"],
    reservation_slot_minutes: clinic["reservation_slot_minutes"], tax_rate: clinic["tax_rate"],
    closed_weekdays: clinic["closed_weekdays"]
  )

  seed["staff"].each do |s|
    Staff.create!(
      id: s["id"], staff_code: s["staff_code"], name: s["name"], role: s["role"],
      is_active: s["is_active"], password_hash: s["password_hash"]
    )
  end

  seed["owners"].each do |o|
    Owner.create!(
      id: o["id"], owner_no: o["owner_no"], name_kana: o["name_kana"], name_kanji: o["name_kanji"],
      postal_code: o["postal_code"], address1: o["address1"], address2: o["address2"],
      phone: o["phone"], mobile: o["mobile"], deleted_at: o["deleted_at"]
    )
  end

  seed["patients"].each do |p|
    Patient.create!(
      id: p["id"], karte_no: p["karte_no"], owner_id: p["owner_id"],
      name_kana: p["name_kana"], name_kanji: p["name_kanji"], species: p["species"],
      breed: p["breed"], sex: p["sex"], birth_date: p["birth_date"],
      neuter_date: p["neuter_date"], deleted_at: p["deleted_at"]
    )
  end

  seed["receptions"].each do |r|
    Reception.create!(
      id: r["id"], patient_id: r["patient_id"], display_no: r["display_no"],
      received_at: r["received_at"], kind: r["kind"], owner_purpose: r["owner_purpose"],
      medical_purpose: r["medical_purpose"], status: r["status"], staff_id: r["staff_id"]
    )
  end

  progress_notes_by_visit = seed["progress_notes"].group_by { |pn| pn["visit_id"] }

  seed["visits"].each do |v|
    visit = Visit.create!(
      id: v["id"], patient_id: v["patient_id"], visit_no: v["visit_no"], visit_date: v["visit_date"],
      visit_time: v["visit_time"], body_weight_kg: v["body_weight_kg"], chief_complaint: v["chief_complaint"],
      symptom: v["symptom"], diagnosis: v["diagnosis"], treatment: v["treatment"],
      staff_id: v["staff_id"], deleted_at: v["deleted_at"]
    )
    (progress_notes_by_visit[v["id"]] || []).each do |pn|
      ProgressNote.create!(
        id: pn["id"], visit_id: visit.id, row_no: pn["row_no"], entry_date: pn["entry_date"],
        temperature_c: pn["temperature_c"], pulse: pn["pulse"], respiration: pn["respiration"],
        body_weight_kg: pn["body_weight_kg"], symptom_course: pn["symptom_course"],
        treatment_rx: pn["treatment_rx"], note: pn["note"]
      )
    end
  end

  seed["preventions"].each do |p|
    Prevention.create!(
      id: p["id"], patient_id: p["patient_id"], kind: p["kind"], content: p["content"],
      performed_date: p["performed_date"], next_due_date: p["next_due_date"], staff_id: p["staff_id"]
    )
  end

  seed["dosings"].each do |d|
    Dosing.create!(
      id: d["id"], patient_id: d["patient_id"], kind: d["kind"], fiscal_year: d["fiscal_year"],
      **(1..12).to_h { |i| [ format("m%02d", i), d[format("m%02d", i)] ] }
    )
  end

  lab_test_items_by_test = seed["lab_test_items"].group_by { |i| i["lab_test_id"] }

  seed["lab_tests"].each do |lt|
    test = LabTest.create!(
      id: lt["id"], patient_id: lt["patient_id"], visit_id: lt["visit_id"], category: lt["category"],
      tested_on: lt["tested_on"], tested_at_time: lt["tested_at_time"], staff_id: lt["staff_id"]
    )
    (lab_test_items_by_test[lt["id"]] || []).each do |it|
      LabTestItem.create!(
        id: it["id"], lab_test_id: test.id, item_code: it["item_code"],
        value_num: it["value_num"], value_text: it["value_text"]
      )
    end
  end

  details_by_billing = seed["billing_details"].group_by { |d| d["billing_id"] }

  seed["billings"].each do |b|
    billing = Billing.new(
      id: b["id"], patient_id: b["patient_id"], owner_id: b["owner_id"], slip_no: b["slip_no"],
      status: b["status"], billed_on: b["billed_on"], staff_id: b["staff_id"],
      cashier_staff_id: b["cashier_staff_id"], paid_amount: b["paid_amount"],
      payment_method: b["payment_method"]
    )
    billing.save!(validate: false) # 検算用データそのままを入れる（確定済み明細の凍結ルールに阻まれないように）

    (details_by_billing[b["id"]] || []).each do |d|
      BillingDetail.create!(
        id: d["id"], billing_id: billing.id, row_no: d["row_no"], price_code: d["price_code"],
        name: d["name"], quantity: d["quantity"], unit_price: d["unit_price"], is_taxable: d["is_taxable"]
      )
    end
  end

  seed["reservations"].each do |r|
    Reservation.new(
      id: r["id"], patient_id: r["patient_id"], starts_at: r["starts_at"], ends_at: r["ends_at"],
      staff_id: r["staff_id"], room: r["room"], purpose: r["purpose"], note: r["note"],
      status: r["status"]
    ).save!(validate: false) # seed データは重複無しを自己検査済み（data/README.md）
  end

  seed["hospitalizations"].each do |h|
    hosp = Hospitalization.create!(
      id: h["id"], patient_id: h["patient_id"], admitted_on: h["admitted_on"],
      discharged_on: h["discharged_on"], room: h["room"]
    )
    (h["care_records"] || []).each do |cr|
      # seed.json の care_records.id は入院ごとに1から振り直されており
      # （テーブル全体でユニークではない）、そのままDBのidに使えない。ここでは
      # 自動採番に任せる（他のテーブルから care_records.id を参照する箇所は無い）。
      #
      # キー名は "category"。openapi.yaml は "kind"（qa/lane-b.md Q10）。
      # 「退院済みには新規記録を足せない」検証は、過去分の入れ直しであるseed投入には
      # 適用しない（validate: false）。実際の追加操作（画面・API経由）では検証がかかる。
      CareRecord.new(
        hospitalization_id: hosp.id, recorded_at: cr["recorded_at"],
        kind: cr["category"], content: cr["content"], performed_by_staff_id: cr["performed_by_staff_id"]
      ).save!(validate: false)
    end
  end
end

# sqlite の AUTOINCREMENT を、入れた最大IDより先に進めておく
# （明示的に id を指定して作っているため、次の自動採番がぶつからないように）。
%w[clinics staffs owners patients receptions visits progress_notes preventions dosings
   lab_tests lab_test_items billings billing_details reservations hospitalizations
   care_records].each do |table|
  max_id = ActiveRecord::Base.connection.select_value("SELECT MAX(id) FROM #{table}").to_i
  next if max_id.zero?

  ActiveRecord::Base.connection.execute("DELETE FROM sqlite_sequence WHERE name = '#{table}'")
  ActiveRecord::Base.connection.execute("INSERT INTO sqlite_sequence (name, seq) VALUES ('#{table}', #{max_id})")
end

puts "== 完了 =="
puts "clinic=#{Clinic.count} staff=#{Staff.count} owners=#{Owner.count} patients=#{Patient.count}"
puts "receptions=#{Reception.count} visits=#{Visit.count} progress_notes=#{ProgressNote.count}"
puts "preventions=#{Prevention.count} dosings=#{Dosing.count} lab_tests=#{LabTest.count} lab_test_items=#{LabTestItem.count}"
puts "billings=#{Billing.count} billing_details=#{BillingDetail.count}"
puts "reservations=#{Reservation.count} hospitalizations=#{Hospitalization.count} care_records=#{CareRecord.count}"
