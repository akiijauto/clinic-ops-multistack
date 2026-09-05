# レーンA の進捗

## 2026-09-06 00:10 — rules 組・crawl 組も緑。共通テスト14件、全通過

`_data_check` 修正（指揮役）を受けて screen 組3件も緑になった。続けて rules 組・crawl 組を実装。

```
python tests/run.py http://127.0.0.1:8401
（全14件）

  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る
  OK  検算1 売上が分類別・担当別・日別・総合計で一致する — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0% — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て — 税2,750 税込30,250
  OK  検算3 体温が全患者で同じ値になっていない — 14 種 / 31 件
  OK  検算4 カルテの画面と印刷で同じ値が出る — 20 組を比べて差なし
  OK  検算5 基準の外にある値は判定欄と色の両方に出る — 50 項目の判定が一致
  OK  検算6 予約が担当・処置室のどちらでも重ならない — 60 件で重なり0
  OK  検算7 入院の記録行に実施者が必ず入っている — 108 件中 実施者なし 0 件
  OK  検算9 削除済みは一覧から消えるが件数には残る — 一覧から消えても集計に残る
  OK  検算8 画面から辿れるリンクが全部生きている — 14 画面を辿って切れなし

全 14 件 通過
```

### やったこと（rules・crawl）

- `internal/clinical/` に `Reservation` `Hospitalization` `CareRecord` を追加し、
  `data/seed.json` から読み込み
- `internal/server/reservation.go`: `GET /api/reservations`（読み取りのみ。作成・
  重複拒否は保存先が決まってから）
- `internal/server/hospitalization.go`: `GET /api/hospitalizations/{id}/care-records`
- crawl（検算8）の**辿れる画面が10未満**という条件を満たすため、`GET /` （トップ）と
  周辺のスタブ画面12枚（`/about` `/today` `/search` `/staff` `/settings`
  `/settings/features` `/settings/import` `/sales` `/dm` `/ward` `/reservations`
  ＋サンプルのカルテ1件）を用意。中身は「これから作り込む」の最小表示で、
  **押せる保存ボタンは置いていない**（spec/screens.md「できます」と見せて出来ていない
  状態を作らない、と同じ考え方）。`/reservations` だけは実データの一覧表示にした
- `internal/server/screens.go`: トップ・スタブ画面の共通の組み立て

### 指揮役へ

- Q-A-10（`_data_check` の修正）ありがとうございました。修正後、検算3・4は
  何も直さずそのまま緑になった＝実装は最初から正しかったことの裏付け
- スタブ画面12枚は**画面の作り込み自体はまだ**（本文はプレースホルダ）。
  `spec/screens.md` の各節の指示が来たら、この段階のスタブを実の画面に差し替える

---

## 2026-09-06 00:05 — screen 組：検算5は緑、検算3・4は共通テスト側の不具合で止まっている

`GET /animals/{karte_no}/karte`（カルテ画面）・`GET /animals/{karte_no}/karte/print`（印刷）・
`GET /api/lab-tests/{id}` を実装した。

```
── screen ──

  NG  検算3 体温が全患者で同じ値になっていない  — 体温の目印が読めた件数 0（data-check が付いていない）
  NG  検算4 カルテの画面と印刷で同じ値が出る  — 画面と印刷を1組も比べられなかった（data-check が無いか画面が出ない）
  OK  検算5 基準の外にある値は判定欄と色の両方に出る  — 50 項目の判定が一致
```

検算5は緑。検算3・4は**私の実装ではなく `tests/checks.py` の `_data_check` 正規表現側の
不具合**で0件になっている（`coordination/qa/lane-a.md` Q-A-10 に実測と再現手順を記録）。
`<!DOCTYPE html><html>...</html>` という標準的な構造の文書だと、`<html>` タグの
非貪欲マッチが文書全体を飲み込んでしまい、中の `data-check` 要素が1つも見つからない。
`curl` や素の正規表現で同じHTMLを直接読むと値は正しく取れている（実装は正しい）。

**これは私のHTMLの書き方の問題ではなく、5レーン共通の土台の不具合**なので、
qa/lane-a.md に記録したうえで指揮役へ直接報告した。止まっている。

