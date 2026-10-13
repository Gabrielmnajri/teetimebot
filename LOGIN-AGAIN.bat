@echo off
REM Double-click if Telegram says you are LOGGED OUT of the club site.
title Tee-Time Login
cd /d "%~dp0"
set "PATH=%PATH%;%ProgramFiles%\nodejs"
node login.js
pause
