# レーンE の進捗

**スタック**: TypeScript / Next.js　**所有ディレクトリ**: `stacks/nextjs/`

---

## 2026-09-05 契約凍結後：統合層を自分で書き、5サブエージェントを並列起動

契約凍結（`spec/README.md`〜`openapi.yaml`・`data/`）を確認。ブリーフの指示どおり
**統合点は自分で書き、5領域はサブエージェントへ分けた**（領域ごとに別の指示文）。

### 自分で書いた統合層（`stacks/nextjs/src/lib/`）

| ファイル | 中身 | 検証 |
| --- | --- | --- |
| `model.ts` | `spec/model.md` の15entity型 | `tsc --noEmit` 通過 |
| `schema.sql` | SQLiteのDDL（16表） | 実データ`data/seed.json`を全件投入して確認 |
| `db.ts` | 接続・結果行の正規化（`rows()`/`row()`） | node:sqliteのnullプロトタイプ対策込み |
| `errors.ts` | `spec/openapi.yaml`のエラー文言・ステータスコード一覧を型で固定 | — |
| `jst.ts` | JST日時ユーティリティ | — |
| `money.ts` | 消費税計算順序（伝票につき1回切り捨て）・最大剰余法の構成比丸め | **実データで検算1・検算2相当をテスト、全件一致** |
| `reservation.ts` | 予約の半開区間重複判定 | **実データ（60件）で検算6相当をテスト、重なり0件を確認** |
| `scripts/seed.ts` | `data/seed.json`を16表へ流し込む（テストからも呼べる`seed()`） | 実行して全件件数を確認 |

`money.ts`と`reservation.ts`は「決めてから作る」ではなく**実データで確かめてから**サブエージェントへ渡した
（会計・売上と入院・予約がこの2つの上に建つため、土台側の間違いは5画面全部に伝播する）。

### 5領域をサブエージェントへ分けた（同時刻起動・別指示文）

| 領域 | 担当画面 | 状態 |
| --- | --- | --- |
| 1 受付・患者 | 本日の患者／新規登録／顧客／検索／来院履歴／削除／折りたたみ表示／トップ | 実行中 |
| 2 診療 | カルテ／検査／投薬／予防／書類 | 実行中 |
| 3 会計・売上 | 会計／会計履歴／DM／売上集計 | 実行中 |
| 4 入院・予約・業務 | 入院／予約／ToDo／スタッフ | 実行中 |
| 5 設定 | 設定／機能設定／取込／マスタ／このシステムについて | 実行中 |

各エージェントには「使ってよい共有部品（変更しないこと）」「他領域のファイルに触らない」
「開発サーバーは領域ごとに別ポート（3101〜3105）・別DBファイルを使い、確認後は必ず止める」
「終わったら typecheck / build / test を通す」を明記した。完了したら私が統合し、
共通テスト（`tests/run.py`）と`spec/acceptance.md`の検算を私自身が走らせて確認する。

### 現時点のベースライン（サブエージェント着手前）

```
npm test → tests 24 / pass 22 / fail 0 / skipped 2
```

---

## いちばん先に見てほしいこと

> ### `tests/run.py` が叩くのは `/healthz`。ブリーフに書いてあるのは `/health`
>
> `briefs/lane-e.md` の「4. `GET /health` だけ作る」に対し、`tests/run.py` の
> smoke 1件目は **`/healthz`** を叩きます。
>
> `tests/` が判定の正なので **`/healthz` を作り、`/health` も別名として残しました**。
> レーンEは**これで通っています**。
>
> **他レーンのブリーフも `/health` と書いてあるなら、4レーンが同じところで転びます。**
> 凍結時にどちらが正か決めてください（`qa/lane-e.md` A）。

---

## 2026-09-05 土台完了。**共通テストの smoke は通っています**

```
$ PORT=3005 npm start
$ python tests/run.py http://localhost:3005
── smoke ──
  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 27ms
全 2 件 通過
```

ブリーフの「契約が凍ったあとの最初のマイルストーン」＝**共通テストの1件目**は、
いま公開されている smoke 2件がそのまま通った状態です。

**画面はまだ1枚も作っていません**（指示どおり。`spec/screens.md` と `openapi.yaml` 待ち）。

### ブリーフ「いまやること」5項目

