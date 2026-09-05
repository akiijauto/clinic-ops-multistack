@echo off
rem Lane C php wrapper. See tools/README.md for why this exists.
setlocal
set "TOOLS=%~dp0"
if "%TOOLS:~-1%"=="\" set "TOOLS=%TOOLS:~0,-1%"
if not exist "%TOOLS%\php-binary.txt" (
  echo tools\php-binary.txt not found. Run tools\setup.ps1 first. 1>&2
  exit /b 1
)
set /p PHPBIN=<"%TOOLS%\php-binary.txt"
set "PHPRC=%TOOLS%"
"%PHPBIN%" %*
