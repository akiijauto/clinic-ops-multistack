# Rack 3 の仕様どおり、レスポンスヘッダのキーは実際には小文字（"content-type" 等）で
# 送出される。共通テストのクローラー（tests/checks.py _dead_links）は
# `headers.get("Content-Type", "")` と大文字小文字を区別して読むため、
# Rack 3準拠のまま返すと常に空文字列になり、リンクを1つも辿れなくなる
# （実測して確認。coordination/qa/lane-b.md 参照）。
#
# HTTPヘッダ名は本来大文字小文字を区別しない（RFC 7230）ので、送出時にだけ
# 昔ながらの表記（Content-Type 等）へ揃える。中身やRack内部の扱いは変えない。
class CanonicalHeaders
  MAP = {
    "content-type" => "Content-Type",
    "content-length" => "Content-Length",
    "location" => "Location",
    "cache-control" => "Cache-Control",
    "etag" => "ETag",
    "set-cookie" => "Set-Cookie"
  }.freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)
    canonical = {}
    headers.each { |key, value| canonical[MAP[key.downcase] || key] = value }
    [status, canonical, body]
  end
end
