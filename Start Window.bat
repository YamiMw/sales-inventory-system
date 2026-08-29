@echo off
setlocal

title Sales Inventory System
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm were not found on PATH.
  echo Install Node.js 24, then run this file again.
  pause
  exit /b 1
)

echo Closing any stale Electron processes...
taskkill /F /IM electron.exe >nul 2>&1

if not exist "%~dp0\node_modules\electron\dist\electron.exe" (
  echo Electron dependencies are missing or incomplete.
  echo Running npm install to restore the app setup...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b %errorlevel%
  )
)

echo Checking the native database module for Electron...
call npm.cmd run rebuild:electron

if errorlevel 1 (
  echo.
  echo Native module rebuild failed.
  echo Try this manually in a fresh terminal:
  echo   npm install
  echo   npm run rebuild:electron
  pause
  exit /b %errorlevel%
)

echo Starting Sales Inventory System...
call npm.cmd run start

if errorlevel 1 (
  echo.
  echo The app did not start successfully.
  echo If the database error appears, run:
  echo   npm install
  echo   npm run rebuild:electron
  pause
  exit /b %errorlevel%
)

endlocal
