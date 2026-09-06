# レーンB の質問と仮決め

**書式**: 止まらないものはここに書いて先へ進む（`PROTOCOL.md` 9）。
仮決めしたことは「仮決め」と明記する。**仮決めが仮決めと分からない形で紛れないようにするため**
（`ASSIGNMENT.md` レーンR の3つ目）。

---

## Q1. 画面は24枚か26枚か（止まらない・仮決め済み）

- `coordination/briefs/lane-b.md` には「**全24画面**」、内訳表も 8+5+3+4+5 = **25**
- `spec/README.md` には「**26画面すべて作る**」「`screens.md` — 26画面」

3つが食い違っている。

**仮決め: `spec/` に従う（26枚）。** 根拠は `spec/README.md` の
「**これが唯一の正**」と `PROTOCOL.md` 5（契約は `spec/` だけ）。
ブリーフの表は領域分けの目安として使い、枚数は `spec/screens.md` が出たらそちらへ合わせる。

**画面をまだ作っていないので、いま止まってはいない。** 契約が凍った時点で自動的に解消する。
違っていたら指摘してください。

---

## Q2. 共通テストはアプリをどう起動するのか（止まらない・仮決め済み）

`tests/` がまだ無いため、次のどちらか分からない。

- (a) テスト側が各レーンのサーバを起動する
- (b) レーンが起動しておき、テストは既知の URL へ繋ぐ

**仮決め: どちらでも困らない形にした。**

- `bin/rails server -p <番号>` の1コマンドで上がる（追加の手順が要らない）
- ポートは **`PORT` 環境変数でも受ける**（Rails 標準）。既定は Rails の 3000、
  いまの動作確認は **3002** を使った
- 起動前に必要なのは `bin/rails db:prepare` だけ

**レーンごとのポート番号を指揮役が決めるなら、`spec/` か `qa/` で指定してください。**
指定があればそれに合わせる。

---

## Q3. Active Storage を外したこと（止まらない・仮決め済み）

`stacks/rails` の生成時に Active Storage を外した。
`spec/screens.md` に「**書類**」画面があり、**ファイル添付を要求される可能性**がある。

**仮決め: 外したまま進む。** 契約が「ファイルの実体を保存する」と定めていた場合のみ、
`bin/rails active_storage:install` で後から足す（Rails 標準の手順で、あとから入れられる）。

理由は、いま入れると使わないマイグレーションが2本先に入り、
**契約が凍る前に DB の形を決めてしまう**こと。

---

## 記録: 題材のリポジトリは変更していない

`題材のシステムdocs/実装分担-2026-09-05.md` は `cat` で読んだだけ。書き込みは一切していない。

なお 題材のシステム は実行時点で `fix/screen-check-expected-set` ブランチにあり、
PDF 13件と `tools/check_screens.py` に**このレーンの作業とは無関係な変更が既に載っていた**。
このレーンは読み取りしか行っていないため、それらには触れていない。

---

## 記録: `config/credentials.yml.enc` は追跡され、`config/master.key` は除外されている（公開ゲート向け）

Rails の標準どおりの形で、**漏れではない**。

- `git ls-files stacks/rails | grep master.key` → **0件**（`stacks/rails/.gitignore:32` で除外・実測）
- `config/credentials.yml.enc` は**追跡されている**。中身は暗号化されており、鍵が無ければ読めない
- このレーンは Rails の credentials を**何にも使っていない**。中身は生成時の `secret_key_base` だけ

公開ゲートが暗号化ファイルを疑う可能性があるので、**先に書いておく**。
消す判断もできる（このレーンは credentials を使っていないため実害なく消せる）が、
Rails の流儀から外れるので**指揮役の指示があれば消す**。いまは標準のまま置いている。

---

## Q4.（重要）共通テストが叩くのは `/healthz`、起動文面には `/health` と書いてあった

- `tests/run.py` の smoke: `c.get_json("/healthz")`
- `coordination/briefs/lane-b.md`「いまやること」4: 「`GET /health` だけ作る」

