# レーン papers（書類データ投入）— 結果

`data/seed.json` に足された `papers`12件・`no_paper_patient_ids`（[43, 41, 10]）を、
5実装すべてに投入した。**`data/` `spec/` は読むだけ**（1行も変えていない）。
`tests/inventory.py` は自分では変えていない（作業中に他レーンが `paper_id` サンプリングを
足しているのを確認した。詳細は下記）。コミット・pushはしていない。
25分後の自動確認のようなフォールバックも入れていない。

## やったこと（実装ごと）

投入処理が `papers` を読んでいなかったので、**5実装とも `stacks/` 配下の投入コードへ
読み込みを足した**（依頼どおり）。

| 実装 | port | 変更したファイル | やったこと |
| --- | --- | --- | --- |
| Go | 8401 | `internal/clinical/types.go` `internal/clinical/store.go` `internal/server/server.go` `internal/server/papers.go` `web/templates/pages/paper_detail.html`（新規） `web/templates/pages/papers_no_paper.html`（新規） | 投入: `seedFile` に `Papers`/`NoPaperPatientIDs` を追加し、`Load()` で `s.papers`/`s.noPaperPatients` へ流し込む処理を新設（元は `papers: nil` で**一度も読んでいなかった**）。`taken_on`→`CreatedAt`、`removed_at`→`DeletedAt`。ルーティング: 下記「Goで見つけて直した別件」参照。ビルドし直して`clinicops.exe`を差し替え、プロセスkill→再起動 |
| Rails | 8414 | `db/seeds.rb` | `Paper.create!` のループを追加（既存コードは `delete_all` の対象リストに `Paper` はあるのに**作成側が無かった**）。`taken_on`→`created_at`、`removed_at`→`removed_at`。sqlite_sequence 補正対象に `papers` を追加。`bundle exec rails db:seed`→プロセスkill→`bin/rails server -p 8414 -b 0.0.0.0` |
| Laravel | 8403 | `database/seeders/DatabaseSeeder.php` | `seedPapers()` を新設して `run()` から呼ぶ（既存コードに**一切無かった**）。同じく `taken_on`→`created_at/updated_at`。`tools/php.sh artisan migrate:fresh --seed --force`→`cache:clear`→プロセスkill→`artisan serve --port=8403` |
| FastAPI | 8415 | `app/seed_loader.py` | `models.Paper` を作るループを追加（既存コードに**一切無かった**）。「空のときだけ投入」の作りを利用し、`data/clinic.db` を削除してから再起動して投入させた |
| Next.js | 8405 | `scripts/seed.ts` | `paper`・`patient_no_paper` の投入を追加（既存コードに**一切無かった**）。このレーンだけ schema.sql が `paper`（`visit_id`/`filename`/`period`込み）と `patient_no_paper` テーブルを既に持っていたので、`title` を `filename` の代用にし `period` は空文字にした。`npm run seed`→プロセスkill→`npm run dev -- -p 8405` |

## `no_paper_patient_ids`（「元から無い」の印）について

依頼どおり、**持てる実装には入れ、持てない実装は理由を書く**。

- **持てた**: Go（既存の `noPaperPatients map[int]bool` / `SetNoPaper` / `IsNoPaper` に投入。
  `/animals/10043/papers` で `no-paper-flag` 相当のマークアップが出ることを確認済み）、
  Next.js（`patient_no_paper` テーブルに3件投入。`/animals/10043/papers` で確認済み）
- **持てなかった**: Rails・Laravel・FastAPI。3実装とも `/papers/no-paper` 画面は
  **静的な案内画面**（コントローラが空アクション、あるいはテンプレートを返すだけ）で、
  患者ごとの「元から無い」印を持つ列・テーブルが存在しない。新規マイグレーション／
  モデル追加は「データ投入」の範囲を超える機能追加になるためやっていない
  （3実装とも同じ理由）。

## 途中で分かったこと — `tests/inventory.py` が他レーンにより修正されていた

作業中、`git status` で `tests/inventory.py` が変更されているのに気づいた（自分は
触っていない）。差分を見ると、`_samples()` に `paper_id` を `seed["papers"][0]["id"]`
から拾う1行が足されていた。**これで papers 系3ルートが初めて実際に叩かれるように
なった**（この修正が入る前は `paper_id` を埋める処理が無く、データを入れても
「確かめられない」のままだった）。

