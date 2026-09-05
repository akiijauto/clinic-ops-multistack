#!/usr/bin/env bash
# レーンA（Go）のテストを流す。scripts/test.ps1 と同じことをする。
set -euo pipefail

if ! command -v go >/dev/null 2>&1; then
  export PATH="/c/Program Files/Go/bin:$PATH"
fi
command -v go >/dev/null 2>&1 || { echo "go が見つからない" >&2; exit 1; }

cd "$(dirname "$0")/.."

unformatted=$(gofmt -l .)
if [ -n "$unformatted" ]; then
  echo "gofmt が整形していないファイル: $unformatted" >&2
  exit 1
fi
go vet ./...
go test ./...
echo OK
