@echo off
rem Lane C composer wrapper.
setlocal
set "TOOLS=%~dp0"
if "%TOOLS:~-1%"=="\" set "TOOLS=%TOOLS:~0,-1%"
call "%TOOLS%\php.cmd" "%TOOLS%\composer.phar" %*
