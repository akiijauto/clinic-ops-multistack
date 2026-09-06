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

## L. 2026-09-06 — 共通CSS(/ui.css)を配布

`spec/ui.css`をそのままコピーして`public/ui.css`として配った（diff で内容一致を確認済み）。
`resources/views/layouts/app.blade.php`（全画面が使う唯一のレイアウト）から
`<link rel="stylesheet" href="/ui.css">`で読むよう変更し、自前の`<style>`（1,886字）を削除した。
`resources/views/clinical/karte_print.blade.php`（唯一レイアウトを使わない独立画面）にも
同様に配線し、自前の`<style>`を削除した。

HTML構造の対応:

- `class="btn"` → `class="button"` へ全置換（72箇所。ui.cssは`.button`/`.button.secondary`/
  `.button.disabled`を定義しており、旧`.btn`は何にも一致しなかった）
- `<a class="btn is-disabled">`（B/C状態のボタン。今日の患者画面の3件）→
  `class="button disabled"`（`ui.css`の`a.disabled`規則に一致。消していない）
- `data-testid="error-banner"` / `"success-banner"`（16箇所）に`class="error-banner"` /
  `class="success-banner"`を併記（`ui.css`はクラスで見た目を決めるため、`data-testid`だけでは
  スタイルが当たらない）
- `data-testid="empty-*"`の行（10箇所）の`<td>`に`class="empty"`を追加
- 検査結果の判定欄（`clinical/exam.blade.php`）を`flag-high`/`flag-low`（`ui.css`に定義が無く
  死んでいた）から`class="out-of-range"`（検算5。`ui.css`の`.out-of-range`規則）へ統一
- `billing/accounting.blade.php`（単価・数量・金額）、`billing/accounting_history.blade.php`
  （税抜・消費税・税込・未算入）、`billing/sales.blade.php`（金額・構成比）の数値セルに
  `class="num"`を追加（右寄せ・桁揃え）
- `<header class="gnav">`を`<nav>`要素へ変更（`ui.css`は`nav`要素セレクタでスタイルを当てる）

**`spec/ui.css`の中身は1文字も変えていない**（`diff spec/ui.css stacks/laravel/public/ui.css`で確認）。
色・余白は自分で足していない（既存の機能的なインラインstyle——`display:inline`のフォーム、
入力欄の`width`、`<pre>`の`margin:0`——はレイアウト目的のため残した。装飾目的のものではない）。

実測: `python tests/run.py http://127.0.0.1:8403` 全20件通過（新規追加された
「見た目 共通CSS(/ui.css)を配っていて、全画面が読んでいる」含む）。

## M. 2026-09-06 — 灰色のボタン3つを追加、キーに「.」を含めない教訓

契約（`/todo/{key}` の説明・`spec/screens.md`「本日の患者」状態C表）が名指しで求める
「一時保存／完了全削除／完了削除」の3つの灰色ボタンのうち、実装済みだったのは
今日の患者画面の2つ（完了全削除・完了削除）だけで、カルテ画面の「一時保存」が無かった。
`resources/views/clinical/karte.blade.php`に`<a class="button disabled" href="/todo/karte_temp_save">一時保存</a>`
を追加した（`config/feature_notes.php`の`todo`配列に`karte_temp_save`キーを新設）。

**副次的な発見**: 既存の2キー（`today.complete_delete_all` / `today.complete_delete_one`）は
`.`（ドット）を含んでいたため、在庫検査の新しい語彙抽出（`/todo/([A-Za-z0-9_\-]+)`——
`.`は文字クラスに含まれない）が両方とも`today`に切り詰めて同一視し、「1個しか無い」と
誤カウントしていた（指揮役の実測どおり）。**キーに`.`を使わない**よう
`today_complete_delete_all` / `today_complete_delete_one`へ改名した
（画面側リンクと`config/feature_notes.php`の両方を合わせて変更。参照箇所は2ファイルのみ
だったことを`grep`で確認済み）。

実測: `/todo/today_complete_delete_all` `/todo/today_complete_delete_one` `/todo/karte_temp_save`
いずれも200。`/today`・`/animals/10002/karte`のHTMLから3つとも辿れることを確認。

**ついでに気づいたこと**: 在庫検査の実行中、`php artisan serve`（開発用の簡易サーバ、
シングルスレッド）が1回だけ`/settings/master/{key}`・`/api/masters/{key}`で偶発的な
タイムアウト/404を返した。実際の6キー（price_item/lab_item/reception_kind/
prevention_kind/department/phrase）はすべて直接確認すると200で、判定器のキー解決ロジック
（`tests/inventory.py`の`_resolve`）を手動で追跡しても正しく`price_item`を拾えていた。
直後に2回連続で実行し直すと両方とも緑になったため、**アプリ側の不具合ではなく開発サーバの
一過性の詰まり**と判断した（本番相当のサーバではないための既知の限界）。

