# レーンD の進捗

**担当**: Python / FastAPI ／ 所有ディレクトリ `stacks/fastapi/`

---

## 2026-09-05 土台ができた（契約が凍る前の作業・完了）

`briefs/lane-d.md`「いまやること」の5項目、**すべて済み**。
**画面はまだ1枚も作っていない**（契約が凍る前に作ると作り直しになるため）。

| # | やること | 状態 | 実測 |
| --- | --- | --- | --- |
| 1 | 雛形を作る | 済 | `app/` `tests/` `run.py` |
| 2 | 依存を入れる（リポジトリ内に閉じる） | 済 | `.venv/` に9件。**cp314 のホイールで全部入った** |
| 3 | テストが走る形にする | 済 | `pytest` が **5件 緑** |
| 4 | `GET /health` | 済 | **実HTTPで `{"status":"ok"}` を確認**（TestClient だけで済ませていない） |
| 5 | 題材を読む | 済 | `題材のシステムdocs/実装分担-2026-09-05.md`。**読むだけ。当該リポジトリは一切変更していない** |

### 使ったもの（実測 2026-09-05）

Python 3.14.3 / FastAPI 0.141.1 / Starlette 1.6.0 / Pydantic 2.13.5 /
SQLAlchemy 2.0.52 / Jinja2 3.1.6 / uvicorn 0.52.4 / pytest 9.1.1

**新しい実行環境は入れていない**（中止条件3に当たらない）。すべて `stacks/fastapi/.venv/` の中。

### 土台の作り

| 場所 | 中身 |
| --- | --- |
| `app/config.py` | 設定と **JST**。`CLINIC_DB_URL` で差し替え可 |
| `app/db.py` | SQLite + SQLAlchemy 2.0。**モデルはまだ置いていない**（契約待ち） |
| `app/main.py` | `create_app()`。**統合点なのでレーン本体が持つ**。領域ルーターは契約後に足す |
| `app/templates/base.html` | 全画面の骨だけ。中身は空 |
| `tests/` | レーンD自身のテスト5件 |

---

## 踏んだもの（他レーンにも起きうるので書き残す）

### 1. Windows に OS のタイムゾーンDBが無い ← いちばん効く

`ZoneInfo("Asia/Tokyo")` が **`ZoneInfoNotFoundError` で落ちた**。`tzdata` を入れて解決。

これを書き残す理由は、**契約が「日付・時刻は JST。集計の月境界も JST」と決めている**こと。
土台に入れておかないと、**集計を実装した時点で初めて落ちる**。
土台の不足が業務の不具合の顔をして出てくる形になる。

### 2. SQLite は既定で外部キーを見ない

接続ごとに `PRAGMA foreign_keys=ON` を打つようにした。
切れていると、**存在しない飼主IDを持つ動物がエラー無しで保存できる**。

### 3. starlette 1.6 の TestClient は `httpx` を非推奨にした

`httpx2` へ切り替え。切り替え後に `httpx` を**アンインストールして緑を確認**したので、
`requirements.txt` だけで再現できることは実測済み。

---

## 見張りを壊して、落ちることを確かめた

`PLAN.md`「緑と呼んでよい条件」2 に従い、**わざと壊して鳴ることを確認**（2026-09-05）。

| 壊し方 | 結果 |
| --- | --- |
| `JST` を `UTC` にする | 2件 FAILED ✓ |
| 設定をキャッシュするようにする | 1件 FAILED ✓ |
| `PRAGMA foreign_keys=ON` を外す | 1件 FAILED ✓ |

**復旧後に全体を流して 5件 緑**（部分実行の緑を緑と呼ばない）。

---

## やらかし（隠さず書く）— プロセスの止め方が広すぎた

開発サーバーを止めるのに、PowerShell で **`python.exe` かつコマンドラインに
`uvicorn` または `app.main:app` を含むもの**という条件で kill した（2026-09-05 17:51頃）。

**2つのPIDが該当した。私が起動したのは1つだけである。**

- 題材の 題材のシステム も **FastAPI で `uvicorn app.main:app`** を使う（実測で確認）。
  条件が一致するので、**題材側の開発サーバーを巻き込んだ可能性がある**
- プロセスは消えているので、**2つ目が何だったかは確かめられない。未確認である**
- 現在 python のプロセスは 0。このリポジトリの5レーンには影響していない
  （A=Go / B=Ruby / C=PHP / E=Node。python を使うのはレーンDだけ）

**再発防止**: 以後、自分で起動したサーバーは **PIDを控えてそのPIDだけを止める**。
名前やコマンドラインの一致で止めない。**同じ機械で他の仕事が動いている**前提で書く。

---

## 仮決めしたこと（`qa/lane-d.md` に記録済み）

