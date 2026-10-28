@echo off
title Smart Campus Issue Maintenance Platform
cd /d "%~dp0"
echo ==================================================
echo    SMART CAMPUS ISSUE MAINTENANCE PLATFORM
echo ==================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js LTS and retry.
  echo https://nodejs.org/
  pause
  exit /b 1
)
echo First run may take a few minutes while dependencies install.
call npm install
if errorlevel 1 goto error
call npm run install:all
if errorlevel 1 goto error
echo.
echo Starting API and website...
echo Website: http://localhost:5173
echo API health: http://localhost:5000/api/health
call npm run dev
goto end
:error
echo.
echo Setup failed. Check your internet connection and Node.js installation.
pause
:end
