@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Opportunity Radar - Local Console
echo   (browser will open automatically)
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found in PATH.
  echo         Install Python 3.11+ and make sure "python" works in cmd.
  pause
  exit /b 1
)

if not exist "current\index.html" if not exist "app\dist\index.html" (
  echo [INFO] No local build found yet. Run scripts\daily-run.ps1 once, or
  echo        the console will fall back to the latest frozen release build.
)

python scanner\serve.py --open
if errorlevel 1 (
  echo.
  echo [ERROR] Console stopped with an error. See scanner\logs\console.log
  pause
  exit /b 1
)
