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
