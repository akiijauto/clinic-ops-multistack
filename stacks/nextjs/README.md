# stacks/nextjs — レーンE（TypeScript / Next.js）

学習・研究目的の実装です。複製・再配布・改変・商用利用を許可しません。

## 構成

| | 選んだもの | 理由 |
| --- | --- | --- |
| フレームワーク | Next.js 16.3.4（App Router） | `ASSIGNMENT.md` の割当 |
| 言語 | TypeScript 7.0.2 | `npm install typescript` の既定。`next build` の型検査が通ることを実測 |
| ランタイム | Node 24.16.0 | `DECISIONS.md` 導入済み一覧 |
| DB | **`node:sqlite`（Node 組み込み）** | `DECISIONS.md`「追加インストールが要らないもの／SQLite を推奨」を両方満たす。DBの依存パッケージが0 |
| テスト | **`node --test`（Node 組み込み）** | 同上。テストフレームワークの依存も0 |

依存パッケージは `next` / `react` / `react-dom` と型定義のみ。

## 走らせ方

```
npm install
npm run build
npm start            # PORT=3005 npm start でポート指定
```

| コマンド | 中身 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（型検査を含む） |
| `npm start` | 本番サーバー |
| `npm run typecheck` | 型検査のみ |
| `npm test` | レーン自身のテスト（`test/`）。`BASE_URL` を渡すとHTTP経由の検査も走る |

**`npm test` が緑でも完了ではありません。** 完了の判定はリポジトリ直下の
共通テスト（`tests/`）です（`coordination/PROTOCOL.md`）。

## いま出来ること

| 経路 | 状態 |
| --- | --- |
| `GET /healthz` | `{"status":"ok"}` を返す。**共通テスト（`tests/run.py`）が叩くのはこちら。実測済み** |
| `GET /health` | 同じ応答を返す別名。`briefs/lane-e.md` がこの名前で書いているため残してある |
| `/` | 土台であることを書いた1枚だけ |
| 26画面 | **まだ作っていない。** `spec/openapi.yaml` と `spec/acceptance.md` が未公開のため |

データの層だけは先に作ってある（`spec/model.md` が公開されたため）。

| ファイル | 中身 |
| --- | --- |
| `src/lib/model.ts` | 15entityの型 |
| `src/lib/schema.sql` | SQLiteのDDL（16表） |
| `src/lib/db.ts` | 接続と、結果行の正規化 |

`spec/model.md` が名指しした2つの不具合は、**DB側で**塞いである。
アプリ側で間違えたのが元の不具合なので、同じ層に置くと同じ間違いをする。

| 規則 | 置いた場所 |
| --- | --- |
| 未設定の単価を0として集計しない | `billing_detail.unit_price` を **NULL可のまま**（`NOT NULL DEFAULT 0` にしない） |
| 実施者の無い記録を作らない | `care_record.performed_by_staff_id` を **NOT NULL** |

どちらも**わざと外して、テストが落ちることを確かめてある**。

画面を作っていないことを画面上でも書いてあります。「出来ます」と書いて出来ていない
状態を作らないためです（`spec/README.md`）。

## 実装中に踏んだこと

- **`node:sqlite` の結果行は null プロトタイプ。** `deepStrictEqual` が平のオブジェクトと
  一致せず、`hasOwnProperty` も持たない。`src/lib/db.ts` の `rows()` / `row()` を
  必ず通して平のオブジェクトに直す
- **`node --test` で `.ts` を読むには拡張子付きの import が要る**（Node の型剥がし）。
  そのままだと `tsc` が TS5097 で落ちるので `allowImportingTsExtensions` を有効にしてある
- **SQLite に配列型も排他制約も無い。** `closed_weekdays` はJSON文字列にし、
  予約の重なりは索引を張ったうえでサービス層で検査する。
  **フレームワークが肩代わりしない部分がここに出る**
