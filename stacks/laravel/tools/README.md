# tools/ — なぜラッパがあるのか

**このディレクトリは「php と composer を素で叩けない」ことへの手当てである。**
中身を読まずに消すと、このスタックは動かなくなる。

## 実測（2026-09-05）

`coordination/DECISIONS.md` 第2節には「PHP 8.4.24 + Composer 2.10.3 が導入済み」とある。
実際に確かめたところ、**そのままでは使えない状態**だった。

| 事実 | 確かめ方 | 影響 |
| --- | --- | --- |
| `php` が PATH に無い | `Get-Command php` / `which php` がどちらも空 | コマンドが起動しない |
| `composer` がどこにも無い | PATH・`%APPDATA%\Composer`・`composer.phar` 検索いずれも空 | 依存を入れられない |
| `pdo_sqlite` / `sqlite3` / `zip` が無効 | `php -m` に出ない。DLL は `ext/` に在り、php.ini でコメントアウト | SQLite が使えない |

**新しい実行環境は入れていない**（`DECISIONS.md` 第2節で禁止）。
入っている PHP 8.4.24 をそのまま使い、足りない部分だけこのディレクトリで埋めている。

## 埋め方

| ファイル | 役割 |
| --- | --- |
| `setup.ps1` | php.exe を探し、このスタック専用の `php.ini` を作り、`composer.phar` を取る |
| `php-binary.txt` | 見つけた php.exe の絶対パス（生成物・git 追跡外） |
| `php.ini` | このスタック専用（生成物・git 追跡外）。**環境の php.ini は書き換えていない** |
| `php.cmd` / `php.sh` | `PHPRC` にこのディレクトリを入れて php を呼ぶ |
| `composer.cmd` / `composer.sh` | 上を経由して `composer.phar` を呼ぶ |
| `serve.cmd` / `serve.sh` | アプリを起こす（既定 8003） |
| `test.cmd` / `test.sh` | このスタック自身のテストを流す |

環境の `php.ini` を直さないのは、それが**所有ディレクトリの外**だからである
（`coordination/PROTOCOL.md` 不変条件3）。他のレーンも同じ PHP を見るかもしれない。

## `-d extension=` ではなく `PHPRC` を使う理由

`php -d extension=pdo_sqlite` でも拡張は読める。しかし **`-d` は子プロセスへ受け継がれない。**
`php artisan serve` は `php -S` の子プロセスを起こすので、`-d` では画面側だけが落ちる。
`PHPRC` は環境変数なので子へ渡る。

ただしそれだけでは足りなかった。下の「踏んだ穴」を読むこと。

## 踏んだ穴（2026-09-05 実測）

### 1. `artisan test` は緑なのに、画面が 500 を返した

`php artisan serve` は「子プロセスへ渡してよい環境変数」を白名簿で持っており、
`PHPRC` はそこに無い。名簿に無い変数は Symfony Process へ `false` として渡され、
**子プロセスから消される**（`vendor/.../Console/ServeCommand.php` の `$passthroughVariables`）。

結果、`GET /health` が `could not find driver` で 500 になった。
`artisan test` は同じプロセス内で動くので**緑のまま**で、テストからは見えなかった。

対処: `app/Providers/AppServiceProvider.php` で `PHPRC` を名簿へ足している。

> サーバーの応答と利用者の画面は別。**テストが緑でも画面が落ちることがある。**

### 2. PowerShell 5.1 は BOM の無い `.ps1` を ANSI として読む

`setup.ps1` を UTF-8（BOM無し）で書いたら日本語コメントが化けて構文エラーになった。
このファイルは **UTF-8 BOM 付きで保存する**。`.cmd` は cmd.exe が ANSI で読むので、
そもそも日本語を書かない（説明はこの README に置く）。

### 3. `-match` は既定で大小を区別しない

拡張の読み込み確認で `$check -match 'NG'` と書いたところ、
**`mbstring` の "ng" に当たって**常に失敗した。`-cmatch ':NG'` にしてある。
