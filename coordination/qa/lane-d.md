# レーンD の質問と仮決め

**書き方のきまり**: 実装が止まらないものはここに書いて**先へ進む**（`PROTOCOL.md` 9）。
仮決めしたことは必ずここへ書く。**仮決めが仮決めと分からない形で溶けるのがいちばん悪い**
（`ASSIGNMENT.md` レーンRの3つ目の観点）。

---

## 契約に食い違いを見つけた（`qa/rulings.md` の手続きに従い、rulings を正として進める）

### D-4. `openapi.yaml` が `data-testid` を要求しているが、`rulings.md` は撤回済み

- **事実**: `spec/openapi.yaml` の説明文と `x-data-testids`（56ルート）は、
  `data-testid="screen-<key>"` 系の目印を要求している
- **事実**: `coordination/qa/rulings.md` #4 は「`data-check` 系に統一。`data-testid` は使わない。
  **要素の存在を確かめたいだけの場合も `data-check` を使う**」と裁定している
  （openapi.yaml 側は反映されていない。凍結のタイミングのずれと見える）
- **手続き**: `rulings.md` 冒頭に「契約の文書（`spec/`）と食い違いを見つけたら、
  この文書が正として指揮役へ報告する」とあるので、**その手順どおりに進める**
- **仮決め**: **`data-testid` は書かない。`data-check` だけを使う。**
  `acceptance.md` の13キーに無い構造的な目印（画面コンテナ・行・空表示・
  成功／失敗バナー・灰色ボタン）は、`openapi.yaml` の命名規則
  （`screen-<key>` / `row-<資源名>` / `empty-<資源名>` / `success-banner` /
  `error-banner` / `disabled-action-<todoキー>`）をそのまま**キーとして流用**し、
  `data-testid` ではなく `data-check` 属性に載せる
  （例: `<div data-check="screen-today">`）
- **止まるか**: いまは止めない。**この決めは5レーンの一致に関わる**ので、
  第3段階の突き合わせより前に指揮役の確認を強く希望する。
  指揮役のセッションが `ListAgents` から特定できなかったため直接メッセージは送っていない
- **リスク**: 他レーンが `openapi.yaml` の文面だけを見て `data-testid` を実装した場合、
  レーンD（`data-check` のみ）と食い違う。**この点は指揮役の確認を待つ**

## 仮決め（回答が来たら差し替える）

### D-1. 開発サーバーのポートを 8004 にした

- **状況**: 5実装が同時に立つので衝突する。契約にポートの指定が無い
- **仮決め**: レーンD = **8004**（A=8001, B=8002, C=8003, D=8004, E=8005 のつもり）
- **根拠**: レーン名の順。**他レーンとは相談していない**（`PROTOCOL.md` 5 により直接やり取りしない）
- **止まるか**: 止まらない。`PORT` 環境変数で変えられるようにしてある
- **指揮役へ**: 共通テストが叩く先を決めるのは契約側なので、**`tests/` 側でポートを指定するなら
  そちらが正**。その場合ここは捨てる

### D-2. DB は SQLite（ファイル）にした

- **根拠**: `DECISIONS.md` 4節「追加インストールが要らないもの。SQLite を推奨」
- **`CLINIC_DB_URL`** で差し替えられる。共通テストが専用のDBを使いたい場合に備えたもの

### D-3. `tzdata` を依存に足した

- **状況**: Windows には OS のタイムゾーンDBが無く、`ZoneInfo("Asia/Tokyo")` が
  `ZoneInfoNotFoundError` で落ちる（2026-09-05 実測）
- **仮決め**: `tzdata==2026.3` を `requirements.txt` に入れた
- **根拠**: `DECISIONS.md` 2節「プロジェクト内の依存追加は許可済み」。
  新しい**実行環境**の導入ではなく、リポジトリ内に閉じた pip の依存なので中止条件に当たらない
- **なぜ書き残すか**: 契約は「日付・時刻は JST。集計の月境界も JST」と決めている。
  これが無いと**集計を実装した時点で初めて落ちる**。土台の問題が業務の問題の顔をして出る

---

## 質問（止まらないもの。指揮役の回答待ち）

### D-Q1. 画面数が 24 と 26 で食い違っている

- `briefs/lane-d.md`: 「**全24画面**を実装し」／領域表は **24画面**
- `PLAN.md` と `spec/README.md`: 「**26画面すべて作る**」（既存24 ＋ 新規2：**予約・売上集計**）
- **どちらが正か。** レーンDの領域表には「売上集計」「予約」が入っていない
  （領域3が「会計 / 会計履歴 / DM」、領域4が「入院 / 予約 / ToDo / スタッフ」）。
  `PLAN.md` の領域表には両方入っている
- **仮決め**: **26画面**（`PLAN.md` と `spec/README.md` に従う）。
  `briefs/` は起動用の要約であり、`PLAN.md` のほうが計画の正本と書かれているため
- **止まるか**: いまは止まらない（まだ画面を作らない段階）。
  **契約が凍ったら止まる**ので、`spec/screens.md` で確定させてほしい

### D-Q2. 共通テストは各レーンをどう起動するか

- 共通テストは HTTP 越しに叩く（`PLAN.md` 成立条件）。
  レーンD側に**起動の作法**（起動コマンド・待ち受けポート・準備完了の判定・初期データの入れ方）を
  合わせる必要がある