| # | やること | 状態 | 実測 |
| --- | --- | --- | --- |
| 1 | 雛形を作る | 済 | Next.js 16.3.4 / App Router / TypeScript 7.0.2 |
| 2 | 依存を入れる | 済 | `next` `react` `react-dom` ＋型定義のみ。リポジトリ内に閉じた。`found 0 vulnerabilities` |
| 3 | テストが走る形 | 済 | `npm test` で10件（うち2件はHTTP用でskip）。**壊して落ちることを確認済み** |
| 4 | `GET /health` | 済 | `/health` と **`/healthz`** の両方。`200` / `application/json` / `{"status":"ok"}` を実測 |
| 5 | 題材を読む | 済 | `題材のシステムdocs/実装分担-2026-09-05.md`。**読むだけ。当該リポジトリは一切変更していません** |

### 先へ進めたぶん（`spec/model.md` が出たので）

**統合点は自分で書く**という指示に従い、サブエージェントへ渡さずに以下を書きました。

| ファイル | 中身 |
| --- | --- |
| `src/lib/model.ts` | 15entityの型。日時はJSTのISO文字列、未設定は `null` |
| `src/lib/schema.sql` | SQLiteのDDL。**16表** |
| `src/lib/db.ts` | 接続と、結果行の正規化 |

`spec/model.md` が名指しした2つの不具合を、アプリ側でなく**DB側で**塞ぎました。
アプリ側で間違えたのが元の不具合なので、同じ層に置くと同じ間違いをします。

| 規則 | 置いた場所 |
| --- | --- |
| 未設定の単価を0として集計しない | `billing_detail.unit_price` を **NULL可のまま**（`NOT NULL DEFAULT 0` にしない） |
| 実施者の無い記録を作らない | `care_record.performed_by_staff_id` を **NOT NULL** |

## 壊して鳴ることを確かめた（`PLAN.md`「緑と呼んでよい条件」2）

| 壊し方 | 結果 |
| --- | --- |
| `health()` の戻り値を変える | 単体テストが `✖` |
| `{"status":"nope"}` を返す偽サーバーへ向ける | HTTP検査が `✖`、`tests/run.py` も `NG` |
| 誰もいないポートへ `tests/run.py` を向ける | `2 件中 2 件 失敗` |
| `care_record` の `NOT NULL` を外す | 該当テストが `✖` |
| `billing_detail.unit_price` を `NOT NULL DEFAULT 0` にする | 該当テストが `✖` |

すべて戻して緑に復帰済み（`npm test` → `tests 10 / pass 8 / fail 0 / skipped 2`）。
**共通テストの緑が偽陽性でないことも、上のA・Bで確かめてあります。**

## 選んだもの

| | 選択 | 理由 |
| --- | --- | --- |
| DB | **`node:sqlite`（Node 組み込み）** | `DECISIONS.md` 2 の「追加インストール不要」と「SQLite 推奨」を両方満たす。**DBの依存0** |
| テスト | **`node --test`（Node 組み込み）** | 同上。テストフレームワークの依存も0 |

Next.js が肩代わりしているもの（ルーティング・ビルド・型検査の統合）と、
**自分で書くことになったもの**（DBの接続、結果行の正規化、予約の重なり検査）の境目は
`stacks/nextjs/README.md` に記録しています。他レーンとの差はここで語れます。

## 仮決め（`coordination/qa/lane-e.md` に全部）

| | 中身 | 止まるか |
| --- | --- | --- |
| A | health のパスが `/health` と `/healthz` の2つある | 止まらない（両方出した） |
| B | 画面数が 24 / 25 / 26 の3通り。差分は**売上集計1枚** → **26で構える** | 止まらない |
| C | `spec/model.md` の見出しは14、中身は15 → **15で実装** | 止まらない |
| 4 | 「どう持つか」（配列・重なり・日時）の埋め方5件 | 止まらない |

## 次にやること

**指揮役の合図待ちです。** `spec/openapi.yaml` `spec/acceptance.md` `spec/screens.md`
`data/` が揃って凍結されたら、領域1〜5をサブエージェントへ分けます
（**領域ごとに別の指示文**を書きます。同じ文面を複数へ渡さない）。
**統合点・共通のモデル・レイアウトは引き続き自分で書きます。**

## 触っていないもの

`git`（commit/push/checkout をしていません）／`spec/`／`tests/`／他レーンの `stacks/`／
題材のシステム（読んだだけ）。書いたのは `stacks/nextjs/` と、このファイル・
`coordination/qa/lane-e.md` だけです。秘密情報・実データは入れていません。

## R-14 / R-19 対応（2026-09-05）

`test/health.http.test.ts` の `BASE_URL` 無し挙動を、skip（緑）から**明示的な失敗**に変更した。

