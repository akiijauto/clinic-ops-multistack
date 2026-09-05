@echo off
rem Lane C: run this stack's own tests. Green here is NOT "done".
setlocal
set "TOOLS=%~dp0"
if "%TOOLS:~-1%"=="\" set "TOOLS=%TOOLS:~0,-1%"
pushd "%TOOLS%\.."
call "%TOOLS%\php.cmd" artisan test %*
popd
