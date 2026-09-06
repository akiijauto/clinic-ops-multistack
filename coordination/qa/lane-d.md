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

## D-9（訂正）: 8404/8414の「握ったまま死んだソケット」の正体は、殺し損ねた孤児プロセスだった

- D-6・D-9 で「PIDを引いても存在しない」と報告したのは誤りだった。
  正しくは: **`Stop-Process` でWatchFilesの reloader（親）を止めても、
  multiprocessing で fork した worker（子）は生き残る。** その子プロセスが
  ソケットを掴んだまま実際に応答し続けていた
- `Get-CimInstance Win32_Process | Where CommandLine -like '*multiprocessing.spawn*'`
  で確認したところ、親PIDが既に存在しない孤児の worker が複数見つかった
  （このセッション内で reloader だけを繰り返し止めていた結果、積み重なっていた）
- 対処: 孤児の worker（子）を個別に `Stop-Process -Force` したところ、
  8404・8414 とも `socket.bind()` が通るようになった
- **教訓**: 今後 `run.py`（`reload=True`）を止めるときは、reloaderのPIDだけでなく
  **その子プロセス（`--multiprocessing-fork` を含むコマンドライン）も一緒に**
  止めること。片方だけ止めると「掴んだまま死んだように見えるソケット」の正体は
  だいたいこれ

## D-10: `/todo/{key}` `/folded/{key}` の key 語彙を仮決めした

- **状況**: `spec/openapi.yaml` の `TodoKey`/`MasterKey` は「語彙は screens.md/acceptance.md
  を正とする（enumに固定しない）」としているが、`screens.md`/`acceptance.md` 本文には
  具体的なキー名が書かれていない
- **仮決め**:
  - todo（C状態・3件）: `temp_save`（一時保存）／`complete_delete_all`（完了全削除）／
    `complete_delete_one`（完了削除）
  - folded（B状態・14件）: `model.md`「落としたもの」表の各行に1つずつキーを振った
    （`hospital_division` `clinic_feature` `staff_position` `karte_draft` `audit_log`
    `karte_pdf` `lab_item_master` `billing_category_master` `price_item_4layer`
    `insurance_claim` `clinic_points` `clinic_last_slip_no` `clinic_agency_code`
    `clinic_logo`）。実体は `app/feature_notes.py`
- **件数の根拠**: 表を数え直したところ**14件**だった（前回の記録で「10件」と書いたのは
  数え間違い。`model.md` 204〜221行目を実際に数えて訂正した）
- **止まるか**: 止まらない。共通テストが特定のkeyを名指しで要求していなければ
  この仮決めのままで良いはず

## D-11: `KartePdf`（落としたもの）と screens.md 13番「書類」の食い違いを見つけた

- **事実**: `model.md`「落としたもの」表に `KartePdf`（紙カルテの取込）が
  「ファイルの取り扱いが主題になってしまう」という理由で載っている
- **事実**: `spec/screens.md` の領域2・13番「書類（紙カルテPDF）」は、PDFの取込・取消・
  「元から無い」印を付ける、という**実際に動く機能**として書かれている
  （`openapi.yaml` にも `/animals/{karte_no}/papers` 等の実ルートがある）
- **疑い**: 「落としたもの」に KartePdf を挙げたのは、契約の別の版・別の書き手による
  記述で、書類画面の設計時には反映されなかった可能性がある
- **仮決め**: 書類画面（screen 13）は**実装する**（`openapi.yaml` に実ルートがあるため）。
  「折りたたみ表示」の一覧には、`model.md` の表をそのまま**文字どおり**載せている
  （KartePdfの行もそのまま出る）ので、**画面上は「作らない」と言いながら実際には
  作っている状態**になっている。これは screen 7 の「満たすべきこと」
  （画面に「できます」と書いて出来ていない状態を作らない、の逆）に抵触しうる
- **止まるか**: 止まらない（書類画面は他の契約記述に従って実装を進める）。
  **`model.md` の表からこの行を外すか、書類画面の実装を取りやめるか、指揮役の判断を仰ぎたい**

## D-12: accounting-dm（会計・DMの残りAPI）の実装と、動作確認できなかった点

