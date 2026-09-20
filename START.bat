@echo off
setlocal
cd /d "%~dp0"
title Home Dashboard
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Dashboard.ps1"
if errorlevel 1 (
  echo.
  echo Das Dashboard konnte nicht gestartet werden.
  echo Bitte pruefen, ob Port 8787 bereits verwendet wird.
  pause
)
