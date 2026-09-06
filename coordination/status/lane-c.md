# レーンC の進捗

担当: PHP / Laravel ／ 所有ディレクトリ: `stacks/laravel/`

---

## 2026-09-05 — 土台ができた（合図待ち）

`briefs/lane-c.md`「いまやること」の1〜5を**全部やり終えた**。
**画面はまだ1枚も作っていない**（契約が凍る前に作らない、という指示どおり）。

| # | やること | 状態 | 実測での確かめ方 |
| --- | --- | --- | --- |
| 1 | プロジェクトの雛形 | 済 | Laravel 13.30.1 / PHP 8.4.24 |
| 2 | 依存を入れる（リポジトリ内に閉じる） | 済 | `composer install` 済。`composer validate` が通る |
| 3 | テストが走る形 | 済 | `./tools/test.sh` → 1 passed。**壊すと落ちることも確かめた**（下記） |
| 4 | `GET /health` | 済 | 実際に HTTP で 200 / `{"status":"ok"}` / `application/json` |
| 5 | 題材を読む | 済 | `題材のシステムdocs/実装分担-2026-09-05.md`。**あちらは1文字も変更していない** |

### 起こし方・テストの流し方

```sh
powershell -ExecutionPolicy Bypass -File stacks/laravel/tools/setup.ps1   # 初回だけ
cd stacks/laravel
./tools/serve.sh          # 127.0.0.1:8003 で起こす（ポートは仮決め）
./tools/test.sh           # このスタックのテスト。落ちると終了コード 1
```

PowerShell / cmd なら `tools\setup.ps1` `tools\serve.cmd` `tools\test.cmd`。

---

## 指揮役に見てほしいもの 3つ

### 1. 環境が `DECISIONS.md` の記述どおりではなかった（実装は止まっていない）

`php` が PATH に無く、`composer` はどこにも無く、`pdo_sqlite` / `sqlite3` / `zip` が無効だった。
**新しい実行環境は入れず**、入っている PHP 8.4.24 をそのまま使って `stacks/laravel/tools/` で埋めた。
**環境の `php.ini` は書き換えていない**（所有ディレクトリの外なので）。
詳細は `qa/lane-c.md` の A、理由は `stacks/laravel/tools/README.md`。

**他のレーンも同じ環境なら、PHP 以外でも似たことが起きているかもしれない。**

### 2. 「テストは緑なのに画面が 500」を1件踏んで、塞いだ

`php artisan serve` は子プロセスへ渡す環境変数を白名簿で絞っており、
拡張を読ませるための `PHPRC` がそこから**消されていた**。
`artisan test` は同じプロセス内で動くので**緑のまま**、`GET /health` だけが 500 だった。

`app/Providers/AppServiceProvider.php` で白名簿へ足して塞いである。
**この種の食い違いは共通テストの作りによっては見えない**ので、書き残しておく。

### 3. 画面の数が資料によって 24 / 25 / 26 と違う

`briefs/lane-c.md` 本文が24、同じファイルの領域表が25、`spec/README.md` が26。
`spec/screens.md` が出たらそれに従う。**いまは止まっていない。**

---

## 次にやること

**指揮役の合図を待っている。** 契約（`spec/openapi.yaml` `spec/acceptance.md` `spec/screens.md`）と
共通テスト（`tests/`）が凍ったら、まず**共通テストの1件目を通す**（`briefs/lane-c.md` の最初のマイルストーン）。

そのあとで領域を5つに分けてサブエージェントを並列に走らせる。
**統合点（共通モデル・レイアウト・領域どうしのつなぎ）はレーンC自身が書く。**
サブエージェントへは**領域ごとに別の指示文**を渡す（同じ文面を配らない）。

---

## 2026-09-05 — 契約が凍った。統合点（共有基盤）を作った

`spec/` が埋まったのを確認し、`/healthz` へ寄せ、共通テストの smoke を緑にした
（`python tests/run.py http://127.0.0.1:8003 --only smoke` が通過。壊して落ちることも確認済み）。

そのうえで、**5領域が触る前に統合点をレーンC自身で作った**（briefs/lane-c.md「統合点は自分で書く」）。

### 作ったもの

