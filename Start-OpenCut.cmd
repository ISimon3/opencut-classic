@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-desktop.ps1"
if errorlevel 1 (
  echo.
  echo OpenCut could not start. See the error above.
  pause
)
endlocal
