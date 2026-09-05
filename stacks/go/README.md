# レーンA — Go 実装

動物病院の窓口業務システムを Go で実装したもの。

**ルーティングのライブラリを使わない。** Go 1.22 以降の `net/http.ServeMux` が持つ
メソッド付きパターン（`"GET /patients/{id}"`）だけで組み立てる。画面は `html/template`。

## 動かす

`go` は PATH に載っていない（2026-09-05 実測）。実体は `C:\Program Files\Go\bin\go.exe`。

```powershell
# テスト（gofmt / go vet / go test をまとめて）
powershell -NoProfile -File .\scripts\test.ps1

# 起動（既定は :8080）
$env:CLINICOPS_ADDR = ':8412'
& 'C:\Program Files\Go\bin\go.exe' run .\cmd\clinicops
```

```bash
# bash から
bash scripts/test.sh
```

生存確認:

```
$ curl -s http://127.0.0.1:8412/health
{"status":"ok"}
```

## 環境変数

| 名前 | 既定 | 意味 |
| --- | --- | --- |
| `CLINICOPS_ADDR` | `:8080` | 待ち受けアドレス |
| `CLINICOPS_DATA_DIR` | `data` | 合成データと保存先 |
| `CLINICOPS_READ_ONLY` | `false` | 真のとき書き込みを断る |

## 構成

```
cmd/clinicops/     起動口。依存の組み立てと停止の面倒を見る
internal/config/   環境変数の読み取り。JST の定義もここ
internal/server/   HTTP の入口。経路表・ミドルウェア・応答の作り方
internal/view/     html/template の束ね方（レイアウト継承・部分テンプレート）
internal/store/    保存先（契約の凍結待ち。中身はまだ無い）
web/               テンプレートと静的ファイル。実行ファイルへ埋め込む
scripts/           テストの走らせ方
```

## いまどこまで

契約（`spec/`）が凍結される前の土台だけ。**画面はまだ1枚も作っていない。**
凍る前に作ると、凍った契約と食い違って作り直しになるため
（`coordination/briefs/lane-a.md`）。

進捗は `coordination/status/lane-a.md`、仮決めは `coordination/qa/lane-a.md` にある。
