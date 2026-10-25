@echo off
setlocal
title Think Different Visuals Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Download the "LTS" version from https://nodejs.org , install it, then double-click this file again.
  echo.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)

if not exist node_modules (
  echo  First run: installing components. This takes a minute or two...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist dist\index.html (
  echo  Building the studio...
  call npm run build
  if errorlevel 1 goto :fail
)

rem A private publish token, created once and kept in token.txt next to this file.
if not exist token.txt (
  node -e "process.stdout.write(require('crypto').randomBytes(18).toString('hex'))" > token.txt
)
set /p BUILDER_TOKEN=<token.txt

echo.
echo  ============================================================
echo   Think Different Visuals Studio is running.
echo   Publish token (paste into Back-End ^> Hosting):
echo     %BUILDER_TOKEN%
echo   Keep this window open while you work. Close it to stop.
echo  ============================================================
echo.

start "" http://localhost:8787
node server\index.js
goto :eof

:fail
echo.
echo  Something went wrong above. Check your internet connection and try again.
pause
exit /b 1
