# レーンE の質問と仮決め

**書き方**: 実装が止まらないものはここに書いて先へ進む（`PROTOCOL.md` 9）。
仮決めは**仮決めと分かる形**で残す（レーンRが見る3点目）。

---

## 指揮役に見てほしいもの（レーンEは止まっていません）

### A【食い違い・**他の4レーンにも当たるはず**】health のパスが2つある

| 出どころ | パス |
| --- | --- |
| `briefs/lane-e.md`「4. `GET /health` だけ作る」 | `/health` |
| `tests/run.py` の smoke 1件目 | **`/healthz`** |

`tests/` が判定の正なので、**`/healthz` を作りました。** ブリーフの文面も無視できないので
`/health` も同じ応答を返す別名として残しています（`src/app/health/route.ts`）。

- **実測**: `python tests/run.py http://localhost:3005` → `全 2 件 通過`
- **お願い**: `spec/openapi.yaml` の凍結時にどちらが正か決めてください。別名は消します
- **注意**: 他レーンのブリーフも `/health` と書いてあるなら、**4レーンが同じところで転びます**

### B【食い違い】画面数が 24 / 25 / 26 の3通りある

| 出どころ | 数 |
| --- | --- |
| `briefs/lane-e.md` の見出し | 全24画面 |
| `briefs/lane-e.md` の領域表を数える | 25枚 |
| `PLAN.md` / `spec/README.md` | 26枚（既存24＋新規2：予約・売上集計） |

差分は**売上集計1枚**。レーンEの領域表（領域3 会計・売上）に入っていません。

- **仮決め**: `spec/README.md`「26画面すべて作る」に従い、**26画面**で構える。
  領域3に売上集計を足す
- **根拠**: `DECISIONS.md` 6-1「`spec/` に答えがあるか」
- **止まるか**: 止まらない（画面はまだ作らないため）

### C【小さな食い違い】`spec/model.md` の見出しは14、中身は15

「変わるもの（14）」の下に 1〜15 が並んでいます（15 は Hospitalization）。
`Hospitalization.care_records` を別のものと数えれば16とも読めます。

- **仮決め**: **15entity**として実装。`care_records` は `care_record` テーブルへ分けました
  （`Hospitalization` の中に並びとして持つ、という記述をそのまま関係表にしただけです）
- **止まるか**: 止まらない

---

## 仮決め（土台の段階・2026-09-05）

### 1【解決】ポートは自由

`tests/run.py` は対象URLを引数で受けるので、レーンごとにポートを決めてよいと分かりました。
`PORT=3005 npm start` で動くことを実測。既定は Next.js の 3000。

### 2【決定】保存先は Node 組み込みの `node:sqlite`

`DECISIONS.md` 2「追加インストールが要らないもの（SQLite を推奨）」を両方満たす。
**仮決めではない**。DBの依存パッケージは0。

### 3【決定】テストは Node 組み込みの `node --test`

同上。テストフレームワークの依存も0。Node 24 は `.ts` の型剥がしを既定で行う。

### 4【仮決め】`spec/model.md` の「どう持つか」の埋め方

`model.md` は「何を持つか」だけを決めていて、持ち方はレーンの自由と書いてあります。
レーンEは次のように埋めました（`src/lib/schema.sql`）。

| 項目 | 持ち方 | 理由 |
| --- | --- | --- |
| `Clinic.closed_weekdays`（整数の配列） | JSON文字列の列 | SQLiteに配列型が無い |
| `Hospitalization.care_records`（記録の並び） | `care_record` 表に分離 | 実施者を **NOT NULL** で強制するため |
| `BillingDetail.unit_price` 未設定 | **NULL**（`NOT NULL DEFAULT 0` にしない） | 「0として集計しない」を**DB側で**担保する |
| 予約の重なり | DB制約にせずサービス層で検査 | SQLiteに排他制約が無い。索引だけ張った |
| 日時 | ISO文字列（JST、`+09:00` 付き） | `DECISIONS.md` 4「JSTで扱う」 |

**`unit_price` を NULL のままにしたのが要点です。** `NOT NULL DEFAULT 0` にすると
未入力と0円が区別できなくなり、`spec/README.md` が名指しした不具合をそのまま作り込みます。
壊して確かめました（下記）。

