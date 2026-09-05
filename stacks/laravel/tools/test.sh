#!/usr/bin/env bash
# レーンC 自身のテストを流す。
#
# **これが緑でも「終わった」ではない。** 完了の判定は共通テスト（リポジトリ直下の tests/）
# が緑になったときだけ（coordination/briefs/lane-c.md「完了の条件」）。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
exec ./tools/php.sh artisan test "$@"
