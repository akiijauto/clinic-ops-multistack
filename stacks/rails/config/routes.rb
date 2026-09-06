Rails.application.routes.draw do
  # === この1本が全26画面＋APIの唯一の正（レーンB内での統合点）。 ===
  # 5つの領域（受付・診療・会計・入院/予約/業務・設定）へ実装を分けるが、
  # ルーティングだけはここに集約する。領域ごとの担当は、対応する
  # controller / view だけを書き、このファイルには触れないこと
  # （新しいアクションが要ると分かったら、指揮役＝このレーン自身に一言のうえ足す）。
  #
  # 既存の実装（検算8を通す最小限フェーズ）の action 名・URL 形はそのまま活かし、
  # 足りない分だけ追加している。

  KARTE_NO = /[0-9]+/ # qa/lane-b.md Q13: 実データはハイフン無しの数字だけ

  get "healthz" => "health#show", as: :healthz
  get "health"  => "health#show", as: :health
  get "up" => "rails/health#show", as: :rails_health_check

  # ============================================================
  # 画面のルート
  # ============================================================

  root "top#index"
  get "about", to: "top#about"

  # --- 領域1｜受付・患者 ---
  get   "today", to: "receptions#index"
  patch "receptions/:id/move", to: "receptions#move", as: :move_reception
  get   "animals/new", to: "animals#new"
  post  "animals/new", to: "animals#create"
  get   "animals/:karte_no", to: "animals#show", karte_no: KARTE_NO
  patch "animals/:karte_no", to: "animals#update", karte_no: KARTE_NO
  post  "animals/:karte_no/renumber", to: "animals#renumber", karte_no: KARTE_NO
  get   "search", to: "search#index"
  get   "animals/:karte_no/history", to: "animals#history", karte_no: KARTE_NO
  get   "animals/:karte_no/delete", to: "animals#delete_confirm", karte_no: KARTE_NO
  post  "animals/:karte_no/delete", to: "animals#destroy", karte_no: KARTE_NO
  post  "visits/:visit_id/restore_from_history", to: "animals#restore_from_history"
  get   "folded/:key", to: "folded#show", as: :folded

  # --- 領域2｜診療 ---
  get   "animals/:karte_no/karte", to: "karte#show", karte_no: KARTE_NO
  post  "animals/:karte_no/karte", to: "karte#save", karte_no: KARTE_NO
  get   "animals/:karte_no/karte/new", to: "karte#new_visit", karte_no: KARTE_NO
  get   "animals/:karte_no/karte/copy_prev", to: "karte#copy_prev", karte_no: KARTE_NO
  post  "animals/:karte_no/karte/cancel", to: "karte#cancel", karte_no: KARTE_NO
  get   "animals/:karte_no/karte/print", to: "karte#print", karte_no: KARTE_NO
  get   "animals/:karte_no/karte/:visit_id/print", to: "karte#print_visit", karte_no: KARTE_NO
  post  "animals/:karte_no/karte/:visit_id/delete", to: "karte#delete_visit", karte_no: KARTE_NO
  post  "animals/:karte_no/karte/:visit_id/restore", to: "karte#restore_visit", karte_no: KARTE_NO

  get   "animals/:karte_no/exam", to: "exams#show", karte_no: KARTE_NO
  post  "animals/:karte_no/exam", to: "exams#save", karte_no: KARTE_NO

  get   "animals/:karte_no/dosing/:kind_id", to: "dosings#show", karte_no: KARTE_NO
  post  "animals/:karte_no/dosing/:kind_id", to: "dosings#save", karte_no: KARTE_NO

  get   "animals/:karte_no/prevention/:kind_id", to: "preventions#show", karte_no: KARTE_NO
  post  "animals/:karte_no/prevention/:kind_id", to: "preventions#save", karte_no: KARTE_NO

  get   "animals/:karte_no/papers", to: "papers#index", karte_no: KARTE_NO
  get   "papers/no-paper", to: "papers#no_paper"
  get   "papers/:paper_id", to: "papers#show"
  post  "animals/:karte_no/papers", to: "papers#create", karte_no: KARTE_NO
  post  "papers/:paper_id/remove", to: "papers#remove"

  # --- 領域3｜会計・売上 ---
  get   "animals/:karte_no/accounting", to: "accounting#show", karte_no: KARTE_NO
  post  "animals/:karte_no/accounting", to: "accounting#save", karte_no: KARTE_NO
  get   "animals/:karte_no/accounting/history", to: "accounting#history", karte_no: KARTE_NO
  get   "dm", to: "dm#index"
  get   "dm.csv", to: "dm#csv"
  get   "sales", to: "sales#index"

  # --- 領域4｜入院・予約・業務 ---
  get   "animals/:karte_no/ward", to: "wards#animal", karte_no: KARTE_NO
  post  "animals/:karte_no/ward", to: "wards#admit", karte_no: KARTE_NO
  post  "animals/:karte_no/ward/:hospitalization_id/care_records", to: "wards#add_care_record", karte_no: KARTE_NO
  post  "animals/:karte_no/ward/:hospitalization_id/discharge", to: "wards#discharge", karte_no: KARTE_NO
  get   "ward", to: "wards#today"
  get   "ward/day", to: "wards#day"

  get   "reservations", to: "reservations#index"
  post  "reservations", to: "reservations#create"
  get   "reservations/new", to: "reservations#new"
  get   "reservations/:id", to: "reservations#show"
  post  "reservations/:id", to: "reservations#update"
  post  "reservations/:id/cancel", to: "reservations#cancel"

  get   "todo/:key", to: "todos#show", as: :todo

  get   "staff", to: "staffs#index"
  post  "staff/select", to: "staffs#select"
  post  "staff/clear", to: "staffs#clear"

  # --- 領域5｜設定 ---
  get   "settings", to: "settings#show"
  post  "settings", to: "settings#save"
  get   "settings/features", to: "settings#features"
  get   "settings/import", to: "settings#import_form"
  post  "settings/import", to: "settings#import_survey"
  get   "settings/master", to: "settings#master_default"
  get   "settings/master/:key", to: "settings#master"

  # ============================================================
  # データのルート（JSON） — 既存のURL形をそのまま活かして追加する
  # ============================================================
  namespace :api do
    get   "postal", to: "postal#show"

    get    "patients", to: "patients#index"
    get    "patients/:karte_no", to: "patients#show", karte_no: KARTE_NO
    patch  "patients/:karte_no", to: "patients#update", karte_no: KARTE_NO
    post   "patients/:karte_no/delete", to: "patients#destroy", karte_no: KARTE_NO
    post   "patients/:karte_no/restore", to: "patients#restore", karte_no: KARTE_NO
    post   "patients/:karte_no/receptions", to: "patients#create_reception", karte_no: KARTE_NO

    get    "owners/:owner_no", to: "owners#show"
    patch  "owners/:owner_no", to: "owners#update"
    post   "owners/:owner_no/delete", to: "owners#destroy"
    get    "owners/:owner_no/billings", to: "owner_billings#index"

    get    "receptions", to: "receptions#index"
    post   "receptions", to: "receptions#create"
    get    "receptions/:id", to: "receptions#show"
    patch  "receptions/:id", to: "receptions#update"

    get    "patients/:karte_no/visits", to: "visits#index", karte_no: KARTE_NO
    post   "patients/:karte_no/visits", to: "visits#create", karte_no: KARTE_NO
    get    "visits/:visit_id", to: "visits#show"
    patch  "visits/:visit_id", to: "visits#update"
    post   "visits/:visit_id/delete", to: "visits#destroy"
    post   "visits/:visit_id/restore", to: "visits#restore"

    get    "patients/:karte_no/lab-tests", to: "lab_tests#index", karte_no: KARTE_NO
    post   "patients/:karte_no/lab-tests", to: "lab_tests#create", karte_no: KARTE_NO
    get    "lab-tests/:id", to: "lab_tests#show"

    get    "patients/:karte_no/dosing/:kind_id", to: "dosings#show", karte_no: KARTE_NO
    patch  "patients/:karte_no/dosing/:kind_id", to: "dosings#update", karte_no: KARTE_NO

    get    "patients/:karte_no/prevention/:kind_id", to: "preventions#index", karte_no: KARTE_NO
    post   "patients/:karte_no/prevention/:kind_id", to: "preventions#create", karte_no: KARTE_NO

    get    "patients/:karte_no/papers", to: "papers#index", karte_no: KARTE_NO
    post   "patients/:karte_no/papers", to: "papers#create", karte_no: KARTE_NO
    get    "papers/:paper_id", to: "papers#show"
    delete "papers/:paper_id", to: "papers#destroy"

    get    "patients/:karte_no/billings", to: "patient_billings#index", karte_no: KARTE_NO
    post   "patients/:karte_no/billings", to: "patient_billings#create", karte_no: KARTE_NO
    get    "billings", to: "billings#index"
    get    "billings/:id", to: "billings#show"
    patch  "billings/:id", to: "billings#update"

    get    "dm", to: "dm#index"
    get    "sales/summary", to: "sales_summary#index"

    get    "ward", to: "wards#index"
    get    "patients/:karte_no/hospitalizations", to: "hospitalizations#index", karte_no: KARTE_NO
    post   "patients/:karte_no/hospitalizations", to: "hospitalizations#create", karte_no: KARTE_NO
    get    "hospitalizations/:id", to: "hospitalizations#show"
    patch  "hospitalizations/:id", to: "hospitalizations#update"
    get    "hospitalizations/:hospitalization_id/care-records", to: "hospitalizations#care_records"
    post   "hospitalizations/:hospitalization_id/care-records", to: "hospitalizations#create_care_record"

    get    "reservations", to: "reservations#index"
    post   "reservations", to: "reservations#create"
    get    "reservations/:id", to: "reservations#show"
    patch  "reservations/:id", to: "reservations#update"
    post   "reservations/:id/cancel", to: "reservations#cancel"

    get    "staff", to: "staff#index"
    get    "features", to: "features#index"
    get    "todo/:key", to: "features#todo"
    get    "masters/:key", to: "masters#show"
  end

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
end