- **実装した**: `app/routers/api_extra.py` に以下4本を実装（`serialize_billing` を再利用）
  - `GET /api/patients/{karte_no}/billings`（`Patient.deleted_at is None` で絞り、
    見つからなければ `not_found`。`Limit`/`Offset` 対応、`billed_on` 降順）
  - `GET /api/owners/{owner_no}/billings`（同様に `Owner` を解決してから絞り込み）
  - `GET /api/billings`（`from`/`to` は任意の日付絞り込み。`from` はPython予約語のため
    `from_: str | None = Query(None, alias="from")` で受けている）
  - `GET /api/dm`（`front.py` の `dm_screen` と同じ `Prevention.next_due_date is not None`
    を基本条件にし、`field`（`next_due_date`/`performed_date`）で絞り込み対象の日付列を
    切り替え、`from`/`to` で範囲を絞る。論理削除済みの `Patient`/`Owner` に紐づく行は除外）
- **仮決め**: `IncludeDeleted` パラメータがこの4本に無いため、`Patient`/`Owner` の
  論理削除は既定どおり除外（CLAUDE.md/D-1〜同様の「既定は除外」方針に合わせた）
- **仮決め**: `/api/dm` の `type`（integer）クエリは、契約に語彙の定義が無く
  `Prevention` に対応する分類列も見当たらないため、**受け取るが絞り込みには使わない**
  （壊さないための最小対応。指揮役の定義待ち）
- **未解決（重要）**: 稼働中の `http://127.0.0.1:8415` に対して動作確認しようとしたが、
  実装した4エンドポイントがすべて `404`（`/api/` 配下用の `not_found` エラー形）を返した。
  一方で `GET /healthz`（200）・既存の `GET /api/billings/{id}`（200、正しいデータ）は
  正常に応答しており、サーバプロセス自体は生きている。`api_extra.router` は
  `main.py` に元から登録済みで自分は触っていないため、**このプロセスが
  今回の実装内容を読み込めていない（オートリロードが効いていない）可能性が高い**。
  構文チェック（`ast.parse`）は通過済み。指示により自分ではサーバを再起動していない。
  **サーバの再起動後に再確認をお願いしたい。**

## D-12: 入院・予約・スタッフの残り画面/APIを仮決めで実装した（サブエージェント「ward-reservations」）

- **実装した範囲**:
  - 画面: `GET/POST /animals/{karte_no}/ward`（この動物の入院一覧＋新規入院登録フォーム）、
    `GET /ward/day`（指定日・省略時JST本日の在院中一覧）、`GET /reservations/new`（新規予約フォーム）、
    `GET/POST /reservations/{id}`（予約詳細・変更）、`POST /reservations/{id}/cancel`（取消・事後の確認画面）、
    `POST /reservations`（`/reservations/new` からの投稿先。一覧画面へ success/error banner 付きで戻す）
  - API: `GET /api/ward`（指定日在院中一覧）、`GET/POST /api/patients/{karte_no}/hospitalizations`、
    `GET /api/staff`（`is_active` 絞り込み対応。`password_hash` は返さない——`model.md` の指示どおり）
- **仮決め①**: `/ward/day` の「在院中」は `admitted_on <= 対象日` かつ
  （`discharged_on` が無い、または `discharged_on >= 対象日`）とした（契約の絞り込み条件が薄いため、
  タスク指示の仮決めルールをそのまま採用）。`/api/ward` も同じ条件。
- **仮決め②**: 予約の新規作成フォーム（`/reservations/new`）は動物を**カルテNo（文字列）**で
  指定させ、POST時にサーバ側で `Patient` を引いて `patient_id` に変換する（画面は人が読む
  カルテNoを、APIのスキーマは内部IDを使う既存の非対称にそのまま合わせた）。カルテNoが
  見つからない場合は `/reservations` の一覧へ error-banner で戻す。
- **仮決め③**: `/reservations/{id}/cancel` は契約上POSTのみでGET（確認質問画面）が無いため、
  詳細画面 (`/reservations/{id}`) に「取消」ボタン（フォームでPOST直送）を置き、
  取消後に確認結果を表示する専用画面（`reservation_cancel.html`, success-banner）を
  「予約キャンセル確認」画面として実装した。
