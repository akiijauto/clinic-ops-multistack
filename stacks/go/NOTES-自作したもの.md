# フレームワークが肩代わりしている部分のうち、自分で書いたもの

レーンAは「ルーティングのライブラリを使わず `net/http` だけ」という条件で書く。
**何を自分で書くことになったか**を後で語れるように、書いた時点で残す。

比較の相手は他レーンのスタック（Rails / Laravel / FastAPI / Next.js）である。
そこでは既製品として付いてくるものが、ここでは自分の行数になる。

## 土台の段階（契約の凍結前）で書いたもの

| 自分で書いたもの | 置き場所 | 他スタックなら |
| --- | --- | --- |
| 経路の登録と一覧の控え | `internal/server/server.go` の `handle` | ルータが経路表を持っている（`rails routes` / `php artisan route:list`） |
| ミドルウェアの連結 | `internal/server/middleware.go` の `chain` | ミドルウェアスタックが標準機能 |
| 要求ごとの通し番号 | 同 `requestID` | Rails の `request.request_id` 等 |
| 1要求1行のログ | 同 `logRequests` | 既定で出る |
| 状態コードの記録 | 同 `statusRecorder` | ログ機能に含まれる |
| panic を 500 に変える | 同 `recoverPanic` | 例外ハンドラが標準 |
| JSON 応答（末尾改行なし） | `internal/server/respond.go` | `render json:` 等 |
| レイアウト継承・部分テンプレートの束ね方 | `internal/view/view.go` | ERB/Blade/Jinja2 が持っている |
| 画面ごとにテンプレート集合を分ける | 同 `Parse` | 同上 |
| 描画を一度 buffer に貯める | 同 `Render` | 同上 |
| 静的ファイルの内容ハッシュ付きURL | `web/web.go` の `Assets` | Sprockets / Vite / Next.js のビルドが行う |
| 停止要求を受けてからの終了処理 | `cmd/clinicops/main.go` | サーバが面倒を見る |
| 環境変数の読み取り | `internal/config/config.go` | 設定機構が標準 |

### 気づいたこと

- **経路表を自分で持つと、死んだリンクの確認が自前でできる。**
  `mux.HandleFunc` を直接呼ばず `Server.handle` を通す形にしたので、
  登録した経路は必ず `Routes()` に載る。「登録したのに一覧に無い」が起きない。
  既製のルータでは一覧を取る口が別に用意されているが、
  自分で書くと**一覧の正しさを自分で保証する必要がある**。
- **`json.NewEncoder(w).Encode` は末尾に改行を足す。**
  本文をそのまま突き合わせるテストだと改行1文字で落ちる。
  他スタックの JSON 応答が改行を足すかどうかは実装依存なので、
  第3段階（突き合わせ）で差が出る候補になる。
- **`html/template` の `ParseFS` は該当0件でエラーになる。**
  「部分テンプレートがまだ無い」状態を通すために吸収する関数が要った。
- **Windows には tzdata が無いことがある。** `time.LoadLocation("Asia/Tokyo")` に頼らず
  固定オフセットで JST を持つことにした。集計の月境界が JST であることは契約の要求なので、
  ここで環境に依存させない。

（契約の凍結後に足したものは、この表へ追記していく）
