@echo off
rem Lane C: start the app. Default port 8403 (coordination/PORTS.md is authoritative).
setlocal
set "TOOLS=%~dp0"
if "%TOOLS:~-1%"=="\" set "TOOLS=%TOOLS:~0,-1%"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8403"
pushd "%TOOLS%\.."
call "%TOOLS%\php.cmd" artisan serve --host=127.0.0.1 --port=%PORT%
popd