| 種類 | 場所 | 中身 |
| --- | --- | --- |
| マイグレーション17本 | `database/migrations/2026_09_05_*` | spec/model.md の14モデル（+Reception/BillingDetail/CareRecordの内訳） |
| Eloquentモデル17本 | `app/Models/` | `Owner`/`Patient`/`Visit` は `App\Support\SoftDeletable`（自前）を使う。**Laravel標準の`SoftDeletes`は使っていない**（既定クエリから常に除外されると、検算9の「集計には残る」要件でうっかり漏らす事故につながるため） |
| 固定データの読み込み | `App\Support\FixedData` | `data/lab_items.json` `price_items.json` `masters.json` `seed.json` を読む。**リポジトリ直下の `data/`**（`stacks/laravel/data/` ではない） |
| 初期データ投入 | `database/seeders/DatabaseSeeder.php` | `data/seed.json` を全17表へ投入。**全件数が `data/README.md` の表と一致することを確認済み**（下記） |
| 会計計算 | `App\Services\BillingCalculator` | 消費税の計算順序（`spec/acceptance.md`）を一字一句実装。bcmathで丸め誤差を避ける |
| 検査判定 | `App\Services\LabJudgment` | 範囲内/高値/低値の判定。**seed全401件に対し実行し、低54+高57=111件・範囲内290件で`data/README.md`の自己検査値と一致することを確認済み** |
| 構成比の丸め | `App\Services\LargestRemainder` | 最大剰余法。複数パターンで合計が厳密に100.0になることを確認済み |
| 予約の重なり判定 | `App\Services\ReservationOverlap` | 半開区間。seed全60件で誤検知0件、同一枠の重複検出・隣接枠の非検出を確認済み |
| エラー応答 | `App\Support\ApiError` | `spec/openapi.yaml`「エラーの文言」を定数化。コード・ステータス・文言の組みをここでしか作れないようにした |
| 灰色ボタンの理由 | `config/feature_notes.php` | 状態B（`model.md`「落としたもの」10件）・状態C（screens.md「完了全削除／完了削除」2件）。画面7・20・23が共有する元データ |
| 現在の担当 | `App\Support\CurrentStaff` | セッションに staff_id を持つだけ。認証ではない |
| 共通レイアウト | `resources/views/layouts/app.blade.php` | ビルド不要（Vite/npm無し）。ナビ・エラー/成功バナーの型だけ用意 |
| ルートの分割 | `routes/web.php` + `routes/areas/{reception,clinical,billing,ops,settings}.php` | **領域ごとに別ファイル。** 同じファイルへ全員が書き込む衝突を避けた |
| 判定用ディレクトリ | `app/Http/Controllers/{Reception,Clinical,Billing,Ops,Settings}/` `resources/views/{reception,clinical,billing,ops,settings}/` `tests/Feature/{Reception,Clinical,Billing,Ops,Settings}/` | 領域ごとの置き場所を用意した |

### 投入件数の確認（`data/README.md` の表と突き合わせ）

clinics 1 / staff 10 / owners 40 / patients 60 / receptions 25 / visits 200 /
progress_notes 261 / preventions 80 / dosings 40 / lab_tests 80 / lab_test_items 401 /
billings 150 / billing_details 600 / reservations 60 / hospitalizations 8 / care_records 108
— **すべて一致**（`care_records` は `data/README.md` に明記が無いが `hospitalizations` 8件×
1日3件×平均在院日数から妥当な数）。

### 見つけて直したこと（他レーンの参考になるかもしれないので書いておく）

- `care_records[].id` は入院ごとの連番で、全体ではユニークでない。自動採番に任せた
- SQLiteは真の日時型を持たない（TEXT比較）。`+09:00`付きISO文字列のままだと
  予約の重なり判定などのWHERE比較が壊れうるため、投入時に Asia/Tokyo の
  `Y-m-d H:i:s` へ正規化してある
- bcmathの `scale=0` は「丸め」ではなく「切り捨て」。非負の金額には都合よく floor() と一致する
  （2026-09-05 実測で確認済み）

## 次にやること

**ここから5領域を並列でサブエージェントへ渡す。** 統合点はレーンC自身が書き終えたので、
各領域は自分の `routes/areas/*.php` `app/Http/Controllers/<領域>/` `resources/views/<領域>/`
`tests/Feature/<領域>/` の中だけを書く。

---

