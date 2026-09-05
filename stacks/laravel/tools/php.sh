#!/usr/bin/env bash
# Git Bash 用の php ラッパ。
# - php.exe は PATH に無いので tools/php-binary.txt から拾う
# - PHPRC には Windows 形式のパスを渡す（環境変数なので artisan serve の子にも効く）
set -euo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$TOOLS/php-binary.txt" ]; then
  echo "tools/php-binary.txt がありません。先に tools/setup.ps1 を実行してください。" >&2
  exit 1
fi
# 先頭の BOM と改行を落とす。PowerShell が BOM 付きで書いた場合の保険
PHPBIN="$(sed -e '1s/^\xEF\xBB\xBF//' "$TOOLS/php-binary.txt" | tr -d '\r\n')"
if [ ! -x "$PHPBIN" ]; then
  echo "php.exe が見つかりません: $PHPBIN" >&2
  exit 1
fi
export PHPRC="$(cygpath -w "$TOOLS" 2>/dev/null || echo "$TOOLS")"
exec "$PHPBIN" "$@"
