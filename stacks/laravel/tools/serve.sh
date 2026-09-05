#!/usr/bin/env bash
# レーンC のアプリを起こす。既定ポートは 8403（coordination/PORTS.md が正）。
#   ./tools/serve.sh            # 8403 で起こす
#   ./tools/serve.sh 9000       # ポートを指定する
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-${LANE_C_PORT:-8403}}"
cd "$ROOT"
exec ./tools/php.sh artisan serve --host=127.0.0.1 --port="$PORT"