**対応: 両方に応えるようにした。** `tests/` は凍結されているので、こちらを合わせた
（`PROTOCOL.md` 2・4）。`get "healthz"` と `get "health"` の2本を同じ
`HealthController#show` に向けてある。**テストの期待値は1文字も触っていない。**

他レーンも同じ食い違いを踏むはずなので、**起動文面の側を直すことを勧めます**。

---

## Q5. `spec/model.md` は「14」と書いてあるが、並んでいるのは15（止まらない・仮決め済み）

見出しは「**変わるもの（14）**」だが、実際に番号が振ってあるのは
1 Clinic 〜 15 Hospitalization の**15件**。冒頭の「28モデルある。この企画は14に絞る」とも合わない。

**仮決め: 並んでいる15件すべてを作る。** 見出しの数字より、
**具体的に書いてある表のほうが実装の指示として強い**と判断した。

---

## Q6. `Hospitalization.care_records` をどう持つか（止まらない・仮決め済み）

`spec/model.md` 15 は `care_records | 記録の並び | 投薬・給餌・計測。**実施者を必ず持つ**` とだけ書いてある。
形（JSON の列か、子テーブルか）は決まっていない。

**仮決め: 子テーブル（`care_records`）にする。**

- `model.md` 冒頭に「**決まっているのは「何を持つか」であって「どう持つか」ではない**」とある
- 「**実施者が空の記録行を作らない**」を Rails のバリデーションで担保するには、行が行として在るほうが素直
- JSON の列だと、実施者の欠落を弾く仕掛けを自前で書くことになる

**結果としてテーブルは15ではなく16になる。** 新しい概念を足したのではなく、
`Hospitalization` の中の並びを Rails の流儀で表しただけ、という位置づけ。
違っていたら指摘してください。

---

## Q7. いま何を待っているか（保留中・自分で決めない）

**モデル層（`spec/model.md` の15件）を先に作るかどうかを保留している。**

- `PROTOCOL.md` 9 は「**待たない**」と言っている
- しかし起動文面は「**共通テストの1件目を通したら、全レーンの足並みが揃うのを確認してから本格的な実装に入る**」と、
  **段取りとして**待つことを指示している

**待つほうを採った。** 9 が禁じているのは「**質問の答え待ちで止まること**」であって、
足並みを揃えるための関門ではない、と読んだ。**ここで先へ走るのは、関門を置いた意味を消す。**

合図があれば、次はこの順で進む。

1. `spec/model.md` の15モデル＋`care_records` の migration とモデル（**統合点なので自分で書く**）
2. 固定データ（`data/*.json`）の読み込み。**まだ `data/` が存在しないので着手できない**
3. 26画面を5領域へ分けてサブエージェントへ（**領域ごとに別の指示文**を書く）

---

## Q8. `spec/model.md` は「書類（紙カルテPDF取込）」を落としたと書いているが、`screens.md` #13・`openapi.yaml` は動く画面として定義している（止まらない・仮決め済み）

- `model.md`「落としたもの」: `KartePdf`（紙カルテの取込）— 理由「ファイルの取り扱いが主題になってしまう」
- `spec/screens.md` #13「書類」: 状態Aの画面として「PDFを取り込む」「取り消す」等の操作を明記
- `spec/openapi.yaml` の `Paper` スキーマ: `id / patient_id / title / note / created_at` のみ。
  **PDFの実体（バイナリ）を持つフィールドが無い。**

**仮決め: 「書類」は実装する。ただしPDFの実体は保存しない。** `Paper` を
「タイトル・メモだけを持つ記録」として作る（openapiのスキーマどおり）。
これなら `model.md` が心配していた「ファイルの取り扱いが主題になる」ことを避けつつ、
`screens.md`／`openapi.yaml` が要求する「動く画面」を満たせる、と読んだ。
**実際のPDFアップロード欄は作らない。**

---

## Q9. `Prevention` に担当医が要るが、`openapi.yaml` のスキーマに `staff_id` が無い（止まらない・仮決め済み）

- `spec/screens.md` #12「予防」: 「実施内容・実施日・（空なら自動計算の）次回予定日・**担当医**・メモを
  入力して保存する」「担当医は未選択でも保存できる」
