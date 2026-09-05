# レーンC の質問と仮決め

**書き方**: 止まらないものは仮決めして先へ進み、ここに残す。止まるものだけ指揮役へ直接言う。

---

## A. 実測して分かったこと（`DECISIONS.md` の記述と食い違う）

**報告事項。実装は止まっていない。**

`DECISIONS.md` 第2節に「PHP 8.4.24 + Composer 2.10.3（2026-09-05 実測）」とあるが、
このセッションで確かめたところ**そのままでは使えなかった**。

| 事実 | 確かめ方 | どうしたか |
| --- | --- | --- |
| `php` が PATH に無い | `Get-Command php` も `which php` も空 | winget の導入先を探して絶対パスで呼ぶ |
| `composer` がどこにも無い | PATH・`%APPDATA%\Composer`・`composer.phar` 検索すべて空 | `composer.phar` 2.10.3 を `stacks/laravel/tools/` へ落とす |
| `pdo_sqlite` / `sqlite3` / `zip` が無効 | `php -m` に出ない。DLL は `ext/` に在り php.ini でコメントアウト | スタック専用 php.ini を作り `PHPRC` で読ませる |

**新しい実行環境は入れていない。** 入っている PHP 8.4.24 をそのまま使っている。
**環境の `php.ini` も書き換えていない**（所有ディレクトリの外なので）。
`composer.phar` はこのリポジトリ内に閉じており、PATH もレジストリも変えていない。

> 他のレーンには関係ない話だが、**Composer のバージョンは 2.10.3 で一致していた**ので、
> 指揮役が確かめた環境と、レーンが起動する環境が違うのだと思われる。

---

## B. 仮決め（契約が凍ったら合わせ直す）

| # | 仮決め | なぜそうしたか | 変えるときに触る場所 |
| --- | --- | --- | --- |
| B1 | **ポートは 8003** | レーンA〜Eを 8001〜8005 と読んだだけ。**根拠は無い** | `tools/serve.sh` `tools/serve.cmd`（`LANE_C_PORT` でも変えられる） |
| B2 | **保存先は SQLite** | `DECISIONS.md` 第2節の推奨。追加インストールが要らない | `.env` の `DB_CONNECTION` |
| B3 | **アプリのタイムゾーンを `Asia/Tokyo` にした** | `spec/README.md`「日付・時刻は JST。集計の月境界も JST」 | `config/app.php` / `.env` の `APP_TIMEZONE` |
| B4 | **`APP_LOCALE` は `en` のまま** | エラー文言は `openapi.yaml` を一字一句使う決めなので、Laravel の翻訳層を挟まないほうが事故らない | `.env` の `APP_LOCALE` |
| B5 | **`GET /health` は `{"status":"ok"}` だけ返す** | `briefs/lane-c.md` の指定どおり。付け足していない | `routes/web.php` |

B1 は**契約が決めるべきもの**だと思う。共通テストが各スタックをどう起こすのか
（起動コマンド・ポートの決め方）が決まったら教えてほしい。**いまは止まっていない。**

---

## C. 契約への質問（止まらないので先へ進む）

### C1. 画面の数が資料によって違う

| 出どころ | 数 |
| --- | --- |
| `briefs/lane-c.md` の本文「全24画面」 | 24 |
| `briefs/lane-c.md` の領域表（8+5+3+4+5） | 25 |
| `spec/README.md`「26画面すべて作る」 | 26 |

**どれが正か分からない。** `spec/screens.md` が出たらそれに従う。
いま画面を1枚も作っていないので**止まっていない**が、
領域の割り振り（サブエージェントへの分担）はこの数で変わる。

### C2. 共通テストは HTTP を叩くのか、それとも各スタックのテストランナーを呼ぶのか

`stacks/laravel/` 側は**どちらでも動く形**にしてある。
- HTTP: `./tools/serve.sh` で起こす → `GET /health` が 200 / `{"status":"ok"}`
- ランナー: `./tools/test.sh`（`artisan test`。失敗すると終了コード 1）

決まったら合わせる。**いまは止まっていない。**

---

## D. 契約どうしの食い違い（実装は止めていない。両方満たす形にした）

### D1. HTMLの目印が2系統ある

`rulings.md` 6番は「`data-check` 系に統一。`data-testid` は使わない」とあるが、
凍結された `spec/openapi.yaml` は `x-data-testids` を画面ルートの契約そのものとしている
（「契約するのは200が返ることと `x-data-testids` に列挙した目印が存在することの2点だけ」）。
一方 `spec/screens.md` / `spec/acceptance.md` の検算（3・4・5等）は `data-check` 属性を前提にしている。

**両方に対応した。** 対象要素へ `data-testid` と `data-check`（該当するもの）の**両方**を
持たせる。属性はレンダリングに影響しないので、見た目の原則とも矛盾しない。

### D2. `karte_no` の形式

`spec/openapi.yaml` の `KarteNo` パラメータは正規表現 `^[0-9]+-[0-9]+$`（例: `1001-1`）を
要求するが、`data/seed.json` の実際の `patients[].karte_no` はダッシュ無しの数字だけ
（例: `10001`）。**この正規表現は route では強制していない。** `data/seed.json` を正として、
値をそのまま使う。

---