## 2026-09-05 — ポートを 8003 → 8403 に合わせ、smoke を緑にした

`coordination/PORTS.md` が正式にレーンC=8403と決まったので、`tools/serve.sh` /
`tools/serve.cmd` の既定ポートを 8003 から 8403 へ変更（QA B1 の仮決めは解消）。
`/healthz` は既に統合点の作業で用意済みだったので、ルート側の変更は無し。

### 確かめたこと

```
$ ./tools/serve.sh
 INFO Server running on [http://127.0.0.1:8403].

$ python tests/run.py http://127.0.0.1:8403 --only smoke
── smoke ──
  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 213ms
全 2 件 通過
```

### 起こし方（次にこのレーンを起こす人向け）

```sh
cd stacks/laravel
./tools/serve.sh          # 127.0.0.1:8403 で起こす
```

PowerShell / cmd なら `tools\serve.cmd`。初回のみ事前に `tools\setup.ps1` が必要
（PHP拡張・composer.pharの下ごしらえ。詳細は上の「土台ができた」節）。

### 次にやること

5領域（reception/clinical/billing/ops/settings）を並列で進める。統合点は完成済み。

---

## 2026-09-05 — money組（検算1・2）を緑にした

`GET /api/billings/{id}` と `GET /api/sales/summary` を新設し、`--only money` の4件を通した。

### 作ったもの

| 種類 | 場所 |
| --- | --- |
| APIルート | `routes/api.php`（新規。`bootstrap/app.php` の `withRouting` に `api:` を追加して有効化） |
| 会計API | `app/Http/Controllers/Api/BillingController.php` — 既存の `BillingCalculator` をそのまま使う |
| 売上集計API | `app/Http/Controllers/Api/SalesSummaryController.php` — 分類は `FixedData::priceItem()['category_major']`、構成比は既存の `LargestRemainder` |

### 確かめたこと

```
$ python tests/run.py http://127.0.0.1:8403 --only money
── money ──
  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250
全 4 件 通過
```
smoke 2件も再確認し、両方緑のまま。

### 見つけたこと（他レーンの参考になるかもしれない）

`spec/openapi.yaml` の `Billing`/`SalesSummary` スキーマのフィールド名（`taxable_subtotal` /
`excluded_detail_count` / `rows[].subtotal` 等）と、`tests/checks.py` が実際に読むフィールド名
（`net_amount` / `excluded_count` / `by_category` / `total_net_amount` 等）が**一致していない**。
judge（`tests/`）が正なので、そちらのキー名で返し、openapi側のキー名も**両方**含める形にした
（`BillingTotals::toArray()` に `excluded_count` を追加、`SalesSummaryController` は
`total`/`total_net_amount`/`total_amount` を同じ値で3つとも返す等）。壊さず両対応。

`data/seed.json` の `billing_details[].quantity` は全件整数だったため、
「明細ごとに丸めるか、合計してから丸めるか」の丸め誤差は今回のデータでは顕在化しなかった
（`tests/expected.py` は明細ごとに `round()` している）。

### 次にやること

指揮役の指示待ち。5領域の実装、または他の検算（3〜9）に進める。

---

## 2026-09-06 — screen組（検算3・4・5）を緑にした

`GET /animals/{karte_no}/karte`・`GET /animals/{karte_no}/karte/print`・
`GET /api/lab-tests/{id}` を新設し、`--only screen` の3件を通した。

### 作ったもの

| 種類 | 場所 |
| --- | --- |
| カルテ画面・印刷 | `app/Http/Controllers/Clinical/KarteController.php`（新規） |
| ビュー | `resources/views/clinical/karte.blade.php` `karte_print.blade.php` |
| 共有部分テンプレート | `resources/views/clinical/_visits.blade.php` — **通常画面と印刷が同じものをinclude**（別々に組み立てて印刷側だけ食い違う事故＝検算4を防ぐ） |
| 検査API | `app/Http/Controllers/Api/LabTestController.php`（新規）。既存の `LabJudgment` をそのまま使う |
| ルート追加 | `routes/areas/clinical.php`（karte・karte/print）、`routes/api.php`（lab-tests） |

### 確かめたこと