- `spec/openapi.yaml` `Prevention` スキーマ: `id/patient_id/kind/content/performed_date/next_due_date` のみ。
  `staff_id` が無い

**仮決め: `staff_id`（nullable）を追加する。** 画面の要求が具体的かつ検算可能な形で書かれており、
スキーマ側の書き漏れと判断した。

---

## Q10. `CareRecord.kind` と `seed.json` の `category` が名前違い（止まらない・仮決め済み）

`openapi.yaml` の `CareRecord` は `kind`（`medication`/`feeding`/`measurement`）。
`data/seed.json` の `hospitalizations[].care_records[]` は同じ語彙を **`category`** というキーで持つ。

**仮決め: DBの列名は `kind`（openapiに合わせる）。取込時に `category` → `kind` で読み替える。**
契約（`openapi.yaml`）が正なので、フィールド名はそちらに揃えた。

---

## Q11. 投薬・予防の `kind_id`（整数）とマスタの `code`（文字列）が噛み合わない（止まらない・仮決め済み）

`openapi.yaml` は `/animals/{karte_no}/dosing/{kind_id}` 等で `kind_id` を**整数**としているが、
`data/masters.json` の `prevention_kinds` / 相当する投薬種別は **`code`（文字列）** で持っている
（`data/seed.json` の `Dosing.kind` / `Prevention.kind` も文字列コード）。

**仮決め: マスタ配列の**インデックス+1**を `kind_id` として採番する。**
`data/masters.json` は生成し直さない限り並びが変わらない（`make_data.py` の `SEED` 固定・
`README.md`「2回流すと完全に同じ出力になる」）ため、安定した対応がとれる。
`FixedData::Masters` に `kind_id → code` の変換を集約し、各画面・APIはそこだけを参照する。

**投薬（Dosing）の種別マスタが `data/masters.json` に見当たらない。** `prevention_kinds` を
流用する（`data/README.md`「種別は `data/masters.json` の予防の種別と共通」と `spec/screens.md` #11に
明記あり）。

---

## Q12. すべて解消・共通テストのsmokeも通ったまま。実装フェーズへ入る

契約一式（`model.md` `screens.md` `acceptance.md` `openapi.yaml` `data/`）と裁定
（`qa/rulings.md`）を読み終えた。**画面数の食い違い（Q1）は26で解消済み**（裁定・screens.mdとも26）。
`/health` と `/healthz` の食い違い（Q4）は両対応で解消済み。

ここからモデル・共通基盤（migrations・models・固定データの読み込み・会計/売上計算・
レイアウト・ルーティング）を自分で書き、そのあと26画面を5領域のサブエージェントへ分ける。

---

## Q13.（重要）`tests/checks.py` の money 検算が読むフィールド名が `spec/openapi.yaml` と食い違う（止まらない・仮決め済み）

`/health` / `/healthz`（Q4）と同種の食い違い。`--only money` を実装する際に見つけた。

| 項目 | `spec/openapi.yaml` の命名 | `tests/checks.py` が実際に読む命名 |
| --- | --- | --- |
| `/api/billings/{id}` の税抜合計 | `taxable_subtotal` + `nontaxable_subtotal`（内訳2本） | `net_amount`（1本） |
| 同、未算入行数 | `excluded_detail_count` | `excluded_count` |
| 同、税込合計 | `total` | `total_amount` |
| `/api/sales/summary` の内訳 | `rows`（`group_by` で選んだ1軸のみ、`period/subtotal/tax_amount/total/...`） | `by_category` / `by_staff` / `by_date`（3軸を**同時に**返す必要がある。検算1が3方向一致を取るため） |
| 同、総合計 | `total_amount` | `total_net_amount`（`total_amount` があればそちらでも可: `body.get("total_net_amount", body.get("total"))`） |
| 同、構成比 | スキーマに無い | `by_category` の各行に `share_pct`（合計100.0を検算） |
| 同、`from`/`to` | 必須パラメータ | **検算1はパラメータ無しで叩く**（全期間が対象） |

