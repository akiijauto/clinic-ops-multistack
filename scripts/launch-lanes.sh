#!/usr/bin/env bash
# レーンを自動で起動する。
#
# **これがあるので、人が起動文面を貼り分ける作業は要らない。**
#
# 2026-09-04 の 前回の並列開発 では、3つのCLIに同一の起動文面を人が貼ったため、
# 各CLIが自分のレーンを知らずに起動し、割当が二転三転する事故が起きた。
# このスクリプトは各レーンへ**そのレーン専用の起動文面**を渡すので、
# 取り違えが構造的に起きない。
#
# さらに `--session-id` で**決め打ちのID**を渡す。指揮役はIDを見れば
# どのレーンか分かる。推論しないで済む。
#
# 使い方:
#   bash scripts/launch-lanes.sh            # 全レーンを起動
#   bash scripts/launch-lanes.sh a c        # レーンAとCだけ起動
#   DRY_RUN=1 bash scripts/launch-lanes.sh  # 実行せずコマンドだけ表示
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO="$(pwd)"

# 決め打ちのセッションID。**変えないこと。**
# 指揮役はこの表を見てレーンを特定する。UUIDの末尾がレーンの目印（a〜e、Rは f）。
# UUIDは16進しか使えないので、レーンRだけ末尾が f になっている。
declare -A SESSION_ID=(
  [a]="c1a11e00-0000-4000-8000-00000000000a"
  [b]="c1a11e00-0000-4000-8000-00000000000b"
  [c]="c1a11e00-0000-4000-8000-00000000000c"
  [d]="c1a11e00-0000-4000-8000-00000000000d"
  [e]="c1a11e00-0000-4000-8000-00000000000e"
  [r]="c1a11e00-0000-4000-8000-00000000000f"
)

declare -A LANE_NAME=(
  [a]="Go" [b]="Rails" [c]="Laravel" [d]="FastAPI" [e]="Next.js" [r]="読むだけの役"
)

# 各レーンが使う道具を先に許可しておく。
# 許可しておかないと、背景で動いているレーンが確認待ちで止まる
# （止まったことに気づけないのが最悪）。
#
# 一方で **何でも許すことはしない。** インストールや git は許可しない。
# 計画では「新しい実行環境の導入が必要になったら止めて報告する」ことにしており、
# ここで許してしまうとその歯止めが効かなくなる。
# 共通テスト(tests/run.py)は Python で書いてある。
# **全レーンに python の実行を許可する。** 許可しないと、完了条件である
# 「共通テストが緑」を各レーンが自分で確かめられない（レーンRの指摘 R-04）。
COMMON_TOOLS='Edit Write Read Glob Grep Task TodoWrite Bash(python tests/run.py*) Bash(python tests/expected.py*)'
declare -A LANE_TOOLS=(
  [a]='Bash(go *) Bash(gofmt *)'
  [b]='Bash(ruby *) Bash(bundle *) Bash(rails *) Bash(rake *)'
  [c]='Bash(php *) Bash(composer *)'
  [d]='Bash(python *) Bash(python3 *) Bash(pip *) Bash(pytest *) Bash(uvicorn *)'
  [e]='Bash(node *) Bash(npm *) Bash(npx *)'
  # レーンRは「見張りが鳴るか」を確かめる役なので、
  # 使い捨ての複製(git worktree)と各スタックのテスト実行を許可する。
  # 本体は触らせない（briefs/lane-r.md に手順を書いてある）。
  [r]='Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git worktree *) Bash(go test*) Bash(pytest*) Bash(npm test*) Bash(rails test*) Bash(php artisan test*)'
)

LANES=("$@")
if [ ${#LANES[@]} -eq 0 ]; then LANES=(a b c d e r); fi

OUT="coordination/launched.md"
{
  echo "# 起動したセッション（scripts/launch-lanes.sh が自動生成）"
  echo
  echo "生成 $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "| レーン | 担当 | セッションID |"
  echo "| --- | --- | --- |"
} > "$OUT"

for l in "${LANES[@]}"; do
  brief="coordination/briefs/lane-$l.md"
  if [ ! -f "$brief" ]; then
    echo "起動文面がありません: $brief" >&2
    exit 1
  fi

  # 起動文面をそのまま最初の発話として渡す。
  # 1文目に「あなたはレーン◯です」が入っている（make_briefs.py が保証）。
  prompt="$(cat "$brief")

上の指示に従って作業を始めてください。まず読むべきものを読み、
自分の担当と所有ディレクトリを確認してから着手してください。"

  # 道具の並びは**配列で渡す**。
  # 文字列のまま `--allowedTools $tools` と書くと、シェルが空白で切ってしまい
  # `Bash(go` と `*)` のように壊れる（レーンRの指摘 R-05）。
  read -r -a tools <<< "$COMMON_TOOLS ${LANE_TOOLS[$l]}"

  cmd=(claude --background
       --session-id "${SESSION_ID[$l]}"
       --model sonnet
       --permission-mode acceptEdits
       --add-dir "$REPO"
       --allowedTools "${tools[@]}"
       "$prompt")

  printf 'レーン%s（%s）\n' "${l^^}" "${LANE_NAME[$l]}"
  if [ "${DRY_RUN:-}" = "1" ]; then
    printf '  [DRY_RUN] session-id=%s tools=%s\n' "${SESSION_ID[$l]}" "${tools[*]}"
  else
    "${cmd[@]}" && printf '  起動: %s\n' "${SESSION_ID[$l]}"
  fi
  printf '| %s | %s | `%s` |\n' "${l^^}" "${LANE_NAME[$l]}" "${SESSION_ID[$l]}" >> "$OUT"
done

echo
echo "起動したセッションの一覧を $OUT に書きました。"
echo "状況の確認: claude agents"