---

## 実測して分かったこと

- **`node:sqlite` の結果行は null プロトタイプ**。`deepStrictEqual` が平のオブジェクトと
  一致せず、`hasOwnProperty` も持たない。`src/lib/db.ts` の `rows()` / `row()` で正規化する
- **`node --test` で `.ts` を import するには拡張子が要る**。そのままだと `tsc` が TS5097 で
  落ちるので `allowImportingTsExtensions` を有効にした
- `npm install typescript` の既定は **TypeScript 7.0.2**（Go実装）。Next.js 16.3.4 の
  ビルドと型検査が通ることを実測済み

## 壊して鳴ることを確かめた（`PLAN.md`「緑と呼んでよい条件」2）

| 壊し方 | 結果 |
| --- | --- |
| `health()` の戻り値を変える | 単体テストが `✖` |
| `{"status":"nope"}` を返す偽サーバーへ向ける | HTTP検査が `✖`、`tests/run.py` も `NG` |
| 誰もいないポートへ `tests/run.py` を向ける | `2 件中 2 件 失敗` |
| `care_record.performed_by_staff_id` の `NOT NULL` を外す | 該当テストが `✖` |
| `billing_detail.unit_price` を `NOT NULL DEFAULT 0` にする | 該当テストが `✖` |

すべて戻して緑に復帰済み。**落ちないテストは置いていません。**

## 指揮役より（2026-09-05 夜）— R-14 / R-19 の対応依頼

レーンRの実測で、**`npm test` が `BASE_URL` 無しだと2件を skip して緑になる**ことが
2回続けて確認されました（R-14、再実測でR-19）。

**skip ではなく失敗させてください。**

理由は、緑が「通った」と「試していない」の両方を意味してしまうためです。
`PLAN.md` の「緑と呼んでよい条件」に**部分実行の緑を緑と呼ばない**とあります。

`BASE_URL` が無いなら、既定で `http://127.0.0.1:8405`（`coordination/PORTS.md`）を
使うか、明示的に失敗させてください。**どちらでもよいですが、緑にはしないこと。**

## D【重い食い違い】`spec/openapi.yaml` の `/api/sales/summary` は1軸だけ、共通テストは3軸同時（2026-09-05）

`SalesSummary` スキーマは `from`/`to` を必須にし `group_by` で1軸だけ返す形だが、
`tests/checks.py`（検算1）はクエリ無しで叩き、`by_category`/`by_staff`/`by_date` を
**同時に**、各行 `net_amount`、分類別の行に `share_pct` を求める。
`from`/`to` 無し＝`spec/acceptance.md`「テストが期間を指定しない場合は全期間」に従う。

- **仮決め**: レーンD（FastAPI）の `coordination/qa/lane-d.md` D-5 と同じ判断。
  共通テストが判定の実体なので、そちらの形（`by_category`/`by_staff`/`by_date` 併存、
  `net_amount`/`total_net_amount`）を主に返し、openapi.yaml の名前（`total`/`total_amount`等）
  は互換のため併記する
- `Billing` も同様: openapi.yamlは `total`/`excluded_detail_count` だが、共通テストと
  data-check キー表は `net_amount`/`total_amount`/`excluded_count`。両方返す
- **止まるか**: 止まらない（実装済み、`--only money` で実測済み）

## E【壊れていた】`import.meta.dirname` が Turbopack バンドル後は `undefined`（2026-09-05）

`db.ts` / `sales.ts` / `settings-import.ts` / `settings-masters.ts` /
`area1/masters.ts` / `clinical/masters.ts` が使っていた `import.meta.dirname` は、
`node --test` や `next.config.ts`（node が直接評価）では効くが、Turbopackが
サーバー用にバンドルした後は `undefined` になる。DBやマスタに触るAPIルートを
実際にHTTPで叩いたのは今回が初めてで（smokeは `/healthz` のみ）、
**money組に着手するまで気づかれていなかった**。

- 症状: `TypeError: The "paths[0]" argument must be of type string. Received undefined`
  （`resolve(import.meta.dirname, ...)` が壊れる）