**仮決め: `tests/` 側の命名を実装する。両方の命名を同じレスポンスに含める。**
根拠は Q4 と同じ（`PROTOCOL.md` 2・4、`tests/` は凍結）。openapi 側の命名も併記して
残してあるので、後で screens.md 側の実装で openapi 準拠の値が要るときはそのまま使える
（`rows[].tax_amount` 等、money検算が触れない部分は分類軸の値で近似した仮の値になっている。
screens.md 側で厳密化が必要になったら直す）。

`from`/`to` 省略時は日付で絞り込まない（`SalesSummaryCalculator` を nil 許容に変更）。

**他レーンも同じ食い違いを踏むはずです。** money を実装するときに気をつけてください。

---

## Q14.【解消済み】`tests/checks.py` の `_data_check` バグ（指揮役が修正済み・当時の記録として残す）

**この節は指揮役によって解消済みです。** 発見はレーンAが先で、こちらの発見・報告と
ほぼ同時期に重なった（メッセージが行き違いになった）。`_data_check` はいまは
`html.parser`（`HTMLParser`）ベースで書き直されており、要素の入れ子は正しく扱える。
**下記の「ネストで包むと読み飛ばす」制約はもう存在しない。**

このレーンの実装（`_visits.html.erb` で `data-check` の値要素を他要素で包まない・
`layout: false` にする、等の回避策）は、修正後のチェッカーでも**引き続き緑のまま**
（実測済み・再発防止に無害なので直していない）。**今後 screens.md の本実装をする際は、
無理にこの回避策に合わせる必要はない。** 以下は当時のバグの実測記録として残す。

`--only screen` の実装中に発見。**これは実装の書き方の問題ではなく、`tests/checks.py` の
`_data_check` ヘルパーの正規表現の性質による制約**なので、5レーン全部が同じ壁にぶつかる。

### 何が起きるか

`_data_check` は次の正規表現でタグを1つずつ消費する素朴な実装:

```python
r'<([a-zA-Z][\w-]*)\b([^>]*?)>(.*?)</\1>'
```

`re.finditer` は**非重複**でマッチを返す。最初に見つかった開始タグから、
**そのタグ名と同じ最初の閉じタグ**までを1マッチとして消費し、**消費した範囲の中はもう二度と
見ない**。これが原因で、次のように**値を持つ `<span data-check="...">` を何か別のタグで
包むと、外側のタグに `data-check` が無い限り、中の `data-check` ごと丸ごと読み飛ばされる**。

実測（`python -c` で `re.finditer` を直接検証済み）:

```html
<!-- これは検出できない（<div> に飲み込まれる） -->
<div><span data-check="x">1</span></div>

<!-- これも検出できない（<table>→<tr>→<td> と何重に包んでも同じ） -->
<table><tr><td><span data-check="x">1</span></td></tr></table>

<!-- これは検出できる（span が「他の要素に包まれていない」） -->
<span data-check="x">1</span><span data-check="y">2</span>

<!-- 外側のタグ自身が data-check を持てば、中に何を書いても検出できる -->
<tr data-check="x"><td>1</td></tr>
```

さらに悪いことに、**ページ全体を `<html>...</html>` で包む標準的なレイアウトも同じ理由で
即死**する（`</html>` はページに1つしか無いので、`<html>` タグが文書全体を1マッチとして
飲み込み、中の `data-check` が全部消える）。`application.html.erb` の既定レイアウトを
そのまま使うと、画面系の検算（3・4・5）は**何を書いても常に0件**になる。

### 仮決め: 対応方法

1. **`data-check` を持つ要素を、他の要素で囲まない。** 値を表示する `<span data-check="...">`
   は、`<td>` や `<div>` の子にせず、地の文の直後に**兄弟として**並べる
   （`stacks/rails/app/views/karte/_visits.html.erb` 冒頭のコメント・実装を参照）。
2. `data-check` を画面全体で使うページ（カルテ・カルテ印刷など）は、**標準レイアウト
   （`<html>`一式）を使わず `render layout: false` にする。**
3. 逆に、`data-check` を使わない一般画面（検算8のクローラーが辿るだけの画面）は、
   通常のレイアウトのままで問題ない（クローラーは `href="..."` を単純な属性正規表現で
   拾うだけで、この入れ子問題の影響を受けない）。

### 検算5（`/api/lab-tests/{id}`）がこの問題に引っかからなかった理由