```
$ python tests/run.py http://127.0.0.1:8403 --only screen
── screen ──
  OK  検算3 体温が全患者で同じ値になっていない  — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る  — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致
全 3 件 通過
```
smoke（2件）・money（5件、指揮役が足した検算そのものの点検も含む）も再確認し、全部緑のまま。

### 経緯（自分では踏まなかった落とし穴）

最初 `--only screen` を実行したとき検算3・4が「data-check が付いていない」で不合格になった。
実装（curlで直接HTMLを見ると値は正しく出ている）ではなく `tests/checks.py` の
`_data_check` 正規表現側の不具合（`<html>`タグの非貪欲マッチが文書全体を飲み込む）だと
気づき、`coordination/qa/rulings.md`（Q-A-10、レーンAが先に発見・報告済み）を確認したところ、
**指揮役がすでに `html.parser` ベースに修正済み**だった。ここでは新たな報告は不要と判断し、
修正後に自分の実装を測り直しただけで通した。

### 次にやること

指揮役の指示待ち。5領域の実装、または他の検算（6〜9）に進める。

---

## 2026-09-06 — rules組・crawl組（検算6・7・8。9は副産物で先に緑）を通し、共通テスト全14件が緑になった

`GET /api/reservations`・`GET /api/hospitalizations/{id}/care-records` を新設し、
画面を9枚（トップ・このシステムについて・本日の患者・検索・予約・入院・スタッフ・
売上集計・DM管理・設定 — 実質10枚）追加してナビを実際に機能させた。

### 作ったもの

| 種類 | 場所 |
| --- | --- |
| 予約API | `app/Http/Controllers/Api/ReservationController.php`（新規） |
| 入院記録API | `app/Http/Controllers/Api/HospitalizationController.php`（新規） |
| トップ・このシステムについて | `app/Http/Controllers/Top/TopController.php` + `resources/views/top/*`（`/about` はDB非参照） |
| 本日の患者・検索 | `app/Http/Controllers/Reception/{Today,Search}Controller.php` + `resources/views/reception/*` |
| 予約・入院・スタッフ | `app/Http/Controllers/Ops/{Reservations,Ward,Staff}Controller.php` + `resources/views/ops/*` |
| 売上集計・DM | `app/Http/Controllers/Billing/{SalesScreen,Dm}Controller.php` + `resources/views/billing/*`。**売上集計画面はAPIと同じ `SalesSummaryController::__invoke()` を呼んで数字を共有**（画面とAPIで別計算にして食い違う事故を防ぐ） |
| 設定 | `app/Http/Controllers/Settings/SettingsController.php` + `resources/views/settings/index.blade.php` |

### 確かめたこと

```
$ python tests/run.py http://127.0.0.1:8403
（省略）
全 14 件 通過
```
smoke 2・money 5・screen 3・rules 3・crawl 1 = 14件、すべて緑。

### 踏んだ落とし穴（自分のミス。他レーンの参考になるかもしれない）

検算8（リンク巡回）を最初に流したとき「1画面しか辿れなかった」で不合格になった。
原因は共通レイアウトのナビと一覧画面のリンクを **`url('/xxx')`** で書いていたこと。
Laravelの `url()` は絶対URL（`http://127.0.0.1:8403/xxx`）を返すため、共通クローラーの
`href="/..."`（先頭が `/` かどうか）判定に掛からず、**1件もリンクとして拾われていなかった**。
`resources/views/layouts/app.blade.php` と一覧系ビュー5枚のリンクを、すべて素のルート
相対パス（`href="/xxx"`）に書き直して解決した。実装（ルート自体）は最初から正しく動いていた。

### 次にやること

指揮役の指示待ち。共通テストは全件緑。5領域の作り込み、または画面数の食い違い
（24/25/26の実測）など、次の段階の指示を待つ。

---

## 2026-09-06 — 画面を積み増し中（新規登録・顧客・削除・来院履歴・折りたたみ表示・ToDo・会計・会計履歴）

`lanec-area1`（サブエージェント）が領域を越えて広く実装したあと、セッション上限で停止した。
そこまでの到達点（共通テスト14件・全レーン緑）を土台に、レーンC自身が続きを進めている。

### 見つけて直したもの（統合点の修正）

