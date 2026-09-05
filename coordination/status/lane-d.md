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
| 5 | 題材を読む | 済 | `vet-karte/docs/実装分担-2026-09-05.md`。**読むだけ。当該リポジトリは一切変更していない** |

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

- 題材の `vet-karte` も **FastAPI で `uvicorn app.main:app`** を使う（実測で確認）。
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