- **仮決め④**: `/animals/{karte_no}/ward` のケア記録追加フォームは今回のスコープに含めず
  表示のみとした（契約のPOSTはこのURLでは「入院の開始」だけを扱うため。ケア記録追加の
  API `/api/hospitalizations/{id}/care-records` は既存のまま変更していない）。
- **気づいた食い違い（要確認・止まらず報告のみ）**: `spec/openapi.yaml` の既存 `/ward`
  （`screen_ward_today`）は `x-data-testids` が `screen-ward-day`/`row-hospitalization`/
  `empty-hospitalization` だが、実装（既存コード、今回変更していない）は
  `data-check="screen-ward"` を出している（`row`/`empty` は一致）。新規追加した
  `/ward/day` 側は契約どおり `screen-ward-day` にした。`/ward` 自体の testid 食い違いは
  このサブタスクの担当範囲外のため直していない。
- **未解決**: 実装後に `python -c "import ast; ast.parse(...)"` で3ファイルとも構文OKを
  確認したが、共有稼働中サーバ（`http://127.0.0.1:8415`、`/openapi.json` で確認）は
  reload=True にも関わらず新しいルート（`/api/staff` `/ward/day` `/reservations/new` 等）を
  まだ認識していない（`/openapi.json` の paths に出てこない）。D-9 で報告済みの
  「reloaderを止めても孤児のworkerが応答し続ける」系の再発の可能性がある。
  **自分では再起動しない指示のため、レーン本体側での確認・再起動を依頼したい。**

## D-12: 受付・患者ドメイン（`app/routers/patients.py`）実装時の仮決め

- **`karte_no` の書式**: `openapi.yaml` の `KarteNo` パラメータは
  `pattern: "^[0-9]+-[0-9]+$"`（例: `1001-1`）と書いているが、`data/seed.json` の
  実データは `"10001"` のような単純な数字連番で、このパターンに一致しない
  （`karte.py` 等の既存ルーターも書式チェックせず文字列一致で引いている）。
  **仮決め**: `karte_no` は書式チェックしない不透明な文字列として扱い、新規発行も
  既存データと同じ「数字だけの連番」（既存の最大値+1）にした。`owner_no` は
  既存データの `"O-00001"` 形式に合わせて発行する
- **`/api/receptions` の `kind` クエリ**: `Reception` モデルには独立した「種別」の列が無い
  （`owner_purpose`/`medical_purpose` はあるが、`data/masters.json` の
  `reception_kinds` に対応する専用列が無い）。**仮決め**: `kind` は
  `owner_purpose` または `medical_purpose` への完全一致で代用した
- **`/animals/{karte_no}` に POST を追加した**: `spec/openapi.yaml` はこのパスに GET しか
  定義していないが、`spec/screens.md` 3番はこの画面に「保存」「番号変更」を求めている。
  `/settings`（`screens-settings`）が同じ画面パスへ GET/POST を両方定義している前例に倣い、
  この画面専用の保存フォーム（`action=save|renumber_patient|renumber_owner`）を追加した。
  契約に無いルートの追加であり、共通テストの対象外の可能性が高いが、実害は無いと判断した
- **来院履歴（`/animals/{karte_no}/history`）は `AuditLog` 抜きの縮小版**: `AuditLog`
  （登録・修正・削除の項目別の前後値を記録するもの）は `model.md`「落としたもの」表・
  `app/feature_notes.py` の `audit_log` キーで**意図して外されている**機能。
  `spec/screens.md` 5番は「登録・修正・削除・復元を新しいものから並べて見る」
  「変更前→変更後がペアで分かる」ことを満たすべきこととして書いているが、
  この項目別diffを支えるテーブルが無いため字義通りには実装できない。
  **仮決め**: `Visit`（削除済みを含む）の一覧を新しい順に出し、削除済みの行には
  「元に戻す」（実行自体は `screens-clinical` 側の
  `/animals/{karte_no}/karte/{visit_id}/restore` に委ねる）への導線を付け、
  画面上に「詳しい変更履歴は監査ログとして扱っていない」旨を明示した
  （`action_button` の B状態、`todo_key="audit_log"` で `/todo/audit_log` に飛ぶ）。
  Owner/Patient の変更履歴・削除復元は一切出していない（そもそも Owner/Patient に
  restore の画面導線が契約に無い——APIの `/api/patients/{karte_no}/restore` と
  `/api/owners/{owner_no}/restore相当` のうち後者は契約に無く、前者のみ存在する）
