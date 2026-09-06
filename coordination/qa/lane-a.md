# レーンA の質問と仮決め

**書き方**: 止まらない質問はここに書いて先へ進む（`PROTOCOL.md` 9）。
仮決めしたことは**仮決めと分かる形で**残す。
実装に溶けて誰も気づけなくなるのを防ぐため（レーンRが見る3点目）。

---

## Q-A-01 画面数が 24 / 25 / 26 で食い違っている（止まらない）

| 出どころ | 数 |
| --- | --- |
| `briefs/lane-a.md` の本文 | 「全24画面」 |
| `briefs/lane-a.md` の領域表を数えたもの | **25**（8＋5＋3＋4＋5） |
| `PLAN.md` の領域表 | **26**（既存24＋新規2。領域3に「売上集計（新）」がある） |
| `spec/README.md` | 「26画面すべて作る」 |

`briefs/lane-a.md` の領域表には `PLAN.md` にある**売上集計（新）が無い**。
本文の「24」は既存画面の数で、新規2枚を足す前の数と読める。

**仮決め**: `spec/screens.md` が出たらそれに従う。それまで画面は作らない
（土台の段階なので実害が無い）。**この食い違いは指揮役に直してほしい**が、
いま止まってはいないので直接は言わない。

---

## Q-A-02 JSON の `Content-Type`（止まらない・要確認）

**仮決め**: `application/json`（`charset=utf-8` を付けない）。

- RFC 8259 は `application/json` に charset 引数を定義していない
- テストが完全一致で見る場合、付けないほうが通りやすい

`spec/openapi.yaml` に書かれていればそれに合わせる。**5実装で揃っている必要がある**ので、
契約に無ければ指揮役に決めてほしい項目。

---

## Q-A-03 JSON 本文の末尾改行（止まらない）

**仮決め**: 付けない。`{"status":"ok"}` の15バイトちょうどを返す。

Go の `json.NewEncoder(w).Encode` は末尾に `\n` を足す。使わずに `json.Marshal` してから書いた。
本文をそのまま突き合わせるテストがあると、改行1文字で落ちるため。
**他レーンの既定と食い違う可能性が高い箇所**（第3段階の突き合わせ候補）。

---

## Q-A-04 経路はあるがメソッドが違うとき（止まらない）

**仮決め**: `405 Method Not Allowed`（`net/http` のメソッド付きパターンの既定）。
未知のパスは `404`。契約に別の定めがあればそれに従う。

---

## Q-A-05 JST の持ち方（止まらない・決着済み）

**決め**: `time.FixedZone("JST", 9*3600)` を使う。`time.LoadLocation("Asia/Tokyo")` は使わない。

Windows には tzdata が入っていない場合があり、環境によって集計の月境界がずれる。
契約が JST を要求している以上、環境に依存させない
（`internal/config/config.go` の `JST`）。

---

## Q-A-08 openapi.yaml と tests/checks.py で応答の項目名が食い違う（止まらない）

`GET /api/billings/{id}` と `GET /api/sales/summary` について、**2つの凍結文書の要求が違う**。

| | `spec/openapi.yaml`（Billing / SalesSummary スキーマ） | `tests/checks.py`（実際に採点する側） |
| --- | --- | --- |
| 伝票の税抜合計 | `taxable_subtotal` + `nontaxable_subtotal` | `net_amount` |
| 伝票の未算入件数 | `excluded_detail_count` | `excluded_count` |
| 伝票の税込合計 | `total` | `total_amount` |
| 消費税額 | `tax_amount` | `tax_amount`（一致） |
| 売上集計の内訳 | `rows`（`group_by` で選んだ1軸だけ） | `by_category` / `by_staff` / `by_date`（3軸を同時に返す） |
| 売上集計の総合計 | `total_amount` | `total_net_amount` または `total` |
| `/api/sales/summary` の `from`/`to` | 両方 `required: true`（無いと 422 想定） | **パラメータ無しで呼ぶ**（`tests/checks.py` の `_sales_three_ways`） |

**仮決め**: 採点する側（`tests/checks.py` = 実際に緑/赤を決める判定）を主に置きつつ、
JSON は両方の項目名を同時に返す形にした（余分なキーがあっても壊れない）。
`from`/`to` は未指定なら無制限（全期間）として扱い、422 にはしない。