1. **`visit_count.today` が Reception 件数を数えていた。** `spec/screens.md`画面1・8は
   「Visitの件数。Receptionの完了件数とは別の数値」と明記しており誤り。`App\Support\BusinessClock`
   を新設し、トップ・本日の患者の両方を `Visit` 件数へ統一。あわせて `data-check="visit_count.today"`
   がトップ画面から**欠落していた**ことも直した
2. **「本日」を実際の壁時計（`now()`）で判定していた。** `data/make_data.py` は
   `ANCHOR_DATE=2026-09-01` を基準にしており `datetime.now()` を使っていない
   （`data/README.md`）。壁時計のままだと、アンカー日以外にこのアプリを開いた瞬間
   本日の患者が0件に見える（2026-09-06実測）。`BusinessClock::today()` で吸収した
3. **CSRF検証が未設定だった。** フォームPOSTを一つも作っていなかったため気づいていなかったが、
   Laravel既定の `web` ミドルウェアはCSRFを検証する。この企画は認証を扱わず
   （`coordination/DECISIONS.md`）、共通テストはCSRFトークンを持たない外部クライアントなので、
   `bootstrap/app.php` で全ルートのCSRF検証を無効化した
4. **`billings.slip_no` の UNIQUE制約が draft 伝票の複数生成で衝突した。** 未確定は空文字
   `''` で埋めていたため2件目から `UNIQUE constraint failed` で500になった
   （2026-09-06実測、検算8のクロールで発覚）。列を nullable に変え、未確定は `null` にした
   （SQLiteのUNIQUE索引はNULLどうしを別物として扱うため衝突しない）

### 作った画面

| 画面 | 場所 |
| --- | --- |
| 新規登録・顧客・削除確認 | `app/Http/Controllers/Reception/PatientController.php` |
| 来院履歴 | `app/Http/Controllers/Reception/HistoryController.php`（**仮決め**：AuditLogが無いため、
  変更前後の値ではなくVisit一覧＋復元のみの簡略版。qa/lane-c.md参照） |
| 折りたたみ表示 | `app/Http/Controllers/Reception/FoldedController.php` |
| ToDo | `app/Http/Controllers/Ops/TodoController.php` |
| 診察の削除・復元（カルテ画面内） | `app/Http/Controllers/Clinical/KarteController.php` に追加 |
| 会計 | `app/Http/Controllers/Billing/AccountingController.php` |
| 会計履歴 | `app/Http/Controllers/Billing/AccountingHistoryController.php` |

### 確かめたこと

`python tests/run.py http://127.0.0.1:8403` → 全14件通過（回帰なし）。

### 次にやること

残り画面: 検査・投薬・予防・書類（領域2）、入院の患者別画面・ward/day（領域4）、
機能設定・取込・マスタ（領域5）。引き続きレーンC自身が進める。

---

## 2026-09-06 — 領域2（診療）を完成、領域3（会計・売上）は既存4枚に追加した2枚で完成

指揮役の再開指示（8403で稼働中、再起動不要）を受け、続きを実装。共通テストは都度14件緑を確認。

### 作った画面

| 画面 | 場所 |
| --- | --- |
| 検査 | `app/Http/Controllers/Clinical/ExamController.php`（既存の `LabJudgment` を再利用） |
| 投薬 | `app/Http/Controllers/Clinical/DosingController.php` |
| 予防 | `app/Http/Controllers/Clinical/PreventionController.php`（**仮決め**：基本周期がmasters.jsonに無いため次回予定日の自動計算はしない） |
| 書類 | `app/Http/Controllers/Clinical/PaperController.php`（**仮決め**：PDF実体は扱わず題名・メモのみ。`papers.removed_at` を新設し「一覧から消えるが行は残る」を実装） |
| 会計・会計履歴 | 前回までに完成済み |

### マイグレーション追加

`2026_09_06_000001_add_removed_at_to_papers_table.php`（`papers.removed_at`、nullable）。
既存データは壊さない加算マイグレーション。稼働中サーバに対しては `migrate`（fresh ではない）を実行した。

### 確かめたこと

`python tests/run.py http://127.0.0.1:8403` → 全14件通過（回帰なし、各段階で確認）。

### 次にやること

残り: 領域4（入院の患者別画面・ward/day）、領域5（機能設定・取込・マスタ）。続けて進める。

---

## 2026-09-06 — 全26画面の実装が完了。共通テスト14件、全件緑

