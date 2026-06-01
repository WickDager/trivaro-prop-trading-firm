@echo off
cd /d "%~dp0"
echo.
echo ============================================
echo   Trivaro MT5 Monitor
echo ============================================
echo.
echo [1] Run one poll cycle (test mode)
echo [2] Run continuously
echo [3] Exit
echo.
set /p choice="Select: "

if "%choice%"=="1" (
    python mt5_bridge.py --once --lookback 1440
    pause
) else if "%choice%"=="2" (
    python mt5_bridge.py
) else (
    exit
)
