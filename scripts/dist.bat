@echo off
REM Dist: Runs the dist workflow on Windows.
echo Creating Windows installer...
call npm run dist
echo Installer created in dist folder.