- **止まるか**: いまは止まらない。契約が凍る時点で `tests/` を見れば分かるはず
- **こちらの用意**: `python run.py` で立ち、`GET /health` が `{"status":"ok"}` を返す。
  DBは `CLINIC_DB_URL` で差し替えられる

## D-5. `openapi.yaml` の `Billing`/`SalesSummary` と、共通テストが読む形が違う

- **事実**: `spec/openapi.yaml` の `Billing` は `total` / `taxable_subtotal` /
  `nontaxable_subtotal` / `excluded_detail_count` という名前。`SalesSummary` は
  `from`/`to` を必須クエリにし、`group_by` で1軸だけ返す形（`rows[]` + `total_amount`）
- **事実**: `spec/acceptance.md` の `data-check` キー表と `tests/checks.py`（共通テスト本体）は
  `net_amount` / `tax_amount` / `total_amount` / `excluded_count` を読み、
  `/api/sales/summary` はクエリ無しで叩いて `by_category` / `by_staff` / `by_date` を
  **同時に**、`by_category` の各行に `share_pct` を求めている
- **仮決め**: 共通テストが判定の実体なので、そちらの名前・形を主に返す。
  openapi.yaml 側の名前（`total` / `taxable_subtotal` 等）も**互換のため併記**した
  （実装: `app/routers/billing.py` `app/routers/sales.py`）。`from`/`to` は必須にせず
  任意にし、渡されれば絞り込みに使う
- **止まるか**: 止まらない。money 組（検算1・2）は緑になった
- **指揮役へ**: D-4 と同じ構図（凍結タイミングのずれで openapi.yaml が古いまま）に見える。
  `spec/openapi.yaml` を差し替えるかどうかは判断を仰ぎたい

## D-6. ポート8404が、私のセッションから見えないプロセスに掴まれている（要対応）

- **事実**: `python -c "import socket; socket.socket().bind(('127.0.0.1', 8404))"` が
  `WinError 10048`（使用中）で失敗する。だが `curl http://127.0.0.1:8404/healthz` は
  **`{"status":"ok"}` を返す**——つまり何かが確かに応答している
- **事実**: `netstat -ano` は `LISTENING` の所有者として PID を示すが、その PID を
  `Get-Process` / `tasklist` / `Get-CimInstance Win32_Process` のどれで引いても
  **「そのようなプロセスは無い」と返る**（PowerShell・cmd 両方で確認）
- **やったこと**: 自分が起動した経緯が追える `run.py` 系プロセス（複数、途中で仮決めポートの
  混在や再起動の試行錯誤で増えた）は、**ポートで所有者PIDを特定してから**個別に停止した。
  それでも 8404 の LISTEN は消えない
- **疑い**: 指揮役側のセッションが「8404 に対して judge を走らせた」ときに立てた
  実装（コード変更前の古い `/healthz` だけの版）が、**私のセッションからは見えない
  プロセス境界（別セッション／別トークン）で動き続けている**可能性が高い
- **暫定対応**: 検証は **`PORT=8494`** で別途起動して行った。
  `python tests/run.py http://127.0.0.1:8494 --only money` / `--only smoke` とも緑
- **お願い**: 8404 を握っているものを指揮役側で止めて（あるいは何か分かれば教えて）いただき、
  私の新しいコードで立て直したい。止めてよいと分かれば、こちらから `run.py` を
  `PORT`未指定（既定8404）で起動し直す

## D-7. `LabTestItem.judgement`（openapi）と `judgment`（共通テスト）も食い違っていた

- D-5と同じ構図。`spec/openapi.yaml` は `judgement`（英）で `low`/`normal`/`high`/`unknown`、
  共通テストは `judgment`（米）で空文字/`H`/`L` を読む
- **仮決め**: `GET /api/lab-tests/{id}` の各項目に両方を返す（`judgment` が共通テスト用、
  `judgement` が openapi.yaml 用。値の語彙は `flag` フィールドとしても併記）
- 実装: `app/routers/lab.py`

## D-8. `_dead_links`（検算8）が Content-Type ヘッダを大文字小文字そのままで見ている

- **事実**: `tests/checks.py` の `_dead_links` は
  `if "html" not in (headers.get("Content-Type", "") or ""): continue` と、
  ヘッダ名を大文字小文字そのまま (`Content-Type`) で引く
- **事実**: FastAPI/Starlette（uvicorn）は仕様どおり**小文字**の `content-type` を返す
  （`curl -sD -` で実測）。`tests/run.py` の `Client.get` は `dict(res.headers)` で
  ヘッダを辞書化するため、大文字小文字はサーバが送った形のまま残る
- **結果**: `headers.get("Content-Type")` が常に `None` になり、リンク抽出の分岐が
  全ページで「htmlではない」扱いになる。トップ以外にリンクが1件も辿れない
- **確認したこと**: `curl` でトップページのHTMLを直接見ると `<a href="/today">` 等
  10個のリンクが正しく出力されている。`tests/run.py` の `Client.get('/')` を直接呼んでも
  同じHTMLが返る。ヘッダのキーだけが `content-type`（小文字）
- **止まるか**: 止めない。指揮役へ報告済み（HTTPヘッダ名は本来大文字小文字を区別しない
  仕様なので、`.get()` 側を大文字小文字を無視する形にするのが筋と考える）
- **画面自体は用意済み**: `/` `/today` `/search` `/reservations` `/ward` `/dm` `/sales`
  `/staff` `/settings` `/about` は直接叩けば全部200。ヘッダの件が直れば crawl は
  緑になる見込み
