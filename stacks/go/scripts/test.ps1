# レーンA（Go）のテストを流す。
#
# go は PATH に載っていない（2026-09-05 実測）。実体は C:\Program Files\Go\bin\go.exe。
# 呼ぶ側が PATH を整えなくても走るよう、ここで解決する。

$ErrorActionPreference = 'Stop'

$go = (Get-Command go -ErrorAction SilentlyContinue).Source
if (-not $go) { $go = 'C:\Program Files\Go\bin\go.exe' }
if (-not (Test-Path $go)) { throw "go が見つからない: $go" }

Push-Location (Join-Path $PSScriptRoot '..')
try {
    $unformatted = & $go fmt ./...
    if ($unformatted) { throw "gofmt が整形した: $unformatted" }
    & $go vet ./...
    if ($LASTEXITCODE -ne 0) { throw "go vet が失敗" }
    & $go test ./...
    if ($LASTEXITCODE -ne 0) { throw "go test が失敗" }
    Write-Output 'OK'
} finally {
    Pop-Location
}