この修正のおかげで、**Goに実在したルーティングの欠けが「確かめられない」から
「無い（404）」という実際のテスト失敗として表に出た。** 見つけて直した内容は次項。

## Goで見つけて直した別件（データではなく実装のルーティングの欠け）

契約にある画面ルート2つが `internal/server/server.go` に未登録だった。

- `GET /papers/{paper_id}`（screen_paper_detail）— 登録が無く404
  （`POST /papers/{paper_id}/remove` はあった）
- `GET /papers/no-paper`（screen_papers_no_paper）— 登録が無く、
  `POST /papers/no-paper`（「元から無い」印のトグル）だけがこのパスに乗っていた

他4実装（Rails・Laravel・FastAPI・Next.js）は元から6ルートとも実装済みだったので、
Go固有の欠けだった。当初は「データ投入担当の範囲外」として直さず報告するだけの
つもりだったが、`tests/inventory.py` の修正で papers 系ルートが実際に叩かれるように
なった結果、`/papers/{paper_id}` が全29件テストの**実失敗**として現れたため、
最小限のルーティングだけ足した。

- `handlePaperDetail`（`internal/server/papers.go`）を追加し
  `GET /papers/{paper_id}` に登録。既存の `s.clinical.Paper(id)` / `PatientByID` を
  再利用するだけで、新しいStoreメソッドは足していない
- `handlePapersNoPaperScreen` を追加し `GET /papers/no-paper` に登録
- テンプレート2枚を新規追加（`paper_detail.html`＝`data-testid="screen-paper-detail"`、
  `papers_no_paper.html`＝`data-testid="screen-papers-no-paper"`。他4実装の同等画面の
  文言・構成に合わせた簡素なもの）

**踏んだ落とし穴**: `GET /papers/{paper_id}` を先に単独で足したところ、
`GET /papers/no-paper` への実際のGETリクエストが `paper_id="no-paper"` として
ワイルドカードに食われて404になった（直す前は該当GETハンドラが無く405で
「在る」ことにされていたのが、直した瞬間に別の404を生んだ）。
`GET /papers/no-paper` を明示的にリテラル登録して解消（`net/http` の
`ServeMux` はリテラルをワイルドカードより優先するので、登録順は問わない）。

`go build ./...` / `go vet ./...` / `go test ./...` はすべて通過を確認済み。

## 確認できたこと

- 検算1の総合計: **5実装とも 5,189,585円**（変わっていない。FastAPIで実測: `total_net_amount: 5189585`）
- `curl http://127.0.0.1:<port>/papers/1` — **5実装すべて200**
- `curl http://127.0.0.1:<port>/papers/no-paper` — **5実装すべて200**
- 各実装の `/api/patients/{karte_no}/papers` が12件中の該当分（患者6の1件など）を返すことを実測

## `python tests/run.py` の結果 — 5実装すべて 全29件 通過（最終）

```
Go       (8401): 全 29 件 通過  — 画面 41/42・API 36/36（確かめられないのは対象78件中1件: /folded/{key}）
Rails    (8414): 全 29 件 通過  — 画面 42/42・API 36/36（確かめられないのは対象78件中0件）
Laravel  (8403): 全 29 件 通過  — 画面 42/42・API 36/36（確かめられないのは対象78件中0件）
FastAPI  (8415): 全 29 件 通過  — 画面 42/42・API 36/36（確かめられないのは対象78件中0件）
Next.js  (8405): 全 29 件 通過  — 画面 42/42・API 36/36（確かめられないのは対象78件中0件）
```

在庫検査の「確かめられない」は、papers関連3ルート分がすべて解消した。
Goだけ `/folded/{key}` が1件残るが、papersとは無関係の既知の別項目
（`_resolve()` の「一覧から語彙を拾う」ロジックがGoの `/folded` 実装では
候補を見つけられない、別レーンの領域の話）。

## 守ったこと

- `data/` `spec/` は読むだけで書き換えていない。`tests/` も自分では書き換えていない
  （他レーンの変更を確認しただけ）
- 既存の `data-testid` / `data-check` は消していない。新設したものは契約の
  `x-data-testids` どおり
- コミット・pushはしていない
- 実装のコード変更は「papersを読み込ませる」投入処理（5実装）＋Goのルーティング欠け
  2件の追加のみ。いずれも `stacks/` 配下
- 25分後の自動確認などのフォールバックは入れていない

**待機します。次の指示があれば対応します。**