1. 開発ポートを **8004** にした（`PORT` で変更可）
2. DB は **SQLite ファイル**（`CLINIC_DB_URL` で差し替え可）
3. **`tzdata` を依存に追加**した

## 指揮役へ（止まってはいない。契約を凍らせるときに見てほしい）

### 画面数が 24 と 26 で食い違っている

- `briefs/lane-d.md` は「**全24画面**」、`PLAN.md` と `spec/README.md` は「**26画面**」
- レーンDの領域表には **売上集計（新）** と **予約（新）** が入っていないが、
  `PLAN.md` の領域表には入っている
- **仮決めして 26画面 で進む**（`PLAN.md` が計画の正本と書かれているため）。
  `spec/screens.md` で確定させてほしい

### 共通テストが各レーンをどう起動するか

`run.py` で立ち、`GET /health` が `{"status":"ok"}` を返す形にしてある。
DBは `CLINIC_DB_URL` で差し替え可。**起動の作法が契約側で決まるなら、そちらに合わせる**。

---

## 2026-09-05（続報）共通テスト smoke 2件、緑を実測

指揮役の指示: 「まず smoke 組（13件中2件）だけを緑にする」。

### やったこと

1. `coordination/PORTS.md` を確認 — レーンDは **8404**（前回の仮決め 8004 から変更）
2. `run.py` の既定ポートを **8004 → 8404** に修正（`PORT` 環境変数での上書きは従来通り可）
3. `/healthz` は前回セッションで契約通り実装済み（`/health` ではない。上の「仮決め」節は
   その修正前の古い記述だったので、ここで訂正する。実体は `app/routers/health.py` の通り）
4. `.venv/Scripts/python.exe run.py` で起動 → `curl http://127.0.0.1:8404/healthz` が
   `{"status":"ok"}` を実測
5. `python tests/run.py http://127.0.0.1:8404 --only smoke` を実行

```
── smoke ──

  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 12ms

全 2 件 通過
```

### 起動コマンド（次回そのまま使える）

```
cd stacks/fastapi
./.venv/Scripts/python.exe run.py
```

環境変数無しで **8404** に立つ。`CLINIC_DB_URL` でDB差し替え可。

## いまの状態

**smoke 2件、緑を確認済み。** 次の指示（領域ごとの実装）を待っている。

`spec/screens.md` と `spec/acceptance.md` はまだ読んでいない（指示通り、次段階まで温存）。

## 2026-09-05（続報2）money 組 4件、緑を実測（ポート8404は要調整）

指揮役の指示: 「money 組の4件を緑にする」。

### やったこと

1. `app/routers/billing.py` を新規作成 — `GET /api/billings/{id}`。
   金額計算は既存の `app/billing_calc.py`（前回セッションで作成済み）をそのまま使う
2. `app/routers/sales.py` を新規作成 — `GET /api/sales/summary`。
   `spec/acceptance.md`「検算1」の定義（対象=confirmedのみ／担当は staff_id／
   構成比は最大剰余法）どおりに集計
3. `app/main.py` にこの2ルーターを登録
4. `spec/openapi.yaml` と `tests/checks.py` のフィールド名の食い違いを見つけ、
   `coordination/qa/lane-d.md` D-5 に記録（共通テストが読む名前を主に、
   openapi.yaml 側の名前も併記する形にした）

### 実測（`PORT=8494` で確認。理由は下記D-6）

```
── money ──

  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250
  OK  検算2 この規則を、いまのデータで確かめられているか（検算そのものの点検）

全 5 件 通過
── smoke ──
全 2 件 通過
```

### D-6：ポート8404が私のセッションから見えないプロセスに掴まれている

`qa/lane-d.md` D-6 に詳細。`bind()` は失敗するのに `curl` は応答する
（何か動いてはいるが、PIDを引いてもプロセスが見つからない）。
自分が起動した経緯を追えるものは全部止めたが消えない。**指揮役側の判断・対応を待つ**
（`qa/lane-d.md` に書いて先に進んだ。コードは `PORT=8494` で検証済みなので、
実装自体は待っていない）。

## いまの状態

**money 組（検算1・2）4件、コード上は緑を実測済み（8494）。**
8404 が空けば同じコードでそのまま緑になるはず。次の指示を待っている。

## 2026-09-05（続報3）screen 組 3件、緑を実測（ポート8414）

指揮役の指示: 「screen 組の3件を緑にする」。ポートは指揮役の振り直しで **8414** に変更
（`run.py` の既定値も8414に修正済み）。

### やったこと

1. `app/routers/karte.py`（新規）: `GET /animals/{karte_no}/karte` と
   `.../karte/print`。表示のみ（保存・新規診察・前回コピー等は次段階）