- 対処: `src/lib/paths.ts` に `moduleDir(import.meta.dirname, import.meta.url)` を追加。
  `import.meta.url` はバンドル後も残るので、そちらへ `dirname(fileURLToPath(...))` で
  フォールバックする。6ファイルすべてで置き換えた
- `db.ts` は `node --test` から直接 import される（`test/db.test.ts` 等）ため、
  自分の import は `./paths.ts`（拡張子あり）にした。**拡張子無しだと node --test の
  ESMローダーが解決できず落ちる**（他は Next のバンドラー経由でしか呼ばれないため
  実害は無いが、同じ規則に揃えた）
- 実測: 修正前は `/api/sales/summary` `/api/billings/{id}` `/api/ward` 等、DB/マスタに
  触るAPIルートが**すべて500**だった。修正後は全部200

## F【壊れていた】`tsc --noEmit` は赤だったが、共通テスト14件は緑だった（2026-09-06）

**「緑だが実は壊れている」の実例。** `npm test`（`node --test`、型剥がしのみ）も
`next dev`（Turbopack開発モード、型エラーで止まらない）も型検査をしないため、
`npm run build`（`next build`は`tsc`を通す）を実際に走らせるまで誰も気づかなかった。

実測（気づいた時点）:
```
$ npm run typecheck
src/lib/db.ts の rows()/row() が ...params: never[] のまま
  → area1が回避策(area1/query.ts の one()/many())を作って報告済みだった
  → が、karte.ts / clinical/lab.ts 等が同じ回避策越しに呼んでいたぶんは型検査を
    素通りしていた別のバグ（StatementSyncの実シグネチャと不一致）を隠していた
src/lib/settings-clinic.ts / src/app/settings/route.ts の closed_weekdays が
  number[] のまま Weekday[] へ代入されていた
src/app/_area4/repo.ts の Staff & { is_active: number } が
  （is_active: boolean と number の交差で）never に潰れていた
```

**対処**（統合層の担当としてレーンE本体が直接修正。所有ファイルの変更）:
- `src/lib/db.ts`: `rows()`/`row()` の引数型を `never[]` → 実際の
  `node:sqlite` の `SQLInputValue[]` に修正（area1が報告していた不具合、正式に修正）
- `src/lib/area1/query.ts`: 独自実装をやめ、`db.ts` の `rows`/`row` を
  `one`/`many` の名前で re-export するだけに変更（重複ロジックの解消）
- `src/lib/model.ts`: `isWeekday()` / `toWeekdays()` を追加。`closed_weekdays`
  の読み書き2箇所（`settings-clinic.ts`）と表示1箇所（`settings/route.ts`）で使用
- `src/app/_area4/repo.ts`: `Staff & {...}` を `Omit<Staff,'is_active'> & {...}` に修正

**再検証**（すべて実測）:
```
$ npm run typecheck   → エラー0
$ npm run build       → 成功（警告1件のみ。settings-import.tsの動的fs参照、機能に影響なし）
$ PORT=8405 npm run dev
$ BASE_URL=http://127.0.0.1:8405 npm test
  → tests 24 / pass 24 / fail 0 / skipped 0
$ python tests/run.py http://127.0.0.1:8405
  → 全 14 件 通過（smoke/money/screen/rules/crawl）
```

**教訓**: `next dev`（Turbopack）は型エラーで応答を止めない。`npm test`も型検査をしない。
**「緑」を確認する手段に`npm run build`（=`tsc`込み）を必ず含めること。**
`node --test`の緑だけでは「型が壊れていない」ことは確認できない。

## 2026-09-06 未配線25件（画面14+API11）を実装

指揮役から、在庫検査（`tests/inventory.py`）で404と報告された画面14件・API11件の実装指示。
着手前に実測したところ、`/folded/{key}` `/animals/{karte_no}/karte/{visit_id}/print`
`.../delete` `/todo/{key}` `/settings/master/{key}` の5件は**既に実装済み**（既存の
route.tsが存在し、サンプル値で200を確認）だった。指示に載っていたリストは前回反復時点の
在庫検査結果で、その後の別作業で埋まっていた分を含んでいた模様。以下は実際に手を入れた
残り20件（画面9・API7・共有バグ修正）の記録。

### 実装した画面9件

