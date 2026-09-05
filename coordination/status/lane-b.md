# レーンB（Ruby on Rails）の進捗

所有ディレクトリ: `stacks/rails/`

## 2026-09-05 — ポートを 8402 へ変更。**共通テスト smoke が緑（実測）**

`coordination/PORTS.md` の指示（レーンB=8402、既定の3000番台はNext.jsと衝突するため）に合わせ、
前回セッションで動かしていたポート3002から**8402へ変更**した。コード変更は無し（`-p` 引数のみ）。
README.md の起動例・疎通確認コマンドも3002→8402に修正した。

```sh
cd stacks/rails
bin/rails server -p 8402 -e development
```

```
$ python tests/run.py http://127.0.0.1:8402 --only smoke
── smoke ──
  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 31ms
全 2 件 通過        (exit 0)
```

## 2026-09-05 — **共通テスト money が緑（4件）**

モデル・`BillingCalculator` / `SalesSummaryCalculator` は前回セッションで実装済みだったため、
今回は `Api::BillingsController` / `Api::SalesSummaryController` とルーティングを追加し、
`db:prepare` でシードを投入して確認した。

```
$ python tests/run.py http://127.0.0.1:8402 --only money
── money ──
  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250
全 4 件 通過        (exit 0)
```

税抜総合計 5,185,704円・未算入12行という指揮役の提示値とも一致（`tests/expected.py` の
`Fixture().sales()` で実測）。smoke（2件）も引き続き緑。

**重要な発見: `tests/checks.py` が実際に読むJSONフィールド名が `spec/openapi.yaml` の
命名と食い違っている**（`/health` vs `/healthz` と同種）。詳細と対応は `qa/lane-b.md` Q13。
両方の命名を同じレスポンスに含める形で対応済み。他レーンも同じ食い違いを踏む可能性あり。

## 2026-09-05 — **共通テスト screen が緑（3件）**

```
$ python tests/run.py http://127.0.0.1:8402 --only screen
── screen ──
  OK  検算3 体温が全患者で同じ値になっていない  — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る  — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致
全 3 件 通過        (exit 0)
```

smoke・money も引き続き緑（`python tests/run.py http://127.0.0.1:8402` フルで確認、
rules/crawl は今回のスコープ外なので未着手のまま）。

追加: `KarteController`（`GET /animals/:karte_no/karte`・`/karte/print`）、
`Api::LabTestsController`（`GET /api/lab-tests/:id`）、`ApplicationController` から
`allow_browser versions: :modern` を削除（共通テストのクライアントはブラウザを
名乗らないため、有効なままだと画面系が全部406になる）。

**追記: 上記の `_data_check` の件は指揮役がすでに修正済み**（レーンAの報告とほぼ同時期に
発見が重なった）。`tests/checks.py` はいま `html.parser` ベースで入れ子も正しく扱える。
修正後のチェッカーでも本実装（flat markup・`layout: false`）は引き続き緑（再実測済み）。
経緯は `qa/lane-b.md` Q14（解消済みとして記録）。

## 2026-09-05〜06 — **共通テスト全14件が緑（フル実行で確認）**

```
$ python tests/run.py http://127.0.0.1:8402
全 14 件 通過
```

`rules`（検算6・7・9）と `crawl`（検算8）を実装。合わせて画面を14枚追加した
（トップ・このシステムについて・本日の患者・検索・顧客詳細・来院履歴・検査・
入院（本日／この動物）・予約・スタッフ・設定、カルテ関連は既存）。
`GET /api/reservations`・`GET /api/hospitalizations/:id/care-records` も追加。

**モデル層の重なり判定（`Reservation#no_overlap`）・実施者必須（`CareRecord`）は
すでに実装済みだった**ため、今回はAPI/画面を足しただけで検算6・7はすぐ緑になった。

途中、検算8で「1画面しか辿れない」という失敗が出た。原因はRack 3が
レスポンスヘッダのキーを小文字（`content-type`）で返す一方、当時の
`tests/checks.py` が `headers.get("Content-Type")`（大文字始まり）で読んでいたこと。
これを補うミドルウェア（`CanonicalHeaders`）を一度書いたが、**Pumaがヘッダを
送出時に小文字へ揃え直すため効かなかった**。調べ直したところ、指揮役が
`tests/checks.py` 側をすでに小文字読み取りへ修正済みだった（今回もクロス報告）。
効かないミドルウェアは削除し、コードはクリーンな状態に戻した。

**今回作った画面はまだ「検算8を通す最小限」の実装。** 保存・新規作成・
削除・キャンセル等のフォーム操作、`x-data-testids` の網羅、`/about` 以外の
画面の完全な作り込みは、26画面の本格実装フェーズでサブエージェント分担する予定
（`qa/lane-b.md` Q12参照）。既存の `spec/` 準拠状況・仮決めは今回変更していない。

以下は前回（ポート3002時点）の記録。内容は変わっていない。

