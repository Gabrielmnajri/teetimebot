@echo off
REM Double-click this file to set up the tee-time assistant. Safe to run again any time.
title Tee-Time Assistant Setup
cd /d "%~dp0"

echo %~dp0 | find /i "\AppData\Local\Temp\" >nul
if not errorlevel 1 goto notextracted

echo.
echo  ============================================================
echo    TEE-TIME ASSISTANT SETUP
echo  ============================================================
echo.

REM If the assistant is already running (setup run again), pause it for now
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule.ps1" -StopOnly >nul 2>nul

REM ---- 1. Node.js (the program that runs the bot) ----
set "PATH=%PATH%;%ProgramFiles%\nodejs"
where node >nul 2>nul
if not errorlevel 1 goto havenode

echo  Installing Node.js, the program that runs the bot...
echo  If Windows asks "Do you want to allow this app to make changes", click YES.
echo.
where winget >nul 2>nul
if errorlevel 1 goto manualnode
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
where node >nul 2>nul
if errorlevel 1 goto manualnode

:havenode
echo  [OK] Node.js is installed.
echo.

REM ---- 2. Bot files and its browser ----
echo  Downloading the bot's parts. This can take a few minutes...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto failed
call npx playwright install chromium
if errorlevel 1 goto failed
echo  [OK] Bot installed.

REM ---- 3. WhatsApp + club login ----
node setup.js
if errorlevel 1 goto failed

REM ---- 4. Start the assistant (and at every sign-in) ----
echo.
echo  ------------------------------------------------------------
echo   STEP 3 of 3: Start your assistant
echo  ------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule.ps1"
if errorlevel 1 goto failed

echo.
echo  ============================================================
echo    ALL DONE!
echo  ============================================================
echo   Your assistant is running. Open Telegram and text it, e.g.:
echo.
echo       book saturday 8:30
echo.
echo   Text it "help" to see everything it can do.
echo.
echo   Keep this PC plugged in, ON, and signed in to Windows.
echo   It has been set to never sleep while plugged in.
echo   If Telegram says "LOGGED OUT", double-click LOGIN-AGAIN here.
echo.
pause
exit /b 0

:manualnode
echo.
echo  Please install Node.js yourself - it is easy:
echo    1. A web page is opening now. Click the big green "LTS" button.
echo    2. Open the file it downloads and click Next until it finishes.
echo    3. Then double-click SETUP again.
start "" "https://nodejs.org/"
echo.
pause
exit /b 1

:notextracted
echo.
echo  Almost! You opened SETUP from inside the zip file.
echo  Please do this first:
echo    1. Close this window.
echo    2. Right-click the zip file and choose "Extract All...", then "Extract".
echo    3. Open the new folder and double-click SETUP there.
echo.
pause
exit /b 1

:failed
echo.
echo  Something went wrong - see the messages above.
echo  Check your internet connection and double-click SETUP to try again.
echo  If it keeps failing, take a photo of this window and send it to Claude.
echo.
pause
exit /b 1
