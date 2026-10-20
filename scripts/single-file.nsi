Unicode true
Name "OpenCut Simonius"
OutFile "@@OUTPUT@@"
Icon "@@ICON@@"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
VIProductVersion "@@PRODUCT_VERSION@@"
VIAddVersionKey "ProductName" "OpenCut Simonius"
VIAddVersionKey "FileDescription" "OpenCut single-file desktop launcher"
VIAddVersionKey "FileVersion" "@@VERSION@@"
VIAddVersionKey "LegalCopyright" "OpenCut contributors / Simonius"
!cd "@@SOURCE@@"

Section
  StrCpy $INSTDIR "$LOCALAPPDATA\app.opencut.desktop\runtime\@@BUILD_ID@@"
  IfFileExists "$INSTDIR\ready" launch
  ClearErrors
  SetOutPath "$INSTDIR"
  File /r "*"
  IfErrors failed
  FileOpen $0 "$INSTDIR\ready" w
  FileWrite $0 "@@BUILD_ID@@"
  FileClose $0
launch:
  SetOutPath "$INSTDIR"
  ClearErrors
  ExecWait '"$INSTDIR\OpenCut.exe"' $0
  IfErrors failed
  SetErrorLevel $0
  Goto done
failed:
  MessageBox MB_ICONSTOP "OpenCut could not extract or start its runtime. Check available disk space and make sure Microsoft Edge WebView2 Runtime is installed."
  SetErrorLevel 1
done:
SectionEnd
