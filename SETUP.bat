@echo off
REM Double-click this file to set up the tee-time bot. Safe to run again any time.
title Tee-Time Bot Setup
cd /d "%~dp0"

echo %~dp0 | find /i "\AppData\Local\Temp\" >nul
if not errorlevel 1 goto notextracted

echo.
echo  ============================================================
echo    TEE-TIME BOT SETUP
echo  ============================================================
echo.

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

REM ---- 4. Schedule every Friday ----
echo.
echo  ------------------------------------------------------------
echo   STEP 3 of 3: Schedule it for every Friday
echo  ------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule.ps1"
if errorlevel 1 goto failed

echo.
echo  ============================================================
echo    ALL DONE!
echo  ============================================================
echo   The bot will run every Friday at 7:57 AM and book Saturday.
echo.
echo   On Friday mornings, just make sure the PC is:
echo     - ON or ASLEEP, not shut down
echo     - plugged in
echo     - signed in to Windows
echo.
echo   You will get WhatsApp messages telling you what happened.
echo   If one says "LOGGED OUT", double-click LOGIN-AGAIN in this folder.
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