## 2026-09-05 17:56 — 土台完了。**共通テスト smoke が緑**。合図待ち

契約（`spec/openapi.yaml` `spec/acceptance.md` `spec/model.md` `spec/screens.md`）と
共通テスト（`tests/`）は**まだ無い**ので、ブリーフのとおり契約に依存しない土台だけを作った。
**画面はまだ1枚も作っていない。**

### 済んだこと（すべて実測で確認）

| ブリーフの項目 | 状態 | 確かめ方 |
| --- | --- | --- |
| 1. 雛形を作る | 済 | `rails new stacks/rails --name=clinic_ops --database=sqlite3` |
| 2. 依存を入れる（リポジトリ内に閉じる） | 済 | `bundle config` で `BUNDLE_PATH: vendor/bundle`。104 gems。**システムへは何も入れていない** |
| 3. テストが走る形 | 済 | `bin/rails test` → `1 runs, 2 assertions, 0 failures, 0 errors` |
| 4. `GET /health` | 済 | 実サーバへ `curl` → `200` / `{"status":"ok"}` |
| 5. 題材を読む | 済 | `vet-karte/docs/実装分担-2026-09-05.md`。**読んだだけで1文字も変更していない** |

### 構成（あとで効く決め）

- **Rails 8.1.3.1 / Ruby 3.4.10 / SQLite**（追加インストール不要のため。`DECISIONS.md` 第4節）
- 画面は **ERB + Hotwire**（Turbo / Stimulus）、アセットは Propshaft
- 生成時に外したもの: Docker / Kamal / CI / Solid（Cache・Queue・Cable）/ Thruster /
  Action Mailbox / Action Text / Active Storage / jbuilder。
  **Solid を外したのは、追加の SQLite を3つ増やすと共通テスト側の DB 準備が複雑になるため**
- **JSON の入口は `ApiController`（`ActionController::API`）**、画面は `ApplicationController`。
  分けた理由は、画面向けの既定（`allow_browser` のブラウザ判定・CSRF・レイアウト）が、
  UA を名乗らないテストクライアントに対して余計な分岐を生むこと
- **時刻は JST**（`config.time_zone = "Tokyo"`、実測で `+0900`）。保存は UTC のまま
- `LICENSE` は**置いていない**（`DECISIONS.md` 第1節。未記載＝全権利留保）
- 秘密情報・実データは**入れていない**。`.gitignore` で `config/master.key` `.env` `db/*.sqlite3` を除外

### 動かし方

```sh
cd stacks/rails
bundle install && bin/rails db:prepare
bin/rails server -p 3002    # PORT 環境変数でも変えられる
curl http://127.0.0.1:3002/health   # => {"status":"ok"}
bin/rails test
```

### 最初のマイルストーンは通った

作業中に `tests/run.py` が置かれたので、そのまま走らせた。

```
$ bin/rails server -p 3002
$ python tests/run.py http://127.0.0.1:3002
── smoke ──
  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 28ms
全 2 件 通過        (exit 0)
```

**緑が本物であることも確かめた。** サーバを止めて同じものを流すと 2件とも NG・exit 1 になる
（`ASSIGNMENT.md` レーンR の2つ目「見張りを壊して、鳴ることを確かめる」）。

> **共通テストが叩くのは `/healthz` で、起動文面には `/health` と書いてあった。**
> `tests/` は凍結なので**こちらを合わせ、両方に応えるようにした**。テストの期待値は触っていない。
> **他レーンも同じ食い違いを踏むはずなので、起動文面の側を直すことを勧めます**（`qa/lane-b.md` Q4）。

### 次にやること

**指揮役の合図待ち。** 起動文面が「1件目を通したら足並みを揃えてから本格的な実装へ入る」
としているので、**ここで止めている**。合図があれば次の順で進む。

1. `spec/model.md` の15モデル＋`care_records` の migration とモデル（統合点なので自分で書く）
2. 固定データの読み込み。**`data/` がまだ無いので着手できない**
3. 26画面を5領域へ分けてサブエージェントへ（領域ごとに**別の**指示文を書く）

**`spec/openapi.yaml` `screens.md` `acceptance.md` と `data/` がまだ無い。**

### 実測した数字（自己申告ではなく、走らせた結果）

```
tests/run.py     -> 全 2 件 通過（サーバを止めると 2 件とも NG。見張りは鳴る）
bin/rails test   -> 3 runs, 6 assertions, 0 failures, 0 errors, 0 skips
rubocop          -> 26 files inspected, no offenses detected
curl /health     -> HTTP 200 / {"status":"ok"}
Time.zone.now    -> 2026-09-05 17:50:00 +0900
git ls-files stacks/rails | grep master.key -> 0件
```

仮決めしたことは `coordination/qa/lane-b.md` に書いた。**3件ある。**
あわせて `config/credentials.yml.enc` の扱い（公開ゲート向け）も同ファイルに記録した。