検算5はHTML画面ではなく**JSON API**を読む（`c.get_json(f"/api/lab-tests/{id}")`）ため、
この問題の対象外。screens.md #10「検査」画面（HTMLで判定欄と色を出す方）を実装するときは、
上記1・2と同じ配慮が要る。

**他レーンも screen 組（検算3・4・5）に入るときに同じ壁に当たるはずです。** 早めに共有します。

---

## Q15.【解消済み】検算8のクロールでヘッダの大文字小文字違いに当たった（指揮役が修正済み）

`--only crawl` の実装中、トップページから1画面しか辿れない不具合に当たった。

**原因**: Rack 3（このアプリの `rack (3.2.7)`）はレスポンスヘッダのキーを**小文字**
（`content-type`）で扱う仕様。一方、当時の `tests/checks.py` の `_dead_links` は
`headers.get("Content-Type", "")`（大文字始まり）で読んでいたため、常に空文字列と
判定され、リンクを1件も拾えなくなっていた。

一度 `CanonicalHeaders` という Rack ミドルウェアを書いて送出前にヘッダを
大文字始まりへ揃えようとしたが、**Puma がソケットへ書き出す直前にヘッダ名を
小文字へ揃え直すため効かなかった**（`bin/rails middleware` でミドルウェア自体は
ロードされているのに、`curl -I` で見るとやはり小文字のまま）。

調べ直したところ、指揮役がほぼ同時期に `tests/checks.py` 側を
`headers.get("content-type", "")`（小文字）へ既に修正していた。効かない
ミドルウェアと `config/application.rb` への追記は削除し、後始末した。

**教訓**: HTTPヘッダ名は本来大文字小文字を区別しない。今回のように片側だけ
大文字小文字を区別する比較をすると、Rack 3・ASGI（FastAPI等）のように
小文字を仕様にしているスタックだけが割を食う。他レーンで同様の「クロールが
1画面しか辿れない」系の失敗が出たら、まずヘッダの大文字小文字を疑うとよい。

---

## Q16. 在庫検査（`tests/inventory.py`）が拾った20件のうち、実際にコードが足りなかったのは何件か（仮決め・記録）

指揮役から「画面8件・API12件が404」として渡された20件を1つずつ実測してから直した。
**結論: コードが本当に無かったのは papers 一式（画面のみ）だけ**。残りは検証の仕組み側の
制約で、実装は元から動いていたか、動詞（GET/POST）を追加するだけで直る話だった。

### 内訳

| 分類 | 件数 | 例 | 対処 |
| --- | --- | --- | --- |
| 実装が丸ごと無かった | 1 | `PapersController`（screen）が存在しない | 新規作成（index/show/create/remove/no_paper + views） |
| 動詞がGETに無い（POST専用の契約通りの実装） | 10 | `karte/cancel`・`karte/{visit_id}/delete`・`karte/{visit_id}/restore`・`papers/{paper_id}/remove`・`reservations/{id}/cancel`・`api/patients/{karte_no}/delete,restore,receptions`・`api/visits/{visit_id}/delete,restore`・`api/reservations/{id}/cancel` | `tests/inventory.py` の `_probe` はGETしか送らない。**Go実装（`stacks/go/internal/server/karte_writes.go`）を確認したところ、net/http の method-specific pattern はGETを405で返す**（404ではない）ため無傷で通っていた。同じ動詞違いを405にするため、`ApplicationController#method_not_allowed` / `ApiController#method_not_allowed` を新設し、GETルートを追加した（実処理は変えていない。GETで削除・復元が走ることは無い） |
| サンプル値がこのアプリの語彙・データと噛み合わない（実装は正しい） | 3〜4 | `/todo/{key}`（サンプル`reception`は実在の3キーのどれでもない）・`/settings/master/{key}`（サンプルは`reception`だが正しいキーは`reception_kind`）・`/api/masters/{key}`（同左）・`/api/owners/{owner_no}/billings`（サンプルは`1`だが実際の形式は`O-00001`） | **直さなかった**。`spec/openapi.yaml` は両方とも「未知のkeyは404」と明記しており、Go実装（`stacks/go/internal/settings/masters.go`・`stacks/go/internal/server/todo.go`）も同じキー語彙・同じ404仕様。サンプルを通すために語彙を歪めるのは契約違反になるため、404のままにして実測結果をここに記録するに留めた |
| データが1件も無い | 1 | `/animals/{karte_no}/karte/{visit_id}/print` は `karte_no=10002` + `visit_id=1` の組み合わせがそもそも同じ患者に属さない（`visit_id=1` は別患者）。同じ理由で `delete`/`restore` も影響 | Go実装が既に同じ問題に当たっていて「visit_idだけで引く（karte_noとの一致は要求しない）」と仮決め済み（`karte_writes.go` のコメント）。**同じ仮決めをRails側にも適用**（`KarteController#print_visit / #delete_visit / #restore_visit` を `@patient.visits.find` から `Visit.find` へ変更）。検算4・検算9の集計（`visit_no`・患者ごとの一覧）には影響しない（表示は常にURLの`karte_no`側で組み立てる） |

