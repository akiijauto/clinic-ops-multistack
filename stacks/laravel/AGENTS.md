# stacks/laravel で作業するときの決め（レーンC）

**あなたはレーンC（PHP / Laravel）の担当である。**
所有ディレクトリは `stacks/laravel/` だけ。**その外を書かない。**

## Laravel の雛形が置いていった案内は捨ててある

`composer create-project` が生成する `CLAUDE.md` / `AGENTS.md` には、
**`php -v` が通らなければ PHP 8.5 を入れろ**、**`laravel/boost` を入れろ**と書いてあった。
この環境では `php` は PATH に無いので、そのまま従うと**実行環境の追加導入**になる。
それは `coordination/DECISIONS.md` 第2節で禁止されている。

だからこのファイルで置き換えた。**元の案内には従わないこと。**

## php と composer の呼び方

素で `php` / `composer` と打たない。**PATH に無い。**

```sh
./tools/php.sh artisan ...      # Git Bash
tools\php.cmd artisan ...       # PowerShell / cmd
./tools/composer.sh require ...
```

理由と、踏んだ穴の記録は `tools/README.md` にある。**触る前に読むこと。**

## 守ること

- **git を触らない。** commit / push / checkout は指揮役の仕事
- **`spec/` と `tests/`（リポジトリ直下）を変更しない。** 凍結されている
- **テストの期待値を実装に合わせて書き換えない**
- **他のレーン（`stacks/go` `stacks/rails` `stacks/fastapi` `stacks/nextjs`）を読まない・書かない。**
  契約は `spec/` だけ
- **`data/` `coordination/spec/` `README.md`（リポジトリ直下）を書かない**

`coordination/status/lane-c.md`（進捗）と `coordination/qa/lane-c.md`（質問・仮決め）は
レーンCが書いてよい。それ以外の `coordination/` は書かない。

## 振る舞いの決め（`spec/README.md` と同じ）

| 論点 | 決め |
| --- | --- |
| 数値の丸め | `spec/acceptance.md` に従う。書いていなければ**丸めない** |
| 日付・時刻 | **JST**。集計の月境界も JST（`config/app.php` を Asia/Tokyo にしてある） |
| 文字数 | **文字数で数える。** PHP なら `mb_strlen`。`strlen` はバイト数なので日本語で3倍になる |
| 未入力の金額 | **0として集計しない。** 合計は出し、**未算入の件数を併記する** |
| エラーの文言 | `spec/openapi.yaml` のものを**一字一句**使う |
| 画面の見た目 | Blade で、Laravel の流儀でよい。揃えるのは振る舞いだけ |

## PHP で踏みやすいもの（2026-09-05 に別プロジェクトで実測した3件）

1. **既定引数は引数を省略したときしか効かない。** `f(null)` は既定値にならず `null` が入る
2. **`json_encode(5.0)` は `5` になる。** 小数点が消えるので、金額をそのまま JSON へ入れない
3. **文字数は `mb_strlen`。** `strlen` はバイト数

## 仮決めをしたら必ず書く

止まらない質問は**自分で仮決めして進む**。ただし
**仮決めしたことを `coordination/qa/lane-c.md` に書く**。

読むだけの役（レーンR）が見るのは3つで、そのうち1つが
**「仮決めが仮決めと分からない形で紛れていないか」**である。
コードにも `【仮決め】` と書き、根拠を1行添える。