- 変更前: `BASE_URL` 未設定 → 2件を `skip` → `npm test` は緑（=試していないのに緑に見える）
- 変更後: `BASE_URL` 未設定時は既定値 `http://127.0.0.1:8405`（`coordination/PORTS.md` のレーンE用ポート）を使う。
  サーバーが起きていなければ `fetch` が `ECONNREFUSED` で例外を投げ、テストは `✖` になる

実測（サーバー無し・`BASE_URL` 無しで `npm test`）:

```
✖ GET /healthz returns {"status":"ok"} — ECONNREFUSED 127.0.0.1:8405
✖ GET /health returns {"status":"ok"} — ECONNREFUSED 127.0.0.1:8405
ℹ tests 24 / pass 22 / fail 2 / skipped 0
```

**skipped は0。緑にはならない。** サーバーを起動した状態（`PORT=8405 npm run dev`）では
`npm test` は `tests 24 / pass 24 / fail 0 / skipped 0` で全緑。

## smoke 実測（2026-09-05）

起動コマンド: `PORT=8405 npm run dev`（`stacks/nextjs/` で実行。ビルド不要、Turbopackのdevサーバー）

```
$ python tests/run.py http://127.0.0.1:8405 --only smoke

── smoke ──

  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 9ms

全 2 件 通過
```

**緑を自分で確認済み。** 起動していたNext.js devサーバーは確認後に停止した。

次の一手: 指揮役の合図待ち（`spec/` 凍結後、領域1〜5をサブエージェントへ分ける）は変更なし。

## money 組 4件 対応（2026-09-05）

**重大な発見**: 着手時、DB/マスタに触るAPIルート（`/api/sales/summary` `/api/billings/{id}`
`/api/ward` 等）が**すべて500だった**。原因は `import.meta.dirname` が Turbopackバンドル後
`undefined` になること（`node --test` では効くため気づかれていなかった）。
`src/lib/paths.ts` の `moduleDir()` で6ファイルを修正し解消（詳細は `coordination/qa/lane-e.md` E）。

追加実装:
- `src/app/api/billings/[id]/route.ts`（新規）: `getBilling()` を呼び、openapi.yaml名
  （`total`/`excluded_detail_count`等）に加え共通テストが読む名前
  （`net_amount`/`total_amount`/`excluded_count`）を併記
- `src/app/api/sales/summary/route.ts`（新規）: `computeSalesSummary()`（既にあった
  `src/lib/sales.ts`）を呼び出し、`from`/`to` 省略時は全期間を対象にする
  （`coordination/qa/lane-e.md` D）

実測（`python tests/run.py http://127.0.0.1:8405 --only money`）:

```
── money ──

  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250

全 4 件 通過
```

期待値と一致（税抜総合計 5,185,704円）。`--only smoke` も引き続き緑を確認済み。
`npm test` も 24/24 通過（`import.meta.dirname` 修正の副作用が無いことを確認）。

起動コマンドは変更なし: `PORT=8405 npm run dev`（`stacks/nextjs/` で実行）。

## screen 組 3件 対応（2026-09-05）

新規実装:
- `src/lib/karte.ts` / `src/lib/karte-render.ts`（新規）: 患者ヘッダ・診察一覧・
  経過記録を、`/animals/{karte_no}/karte`（画面）と `/animals/{karte_no}/karte/print`
  （印刷）の**両方から同じ関数**（`renderKarteScreen`/`renderKartePrint` が同じ
  `visitBlock`/`noteRow` を通る）で描画。検算4「画面と印刷で同じ値」が、
  値を2箇所で別々に計算する余地を最初から持たない作りにした
- `src/lib/clinical/lab.ts`（新規）: `GET /api/lab-tests/{id}` の中身。既にあった
  `src/lib/clinical/lab-judgment.ts`（`judgeLabValue`）をそのまま使い、判定文字
  （`judgment`: ''/H/L）と色の根拠（`data_check_flag`）を**同じ呼び出し1回**から
  出す（検算5「判定と色は独立に確認する——片方だけでは不合格」に応える構造）
- `src/app/animals/[karte_no]/karte/route.ts`・`.../karte/print/route.ts`・
  `src/app/api/lab-tests/[id]/route.ts`（すべて新規）