### まだ直っていない・スコープ外に置いたもの（次に見る人へ）

在庫検査は404/501/0だけを「無い」と見るため、**500（例外）は検出できない**。
今回の作業中に以下がすべて500（コントローラ未実装）であることを見つけたが、
指揮役から渡された20件には含まれていなかったため、手を付けていない。

- `Api::ReceptionsController`（`/api/receptions` 一覧・作成。`Api::PatientsController#create_reception` とは別オペレーション）
- `Api::PapersController`（`/api/patients/{karte_no}/papers`・`/api/papers/{paper_id}`。screen側の`PapersController`は今回新規作成したが、APIの方は未着手）
- `Api::PreventionsController` / `Api::DosingsController`（`/api/patients/{karte_no}/prevention,dosing/...`）
- `Api::StaffController` / `Api::FeaturesController` / `Api::PostalController`
- screen側の `PreventionsController` / `DosingsController`（`animals/{karte_no}/prevention,dosing/{kind_id}`）も同様に未実装（500）

いずれも `app/controllers/api/` または `app/controllers/` にファイルが無いだけ
（`uninitialized constant`）で、ルーティング自体は `config/routes.rb` に既にある。
在庫検査を「404が0件」で見ると緑になるが、**実際にはまだ大きく欠けている**
（今回の指揮役の反省と同じ構図が別の場所にまだ残っている、ということ）。

---

## Q17. 訂正後の11件（画面4・API7）+ 従来から500だった分をすべて実装（仮決め・記録）

指揮役から「20件は誤りで実際は11件」と訂正が来た。訂正後の実測（`--only inventory`）では
`karte/cancel`・`karte/{visit_id}/delete,restore`・`reservations/{id}/cancel`・
`api/patients/{karte_no}/delete,restore,receptions`・`api/visits/{visit_id}/delete`は
**Q16で対応済みの405化がそのまま効いていて、すでに「ある」判定になっていた**
（405は404/5xxのどちらでもないため「無い」に数えられない）。

その代わり、判定器が新しく「500も無いに数える」よう直った（`inventory.py` のコメント参照）
ことで、Q16で「スコープ外」として報告していた500系がそのまま今回の対象に浮上した。
実装したもの:

| 対象 | 内容 |
| --- | --- |
| `DmController` の `LoadError: cannot load such file -- csv` | `csv` gem が Gemfile に無い（依存追加はレーンの裁定範囲外。`settings_controller.rb` import_survey と同じ方針）。gem追加ではなく**自前でCSVを組み立てる**方式に書き換えた（`csv_escape` を追加） |
| `DosingsController`（画面）・`Api::DosingsController` | 新規実装。`{kind_id}` は整数（マスタ行id）とコード文字列の両方を受け付ける（`FixedData::Masters.kind_by_code_or_id` を追加）。**Go実装 `dosing.go` の `resolveKind` と同じ仮決め**。記録が無い年度は404にせず空欄の年間記録を200で返す（Go `clinical_api.go handleAPIDosing` と同じ仮決め） |
| `PreventionsController`（画面）・`Api::PreventionsController` | 新規実装。同じく `kind_id` を整数/コード文字列両対応 |
| `Api::PapersController` | 新規実装（index/create/show/destroy）。screen側は既存（Q16で実装済み） |
| `Api::ReceptionsController` | 新規実装（index/create/show/update）。`Api::PatientsController#create_reception` とは別オペレーション（`api_create_reception` は患者IDを本文で指定する汎用の受付登録） |
| `Api::WardsController` | 新規実装（index。`/api/ward`＝指定日に入院中の患者一覧） |
| `Api::StaffController` | 新規実装（index。`Staff#as_json` が既にpassword_hashを除外済みなのでそのまま使える） |
| `Api::FeaturesController` | 新規実装（index/todo）。`TodosController::ITEMS` / `FoldedController::ITEMS` をそのまま参照し、中身を二重に持たない |

