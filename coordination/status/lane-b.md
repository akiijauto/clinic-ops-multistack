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
| 5. 題材を読む | 済 | `題材のシステムdocs/実装分担-2026-09-05.md`。**読んだだけで1文字も変更していない** |

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

## 2026-09-06 — 5領域へサブエージェントを分けて本実装フェーズへ

前回セッション（サマリ済み）で共通テスト全14件が緑になったのは「検算8を通す最小限」の
実装だったため、ここから26画面の本格実装に入る。

**先に自分でやったこと（統合点）**:
- `config/routes.rb` を全26画面＋全APIエンドポイント分に拡張（既存のaction名・URL形は
  変えず、足りない分だけ追加）
- `Api::VisitsController` を新規実装（既存パターンに合わせ、openapi.yamlの命名と
  tests/checks.pyの実命名を両方返す形を踏襲）
- `app/controllers/api_controller.rb` を拡充：`ApiErrors`モジュール（openapi.yamlの
  エラー文言を一字一句集約）を新設し、`render_api_error(:code, details:)` で
  `RecordNotFound`/`RecordInvalid`/`ParameterMissing`/JSON構文エラー/予約重複(409)を
  一元的に処理する仕組みにした
- `app/controllers/application_controller.rb` に `current_staff`（session由来、
  helper_method化）を追加
- 拡張後も `python tests/run.py` フル実行で**全14件通過を再確認**（回帰なし）

**ここから**: 5領域（受付・患者／診療／会計・売上／入院・予約・業務／設定）へ
サブエージェントを1体ずつ、**領域ごとに別の指示文**で起動した。各自が
`config/routes.rb` `db/migrate` `db/seeds.rb` `app/models` `app/services` `app/lib`
と他領域のcontroller/viewには触れない前提で、担当画面のcontroller/viewだけを実装する。
完了報告が揃い次第、私（レーンB本体）が統合・全体テストを行う。

## 2026-09-06 — 横並び再測の戻り2件を修正。**共通テスト全14件が緑（実測・8414）**

`coordination/review/2026-09-06_統括_横並び再測.md` の指摘2件に対応した。

### 【1】検算2 消費税 2200（期待2750）

**コードの不具合ではなくデータの汚染だった。** `Clinic.tax_rate` がDB上で
`0.08` になっていた（seed.json の値は `0.10`）。2200/2750=0.8=0.08/0.10 と一致し、
原因の見立て（税率の取り違え）が当たっていた。

**原因**: 5領域のサブエージェントが同じ開発用SQLite（`storage/development.sqlite3`）を
共有していたため、`設定`画面（領域5担当）のフォーム保存テストが `Clinic`（1件だけ存在する
シングルトン）を実際に書き換え、他領域のテストに影響していた。コード自体に税率8%の
決め打ちは無い（`grep`で確認済み）。

**対処**: `Clinic.current.update!(tax_rate: 0.10)` で値を戻した。**恒久対策は今後の検討課題**
——シングルトンのモデルを複数エージェントが同時に手で叩くテストをするなら、
各自が試したあとで元に戻す運用か、テスト用DBを分けるかのどちらかが要る。

### 【2】検算8 死にリンク3件

サブエージェント4体がセッション上限で途中停止したため、リンク先の画面が
作られないまま参照だけが先に入っていた。**指揮役として自分で完成させた**（本来は
領域1・領域4の担当分）。

- `/folded/hospital_division` → `FoldedController`（新規）が丸ごと無かった
- `/todo/reception_done_delete` → `TodosController`（新規）が丸ごと無かった
- `/animals/10049/delete` → `AnimalsController#delete_confirm` はあったが
  `app/views/animals/delete_confirm.html.erb` が無く、フォーマット交渉が失敗して406

### 確認結果

```
$ python tests/run.py http://127.0.0.1:8414
全 14 件 通過
```

crawl到達数が16→**30画面**に伸びた（サブエージェントが途中まで進めた分が効いている）。

### 次にやること

5体のサブエージェントは全員セッション上限で停止した（再開待ち）。
各自の担当領域の残り画面（フォームの保存・削除・新規作成など、検算8を通す
最小限を超える完全な作り込み）はまだ途中。指示があれば続きを進める。

---