実測（連続2回・フルテスト1回、すべて緑）:
```
python tests/run.py http://127.0.0.1:8403 --only inventory → 全8件通過（1回目）
python tests/run.py http://127.0.0.1:8403 --only inventory → 全8件通過（2回目、再現なし）
python tests/run.py http://127.0.0.1:8403 → 全22件通過
```

## N. 2026-09-06 — 公開文言・データキャッシュ・「本日」の壁時計化

### 1. `/about` に必須文言が全欠落していた（最優先）

`resources/views/top/about.blade.php`に、`README.md`「これは何か」「利用条件」と
同趣旨の文言（学習・研究目的／ライセンス不付与・複製再配布改変商用利用不可／
データは架空／実運用システムのソース非含有）を追記した。文言はREADMEの表現に合わせた。

### 2. Owner id=18 の氏名がずれていた — 原因はDBではなくキャッシュ

`data/seed.json`は正しい値を持っていたが、`App\Support\FixedData::readJson()`が
`Cache::rememberForever`で**ファイル名だけをキーに永久キャッシュ**していたため、
`data/seed.json`が過去に訂正された後も**古い内容がキャッシュされたまま**だった。
`php artisan migrate:fresh --seed`でDBだけ作り直しても、シーダーが読むのは
このキャッシュ経由の`FixedData::seed()`なので直らなかった（`cache:clear`を挟んで
初めて直った）。

**再発防止**: `readJson()`のキャッシュキーにファイルの更新日時（`filemtime`）を含めるよう
変更した。`data/`のファイルが変わればキーも自動的に変わるため、`cache:clear`を
手で叩かなくても追従する。`lab_items.json` `price_items.json` `masters.json` `seed.json`
すべてに効く一般的な修正（呼び出し元はどこも変更不要）。

実測: 修正後は`GET /api/owners/O-00018`が`data/seed.json`と同じ氏名を返す。
売上集計は修正前後で`5,185,704`円のまま変わらないことを確認した。

（このOwnerの具体的な氏名はここに書かない。IDで指す——指揮役の指示どおり）

### 3. 「本日」を壁時計に統一（裁定に同意。反論なし）

`App\Support\BusinessClock::today()`を`data/seed.json`の`anchor_date`固定から
実際の壁時計（Asia/Tokyo）へ変更した。全コントローラがこのクラス経由で「本日」を
判定しているため、変更はこの1ファイルだけで済んだ（設計がここに集約されていたのが
功を奏した）。

反論はしない。anchor_date固定にしていた理由（種データがアンカー日周辺に集中しており、
壁時計だと`/today`が常に0件に見える）はコメントに残していたとおりだが、
5実装中4つが壁時計を採用しており、`anchor_date`はデータ生成の基準日であって
「いまが何日か」ではないという指揮役の理由付けに同意する。0件になること自体は
不具合ではなく、いま実際に受付・診察が無いことを正しく表示しているだけである。

実測: 変更後、`/today`・`/api/receptions`はいずれも0件（壁時計の本日に一致するデータが
無いため。他4実装と同じ状態）。

### テスト結果

```
python tests/run.py http://127.0.0.1:8403
（検算1-9・検算8・在庫5件・見た目2件・灰色ボタン1件・書き込み1件・データ一致1件・起動確認）
全 24 件 通過
```

## O. 2026-09-06 — レビュー指摘5件（売上3表・マスタ表示・退院済み入院・PDF・スタッフ選択）

### O1. 売上集計、分類別の1表しかなかった → 3表に

`resources/views/billing/sales.blade.php`が`by_category`しか描画していなかった
（APIは`by_staff`/`by_date`も最初から正しく返していた）。分類別・担当別・日別の
3表を追加し、期間指定フォーム・税抜合計・未算入件数（`sales-total`/`sales-excluded-count`
のtestid）も追加した。`Billing\SalesScreenController`で`Staff::pluck('name','id')`を渡し、
担当別表で担当名を表示する。

実測: `total_net_amount` / `by_category`合計 / `by_staff`合計 / `by_date`合計は
すべて`5,185,704`円で一致（spec/screens.md画面17「3つの表それぞれの金額の合計が、
すべて同じ値になる」を満たす）。

### O2. マスタ画面が生JSONダンプだった → 整形済みの表に

`Settings\MasterController`に列見出し・セル整形ロジックを追加した（先頭行のキーから
列を作り、ネストした配列——検査の基準値など——は1行で読める要約文字列にする）。
6種類（price_item/lab_item/reception_kind/prevention_kind/department/phrase）すべてで
表として描画されることを確認した。

### O3. 退院済みの入院にケア記録を追加できてしまう → 422で拒否

`Api\CareRecordController::store()`に退院済みチェック（`$hospitalization->isOngoing()`）が
無く、画面側（`Ops\AnimalWardController`）だけが持っていた規則が抜けていた。API側にも
同じチェックを追加。実測: 退院済みの入院（id=1）へのPOSTは422、進行中の入院（id=8）への
POSTは201のまま。テスト用に作成したケア記録（id=109）は削除済み（他4実装との比較を
歪めないため）。