途中で `--only screen` が2件NGになったが、**自分の実装のバグではなく共通テスト側の
バグだった**（`coordination/qa/rulings.md`「2026-09-05夜 — judge自身にバグがあった」）。
`tests/checks.py` の `_data_check` が正規表現版のときは `<html>...</html>` を1つの
タグとして食い切ってしまい、中の `data-check` が一切見えなかった（レーンAが最初に
発見・報告済み、指揮役が `html.parser` 版に直した）。直った版で再測したら実装は
最初から正しかった。

実測（`python tests/run.py http://127.0.0.1:8405 --only screen`、judge修正後）:

```
── screen ──

  OK  検算3 体温が全患者で同じ値になっていない  — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る  — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致

全 3 件 通過
```

`--only smoke`・`--only money`（検算そのものの点検を含め5件）も再確認済みで緑。
`npm test` も 24/24。起動コマンドは変更なし: `PORT=8405 npm run dev`。

## rules・crawl 対応、全14件が緑（2026-09-06）

### rules（検算6・7・9）

- 検算6: `src/app/api/reservations/route.ts`（新規）。既にあった `_area4/repo.ts` の
  `listReservations()`（重なり判定込みで検算6が要求する半開区間ロジックは
  `src/lib/reservation.ts` に既存）をそのまま呼ぶだけで済んだ
- 検算7: `GET /api/hospitalizations/{id}/care-records` は既に実装済みで、実測したら
  最初から緑だった
- 検算9: `src/app/api/visits/[visit_id]/route.ts`（新規）。`deleted_at` でフィルタしない
  （一覧からは消えるが直接引けば見える、という検算9の要求どおり）

### crawl（検算8）― 26画面のうち大半がまだ配線されていなかった

`src/lib/`・`src/app/_area4/` には領域ごとの実装ロジック（DB操作・集計・判定）が
かなり作り込まれていたが、**実際にHTTPへ応答するページ（`page.tsx`/`route.ts`）は
`/settings` `/settings/features` と、今日作った `/animals/{karte_no}/karte` 系しか
無かった**。トップページも `/healthz` だけを案内する古い内容のままだった。

crawl検算を通すため、既存ロジックを配線する形で以下を新規作成:

- `src/app/page.tsx`（書き換え）: 実在する画面へのリンク集にした
- `src/app/today/route.ts`（screen 1 本日の患者）: `listReceptionsForDay`/`visitCountForDate`
  （`area1/data.ts` に既存）を使用
- `src/app/search/route.ts`（screen 4 検索）: `searchPatientsOwners`/`searchVisits`
  （同上）を使用
- `src/app/staff/route.ts`（screen 21）・`src/app/ward/route.ts`（screen 18）・
  `src/app/reservations/route.ts`（screen 19）: `_area4/repo.ts` の
  `listStaff`/`hospitalizationsActiveOn`/`listReservations` を使用
- `src/app/settings/import/route.ts`（screen 24）・`src/app/settings/master/route.ts`・
  `src/app/settings/master/[key]/route.ts`（screen 25）: `settings-import.ts`/
  `settings-masters.ts`（既存）を使用
- `src/app/about/route.ts`・`src/app/folded/[key]/route.ts`（screen 7）: それぞれ
  `render.ts`のNAVと`/settings/features`が既にリンクしていたが実体が無かった先

すべて**参照専用のスタブ**（一覧・詳細の表示のみ、保存・登録ボタンは置いていない）。
`spec/README.md`「できますと書いて出来ていない状態を作らない」に沿った。

実測（`python tests/run.py http://127.0.0.1:8405`、全14件）:

```
── smoke ──
── money ──
── screen ──
── rules ──
── crawl ──

  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 7ms
  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250
  OK  検算2 この規則を、いまのデータで確かめられているか（検算そのものの点検）  — ★ 150枚すべてで丸め方の差が出ない。この規則は**いまのデータでは検証できていない**（データ側の課題）
  OK  検算3 体温が全患者で同じ値になっていない  — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る  — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致
  OK  検算6 予約が担当・処置室のどちらでも重ならない  — 60 件で重なり0
  OK  検算7 入院の記録行に実施者が必ず入っている  — 108 件中 実施者なし 0 件
  OK  検算9 削除済みは一覧から消えるが件数には残る  — 一覧から消えても集計に残る
  OK  検算8 画面から辿れるリンクが全部生きている  — 35 画面を辿って切れなし

全 14 件 通過
```

`npm test` も 24/24 のまま。起動コマンドは変更なし: `PORT=8405 npm run dev`。
26画面のうち今日繋いだのは参照系の一部のみ。登録・編集フォーム（会計入力・予約登録・
カルテ保存フォーム等）はまだ配線していない — 次にやるとしたらここ。