2. `app/templates/clinical/_visit_macro.html`（新規）: 1診察ぶんの描画を
   画面・印刷の**両方から呼ぶ共通マクロ**にした。別テンプレートに書き写すと
   検算4（画面と印刷の食い違い）の再発リスクになるため
3. `app/templates/clinical/karte.html` / `karte_print.html`（新規）: 上のマクロを使うだけ
4. `app/routers/lab.py`（新規）: `GET /api/lab-tests/{id}`。判定は
   `spec/acceptance.md`「検算5」の規則（`min ≦ value ≦ max` は範囲内、両端含む）どおり
5. `app/main.py` にこの2ルーターを登録
6. `openapi.yaml` の `LabTestItem.judgement`（英）と共通テストが読む `judgment`（米）の
   食い違いを見つけ `qa/lane-d.md` D-7に記録（D-5と同じ構図。両方返す形にした）

### 実測（`PORT=8414`）

```
── screen ──

  OK  検算3 体温が全患者で同じ値になっていない  — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る  — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致

全 3 件 通過
```

smoke・money も同じ8414で再確認済み（smoke 2件・money 5件、いずれも緑）。

### 起動コマンド（次に指揮役が使えるように）

```
cd stacks/fastapi
./.venv/Scripts/python.exe run.py
```

環境変数無しで **8414** に立つ（`run.py` の既定値を修正済み）。

## いまの状態

**smoke・money・screen、合計10件すべて緑。** 次の指示を待っている。
`spec/screens.md` の他領域・保存系の実装はまだ手をつけていない。

## 2026-09-06 rules組 3件 緑。crawl はjudge側の疑いあり（D-8）。ポートは暫定8415

指揮役の指示: 「rules・crawl の残り3件（検算6・7・8）を緑にする」。

### やったこと

1. `app/routers/reservations.py`（新規）: `GET/POST /api/reservations`（重複時409
   `reservation_conflict`）・`GET/PATCH /api/reservations/{id}`・
   `POST /api/reservations/{id}/cancel`。半開区間での重なり判定（担当・処置室の両方）。
   画面 `/reservations`（一覧表示のみ）
2. `app/routers/ward.py`（新規）: `GET /api/hospitalizations/{id}`・
   `GET/POST /api/hospitalizations/{id}/care-records`（実施者必須。無いと422、
   退院済みの入院には追加不可）。画面 `/ward`
3. `app/routers/front.py`（新規）: `/`（`/today`と同じ）・`/search`・`/dm`・`/sales`・
   `/staff`・`/settings`・`/about`。すべてDBから実データを読む表示専用画面
   （保存系は次段階）
4. `app/routers/sales.py`: 集計本体を `compute_summary()` として切り出し、
   API と `/sales` 画面の両方が同じ関数を呼ぶようにした（画面と印刷を共有マクロに
   したのと同じ考え方）
5. `app/main.py` に3ルーターを登録

### 実測（`PORT=8415`。理由は下記）

```
── rules ──

  OK  検算6 予約が担当・処置室のどちらでも重ならない  — 60 件で重なり0
  OK  検算7 入院の記録行に実施者が必ず入っている  — 108 件中 実施者なし 0 件
  OK  検算9 削除済みは一覧から消えるが件数には残る  — 一覧から消えても集計に残る

全 3 件 通過
```

検算9は指示に無かったが `rules` 組に含まれており、既存の設計（`deleted_at IS NULL`で
絞る一覧クエリと、絞らない集計クエリを最初から分けてある）で追加実装なしに緑だった。

### crawl（検算8）: `qa/lane-d.md` D-8 参照。判定側の疑いを指揮役へ報告済み

`tests/checks.py` の `_dead_links` が `headers.get("Content-Type")` を大文字小文字
そのままで引いており、FastAPI/uvicornが返す小文字の `content-type` と噛み合わない。
結果、トップページからリンクを1件も抽出できず「1画面しか辿れない」で不合格になる。
`curl` で直接HTMLを見るとリンクは正しく10個出ている。**自分の実装ではなく判定側の
疑いが強い**（大文字小文字を無視すべきはHTTPヘッダの仕様）。指揮役の確認待ち。

### D-9: ポート8414でまた「握ったまま死んだソケット」（暫定的に8415を使用）

`Stop-Process -Force` でreloaderを止めた直後に発生。強制終了がソケットの後始末を
妨げている可能性を疑っている（`qa/lane-d.md` D-6と同じ現象の再発）。
指揮役へ報告済み。以後、可能な限り `-Force` を避けて様子を見る。

## いまの状態

**rules組（検算6・7・9）緑。crawl（検算8）は判定側の疑いを報告し、指揮役の確認待ち。**
画面自体（`/` `/today` `/search` `/reservations` `/ward` `/dm` `/sales` `/staff`
`/settings` `/about`）は直接叩けば全部200。ヘッダの件が直ればcrawlも緑になる見込み。

