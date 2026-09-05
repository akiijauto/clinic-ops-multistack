# レーンC 土台のセットアップ（PowerShell）
#
# このスタックは「実行環境を新しく入れない」制約で動く（coordination/DECISIONS.md 第2節）。
# 導入済みの PHP 8.4.24 をそのまま使うが、次の2点だけ手当てが要る。
#
#   1. php.exe が PATH に無い（winget で入っており、リンクが張られていない）
#   2. 導入時の php.ini で pdo_sqlite / sqlite3 / zip が無効（DLLは同梱されている）
#
# 1 は絶対パスを解決して使う。2 は「このスタック専用の php.ini」を作り、
# PHPRC でそれを読ませる。**環境の php.ini は書き換えない**（所有ディレクトリの外なので）。
#
# 使い方: powershell -ExecutionPolicy Bypass -File tools\setup.ps1

$ErrorActionPreference = 'Stop'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-PhpBinary {
    $cmd = Get-Command php -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $wingetRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetRoot) {
        $found = Get-ChildItem $wingetRoot -Recurse -Filter php.exe -ErrorAction SilentlyContinue |
                 Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    throw 'php.exe が見つかりません。PHP 8.4 が導入されているか確認してください。'
}

$php = Resolve-PhpBinary
$extDir = (& $php -r "echo ini_get('extension_dir');")
if (-not (Test-Path $extDir)) { throw "extension_dir が見つかりません: $extDir" }

# 見つけた場所を控える（php.cmd / php.sh がこれを読む）
# ASCII で書く。PowerShell 5.1 の -Encoding utf8 は BOM を付けるので、
# Git Bash 側で読むと先頭に ﻿ が混ざり、パスが壊れる（2026-09-05 実測）
Set-Content -Path (Join-Path $toolsDir 'php-binary.txt') -Value $php -Encoding ascii -NoNewline

# このスタック専用の php.ini
# 注意: PHPRC で読ませる php.ini は環境の php.ini を**置き換える**ので、
#       Laravel が要る拡張はここに全部書く必要がある。
#       dom / xml / tokenizer / session / ctype / filter / hash は組み込み済みなので書かない。
$ini = @"
; レーンC 専用の php.ini（tools/setup.ps1 が生成。手で書き換えない）
; 環境の php.ini は変更していない。PHPRC でこのファイルだけを読ませている。
extension_dir = "$($extDir.Replace([char]92, [char]47))"

extension=curl
extension=fileinfo
extension=mbstring
extension=openssl
extension=sodium
; ここから下が、環境の php.ini では無効になっていたもの
extension=pdo_sqlite
extension=sqlite3
extension=zip

memory_limit = 512M
; 業務が国内の窓口業務なので JST（spec/README.md「日付・時刻」）
date.timezone = "Asia/Tokyo"
"@
Set-Content -Path (Join-Path $toolsDir 'php.ini') -Value $ini -Encoding utf8

# 確かめる（「入れた」と「動く形で揃った」は別 — DECISIONS.md 第2節）
$env:PHPRC = $toolsDir
$check = & $php -r "echo implode(',', array_map(fn(`$e) => `$e . ':' . (extension_loaded(`$e) ? 'ok' : 'NG'), ['pdo_sqlite','sqlite3','zip','mbstring','openssl','curl','fileinfo']));"
Write-Output "php      : $php"
Write-Output "ext_dir  : $extDir"
Write-Output "loaded   : $check"
# -match は既定で大小同一視。mbstring が NG に当たるので -cmatch で : つきを見る
if ($check -cmatch ':NG') { throw "有効にできなかった拡張があります: $check" }

$phar = Join-Path $toolsDir 'composer.phar'
if (-not (Test-Path $phar)) {
    Write-Output 'composer.phar を取得します（2.10.3）...'
    Invoke-WebRequest -Uri 'https://getcomposer.org/download/2.10.3/composer.phar' -OutFile $phar -UseBasicParsing -TimeoutSec 180
}
Write-Output ('composer : ' + (& $php $phar --version --no-ansi 2>$null | Select-Object -First 1))
