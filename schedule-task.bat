@echo off
REM Registers a weekly Windows task: every Friday at 7:57 AM the bot starts,
REM checks your login, then waits and books at 8:00.
REM Right-click this file -> "Run as administrator".

set BOTDIR=%~dp0
schtasks /create /f /tn "TeeTimeBot" /sc weekly /d FRI /st 07:57 ^
  /tr "cmd /c cd /d \"%BOTDIR%\" && npm run book >> \"%BOTDIR%bot.log\" 2>&1" /it

echo.
echo Done. Open Task Scheduler, find "TeeTimeBot" ^> Properties ^> Conditions
echo and tick "Wake the computer to run this task".
pause