## 2026-09-06（続報）14件全部緑。ポート問題の正体が判明（D-9訂正）

指揮役の指示どおり `./.venv/Scripts/python.exe run.py`（既定8414）で再検証。

### ポート8404/8414の「死んだソケット」の正体（`qa/lane-d.md` D-9訂正）

**孤児プロセスだった。** `Stop-Process` で reloader（親）だけ止めていたため、
multiprocessing の worker（子）が生き残ってソケットを掴み続けていた。
`Get-CimInstance Win32_Process | Where CommandLine -like '*multiprocessing.spawn*'`
で親が存在しない子を洗い出して個別に止めたところ、8404・8414とも
`socket.bind()` が通るようになった。以後、reloaderを止めるときは子も一緒に止める。

### 実測（`PORT`未指定＝8414）

```
── smoke ──
  OK ×2
── money ──
  OK ×5
── screen ──
  OK ×3
── rules ──
  OK ×3
── crawl ──
  OK  検算8 画面から辿れるリンクが全部生きている  — 60 画面を辿って切れなし

全 14 件 通過
```

**共通テスト14件、すべて緑。**

### 起動コマンド

```
cd stacks/fastapi
./.venv/Scripts/python.exe run.py
```
環境変数無しで8414に立つ。

## いまの状態

**14件全部緑。** 次の指示を待っている。screens.md の保存系操作（カルテ保存・
受付の並べ替え・設定編集等）はまだ未着手。

## 2026-09-06（続き）設定の保存を実装。サブエージェント5体は起動直後にセッション上限で失敗

前回、領域ごとにサブエージェント5体（受付・診療・会計・入院予約・設定）を並列起動したが、
**全員が起動直後に「セッション上限（11:20pm JSTにリセット）」で失敗した**。
ディスク上には既にA〜D領域の読み取り系実装（`front.py` `karte.py` `lab.py` `billing.py`
`sales.py` `reservations.py` `ward.py`）が存在しており、共通テスト14件は実測で全緑
（自分で `tests/run.py` を実行して確認。自己申告のみに頼っていない）。
これはサブエージェント失敗以前の実装であり、失敗した5体の成果ではない。

### やったこと（このセッションで直接）

- `/settings` に **POST**（保存）を追加。`Clinic` は常に1件のみという前提を守り、
  `application/x-www-form-urlencoded` で受け、保存の成否によらず200で再描画
  （`spec/openapi.yaml` の `ClinicForm` の契約どおり）
- 休診日（複数チェックボックス）・消費税率・予約枠等を保存し、再読み込みで
  選んだ内容がそのまま戻ることを実機で確認（`curl` で往復させて実測）
- 保存後に共通テスト14件を再実行し、**退行が無いことを確認**

### まだ手を付けていないもの（screens.md の「できること」表のうち未実装）

書き込み系の大半がまだ残っている。共通テスト14件（検算1〜9・smoke・crawl）は
現状すべて緑だが、これは**契約の全部を検証してはいない**
（`spec/screens.md` の個々の「満たすべきこと」まではカバーしていない項目がある）。

| 領域 | 残っている「できること」 |
| --- | --- |
| 1 受付・患者 | 上へ/下へ（並べ替え）・完了表示切替・新規登録・顧客の編集/削除/番号変更/診察券発行/文書印刷・来院履歴の元に戻す・削除画面（理由必須）・折りたたみ表示 |
| 2 診療 | カルテの保存/新規診察/前回コピー/取消、検査の新規作成、投薬のチェック保存、予防の記録保存、書類（PDF取込） |
| 3 会計・売上 | 会計の明細追加/複写/削除/全削除/確定、DMのCSV書き出し |
| 4 入院・予約・業務 | 入院のケア記録追加・退院、予約の新規作成画面（APIはreservations.pyに実装済みだがフォームが無い）、ToDo画面（`/todo/{key}`） |
| 5 設定 | 機能設定・取込・マスタ（読むだけの3画面。まだ手を付けていない） |

**サブエージェントは今夜11:20pm(JST)まで新規に起動できない**（全員が同じ上限に達しているため）。
それまではこのセッションで直接、優先度の高いものから実装を続ける。

## 2026-09-06（再開）配線の続き。設定の残り3画面と会計の書き込み系を実装

指揮役の指示（ポート8415固定、サーバ再起動不要、統括が横並び再測を実施済み）を受けて再開。

### 横並び再測（`coordination/review/2026-09-06_統括_横並び再測.md`）の結果

**レーンDは食い違い3件のどれにも該当しない。** 全レーン中、指摘を受けなかったのは
レーンDだけ（B=Railsが2件、E=Next.jsが1件）。

### やったこと

