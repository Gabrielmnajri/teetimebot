@echo off
REM Double-click if WhatsApp says you are LOGGED OUT of the club site.
title Tee-Time Bot Login
cd /d "%~dp0"
set "PATH=%PATH%;%ProgramFiles%\nodejs"
node login.js
pause
