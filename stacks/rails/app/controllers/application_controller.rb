class ApplicationController < ActionController::Base
  # allow_browser versions: :modern は外してある。共通テスト（tests/run.py）のクライアントは
  # urllib で、ブラウザを名乗らない（User-Agent が無い）ため、有効にすると全画面が
  # 406 になり検算3・4・5等の画面系がすべて読めなくなる（coordination/qa/lane-b.md）。

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes
end
