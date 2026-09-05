require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
# require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module ClinicOps
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # 窓口業務は国内なので JST で扱う（coordination/DECISIONS.md 第4節）。
    # 保存は UTC のまま（Rails 既定）。表示と集計の境界だけが JST になる。
    config.time_zone = "Tokyo"

    # Rack 3 の小文字ヘッダを送出直前に昔ながらの表記へ揃える
    # （app/middleware/canonical_headers.rb 参照。共通テストのクローラー対策）。
    config.middleware.use CanonicalHeaders

    # config.eager_load_paths << Rails.root.join("extras")
  end
end