### 確認結果

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
全 4 件 通過（画面38/42・API33/36。残り7件は「確かめられない」＝papers/folded/todo/mastersの語彙。0件が「無い」）

$ python tests/run.py http://127.0.0.1:8414
全 18 件 通過
```

新規実装した分は curl で手動確認済み（画面のCSRFトークンを取得して実POST、
JSON APIも実際にPATCH/POSTして値が変わることを確認）。確認に使ったテストデータ
（Dosing id=41, Prevention id=81）は確認後に削除して開発DBを元に戻した。

---

## Q18. Api::PostalController の確認と、ついでに見つけた2件の直し（仮決め・記録）

指揮役から「Api::StaffController / Api::FeaturesController / Api::PostalController が
この中か『あるが別の形』かを実測で確かめてほしい」と依頼があったので実測した。

- `Api::StaffController` / `Api::FeaturesController` は Q17 で既に実装済み（画面・API共に「ある」）
- `Api::PostalController` は**「あるが別の形」だった**。`spec/openapi.yaml` のパスは
  `/postal`（`/api` 配下ではない）なのに、`config/routes.rb` は `namespace :api` の中に
  `get "postal", to: "postal#show"` と書いていたため実際のURLは `/api/postal` になっていた。
  かつ `Api::PostalController` 自体も存在せず500。**新規実装**（`FixedData::Postal`・
  `PostalController`（最上位）・`config/routes.rb` に `get "postal", to: "postal#show"` を追加）。
  郵便番号→住所の対応表はGo実装（`stacks/go/internal/settings/postal.go`）と同じ架空データ・
  同じ地名を使った（実在の郵便番号APIは使わない。coordination/DECISIONS.md 第3節）。
  `/api/postal` は互換のため残し、`/postal` の同じコントローラへ向け直した

ついでに指揮役が直接指摘してくれた新しい在庫検査（`_others`：CSV配信・死活・外部照会）で
2件見つかった:

- **`/dm.csv` が406（別原因）**: `get "dm", to: "dm#index"` を `get "dm.csv"` より先に書いていたため、
  Railsが自動付与する `(.:format)` により `/dm.csv` が `dm#index`（format=csv）に奪われ、
  csv用テンプレートが無くて `ActionController::UnknownFormat` になっていた。
  **`dm.csv` のルートを `dm` より先に書く**よう順序を入れ替えて解消（`config/routes.rb`）
- **`/postal` がcode省略時422**: 死活確認のような単純GETでも422になっていた。
  spec上は必須パラメータの欠落なので422も文脈的には妥当だが、**裁定R-20と同じ考え方**
  （記録が無い＝異常ではない）を適用し、code省略時も `{candidates: [], reason: "..."}` を
  200で返すよう変更（`PostalController#show`）

### 確認結果

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
全 5 件 通過（新しい「画面でもAPIでもないルート」検査を含む）