1. `app/feature_notes.py`（新規）— `model.md`「落としたもの」表（**14件**。前回「10件」と
   書いたのは数え間違いだったので訂正）と、あえて動かさないボタン3件（一時保存／
   完了全削除／完了削除）のデータを1か所に集約
2. `app/routers/refdata.py`（新規）— `/todo/{key}` `/folded/{key}` `/settings/features`
   `/settings/master` `/settings/master/{key}` `/settings/import`（GET/POST）と対応する
   API（`/api/todo/{key}` `/api/features` `/api/masters/{key}`）を実装。マスタ・取込は
   契約どおり**参照専用**（編集フォームを一切置いていない）
3. `app/routers/accounting.py`（新規）— 会計画面（`GET/POST /animals/{karte_no}/accounting`）
   と会計履歴（`GET .../accounting/history`）。明細の追加・複写・削除・全削除・確定を実装。
   金額計算は既存の `app/billing_calc.py` をそのまま呼ぶ（独自計算をしない）
4. `tests/test_accounting.py`（レーン自身の手元テスト、4件）— 確定後の書き込み拒否・
   空伝票の確定拒否・単価未設定行の除外を実機（TestClient）で確認。**全件緑**
5. `app/main.py` に `refdata` `accounting` の2ルーターを登録
6. `qa/lane-d.md` D-10（todo/foldedのkey語彙を仮決め）・D-11（`KartePdf` が
   「落としたもの」表とscreens.md 13番「書類」で食い違っている疑い）を記録

### 確認したこと

- `.venv\Scripts\python -m pytest`: **16件、全緑**（新規4件を含む）
- **8415で稼働中のサーバは `--reload` 無しで起動されている**（プロセスのコマンドラインで
  確認済み）。今回追加したルート（`/todo` `/folded` `/settings/features`
  `/settings/master` `/settings/import` `/animals/{karte_no}/accounting` 系）は
  **サーバを再起動しないと反映されない**。指示どおり自分では再起動していない
- 共通テスト14件は今回のコード変更前に実測した状態（前回セッション）から変わっていない
  はずだが、**再起動後に統括側で再確認をお願いしたい**

### 残っている「できること」（screens.md より）

| 領域 | 残り |
| --- | --- |
| 1 受付・患者 | 上へ/下へ（並べ替え）・完了表示切替・新規登録・顧客の編集/削除/番号変更/診察券発行/文書印刷・来院履歴の元に戻す・削除画面（理由必須） |
| 2 診療 | カルテの保存/新規診察/前回コピー/取消、検査の新規作成、投薬のチェック保存、予防の記録保存、書類（PDF取込。D-11参照） |
| 3 会計・売上 | DMのCSV書き出し（`/dm.csv`） |
| 4 入院・予約・業務 | 入院のケア記録追加・退院フォーム、予約の新規作成フォーム（APIは実装済み） |

## いまの状態

**待機中。** 手元のpytestは16件全緑。共通テストはサーバ再起動後に統括側で確認をお願いしたい。
次の指示（または続けての実装許可）を待つ。

## 2026-09-06 自己点検（ユーザー指示）: 「本当に終わったか」を実測で確認

**結論: 終わっていない。** 共通テスト14件が緑なのは事実だが、それは契約
（`spec/openapi.yaml`）が定義する画面・APIの**一部だけ**を検証するものであり、
「終わった」の条件（`spec/README.md`「完了の判定」）はまだ満たしていない。

### 実測方法

`spec/openapi.yaml` から `tags: ["screens-*"]` と `tags: ["api-*"]` の全パスを
機械的に抽出し、`app/routers/*.py` に実装済みのルートと突き合わせた
（パスパラメータ名の違い `{id}` vs `{billing_id}` 等は正規化して比較）。

### 結果

| | 契約上の件数 | 実装済み | 未実装 |
| --- | ---: | ---: | ---: |
| 画面ルート（`screens-*`） | 43 | 20 | **23（53%）** |
| データルート（`api-*`） | 38 | 12 | **26（68%）** |

### 未実装の画面ルート（叩けば404になることを確認）