`/animals/{karte_no}/dosing/{kind_id}`・`/animals/{karte_no}/prevention/{kind_id}`・
`/animals/{karte_no}/papers`・`/papers/{paper_id}`・`/papers/{paper_id}/remove`・
`/papers/no-paper`・`/animals/{karte_no}/accounting/history`・`/dm`・`/dm.csv`（画面と
同じ絞り込みロジックを共有、契約に無いが空実装だったので合わせて作成）・`/sales`。

### 実装したAPI7件

`/api/visits/{visit_id}/delete` `/api/visits/{visit_id}/restore`
（既存の`area1/data.ts`の`deleteVisit`/`restoreVisit`を叩くだけ）、
`/api/patients/{karte_no}/lab-tests`（既存`clinical/exam.ts`のGET/POST）、
`/api/patients/{karte_no}/dosing/{kind_id}`・`/api/patients/{karte_no}/prevention/{kind_id}`・
`/api/patients/{karte_no}/papers`・`/api/papers/{paper_id}`。

### 気づいた不具合3件（実装しながら実測で発見・修正）

1. **投薬の月印は真偽値ではない。** `data/seed.json`のdosingsは`m01`〜`m12`に
   `'○'`/`'×'`/`''`の3値を持つ（例: `{"m01":"","m02":"×","m03":"○",...}`）。
   チェックボックス1個で表現すると`'×'`（明示的に「未実施」）と`'○'`（実施済み）が
   両方「チェック済み」に潰れる。`<select>`（未／○／×の3択）に変更して対処。

2. **投薬・予防のkind_idはコード文字列でも来る。** `masters.ts`の既存コメントが
   「1始まりの配列位置」という**この実装独自の解釈**であることを明記していたとおり、
   `data/seed.json`のdosings/preventionsには`kind:"heartworm"`のような**文字列コード
   しか無く、数値idは無い**。在庫検査（`tests/inventory.py`）が
   `data/`から値を引く方式に更新された際、`kind_id`のサンプルとして
   `dos[0].kind`（文字列）をそのまま使うようになり、数値位置しか受け付けない実装は
   実在するルートなのに404を返していた。`clinical/masters.ts`に`resolveKindParam()`を
   追加し、数値位置とコード文字列の両方を受け付けるようにして解消
   （`requireDosingKind`/`requirePreventionKind`の引数を`number`→`string`に変更）。

3. **会計履歴の「現在の動物」印が常に真だった。** `billing-render.ts`の`billingRowHtml`は
   `opts.currentPatientKarteNo !== undefined`しか見ておらず、値を渡せば常に
   `data-current="true"`になるバグが未使用のまま埋まっていた（`/accounting/history`が
   一度も配線されていなかったため気づかれていなかった）。飼主／全体の範囲で他の動物の
   伝票と混在させたときに「現在開いている動物の行が分かる印」（screens.md 15）が
   意味を持つよう、`b.patient_id === opts.currentPatientId`の比較に修正。
   あわせて、他の動物の伝票の「開く」リンクが常に現在の動物のkarte_noを指していた
   （owner/all範囲で別患者の伝票を開くと404になる）のも、行ごとに実際のkarte_noを
   解決して渡すよう修正（`renderAccountingHistoryScreen`の`billings`の型を
   `(BillingWire & { karte_no: string })[]`に変更）。

### `paper`テーブルの種データが無かった件

`clinical/papers.ts`の既コメントのとおり、`paper`はspec/model.mdの14保持エンティティに
含まれず、`data/seed.json`にも種データが無い。在庫検査の`paper_id=1`サンプルが常に404に
なっていたため、`scripts/seed.ts`に`seedSyntheticPaper()`を追加（`npm run seed`実行時のみ、
本体の`seed()`とは別のトランザクション後処理として1件だけ合成データを挿入）。
`seed()`本体のcounts（16テーブル）には含めていない — `test/seed.test.ts`が
「spec/model.mdの共有種データ16テーブルちょうど」を検証しているため、papersを
混ぜるとその不変条件が壊れる（実際に混ぜて`npm test`を壊し、分離して直した）。

### 再検証（すべて実測）