理由: 「実装のほうを疑う」原則は実装のバグを疑う話であって、**2つの凍結文書自体が
矛盾している**場合はどちらかを選ばざるを得ない。5実装が同じ判定で緑になる必要がある以上、
`tests/` が実際に読む形を優先した。`spec/openapi.yaml` 側の項目名も同時に満たしているので、
どちらの文書を正としても壊れない状態にしてある。

**実装した場所**: `stacks/go/internal/server/billing.go`（`billingAmountsJSON` / `salesSummaryJSON`）。

これは5実装で認識が割れやすい箇所なので、**契約を1本化してもらえると次の段階が楽になる**。

---

## Q-A-10 `tests/checks.py` の `_data_check` が、完全なHTML文書からは値を1つも読めない（**止まる・全レーン共通の可能性が高い**）

**実測**（`stacks/go` の実装で確認。ロジックの問題ではなく正規表現そのものの性質）:

```python
>>> import re
>>> html = '<!DOCTYPE html><html><head></head><body><span data-check="x">1</span></body></html>'
>>> pattern = r'<([a-zA-Z][\w-]*)\b([^>]*?)>(.*?)</\1>'
>>> [m.group(1) for m in re.finditer(pattern, html, re.S)]
['html']
```

**原因**: `re.finditer` は最も左で成立する開始位置から**貪欲でなく最短**にマッチを試みる。
文書中に `</html>` は末尾に1個しか無いため、最初に見つかる `<html ...>` を開始点とする
マッチは、**その `.*?` が文書の残り全部（`<span data-check="x">` を含む）を飲み込んで
初めて成立する。** 結果、`finditer` はこの1個（文書全体）だけをマッチとして返し、
検索位置がそこで終わるため、**中に入れ子になっている `data-check` 要素は一切見つからない**。

**確認したこと**:
- これは私（Go実装）のHTMLの書き方の問題ではない。`<!DOCTYPE html><html>...</html>` という
  ごく標準的な構造を持つHTML文書であれば、**どの言語・どのスタックで作っても同じ結果になる**
  （正規表現自体の性質のため）。
- 実際、`stacks/go` で `/animals/{karte_no}/karte` に `data-check="progress_note.temperature_c"`
  等を正しく埋め込んだ画面を用意したが、`python tests/run.py --only screen` の
  検算3・4は `_data_check` が0件しか返さず不合格になった。`curl` や素の正規表現で
  同じHTMLを直接読むと値は正しく取れている。
- `checks.py` 内の他の合格しているテスト（検算5・9等）は `_data_check` を経由しない
  （JSON APIまたは別ロジック）ため、**この不具合はまだどのレーンの結果にも表面化していない
  可能性が高い**（screen組に着手したのが私が最初のため）。

**仮決めできない理由**: `tests/` は凍結対象で変更できない。かといって、完全なHTML文書を
返さない実装（`<html>` を省く等）は仕様（画面）として不自然。**私の側の作り方では
回避しようがない**ため、ここで止まって報告する。

**指揮役への相談**: `tests/checks.py` の `_data_check` の正規表現を直す必要があると考える
（例: `re.finditer` の代わりに `html.parser` を使う、または非貪欲マッチが同名タグの
入れ子・後続を正しく扱えるロジックに直す）。5レーン共通の土台なので、**1箇所直せば
全レーンに効く**。

---

## Q-A-06 保存先（まだ決めない）

契約（`spec/model.md`）が凍っていないので**決めない**。判断材料だけ実測して置く（2026-09-05）。

| 実測したこと | 結果 |
| --- | --- |
| `CGO_ENABLED` | `0`。gcc も入っていない |
| cgo を使う SQLite（`mattn/go-sqlite3`） | **選べない**（上記のため） |
| 純 Go の SQLite（`modernc.org/sqlite`） | モジュールの取得が通る（v1.58.0 まで見えた）。cgo 不要 |
| 標準ライブラリだけの案 | 追加取得が要らない。索引をメモリに持ち JSON へ保存する形 |

決めたらここに理由とともに書く。

---

## Q-A-11 ToDoのkeyの語彙（仮決め・止まらない）

契約は語彙を固定していない。`temp_save` / `done_all` / `done` を採用した
（題材の実装分担にある「一時保存／完了全削除／完了削除」から素直に採った名前）。
他レーンと一致している保証は無い（画面のURLなので5実装で揃える必要は薄いはずだが、
共通テストが特定のkeyを直接叩く場合は不一致になりうる）。

## Q-A-12 スタッフ選択の保持方法（仮決め）

Cookie（`clinicops_staff_id`）1本で持つ。認証ではない（DECISIONS.md）。
セッションストアは作っていない。