```
/animals/{karte_no}                          顧客（screen 3）
/animals/{karte_no}/delete                   飼主/動物の削除（screen 3の一部）
/animals/{karte_no}/history                  来院履歴（screen 5）
/animals/{karte_no}/karte/new                新規診察（screen 9の一部）
/animals/{karte_no}/karte/copy_prev          前回コピー（screen 9の一部）
/animals/{karte_no}/karte/cancel             取消（screen 9の一部）
/animals/{karte_no}/karte/{visit_id}/print   診察ごとの印刷（screen 9の一部）
/animals/{karte_no}/karte/{visit_id}/delete  削除（screen 6）
/animals/{karte_no}/karte/{visit_id}/restore 復元（screen 6）
/animals/{karte_no}/exam                     検査（screen 10）
/animals/{karte_no}/dosing/{kind_id}         投薬（screen 11）
/animals/{karte_no}/prevention/{kind_id}     予防（screen 12）
/animals/{karte_no}/papers                   書類一覧（screen 13）
/papers/{paper_id}                           書類詳細（screen 13）
/papers/{paper_id}/remove                    書類取消（screen 13）
/papers/no-paper                             書類なし印（screen 13）
/animals/new                                 新規登録（screen 2）
/animals/{karte_no}/ward                     患者ごとの入院（screen 18の一部）
/ward/day                                    入院の日次表示（screen 18の一部）
/reservations/new                            予約の新規作成フォーム（screen 19）
/reservations/{id}                           予約の詳細/編集画面（screen 19）
/reservations/{id}/cancel                    予約キャンセル画面（screen 19）
/dm.csv                                      DMのCSV書き出し（screen 16の一部）
```

### 未実装のデータルート（26件。主なもの）

`/api/patients` 系（一覧・詳細・削除・復元・診察・受付・検査・投薬・予防・書類・入院）、
`/api/owners/{owner_no}` 系、`/api/visits/{visit_id}` 系（削除・復元）、`/api/receptions` 系、
`/api/staff`、`/api/ward`、`/api/billings`（一覧）、`/api/dm`、`/postal`。

### なぜ共通テスト14件が緑でも気づけなかったか

共通テスト（`tests/checks.py`）は検算1〜9・smoke・crawlという**特定の数値・振る舞い**を
検証するもので、**26画面すべてを1つずつ確認する作りではない**。crawl（検算8）も
「今あるリンクを辿って切れがないか」を見るだけなので、**まだリンクすら無い画面**は
そもそも辿られず、見かけ上は問題にならない。「緑＝完成」ではなく
「緑＝いま測った範囲では問題なし」でしかなかった。

### ついでに見つけたこと（今回の点検中）

自分の過去のセッションで、共有DB（`stacks/fastapi/data/clinic.db`。ポート8415の
稼働中サーバと同じファイル）に対して `CLINIC_DB_URL` を指定せず手動でPOSTを試したことがあり、
`Clinic.name` に検証用の値（「はるかぜ動物病院・改」）が残っている可能性がある。
**稼働中のサーバには触っていない**が、次回の再起動時にDBの中身をseedへ戻すか
確認したほうがよい（`load_seed` は「Clinicが1件でもあれば投入済み」とみなすため、
再起動しても自動では戻らない）。

## いまの状態

**未完了。** 残り23画面・26 APIの実装を続ける。優先順位は指揮役の指示があれば従うが、
無ければ「受付・患者（新規登録・顧客・削除・来院履歴）」→「診療（検査・投薬・予防）」→
「予約フォーム・DM CSV」の順で進める。

## 2026-09-06（続き）残り23画面・26 APIを4並列サブエージェントで実装、完了

指揮役から改めて「本当に終わったか」の実測依頼を受け、前回の自己点検（未完了。残り23画面・
26 API）どおり実装を継続した。5領域のうち設定（refdata.py）は既に済んでいたため、
残り4領域（受付・患者／診療／会計・DM／入院・予約・スタッフ）をサブエージェント4体に
並列で分担させた（担当ファイルを重複させず、`coordination/qa/lane-d.md` D-12〜D-16参照）。

途中、共有の稼働中サーバ（8415番）に対して2体のサブエージェントが「新しいルートが
反映されない」と報告したが、原因は D-9 の再発ではなく単に指揮役がまだ再起動していな
かっただけだった。全員の実装完了後に孤児プロセスも含めて 8415 を再起動し、以下を実測した。

## 完了の自己点検

```
$ python tests/run.py http://127.0.0.1:8415 --only inventory

── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件

全 3 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8415

（smoke/money/screen/rules/crawl/inventory の全17項目）
  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 13ms
  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250
  OK  検算2 この規則を、いまのデータで確かめられているか（検算そのものの点検）  — ★ 150枚すべてで丸め方の差が出ない（データ側の課題。前回から変化なし）
  OK  検算3 体温が全患者で同じ値になっていない  — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る  — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致
  OK  検算6 予約が担当・処置室のどちらでも重ならない  — 61 件で重なり0
  OK  検算7 入院の記録行に実施者が必ず入っている  — 108 件中 実施者なし 0 件
  OK  検算9 削除済みは一覧から消えるが件数には残る  — 一覧から消えても集計に残る
  OK  検算8 画面から辿れるリンクが全部生きている  — 60 画面を辿って切れなし
  OK  在庫 契約の画面ルートが全部ある  — 38/42 件ある（残り4件は下記の理由で「確かめられない」扱い）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（残り3件は同上）
  OK  在庫 この検査自体が働いているか  — 対象 78 件中、確かめられないのは 7 件

全 17 件 通過
```

