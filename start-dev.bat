@echo off
rem -- Dynamic Path Version --
cd /d "%~dp0"

echo ===================================================
echo      Arc Connect (Test Environment) Launcher
echo ===================================================
echo Working directory set to: %CD%
echo.

echo [1/3] 🔪 Cleaning up old processes (Zombies)...
taskkill /F /IM node.exe >nul 2>&1
echo       ✅ Process cleanup complete.
echo.

echo [2/3] 🚀 Starting Backend Server (Port 5000)...
start "Arc Connect Backend" /min cmd /k "cd api && npm run dev"
timeout /t 3 >nul

echo [3/3] 🎨 Starting Frontend...
start "Arc Connect Frontend" /min cmd /k "cd frontend && npm run dev"

echo.
echo ✅ All systems starting in new windows!
echo The launcher will close in 3 seconds...
timeout /t 3 >nul
exit
