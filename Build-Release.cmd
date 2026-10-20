@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-release.ps1" %*
set "BUILD_EXIT=%ERRORLEVEL%"
if not "%BUILD_EXIT%"=="0" (
  echo.
  echo Release build failed. See the error above and the build log.
  pause
) else (
  echo.
  echo Release build complete. Output is in the release folder.
  pause
)
endlocal & exit /b %BUILD_EXIT%