$ python tests/run.py http://127.0.0.1:8414
全 19 件 通過
```

---

## Q19. 共通CSS `/ui.css` の配布とHTML構造の統一（仮決め・記録）

指揮役の指示（案B・見た目を5実装で揃える）に対応した。

- `spec/ui.css` を1文字も変えず `stacks/rails/public/ui.css` にコピーし、`/ui.css` として配信
  （Railsは `public/` 配下を静的配信するので、asset pipelineのダイジェスト名を避けられる）
- `app/views/layouts/application.html.erb` の `<head>` に
  `<link rel="stylesheet" href="/ui.css">` を追加（全画面がこのレイアウトを共有しているので
  1箇所の変更で足りる。`layout: false` の印刷用フラグメント（`karte/print` 等）は
  `<html>` を持たないため判定器の対象外——`_ui` チェックの実装がそこを見て確認した）
- クラスを3種追加: `num`（会計・売上の金額/数量セル。`accounting/show,history` `sales/index`）・
  `out-of-range`（検査の基準外値。`exams/show`。値セルと判定セルの両方に付けた）・
  `disabled`（B/C状態の偽ボタン2件。`/folded/hospital_division` `/todo/reception_done_delete`。
  既存の `aria-disabled="true"` は消していない）
- `data-testid` / `data-check` は一切変更していない

### 確認結果

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
全 6 件 通過（新しい「見た目」チェック含む）

$ python tests/run.py http://127.0.0.1:8414
全 20 件 通過
```

---

## Q20. 灰色のボタン3つ（一時保存／完了全削除／完了削除）を揃えた（記録）

`TodosController::ITEMS` は元から3キーとも定義済みだったが、**画面から実際にリンクしていたのは
`reception_done_delete`（完了削除）1つだけ**だった（レーンAが全文検索で発見・指揮役が確認）。

- `/today`（`app/views/receptions/index.html.erb`）に「完了全削除」（`/todo/reception_done_all_delete`）を追加
- `/animals/{karte_no}/karte`（`app/views/karte/show.html.erb`）に「一時保存」（`/todo/temp_save`）を追加

いずれも `class="disabled"` `aria-disabled="true"` を付けた**押せる見た目のボタン**で、消していない
（spec/README.md「押せる見た目のまま無効。消さない」）。キー名は既存の `TodosController::ITEMS` の
3キーをそのまま使った（契約はenumを固定していないため、語彙を変える必要は無かった）。

`karte/show.html.erb` は `_visits` パーティシャル（画面・印刷で共有）を呼ぶだけの薄いテンプレートで、
一時保存ボタンは印刷（`karte/print.html.erb`）には影響しない別ファイルに置いた
（印刷フラグメントに余計なボタンを混ぜないため）。

### 確認結果

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
全 8 件 通過（新しい「契約 押しても何も起きないボタンにしない」チェック含む）

$ python tests/run.py http://127.0.0.1:8414
全 22 件 通過
```

---

## Q21. 開発DBが古い `data/seed.json` のままだった（指揮役の実測で発覚・記録）

指揮役から「owner id=18 の氏名が `data/seed.json` と食い違う」と指摘があった。実測したところ、
姓（`name_kanji` `name_kana`）だけが古い値のままで、住所・電話は一致していた
（住所・電話は生成ロジック上たまたま変わっていなかっただけとみられる）。

**古い姓は報告・コード双方に書かない**（指揮役の注意どおり。過去に公開ゲートで
引っかかった経緯があるため）。指すときは `owner id=18` で統一する。

### 対応

1. `bundle exec rails db:seed` で `data/seed.json` から入れ直した
   （`db/seeds.rb` は変更禁止だが、実行は妨げられていない）
2. owner id=18 の `name_kanji` `name_kana` `phone` `address1` が `data/seed.json` と
   一致することを実測で確認
3. owners（5件おき8件）・patients（6件おき10件）・staff（全10件）・visits（20件おき10件）・
   clinic の主要文字列項目、計95項目をサンプル突合し、**全一致**を確認
4. 入れ直し前後で `/api/sales/summary` の `total_net_amount` が **5,185,704円のまま**変化しないことを確認

### 確認結果

```
$ python tests/run.py http://127.0.0.1:8414 --only inventory
全 10 件 通過（新しい「書き込み」「データ」チェック含む。データ照合は30項目一致）

$ python tests/run.py http://127.0.0.1:8414
全 24 件 通過
```

**原因の見当（未確認）**: いつ・なぜ古いデータが入ったままだったかは追っていない。
一時的な作業用DBのまま`db:seed`を再実行せずに使い続けていた可能性が高いが、断定はしない。