在庫検査の「確かめられない」7件（`/folded/{key}` `/papers/{paper_id}`
`/papers/{paper_id}/remove` `/api/papers/{paper_id}` `/api/todo/{key}` `/api/masters/{key}`）は、
検査側の固定サンプル値（`_SAMPLE = {"key": "reception", ...}`）がこのプロジェクトの
key語彙・実データと一致しないために生じる見かけ上の未確認であって、ルート欠落ではない。
個別に有効な値で実測して確認済み:

```
GET /folded/hospital_division      -> 200
GET /api/todo/temp_save            -> 200
GET /api/masters/price_item        -> 200
POST /api/patients/10002/papers    -> 201（新規作成）
GET /papers/1                      -> 200
GET /api/papers/1                  -> 200
POST /papers/1/remove              -> 200
```

## 残っていること

- `coordination/qa/lane-d.md` D-11（`spec/model.md`「落としたもの」表の `KartePdf` と
  `spec/screens.md` 13番「書類」の食い違い）は**指揮役判断待ちのまま未解決**。
  今回の実装は「契約に実ルートがある」を優先して書類画面・APIを実装した
- D-12（受付・患者）で触れた3つのボタン（診察券発行／文書印刷／品種リスト）は
  `spec/screens.md` に「できること」として載っているが対応する契約ルート・マスタデータが
  無いため、`todo_key`: `reception_id_card` / `reception_document_print` /
  `reception_breed_list` のB状態ボタンにした。この3キーは `app/feature_notes.py`
  （書き換え不可の担当外ファイル）に無いため、`/todo/{key}` が対応済みか要確認
  （未確認。共通テストの `--only crawl` は通っているため、リンクが辿られて404には
  なっていない可能性が高いが、実際に踏んで確認はしていない）
- `spec/openapi.yaml` の `/ward` の `x-data-testids`（`screen-ward-day`）と実装
  （`data-check="screen-ward"`）の食い違いは、今回のスコープ外として直していない
  （D-12 ward-reservations 参照）
- `IncludeDeleted` 等、契約に定義の薄いクエリパラメータの扱いは仮決め止まり
  （D-12 accounting-dm 参照）

以上を除き、**画面42件・API36件は全てエンドポイントとして存在し、共通テスト17件が
全て緑**。コミット・pushは指揮役のゲート待ちのため未実施。

## 2026-09-06（続き2）裁定R-21/R-22対応、data-testid修正、新規在庫検査での2件の未実装発見・実装

指揮役の裁定（R-21書類は範囲内、R-22 /wardの目印は実装漏れ）と、新しく足された
data-testid検査（32画面すべてで欠落）を受けて対応した。

やったこと:
1. `_macros.html` の `screen()` マクロに `data-testid` を追加（32画面いっぺんに解消）
2. `/` と `/today` が同じテンプレートを共有していたため `screen-top`/`screen-today` を
   出し分けるよう修正
3. `/ward` の目印を `screen-ward` → `screen-ward-day` に修正（R-22）
4. R-21対応中に別の実装バグを自分で発見: 書類の削除が契約の「物理削除しない」に反して
   物理削除になっていた。`Paper.removed_at` を追加し論理削除に直した（D-18）
5. 新しい在庫検査（画面でもAPIでもないルート）で `/dm.csv`・`/postal` が未実装と
   判明、実装した（D-19）
6. R-21で聞かれた「PDF以外の形式を拒否する」は、**この実装にファイルアップロード
   自体が無いため該当なし・未対応**（正直に報告）

## 完了の自己点検（2回目）

```
$ python tests/run.py http://127.0.0.1:8415 --only inventory

── inventory ──

  NG  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 2 件が無い: /animals/{karte_no}/dosing/{kind_id}=422, /animals/{karte_no}/prevention/{kind_id}=422 ／ 36/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  NG  在庫 契約のAPIルートが全部ある  — 2 件が無い: /api/patients/{karte_no}/dosing/{kind_id}=422, /api/patients/{karte_no}/prevention/{kind_id}=422 ／ 31/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件
  OK  在庫 契約が求める data-testid が画面に出ている  — 32 画面で目印を確認
  OK  在庫 画面でもAPIでもないルートが応答する（CSV配信・死活・外部照会）  — 3/3 件が応答

5 件中 2 件 失敗
```

```
$ python tests/run.py http://127.0.0.1:8415
（省略。smoke/money/screen/rules/crawl は全項目OK。inventory は上と同じ2件NG）
19 件中 2 件 失敗
```

**まだ緑ではない。正直に報告する。** ただし残り2件のNG（画面2・API2、実質同じ原因）は
実装の欠けではなく、**検査側のサンプル生成の誤り**だと判断している（D-19に実測を記録）。

