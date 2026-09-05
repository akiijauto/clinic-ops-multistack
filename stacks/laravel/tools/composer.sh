#!/usr/bin/env bash
set -euo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$TOOLS/php.sh" "$TOOLS/composer.phar" "$@"