- **診察券発行／文書印刷／品種リスト**: `spec/screens.md` 3番の「できること」に載っているが、
  対応する openapi ルートが無く、品種マスタ等の裏付けデータも `data/masters.json` に無い。
  **仮決め**: 実装せず、`action_button` の B状態（`todo_key`:
  `reception_id_card` / `reception_document_print` / `reception_breed_list`）にした。
  これらの3キーは `app/feature_notes.py` の `FOLDED_NOTES`（14件）とは別枠
  （model.md の表に対応する項目ではないため）で、`/todo/{key}` の個別文言だけで説明する
  想定。**`app/feature_notes.py` は書き換えない担当外ファイルのため、この3キーの
  ToDo文言をレーン本体側で用意してもらう必要がある**（現状は `/todo/` 側の実装次第で
  未知キーが404になる可能性がある。要確認）
- **実施した確認**: `TestClient` で `/animals/new`（GET/POST）→ 発行された `karte_no` で
  `/animals/{karte_no}`・`/history`・`/delete`（GET/POST）、`/api/patients`
  （一覧・取得・PATCH・delete・restore）、`/api/owners`（取得・PATCH・delete）、
  `/api/patients/{karte_no}/receptions`・`/api/receptions/{id}`、
  `/api/patients/{karte_no}/visits`（進行記録つき作成）を一通り実行し、
  いずれも契約どおりのステータス・内容を確認した（一時DBを使い、共有DBには触れていない）

## D-12: `VisitForm` のフィールド名を仮決めした（カルテ保存フォーム）

- **状況**: `spec/openapi.yaml` の `VisitForm` は「説明文だけ」（`description` のみ）で、
  具体的なフィールド名を定義していない
- **仮決め**: `visit_id`（空なら新規診察）／`visit_date`／`body_weight_kg`／
  `chief_complaint`／`symptom`／`diagnosis`／`treatment`／`staff_id` に加え、経過記録は
  `entry_date[]` `temperature_c[]` `pulse[]` `respiration[]` `note_body_weight_kg[]`
  `symptom_course[]` `treatment_rx[]` `note[]` の並列配列（同じindexが同じ行）とした。
  `body_weight_kg` は Visit本体・行の両方にあるため、行側は `note_body_weight_kg[]` と
  別名にして衝突を避けた
- **保存方式**: 保存のたびに対象 `Visit` の `ProgressNote` を全行削除して入れ直す
  （部分更新の混線を避ける最も単純な方式。検算3「行ごとに独立」の対策と両立する）
- **前回コピー**: 直前の診察が無いときは一覧側のボタンを灰色にし、`/karte/copy_prev`
  自体も404を返す（`openapi.yaml` に404レスポンスが定義済みのため整合）
- **取消**: この企画には手で押す一時保存が無い（`karte_draft` はB状態、`temp_save` は
  ToDo/C状態）ため、「新規診察フォームへ戻す」だけの操作にした。実質いつでも押せる
- **削除済みの表示**: `screens.md`「共通の約束」の「削除済みも表示」を選べば見える、を
  `GET /animals/{karte_no}/karte?show_deleted=1` で実装した
- **実施した確認**: 一時DB（`CLINIC_DB_URL` を差し替え、ポートも8931に分離）で、
  カルテ新規保存→一覧・行の値の突き合わせ、印刷・削除・復元・取消の一通りを
  実際にHTTPで叩いて確認した（共有DB・共有サーバには触れていない）

## D-13: 検査・投薬・予防・書類も一時DBで実HTTP確認した