### O4. 書類のPDF拒否 — 実装にファイルアップロード自体が無い（対応不要と判断）

`Clinical\PaperController` / `Api\PaperController`とも`title`（文字列）と`note`だけを
受け取る設計で、`enctype="multipart/form-data"`もファイル入力欄も、
`$request->file()`/`hasFile()`の呼び出しも存在しない（grep で確認済み）。
`title=test.txt`のようなPOSTが通るのは「titleという文字列項目に任意の文字列を
入れられる」だけであり、ファイルの拡張子チェックとは別の話。指揮役の指示
「受け取らないなら対応不要」に従い、コード変更はしていない。

### O5. スタッフ画面に担当選択の手段が無かった → 選択・解除を追加

`Ops\StaffController`に`select(int $id)`（一覧から選ぶ）`clear()`（担当を外す）を追加し、
`routes/areas/ops.php`に`POST /staff/{id}/select` `POST /staff/clear`を配線した
（openapi.yamlは`/staff`のGETしか規定していないため、POST経路はレーンC統合点として
自分で決めた——会計画面のE3と同じ考え方）。`App\Support\CurrentStaff`は既存の仕組みを
そのまま使う。実測: 選択後`GET /staff`が選んだ担当名を表示し、解除後は「未選択」に戻る。

## P. 2026-09-06 — 見た目の実描画一致（トップ見出し・共通ナビ・受付区分タブ）

指揮役がPlaywrightでの実描画比較（`tests/shots.py`）を導入し、「CSSを配った／クラスが
付いた」までしか確かめておらず「同じに見えるか」を見ていなかったと自ら訂正した。
以下を対応した。

- `<title>`をレイアウト側で一括して「画面名 — 動物病院 窓口業務システム」の形に統一
  （`resources/views/layouts/app.blade.php`の1箇所の変更で全画面に効く）
- トップ画面（`/`）の本文を、spec/screens.md追記どおり「h1・3点の説明・`/today`への
  導線1本」だけに簡略化。旧本文にあった`/folded`・`/about`へのリンク（ナビの重複）と
  対象日診察件数の表示を削除した。`Top\TopController`もこれに伴いDB参照が不要になった
- `<h1>`に日付・期間を含めていた2画面（`/reservations`「予約一覧（期間）」→「予約」、
  `/ward`「入院（日付時点）」→「入院」）を修正。期間・基準日は見出しの下の`<p>`へ移した
  （全画面の`<h1>`をgrepし、可変値を含むのはこの2件だけだったことを確認済み。他は
  患者名・伝票番号等の「その画面が指す対象の識別子」であり、日付・期間ではないため対象外
  と判断した）
- 共通ナビ（`<nav>`内の10リンク：トップ/本日の患者/検索/予約/入院/DM/売上集計/スタッフ/
  設定/このシステムについて）は、追記されたspec/screens.mdの表と完全一致していることを
  確認済み（元から変更不要だった）
- `spec/ui.css`（ダークモード対応版）と`public/ui.css`はdiffで内容一致を確認済み
  （再配布の必要は無かった）

`python tests/shots.py /today /reservations /ward` / `/sales` / `/`で実描画を確認:
`/`・`/sales`・`/reservations`（修正後）は「揃っている」。`/today`はtitle/h1が5実装
完全一致（nav本数だけ16 vs Rails17で近似）。`/ward`は自分のtitle/h1が最も規則に
忠実（可変値を含まない）だが、他4実装がまだ日付を残しているため「違う」表示のまま
残る（自分側の問題ではないと判断）。

## Q. 2026-09-06 — 受付区分タブ（spec/screens.md画面1・契約が名指しで要求）

`Reception\TodayController`に受付区分（`data/masters.json`の`reception_kinds`）の
タブを追加した。`Reception.medical_purpose`が区分の表示名（例:「初診」）をそのまま
持っていること（`code`ではない）を`data/seed.json`実測で確認した上でマッピングした。

契約どおり: `kind`省略時・未知の`kind`はマスタの1つ目へ戻す（空一覧にしない）。
6区分すべてにタブリンクを設置し、「完了行を隠す」トグルでも`kind`を保持するよう
修正した。

## R. /folded（バラ引数無し）についての意見

指揮役から「契約に足すか、他レーンに合わせるかを決めたい」と相談があった。
自分の意見: **契約に追加することを推奨する。** 理由は、`/folded`単体を一覧として
実装した2レーン（Laravel・Rails）は実際に動く200のページを返しており、逆に
未実装（Go・FastAPI）や404（Next.js）へ合わせるのは、動くものを壊す方向の統一に
なるため。`spec/screens.md`の「③折りたたみ表示＝一覧」という説明とも自然に合致する。