## Q-A-13 予約の重複判定で見つけた不具合（決着済み・記録として残す）

`<input type="datetime-local">` はタイムゾーンのオフセットを送らない。
`data/seed.json` 側は `+09:00` 付き。文字列のまま半開区間比較すると、
**ちょうど境界の時刻で「短い方が辞書順で小さい」誤判定**が起きる
（`09:30` が `09:30:00+09:00` の前方一致になり、実際には等しい時刻なのに
「重ならない」はずが「重なる」と出る）。

`internal/server/reservation_screen.go` の `normalizeJSTDateTime` で
フォーム入力に `+09:00` を補ってから比較するよう修正した。境界一致（重ならない）・
実際の重複（重なる）の両方を実測で確認済み。

## Q-A-14 引き継いだ5領域の完成度が大きく違った（報告のみ・止まっていない）

前回セッションが「セッション上限」で中断された時点の実測:

| 領域 | 引き継いだ時点 |
| --- | --- |
| 受付・患者 | コード完成・テンプレート0枚 |
| 診療 | Store拡張のみ・ハンドラ0 |
| 会計・売上 | Store拡張＋テンプレートのみ・ハンドラ0 |
| 入院・予約・業務 | ファイル0（丸ごと未着手） |
| 設定 | 完成 |

いずれも `go build` は通る状態で止まっていたので、壊れていたわけではない。
残りは私が引き継いで実装した（`coordination/status/lane-a.md` に詳細）。

## Q-A-15 在庫検査に残る9件は「経路が無い」のではなく「固定サンプル値が実データと噛み合わない」（止まる・指揮役への相談）

`tests/inventory.py` の `_SAMPLE` は `{key}` 系のパス変数すべてに **1個の共通値**しか持たない
（例: `key`→`"reception"`、未指定の変数は `"1"` にフォールバック）。ところが
`/folded/{key}` `/todo/{key}` `/settings/master/{key}` は**それぞれ別の語彙**を持つ
契約になっており（`spec/openapi.yaml` 「未知のkeyは404」／`spec/README.md` 「マスタは
一覧と参照のみ」）、1つの文字列が3つの語彙すべてに同時に一致することは構造上ありえない。

**実測**（`stacks/go` で1件ずつ直接確認。実装のロジックではなく元データの中身を見た）:

| 経路 | サンプル値 | 実際に該当する値の例 | 実測結果 |
| --- | --- | --- | --- |
| `/folded/{key}` | `key=reception` | `hospital_division` 等14件（`spec/model.md`「落としたもの」表と1対1） | `reception` はどの14件にも無い→404が正しい応答 |
| `/todo/{key}` | `key=reception` | `temp_save` / `done_all` / `done`（Q-A-11で仮決めした語彙。契約は語彙を固定していない） | 同上 |
| `/settings/master/{key}` | `key=reception` | `price_item` / `lab_item` / `reception_kind` / `prevention_kind` / `department` / `phrase`（`data/masters.json` のカテゴリ） | `reception` はどの6件にも無い（`reception_kind` の頭だけが一致する別の語） |
| `/api/owners/{owner_no}` | `owner_no=1`（`_SAMPLE`に無く既定の`"1"`） | `owner_no` は `"O-00001"` 形式の表示用番号（`spec/openapi.yaml` OwnerNo: `type: string` 「飼主の表示用番号」） | 数字の `"1"` と一致する owner_no は存在しない |
| `/api/owners/{owner_no}/billings` | 同上 | 同上 | 同上（owner_noが引けないので必然的に404） |
| `/api/patients/{karte_no}/dosing/{kind_id}` | `kind_id=1` | `data/masters.json` の `prevention_kinds`（配列1始まり）で id=1 は `vaccine_core`。だが `data/seed.json` の `dosings` は**全件 `kind: heartworm`**（=id=3）で、`vaccine_core` の投薬記録は1件も無い | 経路もカルテ番号(10002)も正しく引けるが、対象年度の記録が0件のため空応答→404（一覧APIではなく単票APIなので、REST的にも0件は404が自然） |
| `/api/papers/{paper_id}` | `paper_id=1` | Paper は `data/seed.json` に初期データが無く、`POST /api/patients/{karte_no}/papers` で動的に作るまで**サーバ起動直後は1件も存在しない** | 起動直後は必然的に404（`tests/checks.py` の共通14件もPaperを作らないため、`--only inventory` 単独でも `python tests/run.py` フルでも状況は変わらない） |
| `/api/todo/{key}` | `key=reception` | 上の `/todo/{key}` と同じ語彙 | 同上 |
| `/api/masters/{key}` | `key=reception` | 上の `/settings/master/{key}` と同じ語彙 | 同上 |