- 検査: 新規保存→一覧再表示で `data-check="lab_test_item.value"` /
  `data-check="lab_test_item.judgment"` + `data-check-flag` が意図どおり
  （範囲内=normal/空、範囲外=high/`H`）に出ることを確認
  - 実装中に一度500が出た：Jinja で辞書の `t.items` と書くと `dict.items`（組み込み
    メソッド）に化けてイテレートできない事故だった（`t["items"]` に修正）。
    今後このファイル群で辞書を渡す変数に `items` というキーを使うときは要注意
- 投薬: 年度追加→月の3択（空／○／×）保存→再表示で値が反映されることを確認。
  月ごとに空／○／×のセレクトにしたのは、チェックボックスでは「未送信」と
  「明示的に外した」を区別できないため（`models.py` Dosing のコメントと同じ理由）
- 予防: 新規記録保存→一覧反映を確認。次回予定日は常に「未入力なら空のまま」とした
  （D-14参照）
- 書類: API（POST/GET/DELETE）・画面（一覧・詳細・削除・no-paper案内）を一通り確認

## D-14: 予防の「基本周期」は全種別「未設定」として扱った

- **事実**: `spec/screens.md` 12番は「次回予定日を空で保存すると、その種別の基本周期が
  設定されている場合に限り自動計算する」としているが、`data/masters.json` の
  `prevention_kinds` には周期を表す列が無い（`code`/`name` のみ）
- **仮決め**: 基本周期のデータが存在しないため、全種別を「周期未設定」として扱い、
  次回予定日を空で保存した場合は常に空のまま保存する（契約の「周期が未設定なら
  次回予定日は空のまま保存される」分岐のとおり）。周期の自動計算ロジック自体は
  実装したが、呼び出す元データが無い状態
- **止まるか**: 止まらない。契約上「未設定なら空のまま」という正しい状態の一種として
  扱える

## D-15: 書類画面の作成経路はAPIのみ（画面にはフォームを置かない）

- **事実**: `spec/openapi.yaml` の `/animals/{karte_no}/papers` は GET のみ定義されており、
  POST（画面からの新規作成）が無い。作成は `/api/patients/{karte_no}/papers`（POST）だけ
- **仮決め**: 画面（`clinical/papers.html`）は一覧・削除のみとし、新規作成フォームは
  置かない（契約に無い操作を画面にだけ追加しない）。取込は API 経由（他クライアント・
  テストから）を前提とする

## D-16: サブエージェント4体の実装完了、統合・再起動して全共通テスト緑を確認（レーン本体）

- 4領域（受付・患者 / 診療 / 会計・DM / 入院・予約・スタッフ）を並列サブエージェントに
  分担させ（D-12〜D-15参照）、`stacks/fastapi/` 以外・他領域のファイルには触れさせず実装した
- **D-12（accounting-dm）・D-12（ward-reservations）が「サーバがreloadを反映しない」と
  報告した件**: これは D-9 の再発ではなく、**単に指揮役（自分）がその時点でまだ
  8415番のプロセスを再起動していなかっただけ**だった。両エージェントとも指示どおり
  「自分ではサーバを再起動しない」を守っていたため、当然まだ古いプロセスを見ていた。
  実際に一度 `Stop-Process`（孤児のworker含め全PID）→ 再起動したところ、
  4領域すべての新規ルートが `/openapi.json` に反映され、実HTTPで200を確認できた
- 在庫検査（`tests/inventory.py`）は42画面中38件・36API中33件を直接確認でき、残り7件
  （`/folded/{key}` `/papers/{paper_id}` `/papers/{paper_id}/remove` `/api/papers/{paper_id}`
  `/api/todo/{key}` `/api/masters/{key}`。もう1件は在庫検査のカウント上の重複表記）は
  検査側の固定サンプル値（`_SAMPLE`）がこのプロジェクトの語彙・実データと一致しないための
  「確かめられない」であり、**実際に個別へ有効な値（`hospital_division` / `temp_save` /
  `price_item` / 作成直後の paper id）で叩くと全部200**であることを実測で確認済み
  （ルート欠落ではない）
- `python tests/run.py http://127.0.0.1:8415`（全17件）・`--only inventory` とも
  全件通過。詳細は `coordination/status/lane-d.md` の「完了の自己点検」を参照

