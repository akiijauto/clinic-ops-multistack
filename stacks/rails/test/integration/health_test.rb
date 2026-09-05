require "test_helper"

class HealthTest < ActionDispatch::IntegrationTest
  # 共通テスト（tests/run.py の smoke）が叩くのは /healthz。
  # 起動文面には /health と書いてあったので、両方に応える。
  [ "/healthz", "/health" ].each do |path|
    test "GET #{path} は {\"status\":\"ok\"} を返す" do
      get path

      assert_response :success
      assert_equal({ "status" => "ok" }, JSON.parse(response.body))
    end
  end

  # 共通テストのクライアントは urllib で、この Accept と UA を送ってくる。
  # 画面向けの allow_browser / レイアウトに巻き込まれて 406 にならないことを確かめる。
  test "共通テストと同じ Accept・User-Agent でも 200 を返す" do
    get "/healthz", headers: {
      "Accept" => "text/html,application/json",
      "User-Agent" => "Python-urllib/3.14"
    }

    assert_response :success
    assert_equal({ "status" => "ok" }, JSON.parse(response.body))
  end
end
