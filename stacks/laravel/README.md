# stacks/laravel — レーンC（PHP / Laravel）

動物病院の窓口業務システムを **PHP 8.4 / Laravel 13** で実装したもの。
`clinic-ops-multistack` の5実装のうちの1つで、**外から見た振る舞いは `spec/` が正**。

学習・研究のための実装である。実在の動物病院・飼主・動物の情報は含まない。

## 使い方

初回だけ土台を用意する。**新しいソフトウェアは入らない**（理由は `tools/README.md`）。

```powershell
powershell -ExecutionPolicy Bypass -File tools\setup.ps1
tools\composer.cmd install
```

Git Bash なら:

```sh
powershell -ExecutionPolicy Bypass -File tools/setup.ps1
./tools/composer.sh install
```

起こす / テストする:

| したいこと | PowerShell / cmd | Git Bash |
| --- | --- | --- |
| アプリを起こす（既定 8003） | `tools\serve.cmd` | `./tools/serve.sh` |
| このスタックのテスト | `tools\test.cmd` | `./tools/test.sh` |
| 素の php / composer | `tools\php.cmd` / `tools\composer.cmd` | `./tools/php.sh` / `./tools/composer.sh` |

疎通の確認:

```sh
curl http://127.0.0.1:8003/health
# {"status":"ok"}
```

## いまの状態

| | |
| --- | --- |
| 土台 | できている（PHP・Composer・SQLite・テストが走る形） |
| `GET /health` | 動く |
| 画面 | **まだ1枚も作っていない。** 契約（`spec/`）が凍るのを待っている |

契約が凍る前に画面を作ると、凍った契約と食い違って作り直しになる
（`coordination/briefs/lane-c.md`）。

## 保存先

SQLite（`database/database.sqlite`、git 追跡外）。
追加インストールが要らないため（`coordination/DECISIONS.md` 第2節）。
テストは `:memory:` を使う（`phpunit.xml`）。

## 決めたこと・仮決め

`coordination/qa/lane-c.md` に集約している。**ここには書かない**（二重管理になるため）。
