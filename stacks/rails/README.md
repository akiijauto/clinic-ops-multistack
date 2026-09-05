# レーンB — Ruby on Rails 実装

動物病院の窓口業務システムを Ruby on Rails で実装したもの。
**学習・研究目的**であり、複製・再配布・改変・商用利用は許可しない。
データはすべて合成データで、実在の動物病院・飼主・動物の情報は含まない。

外から見た振る舞いは、このリポジトリの `spec/` が唯一の正である。

## 環境（2026-09-05 実測）

| | |
| --- | --- |
| Ruby | 3.4.10 (x64-mingw-ucrt) |
| Rails | 8.1.3.1 |
| Bundler | 2.6.9 |
| DB | SQLite（追加インストール不要のため。`DECISIONS.md` 第4節） |
| 画面 | ERB + Hotwire（Turbo / Stimulus）、アセットは Propshaft |

依存は `bundle config` で `vendor/bundle` に閉じてある。**システムへは何も入れていない。**

## 動かし方

```sh
cd stacks/rails
bundle install          # 初回のみ。vendor/bundle に入る
bin/rails db:prepare    # SQLite を作る
bin/rails server -p 8402   # ポートは coordination/PORTS.md の正（レーンB=8402）
```

`bin/rails` が動かないときは `bundle exec rails ...` で読み替える。

## テストの走らせ方

```sh
cd stacks/rails
bin/rails test          # 単体・結合（test/）
```

共通テスト（リポジトリ直下の `tests/`）が最終的な合否である。
**このレーンが書いたテストが緑でも完了ではない**（`coordination/PROTOCOL.md`）。

## 疎通確認

```sh
curl http://127.0.0.1:8402/health
# => {"status":"ok"}
```

## 構成のうち、あとで効く決め

- **JSON の入口は `ApiController`（`ActionController::API`）**。画面は `ApplicationController`。
  分けているのは、画面向けの既定（ブラウザ判定・CSRF・レイアウト）が
  UA を名乗らないテストクライアントに対して余計な分岐を生むため
- **時刻は JST**（`config.time_zone = "Tokyo"`）。保存は UTC のまま。集計の月境界も JST