### やったこと（実装自体は完了している）

- `internal/clinical/`（新規）: `data/seed.json`（patients/visits/progress_notes/
  lab_tests/lab_test_items）と `data/lab_items.json`（基準値マスタ）を読み込み、
  検査項目の判定（`Evaluate`）を計算
- `internal/server/karte.go`（新規）: カルテ画面・印刷画面。**同じ組み立て関数
  （`buildKarteView`）と同じ部分テンプレート（`partials/karte_body.html`）を
  画面・印刷の両方で使う**ことで、値の食い違いようが無い作りにしてある
- `internal/server/labtest.go`（新規）: `GET /api/lab-tests/{id}`
- `web/templates/pages/karte.html` `karte_print.html` `partials/karte_body.html`（新規）

Q-A-09（openapi.yamlの `judgement`/`out_of_range` と checks.pyの `judgment` の
つづり違い）も同時に見つけたが、こちらは Q-A-08 と同じやり方（両方の名前を返す）で
止まらずに進めてある。

---

## 2026-09-05 23:45 — money 4件、緑（smoke 2件も継続して緑）

`python tests/run.py http://127.0.0.1:8401 --only money` が**4件とも通過**。

```
── money ──

  OK  検算1 売上が分類別・担当別・日別・総合計で一致する  — 4値とも 5,185,704 円
  OK  検算1 分類別の構成比の和がちょうど100.0%  — 和=100.0
  OK  検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す  — 伝票28 税抜49,500 未算入1行
  OK  検算2 消費税は伝票単位で1回だけ切り捨て  — 税2,750 税込30,250

全 4 件 通過
```

smoke も引き続き緑（回帰なし）。`--only screen/rules/crawl` は今回の担当範囲外（画面が
まだ無いので当然に赤。9件中 `検算9` のみ現時点で偶然緑）。

起動コマンド:
```
cd stacks/go
CLINICOPS_ADDR=":8401" go run ./cmd/clinicops
```
（`data/`（トップレベル・凍結対象）を自動で見つけて読み込む。`stacks/go` 配下に
データを複製していない — `internal/billing/store.go` の `ResolveDataDir`）

### やったこと

- `internal/billing/`（新規パッケージ）: `data/seed.json` `data/price_items.json` を
  読み込み、伝票の額（`BillingAmounts`）と売上集計（`SalesSummary`）を計算する。
  保存の道具はまだ選んでいない（Q-A-06は未決着のまま）。**この段階は読み取りだけで
  足りたので、保存先を決めずに進めた**
- `internal/server/billing.go`（新規）: `GET /api/billings/{id}` と
  `GET /api/sales/summary` のハンドラ
- `server.go` / `main.go`: `billing.Store` を組み立てに追加（`New()` の引数が1つ増えた。
  `server_test.go` の既存呼び出しは `nil` を渡すよう直した）

### 指揮役へ（Q-A-08 として qa/lane-a.md に詳細）

`spec/openapi.yaml` と `tests/checks.py` で、この2エンドポイントの**応答の項目名が
食い違っている**（税抜合計を `taxable_subtotal`/`nontaxable_subtotal` と呼ぶか
`net_amount` と呼ぶか、等）。加えて `/api/sales/summary` の `from`/`to` は openapi 側は
必須だが、共通テストはパラメータ無しで呼んでいる。

止まらずに**両方の項目名を同時に返す**形で進めたが、契約を1本化してもらえると
次の段階（画面）で同じ迷いを繰り返さずに済む。詳細は `coordination/qa/lane-a.md` Q-A-08。

### 次の一手

`spec/screens.md` の指示を待つ。画面段階に入るまでは、この2エンドポイントの
実装をそのまま維持する。

---

## 2026-09-05 23:30 — smoke 2件、緑

`python tests/run.py http://127.0.0.1:8401 --only smoke` が**両方通過**することを実測した。
既存の土台（`GET /healthz` は前回時点で実装済み）に対して、指定ポート **8401** で
実際に起動し直して確認した。土台のコード自体に変更は無い。