## D-17: `action_button` マクロがb状態のリンク先を間違えていた（レーン本体・自分の実装バグ）

- **事実**: `_macros.html` の `action_button` は state が `"a"` 以外なら**常に** `/todo/{key}`
  へリンクしていた。しかし `/todo/{key}` のルーター（`refdata.py`）は
  `kind == "todo"`（C状態・3件）しか受け付けず、B状態（`kind == "folded"`）のキーを渡すと
  404になる
- **見つけ方**: D-12（受付・患者）で追加された `animal_history.html` の
  `action_button("監査ログ", "b", todo_key="audit_log")` を実際に踏むと
  `/todo/audit_log` が404だった（`audit_log` は `FOLDED_NOTES` にしかない）。
  在庫検査・crawlはこの画面の該当ボタンをリンクとして辿っていなかったため、
  それだけでは気づけなかった（＝またしても「作った（だがリンクが壊れている）のに
  緑」に近い穴。crawlは「辿れたリンク」しか見ないため、辿り方次第で漏れる）
- **対処**: `state == "b"` は `/folded/{key}`、`state == "c"` は `/todo/{key}` に
  振り分けるよう `_macros.html` を修正した
- **副作用の対処**: `animal_detail.html`（診察券発行／文書印刷）・`animal_new.html`
  （品種リスト）が使っていた `reception_id_card` / `reception_document_print` /
  `reception_breed_list` は `app/feature_notes.py` の `FOLDED_NOTES`（model.mdの表と
  1対1が契約）にも `TODO_NOTES` にも存在しないキーだった。この3件は
  勝手に新規キーを足さず（表との1対1を壊すため）、**ボタンごと削除**した
  （`spec/screens.md` 3番の「できること」に載ってはいるが、対応する契約ルート・
  マスタデータが無い機能のため）
- 修正後、`tests/run.py`（全17件）を再実行し、緑を再確認した

## D-18: 裁定R-21・R-22への対応、および書類の物理削除バグを自分で見つけて直した

- **R-22（`/ward` の目印）**: 実装漏れだった。`app/templates/ward/ward.html` の
  `screen("ward")` を `screen("ward-day")` に直した（`/animals/{karte_no}/ward` 用の
  `ward/animal_ward.html` は元から `screen("ward")` のままで正しい）
- **32画面のdata-testid欠落**: `_macros.html` の `screen()` マクロが `data-check` しか
  出しておらず `data-testid` を出していなかった（`spec/README.md` の2系統の片方だけ実装した
  実装漏れ）。マクロに `data-testid="screen-{{ key }}"` を追加し、ほぼ全画面が
  このマクロ経由だったため1箇所の修正で32画面すべてに反映された。例外は
  `/` と `/today`（同じ `front/today.html` を共有していたため、契約が要求する
  `screen-top` と `screen-today` を出し分けられていなかった）で、
  `today_screen()` がリクエストパスを見て `screen_key` を切り替えるようにした
- **R-21（書類は範囲内）を受けての確認**: `spec/screens.md` 13番「PDF以外の形式のファイルは
  取り込みを拒否する」については、**この実装にファイルアップロード自体が無い**
  （`Paper` は `title`/`note` のみを持つ台帳で、ファイル本体を扱わない設計に
  したため）。したがって「拒否する」判定は該当なし・未実装。指揮役へ報告する
- **R-21対応中に見つけた別の実装バグ（自己発見・修正）**: `spec/screens.md` 13番
  「満たすべきこと」に「取り消したPDFは一覧から消えるが、記録（行）自体は保持される
  （物理削除しない）」と明記されているのに、実装（`api_delete_paper` /
  `paper_remove`）は `db.delete(paper)` の**物理削除**になっていた。当初のコメントには
  「契約に restore が無いから物理削除でよい」と書いていたが、これは誤りだった——
  「物理削除しない」は restore ボタンの有無とは独立の別要件で、見落としていた。
  `models.Paper` に `removed_at`（Owner/Patient/Visitと同じ論理削除の型）を追加し、
  一覧系（`api_list_papers` / `papers_screen`）は `removed_at IS NULL` で絞り、
  削除系は `removed_at` に日時を入れるだけに直した。詳細取得（`api_get_paper` /
  `paper_detail`）は削除済みでも見られるようにしてある（記録が保持される、を
  実際に確認できるようにするため）