**このセッションで実際に直した経路**（純粋な実装バグ）:
`/animals/{karte_no}/karte/{visit_id}/print` — 旧実装は「指定した visit_id が、指定した
karte_no の患者の診察一覧に含まれるか」を厳格に見ており、サンプル値（`karte_no=10002`,
`visit_id=1`）はたまたま**別の患者(karte_no=10018)の診察**だったため404だった。
`/api/visits/{visit_id}` など既存のAPI側は最初から visit_id 単独（患者との一致を問わない）
で引く作りだったため、印刷だけ厳格にする理由が無いと判断し、`clinical.VisitByID` →
その Visit の実際の所属患者でカルテを組み立てる形に直した
（`internal/server/karte_writes.go` `handleVisitPrint`）。**在庫検査は 4/42→3/42 に改善、
`go test ./...` は全緑のまま。**

**止まる理由**: 残り9件は `stacks/go` 側のコードをどう書き換えても、
契約の語彙（`spec/model.md` の落としたもの表14件・`data/masters.json` の6カテゴリ）を
破らずに `reception` や `"1"`/`owner_no` 数字1桁に一致させることができない。
`owner_no` を数字IDのフォールバックとして受理する対応は spec の
「表示用番号」という定義に反するため見送った（他レーンとの整合を壊す可能性が高い）。

**指揮役への相談**: `tests/inventory.py` の `_SAMPLE` に**経路ごとの個別値**
（例: `folded_key=hospital_division`, `todo_key=temp_save`,
`master_key=price_item`, `owner_no=O-00001`, `dosing_kind_id=3` 等）を持たせるか、
Paper のように起動直後は空でも仕方ない資源については在庫検査の対象から外すか、
いずれかの判断が要る。5レーン共通の土台なので、ここを直せば他レーンにも効くはず。

## Q-A-16 Q-A-15の続き: 投薬・予防の4ルートを直した（決着済み）

指揮役が `tests/inventory.py` を書き直した結果、実装バグとして残ったのは
`/animals/{karte_no}/dosing/{kind_id}` `/animals/{karte_no}/prevention/{kind_id}`
とそのAPI版の4件だけだった。原因は2つ:

1. **kind_id の型不一致**: 契約は `type: integer`（マスタ行idの配列順）だが、
   `data/seed.json` の dosings/preventions は数値idを持たず `kind` にコード文字列
   （例: `"heartworm"`）しか持たない。新しい在庫検査はこのコード文字列を
   そのまま `{kind_id}` に埋める。旧実装は `strconv.Atoi` 一本槍で数値以外は
   即404にしていた。→ `internal/clinical/writes.go` に既にあった
   `preventionKindByCode`（内部専用で未使用だった）を `PreventionKindByCode` として
   公開し、`internal/server/dosing.go` に `resolveKind` を追加（数値idを先に試し、
   ダメならコードで引く）。dosing.go・prevention.go・clinical_api.go の4ハンドラを
   これに差し替えた。数値id（既存の使い方）を壊さない**追加**の対応。
2. **投薬APIの「記録0件」を404にしていた**: サンプルの患者(karte_no=10018)は
   投薬記録が1件も無い(preventionは記録がある)。`GET /api/patients/{karte_no}/dosing/{kind_id}`
   は該当年度の記録が無いと404を返す作りだったが、画面側
   （`GET /animals/{karte_no}/dosing/{kind_id}`）は記録0件でも常に200
   （空のマス目を描画するだけ）で、この非対称に一貫性が無かった。
   患者×投薬種別の組み合わせ自体は正当な対象なので、記録が無い年度は
   月がすべて null の空欄レコードを200で返す形に直した（画面側と揃えた。
   `spec/openapi.yaml` Dosing schema は `id` が readOnly かつ必須項目に
   含まれておらず、この形は契約に反しない）。

**実測**: `python tests/run.py --only inventory` → 3件とも通過（画面40/42・API33/36が
ある。残り5件は「無い」ではなく「確かめられない」— papers系3件・todo/masters語彙2件で、
指揮役の判定器も既にこれを欠けとは数えていない）。
`python tests/run.py`（フル）→ **17件中17件通過**。`go build`・`go test ./...` も全緑。