```
$ CLINICOPS_ADDR=":8401" go run ./cmd/clinicops &
time=... level=INFO msg=listening addr=:8401 read_only=false

$ python tests/run.py http://127.0.0.1:8401 --only smoke
── smoke ──

  OK  GET /healthz が 200 で {"status":"ok"} を返す
  OK  起動していて、応答が返る  — 15ms

全 2 件 通過
```

起動コマンド（次に指揮役が起動する場合）:

```
cd stacks/go
CLINICOPS_ADDR=":8401" go run ./cmd/clinicops
```

（`go` が PATH に無い環境では `C:\Program Files\Go\bin\go.exe` を使う）

確認後、テスト用サーバーは停止済み（ポート 8401 は空いている）。

### 次の一手

画面（`spec/screens.md`）と検算（`spec/acceptance.md`）の指示が来たら着手する。
それまでは土台の維持のみ。

---

## 2026-09-05 17:55 — 土台ができた。合図待ち

`briefs/lane-a.md`「いまやること」の5項目を全部終えた。**画面はまだ1枚も作っていない。**

| 指示 | 状態 | 実測したこと |
| --- | --- | --- |
| 1 雛形を作る | 済 | `stacks/go/` にビルドの通る形。`gofmt` / `go vet` も通る |
| 2 依存を入れる | 済（**追加なし**） | 標準ライブラリだけで足りたので `go.mod` に依存が無い。`go get` は不要だった |
| 3 テストの走らせ方 | 済 | `scripts/test.ps1` と `scripts/test.sh`。gofmt→vet→test をまとめて流す |
| 4 `GET /health` | 済 | 実際に起動して HTTP 越しに `{"status":"ok"}` を確認（下記） |
| 5 題材を読む | 済 | `題材のシステムdocs/実装分担-2026-09-05.md`。**読むだけ。当該リポジトリは一切変更していない** |

### 実測（推測ではない）

```
$ curl -i http://127.0.0.1:8412/health
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 15

{"status":"ok"}
```

- `go test ./...` … 3パッケージ緑・0失敗（`internal/server` `internal/view` `web`）
- **わざと壊して落ちることを確かめた**。`{"status":"ok"}` を `"OK"` に変えると
  `TestHealth` が落ち、戻すと通る（`PLAN.md` 緑と呼んでよい条件 2）
- Go 1.27.0。ただし **`go` は PATH に載っていない**。実体は `C:\Program Files\Go\bin\go.exe`。
  テストの走らせ方はどちらの経路でもこれを解決する

### 土台として書いたもの

- 経路の登録と一覧の控え（死んだリンクを機械で確かめるため。`Server.handle` を必ず通す）
- ミドルウェア3つ（panic を500に変える／要求ごとの通し番号／1要求1行のログ）
- `html/template` の束ね方（レイアウト継承・部分テンプレート・画面ごとに集合を分ける）
- 静的ファイルの**内容ハッシュ付きURL**（中身が変わればURLも変わる。画面だけ古いまま残る事故を防ぐ）
- 停止要求を受けてからの終了処理

何を自分で書いたかは `stacks/go/NOTES-自作したもの.md` に表で残している
（他スタックなら既製品として付いてくるものの対照表）。

### 指揮役へ

1. **画面数が食い違っている。** `briefs/lane-a.md` 本文は「24」、同ファイルの領域表を数えると
   **25**、`PLAN.md` と `spec/README.md` は **26**。
   `briefs/lane-a.md` の領域表に **`売上集計（新）` が無い**のが差。
   止まってはいないので `qa/lane-a.md`（Q-A-01）に書いて先へ進む。**契約を凍らせる前に直したほうがよい**
2. **5実装で揃っている必要があるのに契約に書かれていなさそうな点**が2つ。
   JSON の `Content-Type` に `charset=utf-8` を付けるか（Q-A-02）と、
   JSON 本文の末尾改行の有無（Q-A-03）。仮決めして進んでいる
3. 保存先はまだ決めていない（Q-A-06）。判断材料だけ実測済み。
   cgo が使えないので cgo 版 SQLite は選べない。純 Go の SQLite は取得できる

**契約の凍結を待っています。** 凍ったら、まず共通テストの1件目を通します。