## D-19: 新しい在庫検査（画面でもAPIでもないルート）で /dm.csv・/postal の未実装を発見、実装した

- 指揮役が足した5つ目の在庫検査（`_NOT_SCREEN` に入っていた `/dm.csv` `/postal` `/healthz`
  が実際に応答するかを見る）で、`/dm.csv`・`/postal` を一度も実装していなかったことが
  分かった（元々の欠けリストでも「画面でもAPIでもない」ため対象外になっていて、
  誰も気づいていなかった）
- **`/dm.csv`**: `app/routers/front.py` に追加。`/dm` 画面と絞り込みロジック
  （`_dm_rows`）を共有し、書き写しによる食い違いを防いだ。ただし契約が定義する
  `type`/`field`/`span`/`from`/`to` クエリは、**元の `/dm` 画面自体がまだ対応していない**
  ため、`/dm.csv` 側でも今回は対応を見送った（「画面と同じ絞り込み」を守ることを
  優先し、`/dm` にだけクエリ対応を先に足す非対称は作らなかった）。次段階で `/dm`・
  `/dm.csv` 両方にクエリ対応を足す必要がある
- **`/postal`**: `app/routers/staff_api.py`（prefixなしの `no_prefix_router` を追加）に
  実装。**住所マスタ（郵便番号→住所の対応表）が `data/` に存在しない**ため、
  形式（`\d{3}-?\d{4}`）だけ検証し、正しければ契約どおり
  `{"candidates": [], "reason": "..."}` を返す。形式が壊れていれば422。
  実在の住所は一切返せない（データが無いため）
- **`/animals/{karte_no}/dosing/{kind_id}` `/animals/{karte_no}/prevention/{kind_id}`
  `/api/patients/{karte_no}/dosing/{kind_id}` `/api/patients/{karte_no}/prevention/{kind_id}`
  が在庫検査で422**: 検査のサンプル生成が `dosings[0].get('kind_id', dosings[0].get('kind'))`
  で、`data/seed.json` の `dosings` に `kind_id`（数値）が無く `kind`（文字列
  `"heartworm"`）しか無いため、`kind_id="heartworm"` という**文字列**が実際に渡っている。
  契約（openapi.yaml）は `kind_id` を `type: integer` と定義しており、この実装は
  契約どおり整数のパスパラメータとして受けている（文字列だと422になるのは正しい
  Pydantic/FastAPIの型検証）。**整数の kind_id（`prevention_kinds` の1始まり
  インデックス。heartwormは3番目なので `kind_id=3`）で実測すると4本とも200**:
  ```
  GET /animals/10004/dosing/3            -> 200
  GET /animals/10004/prevention/3        -> 200（または該当データがあれば200）
  GET /api/patients/10004/dosing/3       -> 200
  GET /api/patients/10018/prevention/1   -> 200
  ```
  したがってこれは実装の欠けではなく、**検査側のサンプル生成が`kind_id`と`kind`を
  混同している**ことによる誤検知（`tests/inventory.py` は自分の担当外のため直せない。
  指揮役へ報告する）

## D-20: 裁定R-23（kind_idの数値／文字列コード両対応）を適用した

- `app/routers/clinical_extra.py` の `kind_id` パスパラメータを `int` → `str` に変更し、
  `_resolve_kind_index()` に集約: 数字なら `prevention_kinds` への1始まりインデックス、
  数字でなければ `code` 完全一致で解決する（後方互換: 既存の数値idでの呼び出しは
  そのまま通る）。対象4ルート
  （画面2: `/animals/{karte_no}/dosing/{kind_id}` `/animals/{karte_no}/prevention/{kind_id}`、
  API2: `/api/patients/{karte_no}/dosing/{kind_id}` `/api/patients/{karte_no}/prevention/{kind_id}`。
  それぞれGET/POSTまたはGET/PATCH両方）
- 実測: `kind_id=3`（数値）・`kind_id=heartworm`（文字列コード）のどちらでも
  4ルートとも200を確認