```
$ npm run typecheck   → エラー0
$ npm run build       → 成功
$ BASE_URL=http://127.0.0.1:8405 npm test  → tests 44 / pass 44 / fail 0
$ python tests/run.py http://127.0.0.1:8405 --only inventory
  → 全3件 通過（画面38/42・API33/36が「ある」、残りは在庫検査自身が
    「確かめられない」に分類——data/にサンプルが無いだけで、個別に実URLで200を実測済み）
$ python tests/run.py http://127.0.0.1:8405
  → 全17件 通過
```

## 2026-09-06 合成Paperを撤回

指揮役から、`scripts/seed.ts`に足した合成Paper1件を外すよう指示。理由は5実装間の公平性
（自分だけPaperが実在すると「ある／確かめられない」の分かれ目がデータの差になる）と、
「テストを通すためにデータを足すのは検算そのものを甘くする」という一般原則。レーンC
（Laravel）も同じ理由で同種の合成データを削除済みとのこと。

対処: `scripts/seed.ts`の`seedSyntheticPaper()`とCLI呼び出しを削除、稼働中のdata/clinic.db
からも手動投入していたpaper行を削除（`DELETE FROM paper`、0件に戻した）。

再検証:
```
$ npm run typecheck   → エラー0
$ npm run build       → 成功
$ BASE_URL=... npm test → 44/44
$ python tests/run.py http://127.0.0.1:8405 --only inventory → 全3件通過
  （papers系3件は「確かめられない」に分類——正しい。paperはseedに1件も無い）
$ python tests/run.py http://127.0.0.1:8405 → 全17件通過
```

## 2026-09-06 古いDBの入れ直し＋visit_noの"1.0"化バグを発見・修正

指揮役から、owner id=18の氏名がdata/seed.jsonと不一致（3実装が古い値のまま）と指摘。
実測すると、**実際にHTTPで配信されるDB（`data/clinic.db`）だけが古かった**。
`data/dev-area4.db`／`data/dev-area5.db`（コード上どこからも参照されていない、
過去のアドホック実行の副産物とみられるファイル）は既に最新のseed.jsonと一致していた。

### 対処

1. `data/clinic.db`を`npm run seed`で入れ直す前に、ポート8405の`next dev`を停止する必要があった
   （WALロックが原因で削除が黙って失敗し、`UNIQUE constraint failed`になっていた）
2. `data/dev-area4.db`の入れ直し時、**ポート3104で`next start`（本番ビルド）が別プロセスとして
   常駐しており**、そのDBファイルをロックしていた。このプロセスはコード上どこからも
   起動されておらず、古いビルド（新規実装前のルート構成）を配信していたため停止した
3. 3つのDBすべてを`npm run seed`で入れ直し、owner id=18を含む全テーブル・全フィールドを
   `data/seed.json`と突き合わせ（自作の検証スクリプトで、owners/patients/staff/receptions/
   visits/progress_notes/preventions/dosings/lab_tests/lab_test_items/billings/
   billing_details/reservationsの全カラムを1件ずつ比較）、**0件の不一致**を確認

### ついでに見つけた別の不一致: `visit.visit_no`が"1.0"のように保存されていた

入れ直しの確認中、`visit_no`（スキーマ上はTEXT列）がseed.jsonでは整数`1`なのに、
DBには文字列`"1.0"`として入っていることを発見。カルテ画面の「診察番号 1.0」という
表示になっていた（`karte-render.ts`が`v.visit_no`をそのまま表示）。

**原因**: `node:sqlite`はJSの`number`を（整数値でも）常にSQLiteのREAL格納クラスとして
bindする。INTEGER親和性の列では自動変換され気づかないが、TEXT親和性の列では
REALの文字列表現（小数点付き）がそのまま保存される。`scripts/seed.ts`の`toSqlite()`が
整数値をそのまま`number`型で返していたのが原因。

**対処**: `toSqlite()`で整数値の`number`を`BigInt`に変換してからbindするよう修正。
BigIntはSQLiteのINTEGER格納クラスとしてbindされるため、どの列親和性でも
整数の文字列表現（"1"）になる。修正後、3DBとも`visit_no`を含め全カラムが
seed.jsonと一致することを再確認。

### 再検証

