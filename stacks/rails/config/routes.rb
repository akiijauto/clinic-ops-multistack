Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # 疎通確認。{"status":"ok"} を返すだけ。
  # 共通テスト（tests/run.py の smoke）が叩くのは /healthz。
  # 起動文面（briefs/lane-b.md）には /health と書いてあったので、両方に応える。
  # tests/ は凍結されているため、こちらを合わせる（PROTOCOL.md 2・4）。
  get "healthz" => "health#show", as: :healthz
  get "health"  => "health#show", as: :health

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    resources :billings, only: [ :show ]
    get "sales/summary", to: "sales_summary#index"
    get "lab-tests/:id", to: "lab_tests#show"
    get "reservations", to: "reservations#index"
    get "hospitalizations/:id", to: "hospitalizations#show"
    get "hospitalizations/:hospitalization_id/care-records", to: "hospitalizations#care_records"
  end

  root "top#index"
  get "about", to: "top#about"
  get "today", to: "receptions#index"
  get "search", to: "search#index"
  get "reservations", to: "reservations#index"
  get "ward", to: "wards#today"
  get "staff", to: "staffs#index"
  get "settings", to: "settings#show"

  get "animals/:karte_no/karte/print", to: "karte#print"
  get "animals/:karte_no/karte", to: "karte#show"
  get "animals/:karte_no/history", to: "animals#history"
  get "animals/:karte_no/ward", to: "wards#animal"
  get "animals/:karte_no/exam", to: "exams#show"
  get "animals/:karte_no", to: "animals#show"

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"
end
