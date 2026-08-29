@echo off
REM Build: Runs the build workflow on Windows.
echo Building Sales & Inventory System for production...
call npm run clean
call npm run build:main
call npm run build:renderer
echo Build complete!