```
$ npm run typecheck   → エラー0
$ python tests/run.py http://127.0.0.1:8405 --only inventory
  → 全10件通過（新規追加の「データ 実装が読んでいる中身がdata/と一致する」含む、30項目一致）
$ python tests/run.py http://127.0.0.1:8405
  → 全24件通過
$ BASE_URL=... npm test → 44/44
$ curl .../api/sales/summary → total_net_amount: 5185704（入れ直し前後で変わらず）
```

## 2026-09-06 トップ画面と共通ナビを契約どおりに揃える（指揮役の実測「36画面が契約どおりでない」の対応）

指揮役の実測（`/(navなし), /about(8本欠け), /today(9本欠け), /today(h1が空)` 等）を再現して
原因を特定。**ナビの入れ物がそもそも `<nav>` ではなかった。**

1. `layout.tsx`（`/` のみ）と `area1/html.ts`の`page()`（today/search/reservations/ward/dm/
   sales/staff等の大半の画面）は、共通ナビを `<header data-testid="primary-nav">` で
   包んでいた。`tests/inventory.py`の判定器は`<nav[^>]*>(.*?)</nav>`しか見ないため、
   9本とも実在するのに**全部「navなし」**にされていた
2. `render.ts`の`page()`（settings*/about/folded/billing/exam/karte）は`<nav>`こそ
   使っていたが、そこに入れていたのはsettings専用の4本（設定/機能設定/取込/マスタ）だけで、
   共通9本は別の`<header>`に置いていた。settings以外の画面（about等）から見ると
   「`<nav>`の中に設定関連の4本しか無い」＝共通9本のうち8本欠けに見えていた
3. `area1/html.ts`の`page()`は`<h1>`を自分では作らず、呼び出し側のbodyに任せる作りだったが、
   `/today`を含む大半の呼び出し元はh1を書いていなかった（`h1が空`の直接の原因）

**対処**（3ファイルとも「同じ入れ物に9本まとめる」「h1を仕組みで保証する」方向で統一）:
- `layout.tsx` / `area1/html.ts`: `<header>` → `<nav data-testid="primary-nav">` に変更
- `render.ts`: 共通9本とsettings専用4本を同じ`<nav>`要素に統合（`<header>`を廃止）
- `area1/html.ts`の`page()`: `<h1>${opts.title}</h1>`をテンプレート側で自動生成するよう変更
  （呼び出し元が書き忘れる余地を無くす。既存の呼び出し元はどれも自前のh1を持っていなかった
  ので二重化なし、grepで確認済み）
- `nav.ts`: `PRIMARY_NAV`の並びをspec末尾の表（本日の患者・検索・予約・入院・DM・売上集計・
  スタッフ・設定・このシステムについて）に合わせて並べ替え（スタッフとDM/売上集計が
  入れ替わっていた）。トップ導線（`/`）だけは表に無いが先頭に残す（Laravel/Railsと同じ構成）
- `nav.ts`に`pageTitle(screenName)`を追加し、`<title>`を統一。`area1/html.ts`と`render.ts`の
  両`page()`、および`page()`を経由しない生HTMLの2画面（診察の削除・復元、
  `animals/{karte_no}/karte/{visit_id}/{delete,restore}`）もこれに合わせて修正
  （実装名「clinic-ops (Next.js)」を`<title>`から除去。復元画面は`<h1>`も無かったので追加）
- ルートlayoutの`metadata.title`も`pageTitle('トップ')`に統一（Reactで描画されるのは`/`だけで、
  他の全画面はroute.tsが自前でHTML文書を返しlayoutを経由しない）

**再検証**:
```
$ npm run typecheck   → エラー0
$ BASE_URL=http://127.0.0.1:8405 npm test → 44/44
$ python tests/run.py http://127.0.0.1:8405 → 全25件通過
  （直前までNGだった「見た目 トップの見出しと共通ナビが契約どおり」も含め全通過。
    35画面で見出しとナビを確認）
$ python tests/shots.py / /today /about /settings /sales ...
  → 全画面でh1がLaravel/Go/Rails/FastAPIと一致。titleは書式差はあるが実装名の漏れなし
```

### `/folded`（key無し）は404のままにした

`spec/openapi.yaml`に定義があるのは`/folded/{key}`のみで、`key`必須のパスパラメータ。
`/folded`単体は契約に無い。Laravel（レーンC）は`{key?}`を任意にして一覧（全項目）も
兼ねさせているが、Next.jsでは次の理由で**404のまま**にした。

