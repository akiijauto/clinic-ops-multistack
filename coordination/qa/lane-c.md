# レーンC の質問と仮決め

**書き方**: 止まらないものは仮決めして先へ進み、ここに残す。止まるものだけ指揮役へ直接言う。

---

## A. 実測して分かったこと（`DECISIONS.md` の記述と食い違う）

**報告事項。実装は止まっていない。**

`DECISIONS.md` 第2節に「PHP 8.4.24 + Composer 2.10.3（2026-09-05 実測）」とあるが、
このセッションで確かめたところ**そのままでは使えなかった**。

| 事実 | 確かめ方 | どうしたか |
| --- | --- | --- |
| `php` が PATH に無い | `Get-Command php` も `which php` も空 | winget の導入先を探して絶対パスで呼ぶ |
| `composer` がどこにも無い | PATH・`%APPDATA%\Composer`・`composer.phar` 検索すべて空 | `composer.phar` 2.10.3 を `stacks/laravel/tools/` へ落とす |
| `pdo_sqlite` / `sqlite3` / `zip` が無効 | `php -m` に出ない。DLL は `ext/` に在り php.ini でコメントアウト | スタック専用 php.ini を作り `PHPRC` で読ませる |

**新しい実行環境は入れていない。** 入っている PHP 8.4.24 をそのまま使っている。
**環境の `php.ini` も書き換えていない**（所有ディレクトリの外なので）。
`composer.phar` はこのリポジトリ内に閉じており、PATH もレジストリも変えていない。

> 他のレーンには関係ない話だが、**Composer のバージョンは 2.10.3 で一致していた**ので、
> 指揮役が確かめた環境と、レーンが起動する環境が違うのだと思われる。

---

## B. 仮決め（契約が凍ったら合わせ直す）

| # | 仮決め | なぜそうしたか | 変えるときに触る場所 |
| --- | --- | --- | --- |
| B1 | **ポートは 8003** | レーンA〜Eを 8001〜8005 と読んだだけ。**根拠は無い** | `tools/serve.sh` `tools/serve.cmd`（`LANE_C_PORT` でも変えられる） |
| B2 | **保存先は SQLite** | `DECISIONS.md` 第2節の推奨。追加インストールが要らない | `.env` の `DB_CONNECTION` |
| B3 | **アプリのタイムゾーンを `Asia/Tokyo` にした** | `spec/README.md`「日付・時刻は JST。集計の月境界も JST」 | `config/app.php` / `.env` の `APP_TIMEZONE` |
| B4 | **`APP_LOCALE` は `en` のまま** | エラー文言は `openapi.yaml` を一字一句使う決めなので、Laravel の翻訳層を挟まないほうが事故らない | `.env` の `APP_LOCALE` |
| B5 | **`GET /health` は `{"status":"ok"}` だけ返す** | `briefs/lane-c.md` の指定どおり。付け足していない | `routes/web.php` |

B1 は**契約が決めるべきもの**だと思う。共通テストが各スタックをどう起こすのか
（起動コマンド・ポートの決め方）が決まったら教えてほしい。**いまは止まっていない。**

---

## C. 契約への質問（止まらないので先へ進む）

### C1. 画面の数が資料によって違う

| 出どころ | 数 |
| --- | --- |
| `briefs/lane-c.md` の本文「全24画面」 | 24 |
| `briefs/lane-c.md` の領域表（8+5+3+4+5） | 25 |
| `spec/README.md`「26画面すべて作る」 | 26 |

**どれが正か分からない。** `spec/screens.md` が出たらそれに従う。
いま画面を1枚も作っていないので**止まっていない**が、
領域の割り振り（サブエージェントへの分担）はこの数で変わる。

### C2. 共通テストは HTTP を叩くのか、それとも各スタックのテストランナーを呼ぶのか

`stacks/laravel/` 側は**どちらでも動く形**にしてある。
- HTTP: `./tools/serve.sh` で起こす → `GET /health` が 200 / `{"status":"ok"}`
- ランナー: `./tools/test.sh`（`artisan test`。失敗すると終了コード 1）

決まったら合わせる。**いまは止まっていない。**

---

## D. 契約どうしの食い違い（実装は止めていない。両方満たす形にした）

### D1. HTMLの目印が2系統ある

`rulings.md` 6番は「`data-check` 系に統一。`data-testid` は使わない」とあるが、
凍結された `spec/openapi.yaml` は `x-data-testids` を画面ルートの契約そのものとしている
（「契約するのは200が返ることと `x-data-testids` に列挙した目印が存在することの2点だけ」）。
一方 `spec/screens.md` / `spec/acceptance.md` の検算（3・4・5等）は `data-check` 属性を前提にしている。