## 2026-09-06 — 在庫検査で見つかった20件（画面8・API12）の対応

指揮役から渡された20件を実測し直し、`coordination/qa/lane-b.md` Q16 に内訳を記録した。
詳細はそちら参照。要点だけ:

- 本当にコードが無かったのは **papers（画面）一式**のみ。新規実装した
  （`app/controllers/papers_controller.rb` + `app/views/papers/{index,show,no_paper}.html.erb`）
- 10件は「POST専用の実装にGETで探りを入れると404になる」検査側の仕様。
  405を返すよう `ApplicationController#method_not_allowed` / `ApiController#method_not_allowed`
  とGETルートを追加（実処理は変更していない）
- 3〜4件はサンプル値（`key=reception`・`owner_no=1`）がこのアプリの語彙・データ形式と
  噛み合わないだけで、spec通りの404。**直していない**（契約違反になるため）
- 1件（karte print/delete/restore）は `karte_no` と `visit_id` の組み合わせがサンプル上
  存在しないデータの問題。Go実装の既存の仮決め（visit_idだけで引く）と同じ対処をした
- ついでに `Api::PatientsController` / `Api::OwnersController`（新規）、
  `Api::ReservationsController#show/create/update/cancel`、
  `Api::LabTestsController#index/create`、`Api::HospitalizationsController#index/create/update/create_care_record`
  を実装（20件に対応するために必要だった分）

**予約一覧の日付フィルタ未実装（他レーンからの指摘）→ 対応済み**: `ReservationsController#index`
（screen）は元から `params[:from]` で `@date` は計算するが、一覧クエリ自体は
`Reservation.includes(...).order(:starts_at).limit(50)` のままで絞り込んでいなかった。
spec/openapi.yaml の `screen_reservations`（`from`/`to`/`staff_id`/`room` クエリ）に合わせて
日付範囲・担当・処置室で絞り込むよう修正し、`from` を変えて別の日を見るフォームを追加した
（`app/controllers/reservations_controller.rb` `app/views/reservations/index.html.erb`）。
指示された20件には含まれていなかったが、他レーンの実測指摘なので直しておいた。

### 完了の自己点検

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件

全 3 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8414
（smoke/money/screen/rules/crawl/inventory 全17件）
全 17 件 通過
```

**残っていること（自己申告。次の指示待ち）**:

1. 500になっている未実装コントローラ多数（`Api::ReceptionsController`・`Api::PapersController`・
   `Api::PreventionsController`・`Api::DosingsController`・`Api::StaffController`・
   `Api::FeaturesController`・`Api::PostalController`、screen側の`PreventionsController`・
   `DosingsController`）。在庫検査は404/501/0しか見ないため緑のままだが、実際には
   まだ大きく欠けている。詳細は `coordination/qa/lane-b.md` Q16
2. 新規実装した papers 画面・拡張したAPIコントローラ・予約一覧の日付フィルタは、
   共通テストと在庫検査は通ったが**個別の手動確認（実際にPOSTして書類が消える／
   予約がキャンセルされる／日付を変えて絞り込まれる等）はまだ**

---

## 2026-09-06 — 訂正後の11件（画面4・API7）+ 発見済み500系をすべて実装

指揮役から在庫検査の欠陥修正（実データから値を引く・visit_idをkarte_noと対にする・
5xxも「無い」に数える）に伴う訂正を受けた。訂正後に実測し直し、
`coordination/qa/lane-b.md` Q17 に内訳を記録した。

Q16で「500だがスコープ外」と報告していた項目（`Api::ReceptionsController`・
`Api::PapersController`・`Api::PreventionsController`・`Api::DosingsController`・
`Api::StaffController`・`Api::FeaturesController`・`DmController`のcsv gem不在・
`Api::WardsController`）を、判定器の500検知強化に伴いすべて実装した。
画面側の `DosingsController` `PreventionsController` も新規実装。

### 完了の自己点検

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件
  OK  在庫 契約が求める data-testid が画面に出ている  — 34 画面で目印を確認

全 4 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8414
（smoke/money/screen/rules/crawl/inventory 全18件）
全 18 件 通過
```

**残っていること（自己申告）**:

1. `/dm.csv`（CSVダウンロード）が406を返す既存バグに気づいた（`require "csv"` 削除で
   `/dm`（画面）自体は直ったが、`.csv` 拡張子のフォーマットネゴシエーションが
   別の理由で失敗している）。`_NOT_SCREEN` で在庫検査の対象外・指示された11件にも
   含まれていないため未対応。次に見る人へ
2. 新規実装した dosing/prevention の画面・API、papers/receptions/ward/staff/features
   のAPIは在庫検査・共通テストは通ったが、**手動確認は代表的な1パターンのみ**
   （検算相当の網羅的な確認はしていない）

---

## 2026-09-06 — R-20対応・Api::PostalController実測・在庫検査の新チェック2件対応

裁定R-20（記録0件は200で空を返す。404/500にしない）を確認したところ、
前回実装済みの `Api::DosingsController#show` は既にこの方針で作ってあった
（記録が無い年度は空欄の年間記録を200で返す）。`Api::PreventionsController#index` も
0件配列を200で返す既存のActiveRecord挙動でR-20を満たしていた。

指揮役依頼の `Api::PostalController` 実測 → 「あるが別の形」だった（spec上は `/postal`
だが実装は `/api/postal` に誤って配置され、かつ中身が無く500）。新規実装し、
ついでに新しい在庫検査（`_others`）が拾った `/dm.csv`（406・ルート順序の問題）も直した。
詳細は `coordination/qa/lane-b.md` Q18。

### 完了の自己点検

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件
  OK  在庫 契約が求める data-testid が画面に出ている  — 34 画面で目印を確認
  OK  在庫 画面でもAPIでもないルートが応答する（CSV配信・死活・外部照会）  — 3/3 件が応答

全 5 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8414
（smoke/money/screen/rules/crawl/inventory 全19件）
全 19 件 通過
```

**残っていること（自己申告）**: 「確かめられない」7件（`/folded/{key}` `/papers/{paper_id}`
`/papers/{paper_id}/remove` `/todo/{key}` `/api/papers/{paper_id}` `/api/todo/{key}`
`/api/masters/{key}`）はいずれも実装済みだが、サンプル値の語彙（`key`）が判定器から
一意に決められないための「確かめられない」であり、無いわけではない
（`/folded/{key}` `/todo/{key}` は画面から実在するキーを拾って確認済み。papers系は
data/にpaper自体が無いため確かめようがない）。指揮役の判断が必要なら申告する。

---

## 2026-09-06 — 共通CSS `/ui.css` の配布・HTML構造の統一

指揮役の指示（案B）に対応。`spec/ui.css` を書き換えずに `/ui.css` として配り、全画面の
`<head>`（`app/views/layouts/application.html.erb` 一箇所）から読むようにした。
`class="num"`（会計・売上の金額/数量セル）・`class="out-of-range"`（検査の基準外値）・
`class="disabled"`（B/C状態の偽ボタン2件）も付けた。詳細は `coordination/qa/lane-b.md` Q19。

### 完了の自己点検

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件
  OK  在庫 契約が求める data-testid が画面に出ている  — 34 画面で目印を確認
  OK  在庫 画面でもAPIでもないルートが応答する（CSV配信・死活・外部照会）  — 3/3 件が応答
  OK  見た目 共通CSS(/ui.css)を配っていて、全画面が読んでいる  — 32 画面すべてが読んでいる

全 6 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8414
（smoke/money/screen/rules/crawl/inventory 全20件）
全 20 件 通過
```

**残っていること**: `num`/`out-of-range`/`disabled` は指揮役が例示した3箇所に絞って付けた
（会計・売上・検査・B/C状態ボタン2件）。他の金額表示（例: `animals/show` の未収金は
テーブルセルではなく地の文なので付けていない）は指示があれば対応する。

---

## 2026-09-06 — 灰色のボタン3つ（一時保存／完了全削除／完了削除）を揃えた

レーンAの全文検索での発見（`reception_done_delete`しか画面にリンクされていなかった）を受けて、
`/today`に「完了全削除」、カルテ画面に「一時保存」を追加した。詳細は `coordination/qa/lane-b.md` Q20。

### 完了の自己点検

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
（8件。新規「契約 押しても何も起きないボタンにしない（灰色3つが理由へ繋がる）」含む）
全 8 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8414
（22件）
全 22 件 通過
```

**残っていること**: 無し。