`tests/inventory.py` の `_samples()` は `dosings[0].get('kind_id', dosings[0].get('kind'))`
で `kind_id` を作っているが、`data/seed.json` の `dosings` 行に `kind_id`（数値）は無く
`kind`（文字列 `"heartworm"`）しか無いため、結果として `kind_id="heartworm"`
という**文字列**がパスパラメータに渡る。契約（`spec/openapi.yaml`）は `kind_id` を
`type: integer` と定義しており、この実装は契約どおり整数として受けているため
文字列を渡すと422になる。**整数の kind_id で実測すると4本とも200**:

```
GET /animals/10004/dosing/3            -> 200（3 = prevention_kinds の3番目 = heartworm）
GET /api/patients/10004/dosing/3       -> 200
GET /animals/10018/prevention/1        -> 200
GET /api/patients/10018/prevention/1   -> 200
```

指揮役の判断を仰ぎたい: 検査側の `kind_id` サンプル生成を直すか、他レーンとの
すり合わせで `kind_id` の型を再確認するか。自分では `tests/` を直せないため、
これ以上この2件を緑にする手立てが無い。

## 完了の自己点検（3回目、R-20対応後）

```
$ python tests/run.py http://127.0.0.1:8415 --only inventory

── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件
  OK  在庫 契約が求める data-testid が画面に出ている  — 34 画面で目印を確認
  OK  在庫 画面でもAPIでもないルートが応答する（CSV配信・死活・外部照会）  — 3/3 件が応答

全 5 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8415

（smoke/money/screen/rules/crawl 全項目 + 上の在庫検査5件）
全 19 件 通過
```

**今回は正真正銘の全緑。** 残っていたのは裁定R-20（記録0件のAPIは200で空を返す）の
未適用1件のみで、`api_get_dosing` に `_empty_dosing_dict()` を足して解消した
（`coordination/qa/lane-d.md` D-21）。R-23（kind_idの型）は指揮役により撤回済みで、
自分の実装（契約どおり `kind_id: integer`）は最初から正しかった——ただし数値／文字列
コードの両対応（`_resolve_kind_index`）自体は「契約が許す範囲を広げるだけ」として
残してある。

## 完了の自己点検（4回目、/ui.css 対応後）

```
$ python tests/run.py http://127.0.0.1:8415 --only inventory

── inventory ──

  OK  在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）  — 38/42 件ある（4 件は確かめられない: /folded/{key}, /papers/{paper_id}, /papers/{paper_id}/remove）
  OK  在庫 契約のAPIルートが全部ある  — 33/36 件ある（3 件は確かめられない: /api/papers/{paper_id}, /api/todo/{key}, /api/masters/{key}）
  OK  在庫 この検査自体が働いているか（確かめられない分が多すぎないか）  — 対象 78 件中、確かめられないのは 7 件
  OK  在庫 契約が求める data-testid が画面に出ている  — 34 画面で目印を確認
  OK  在庫 画面でもAPIでもないルートが応答する（CSV配信・死活・外部照会）  — 3/3 件が応答
  OK  見た目 共通CSS(/ui.css)を配っていて、全画面が読んでいる  — 34 画面すべてが読んでいる

全 6 件 通過
```

```
$ python tests/run.py http://127.0.0.1:8415
全 20 件 通過
```

`/ui.css` は `spec/ui.css` と無改変で完全一致（diffなし）。`app/static/ui.css` へコピーし、
`/ui.css` 直下で配る専用ルートを `main.py` に追加、`base.html` の `<head>` から
`<link>` で読む（全画面が `base.html` を継承しているため1箇所で足りた）。
クラス名（`success-banner`/`error-banner`/`button`/`disabled`/`num`/`out-of-range`）を
`ui.css` の定義に合わせて実装側を修正した。詳細は `coordination/qa/lane-d.md` D-22。

**残っているもの（正直な棚卸し）**: `coordination/qa/lane-d.md` D-11・R-21の
「PDF以外の形式のファイルは取り込みを拒否する」は該当なし・未対応のまま
（この実装にファイルアップロード自体が無いため）。指揮役側で `screens.md` を
直す方針と聞いている。それ以外の既知の欠けは無い。

## 完了の自己点検（5回目、灰色ボタン3つ対応後）

```
$ python tests/run.py http://127.0.0.1:8415 --only inventory
全 8 件 通過
```
```
$ python tests/run.py http://127.0.0.1:8415
全 22 件 通過
```

`/today` に「完了全削除」「完了削除」、`/animals/{karte_no}/karte` に「一時保存」を
状態Cのボタンとして追加（`feature_notes.py` の既存キーへ繋いだだけで新規キーは
作っていない）。詳細は `coordination/qa/lane-d.md` D-23。