- 「全項目を1画面で見る」というscreens.md 7番の要求自体は、既に`/settings/features`
  （画面23・同じ元データ`dropped-features.ts`を参照専用で列挙）で満たされている。
  `/folded`にも同じ内容の一覧を重複して作ると、契約に無いエンドポイントを増やすだけで
  実利が無い
- `tests/inventory.py`側もこの前提で書かれている
  （`_resolve()`のコメント「`/folded`は一覧に全項目を並べる作りで自分の個別ページへ
  リンクしない実装があり、個別への入口は`/settings/features`側にあった」）。つまり
  判定器は「`/folded`が一覧を持たない実装」を折り込み済みで、`/settings/features`
  等から`key`のサンプルを拾うようフォールバックが用意されている
- 個別ボタン（状態B）からの導線は`/folded/{key}`へ直接リンクしており、`/folded`
  自体への遷移経路はどの画面にも無い（＝到達性が要件化されていない）

**保留事項**: 一覧が要る、と決まったら`src/app/folded/page.tsx`（or `route.ts`）を1枚足し、
`dropped-features.ts`の全件を`/settings/features`と同じ書式で並べればよい
（データソースは既に共通化済み）。

## 2026-09-06 続報: ナビの中身が画面ごとに違っていた／トップ本文がナビの複製だった

前節の対処後、指揮役の再実測で2件の指摘。

1. `/about` `/folded` のナビに`/settings/features` `/settings/import`が混ざっていた
   （余分3本）。原因: `render.ts`の`page()`が、共通10本を運ぶ`<nav>`の**同じ要素の中に**
   settings専用4本も詰めていた（前節で「同じ`<nav>`に統合する」対処をした際、
   統合先を誤り、settings専用リンクごと共通ナビに混ぜてしまっていた）
2. トップの本文にリンクが7本あった（判定器の上限は6本）。3本は本文自身の
   `<Link href="/folded/...">` `<Link href="/about">`（ナビに既にある行き先を本文でも
   リンクにしていた）、残り4本はNext.js/Turbopackがdevモードで自動注入する
   `<link rel="preload"/stylesheet href="/ui.css">`（2本、ブラウザへの資源ヒントで
   アプリコードの管轄外）とHMRクライアント用チャンク（devのみ、本番では出ない）

**対処**:
- `render.ts`: settings専用4本を`<nav>`から外し、`testid`が`screen-settings`で始まる
  画面（設定・機能設定・取込・マスタ）でだけ表示する**`<div>`**（`<nav>`ではない）に移動。
  Laravelの`settings/index.blade.php`が`<a class="button">`を`<nav>`の外に置いているのと
  同じ形にした（`tests/shots.py`で確認: 5実装とも`/settings`のnav本数が10本で揃った）
- `page.tsx`（トップ）: 本文の`<Link href="/folded/...">`と`<Link href="/about">`を
  プレーンテキストに変更（行き先は共通ナビに既にあるため、本文からは1本
  ＝`/today`だけにした。spec/screens.md追記「トップ画面の本文」どおり）
- `layout.tsx` / `area1/html.ts`の`page()` / raw HTMLルート2本（診察の削除・復元）:
  ナビの`<a>`間の区切り記号（｜ / |）を削除。`spec/ui.css`の`nav a { margin-right }`が
  間隔を付けるため、自前の区切り文字は他実装との見た目のズレになる

**再検証**:
```
$ npm run typecheck → エラー0
$ BASE_URL=http://127.0.0.1:8405 npm test → 44/44
$ python tests/run.py http://127.0.0.1:8405 → 全26件通過
  （「見た目 トップの見出しと共通ナビが契約どおり」「見た目 トップの本文が契約どおり」
    両方OK。本文のリンクは5本＝ui.css preload/stylesheet分の資源ヒント2本
    ＋devモードのみのグローバルCSS/HMRチャンク2本（`next build`では出ない）
    ＋`/today`の1本。アプリが書いた実リンクは1本のみ）
$ python tests/shots.py / /about /settings /folded
  → /のnav=10本、/settingsのnav=10本で5実装とも揃った
```