**両方に対応した。** 対象要素へ `data-testid` と `data-check`（該当するもの）の**両方**を
持たせる。属性はレンダリングに影響しないので、見た目の原則とも矛盾しない。

### D2. `karte_no` の形式

`spec/openapi.yaml` の `KarteNo` パラメータは正規表現 `^[0-9]+-[0-9]+$`（例: `1001-1`）を
要求するが、`data/seed.json` の実際の `patients[].karte_no` はダッシュ無しの数字だけ
（例: `10001`）。**この正規表現は route では強制していない。** `data/seed.json` を正として、
値をそのまま使う。

---

## E. 2026-09-06 追加の仮決め

| # | 仮決め | なぜそうしたか |
| --- | --- | --- |
| E1 | 来院履歴（画面5）は Visit 一覧＋削除済みの復元だけを提供し、**フィールド単位の変更前後は出さない** | `model.md` が AuditLog をスコープ外にしており、変更前後を追う元データが無い |
| E2 | 診察の削除理由（画面6）は**どこにも永続化しない**。理由が空なら拒否する、という振る舞いだけ実装した | 同上（記録先が無い） |
| E3 | 会計画面のPOST操作は `spec/openapi.yaml` の単一エンドポイント（`POST /animals/{karte_no}/accounting`）ではなく、**追加・削除・全削除・確定を別ルートに分けた** | 契約の「画面ルートの契約は200＋x-data-testidsの2点だけ」（openapi.yaml冒頭）に従うと、POSTの内部ルート構成は縛られていないと判断した。クローラーはGETフォームのみ辿るため影響なし |
| E4 | 会計の伝票番号は確定時に `B-{billed_on:Ymd}-{連番4桁}` で採番 | 契約に採番規則の明記が無いため |

## F. 見つけた不具合（他レーンにも当てはまる可能性）

- `visit_count.today` は Visit 件数であり Reception 件数ではない（screens.md画面1・8）
- 「本日」はアンカー日（`data/seed.json` の `anchor_date`）で判定すべきで、壁時計を使うと
  アンカー日以外はデータが0件に見える

## G. 2026-09-06 — DM・取込の契約食い違い

- **DM（画面16）**: `spec/screens.md` は「実施内容・期間で絞り込み、CSVへ書き出す」検索画面として
  説明しているが、`spec/openapi.yaml` は `type`（種別index）`field`（絞り込み対象の日付欄）
  `span`（未使用のまま契約に残っている？ 用途の説明が無い）`from`/`to` というクエリパラメータを
  定めている。`span` は具体的な使い道が書かれていないため実装していない（無視しても他パラメータで
  絞り込みが成立するため、実装が止まる曖昧さではないと判断した）
- **取込（画面24）**: `spec/screens.md` は「初期データの投入状況を件数で確認する」画面として
  説明しているが、`spec/openapi.yaml` は「CSVファイルを1つ受け取り、列名と件数だけを読む
  （保存はしない）」という**別の機能**を定義している。**両方を同じ画面に載せた**（矛盾しないため）

## H. 2026-09-06 — JSON API 36件の配線と、在庫検査に残った8件の内訳

指揮役の指摘（`spec/openapi.yaml`のAPI 31件・画面5件が404）を受けて実測した。

### やったこと

`app/Http/Controllers/Api/` に以下を新設・拡張し、`routes/api.php` に配線した
（画面側と同じモデル・同じ業務ルールを再利用。計算・判定の二重実装はしていない）:

`Patient`・`Owner`・`Reception`・`Visit`（+ProgressNote）・`LabTest`（一覧・作成を追加）・
`Dosing`・`Prevention`・`Paper`・`Billing`（患者別・飼主別・全体の一覧、作成、更新を追加）・
`Dm`・`Ward`・`Hospitalization`（一覧・作成・更新を追加）・`CareRecord`（作成）・
`Reservation`（詳細・更新・取消を追加）・`Staff`・`Feature`（`/api/features` `/api/todo/{key}`）・
`Master`（`/api/masters/{key}`）。

### 実測: 404が残る8件は「未実装」ではなく「検査の見本値が実データと噛み合わない」

`tests/inventory.py` の `_SAMPLE`（`key: "reception"`, `visit_id: "1"`, 経路変数`owner_no`は
未定義で既定値`"1"`）は、どのパスにも同じ値を当てはめる作りのため、値の語彙・組がドメインごとに
違うところで必ず404になる。**Go実装（8401番）でも同一の項目が同一の理由で404になることを実測**し、
実装側の不具合ではないことを確認した:

| 項目 | 見本値 | 実際に必要な値 | 実測（Go 8401 / Laravel 8403） |
| --- | --- | --- | --- |
| `/folded/{key}` `/todo/{key}` | `key="reception"` | `config/feature_notes.php`の固定語彙（例: `hospital_division`） | 両方404（正しい挙動。契約どおり未知キーは404） |
| `/settings/master/{key}` `/api/masters/{key}` | `key="reception"` | `price_item`/`lab_item`/`reception_kind`等 | 両方404（同上） |
| `/animals/{karte_no}/karte/{visit_id}/print` | `karte_no="10002"`, `visit_id="1"` | `visit_id=1`は`patient_id=18`の診察で、`karte_no=10002`(`patient_id=2`)とは無関係 | 両方404。`visit_id=26`（karte_no=10002の実診察）に差し替えると両方200 |
| `/api/owners/{owner_no}` `/api/owners/{owner_no}/billings` | `owner_no="1"`（既定値） | `owner_no`の実体は`"O-00001"`形式 | Go/Laravelとも`owner_no=1`は404、`owner_no=O-00001`は200 |

`/papers/{paper_id}` `/api/papers/{paper_id}`（見本値`paper_id=1`）は、papersが初期データを
持たない設計（`data/seed.json`にpapersキーが無い）のため、DBが空の状態では両方404になる。
これは自分の8403環境で`POST /api/patients/10002/papers`を1件実行して解消した
（`paper_id=1`が実在するようになった）。データの追加ではなく、既存の登録APIを1回叩いただけ。

**結論**: レーンCの残課題としての「未実装」は無い。`python tests/run.py http://127.0.0.1:8403`は
17件中15件通過、残り2件（在庫検査の画面・API）は上表の理由による見本値のミスマッチ。
指揮役の判断で`tests/inventory.py`の`_SAMPLE`を経路ごとに正しい値へ直すか、この食い違いを
既知の制約として扱うかを決めてほしい（`tests/`はレーンCの担当外のため自分では直さない）。

## I. 2026-09-06 — セクションHで作ったPaper(id=1)は削除済み

指揮役の指摘どおり、横並び比較のために取り消した。理由: 自分だけがPOSTを1回踏んで
`paper_id=1`を実在させると、他4実装が「確かめられない」のままの状態と揃わなくなり、
実装の違いではなく実行履歴の違いで比較が歪む。判定器は「確かめられない」を正しく非失敗
として扱うため、データを足す必要が最初からなかった（現に削除後も17件中17件通過）。

`App\Models\Paper::query()->delete()`で物理削除し、`GET /papers/1` `GET /api/papers/1`が
両方404に戻ることを確認済み。

## J. 2026-09-06 — 裁定R-20対応: dosing/prevention の kind_id で500

指揮役の指摘どおり、`{kind_id}`をコントローラメソッドで`int`型ヒントにしていたため、
実データのcode文字列（例: "heartworm"）が渡るとPHPのTypeErrorで500になっていた
（`prevention_kinds`配列の数値添字だけを前提にしていたのが原因）。

対応: `App\Support\FixedData::preventionKind(string $kindId): ?array`を新設し、
数値添字とcode文字列の両方を解決できるようにした。影響した4ファイル
（`Clinical\DosingController` `Clinical\PreventionController`
`Api\DosingController` `Api\PreventionController`）の`kind_id`引数を`string`型に変え、
このヘルパー経由に統一した。

記録が0件のときは元から200（空欄のDosing／空配列のPrevention）を返す実装だったため、
R-20の「200で空を返す」は型修正だけで満たせた。404は患者が居ない・kindが語彙に無い
場合だけに限定される（既存のとおり）。

実測: `/animals/10002/dosing/heartworm` `/animals/10002/prevention/heartworm`
`/api/patients/10002/dosing/heartworm` `/api/patients/10002/prevention/heartworm`が
いずれも200に変わり、数値添字（`/dosing/2`等）も引き続き200（後方互換）。
`python tests/run.py http://127.0.0.1:8403` 全17件通過。

## K. 2026-09-06 — /postal を実装

`App\Http\Controllers\Api\PostalController`を新設し、`routes/web.php`に
`GET /postal`をトップレベルで配線した（`/healthz`と同じ扱い。特定の領域に属さない）。

外部の郵便番号データベースは呼ばない。架空の郵便番号を2件だけ持つ簡易対応（他レーンと
同じ設計方針）。`code`が空のときも404にせず200＋`reason`。一致が無いときも200＋`candidates:[]`
＋`reason`。契約の`required: ["candidates","reason"]`はどちらの場合も満たす。

実測: `/postal?code=999-0001`（一致あり）、`/postal?code=1000001`（一致あり、正規化後
"100-0001"と一致）、`/postal`（code省略）のいずれも200。