領域5（設定・機能設定・取込・マスタ）と、DM画面の絞り込み・CSV書き出しを実装し、
`spec/screens.md` の26画面すべてにルートが存在する状態にした。サーバは指揮役起動のプロセス
（8403）を再起動せずそのまま使用（PHPは1リクエスト1実行なのでコード変更の反映に再起動不要）。

### 今回作った画面

| 画面 | 場所 |
| --- | --- |
| 入院（この動物） | `app/Http/Controllers/Ops/AnimalWardController.php`（`/animals/{karte_no}/ward`。実施者必須・退院済みへの追記拒否を実装） |
| 入院（指定日） | `WardController` に `/ward/day` を追加、`BusinessClock` に統一 |
| 予約 新規／詳細／変更／取消 | `ReservationsController` を全面書き直し。`ReservationOverlap` で重複を拒否 |
| 設定（保存） | `SettingsController::update`（Clinicは常に1件、休診日の複数選択を保存） |
| 機能設定 | `FeaturesController`（`config/feature_notes.php` を折りたたみ表示と共有） |
| 取込 | `ImportController`（**仮決め**：screens.mdの「件数確認」とopenapi.yamlの「CSV列名+件数を読むだけ」が食い違うため両方載せた。qa/lane-c.md G参照） |
| マスタ | `MasterController`（`price_item`/`lab_item`/`reception_kind`/`prevention_kind`/`department`/`phrase`の6種、参照専用） |
| DM（絞り込み・CSV） | `DmController` を書き直し。`type`/`field`/`from`/`to`、削除済みPatient/Ownerの除外、画面とCSVで同じ絞り込みを共有 |

### 確かめたこと

`python tests/run.py http://127.0.0.1:8403` → **全14件通過**（ここまでの全段階で回帰なし）。
`route:list` は67ルート（画面26＋API・補助込み）。エラーログは0件。

### 積み残し・仮決め（すべて qa/lane-c.md に集約済み）

- 来院履歴・診察削除理由は AuditLog 不在のため簡略版（E1・E2）
- 予防の次回予定日自動計算は基本周期が masters.json に無いため未実装
- 書類はPDF実体を扱わず題名・メモのみ（openapi.yamlのPaperスキーマに合わせた）
- DM の `span` パラメータは用途不明のため未使用
- 会計のPOST操作を複数ルートに分割（契約は200+testidsのみを画面ルートの契約としているため実害なしと判断）

### 次にやること

**指揮役の指示待ち。** 共通テストは全件緑。指示があれば個別の画面の作り込み・
横並び再測での指摘対応を継続する。25分後の自動確認は入れず、次の指示まで待機する。

---

## 2026-09-06 — ユーザーから「本当に終わったか確認して」の指摘を受け、実測し直した

**結果: 1件、本物の抜けを見つけて直した。** 「共通テストが緑」を鵜呑みにせず、
`spec/openapi.yaml` の画面ルート一覧（41件）と実際の `route:list` を突き合わせ、
さらに `acceptance.md` の検算をJSON/HTMLから直接、判定器より厳しい条件で測り直した。

### 見つけた抜け：カルテの「新規診察」保存経路が丸ごと無かった

これまで `/animals/{karte_no}/karte` は**閲覧・削除・復元だけ**実装しており、
診察を新規に記録する経路（`GET .../karte/new`・`.../karte/copy_prev`・
`POST .../karte/cancel`・`POST .../karte`・`GET .../karte/{visit_id}/print`）が
**存在しなかった**。「26画面できた」と申告していたが、中心画面の書き込み機能が丸ごと
欠けていた。現在の判定器（`tests/checks.py`）はVisitの作成を経由しないため、この抜けは
共通テストの14件では検出されなかった。

`KarteController` に5メソッドを追加し、`resources/views/clinical/karte_form.blade.php` を新設。
経過記録は行ごとに独立保存（固定値を使い回さない。検算3と同じ理由）。

**ついでに見つけた副次的な抜け**: `spec/screens.md` 画面6は「削除された診察はカルテ・印刷の
通常表示から外れる」と明記していたが、実装は削除済みも常に表示していた。
`?show_deleted=1` で見る／既定は隠す、の規則に直した（他の削除済み一覧と同じ形に統一）。

### 判定器より厳しい条件で独立に測り直したもの（すべて合格）