- 再実行後、在庫検査は**1件だけ**残った: `/api/patients/{karte_no}/dosing/{kind_id}=404`
  （検査のサンプル `karte_no=10018, kind_id=3` の組み合わせ）。実測したところ、
  **patient 10018 は heartworm(kind_id=3) の投薬記録を持っていない**（`data/seed.json`
  の40件の投薬記録は特定の患者に偏って割り当てられており、10018は含まれない）。
  正しい組み合わせ（`karte_no=10004`）では同じAPIが200を返すことを確認した
  ```
  GET /api/patients/10018/dosing/3  -> 404（そのkindの記録がまだ無い患者。契約が
                                          定義する正しい404）
  GET /api/patients/10004/dosing/3  -> 200（記録がある患者）
  ```
  `GET /api/patients/{karte_no}/dosing/{kind_id}` はopenapi.yamlが404を正式なレスポンスとして
  定義している（「記録がまだ無い」を表す正しい404）ため、これは実装の欠けではなく、
  検算6・検算8で修正済みの「visit_idはkarte_noと対にする」と同じ構図の
  **サンプルのペアリング不足**（karte_noとkind_idも対にする必要がある）だと考えている。
  指揮役へ報告する

## D-21: 裁定R-20（記録0件は404でも500でもなく200で空を返す）を投薬APIに適用

- `GET /api/patients/{karte_no}/dosing/{kind_id}` が記録0件のとき404を返していた
  （R-20発行時点でこの実装はまだ無く、後から実装した際にR-20を見落として404にしていた）
- `_empty_dosing_dict()` を追加し、該当する `Dosing` 行が無いときは404の代わりに
  `id: null, patient_id, kind, fiscal_year(クエリ指定 or 当年), m01〜m12はすべて空文字`
  を200で返すようにした（`/animals/{karte_no}/dosing/{kind_id}` 画面側は元々0件でも
  200で空のマス目を出していたので、これで画面とAPIが揃った）
- 予防（`GET /api/patients/{karte_no}/prevention/{kind_id}`）は元から一覧形式
  （`{items: [], total: 0}`）で、0件でも200を返す実装だったため対応不要だった
- 実測: `GET /api/patients/10018/dosing/3` -> 200
  `{"id":null,"patient_id":18,"kind":"heartworm","fiscal_year":2026,"m01":"",...}`
- `python tests/run.py http://127.0.0.1:8415`（全19件）・`--only inventory`（全5件）
  とも全件通過を確認

## D-22: 共通CSS（/ui.css）を配り、全画面から読ませた

- `spec/ui.css` を1文字も変えず `app/static/ui.css` へコピーし、`/ui.css`（`/static/ui.css`
  ではなく直下）で配る専用ルートを `main.py` に追加した（`FileResponse`）
- 全画面が `base.html` を `{% extends %}` している構造だったため、`<link rel="stylesheet"
  href="/ui.css">` を `base.html` の `<head>` に1行足すだけで34画面すべてに反映された
  （`data-testid` を1箇所で直したときと同じ理由）
- `ui.css` が要求するクラス名に実装側を合わせた:
  - `_macros.html` の `success_banner`/`error_banner` を `banner-success`/`banner-error`
    → `success-banner`/`error-banner` に修正（ui.cssのセレクタと不一致だった）
  - `action_button` マクロと各テンプレートの `class="btn btn-action"`/`"btn btn-disabled"`
    を `class="button"`/`class="button disabled"` に統一（独自の `btn-*` は ui.css に
    定義が無く効いていなかった）
  - 金額・数量のセルに `class="num"`（会計・会計履歴・売上集計・マスタの該当列）
  - 基準の外にある検査値（`exam.html`）に `class="out-of-range"`（検算5「色だけで
    伝えない」に対応。判定欄の文字列と併用）
- 色・余白は一切自分で足していない（`ui.css` の中身は無改変）
- 実測: `GET /ui.css` -> 200、`spec/ui.css` と完全一致（diff差分なし）。
  `python tests/run.py http://127.0.0.1:8415 --only inventory`（全6件）・
  フル（全20件）とも全件通過