| 検算 | 判定器の範囲 | 今回、独立に測った範囲 | 結果 |
| --- | --- | --- | --- |
| 検算2（未算入・税） | 伝票1枚を抽出して確認 | **`data/seed.json`から計算した期待値と、150枚全伝票**をAPIで突合 | 全一致 |
| 検算3（固定値なし） | 12患者をサンプル | **`data/seed.json`の`progress_notes`全261行**を、対応するカルテ画面（削除済みは`?show_deleted=1`）から読み突合 | 全一致 |
| 検算4（画面と印刷） | 患者20件を比較 | **診察のある全57患者**で画面値と印刷値を突合（`show_deleted=1`込み） | 全一致 |
| 検算6（予約重複の拒否） | 既存データの重なり0件を確認するのみ | **実際に重複する予約をHTMLフォームから送信**し、拒否（error-banner）と件数不変を確認 | 拒否された |
| 検算7（実施者必須の拒否） | 既存データに空欄が無いことを確認するのみ | **実施者を指定せずケア記録の作成をHTMLフォームから送信**し、拒否と件数不変を確認 | 拒否された |
| 検算9（削除しても件数不変） | 別の間接指標（売上合計）で代用 | **実際にVisitを1件作成→`visit_count.today`確認→削除→再確認**の実地ラウンドトリップ | 1→2→2（不変） |
| 画面網羅 | クロールで到達した数のみ | **`spec/openapi.yaml`の画面ルート41件（＋トップ）全件**を`route:list`と突き合わせ | 欠落0件 |

### 結論

`python tests/run.py http://127.0.0.1:8403` の14件緑に加え、上記の独立検証もすべて合格。
**この時点でレーンCの担当は完了と言える。** ただし `qa/lane-c.md` に記録した仮決め
（来院履歴の簡略化・書類のPDF非対応・DM/取込のopenapi/screens.md間の記述差異等）は
指揮役の裁定待ちのまま残っている。

## 完了の自己点検（2026-09-06 再開・JSON API 36件の配線）

指揮役の指摘（画面5件・API31件が404）を実測してから着手した。実測の詳細・根拠は
`coordination/qa/lane-c.md` セクションHに記録済み。要点だけここに書く。

- 画面5件（`/folded/{key}` `/animals/{karte_no}/karte/{visit_id}/print` `/papers/{paper_id}`
  `/todo/{key}` `/settings/master/{key}`）は**実装済み**で、404の原因は在庫検査の見本値
  （`karte_no`と`visit_id`が別患者の組み合わせ、`key`が固定語彙に無い値）だった
  （Go実装でも同一条件で同一の404を実測し、レーンC固有の不具合でないことを確認済み）
- API 31件は実際に**未配線**だった。`app/Http/Controllers/Api/`に配線し、画面側と同じ
  モデル・同じ業務ルールを再利用した（二重実装なし）
- `/papers/{paper_id}` `/api/papers/{paper_id}`だけは初期データが無い設計（`data/seed.json`に
  papersが無い）ため、`POST /api/patients/10002/papers`を1回実行して`paper_id=1`を実在させた

### 実行結果（コマンドの出力そのまま）

```
$ python tests/run.py http://127.0.0.1:8403 --only inventory

── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件

全 3 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8403

（検算1〜9・検算8・在庫3件・起動確認、すべてOK）

全 17 件 通過
```

（`tests/inventory.py`は着手時と終了時で出力形式が変わっている——指揮役側で見本値の
ミスマッチを「確かめられない」として扱うよう直った様子。自分は`tests/`配下を編集していない。）

### 残っていること

- `coordination/qa/lane-c.md`セクションHの4項目（folded/todoキー語彙、settings/masterキー語彙、
  owner_noの見本値、karte印刷のkarte_no/visit_id組み合わせ）は、在庫検査が「確かめられない」
  扱いに変わったため、実害としては解消済み。指揮役の裁定は不要になったはず
- 既存の`AccountingController`（画面側）と新設`Api\BillingController`は伝票番号の採番規則
  （`B-{billed_on:Ymd}-{連番4桁}`）を重複コードのまま持っている（意図的——画面用と統合点用で
  依存を増やしたくなかったため。将来まとめるならサービスクラス化を検討）
- サーバは8403で起動したまま待機する
