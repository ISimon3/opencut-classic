$ErrorActionPreference = 'Stop'
$repoDir = Split-Path -Parent $PSScriptRoot
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
$linkPath = Join-Path $desktopDir 'OpenCut Simonius.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($linkPath)
$shortcut.TargetPath = Join-Path $repoDir 'Start-OpenCut.cmd'
$shortcut.WorkingDirectory = $repoDir
$shortcut.IconLocation = "$(Join-Path $repoDir 'apps\web\src-tauri\icons\icon.ico'),0"
$shortcut.Description = 'OpenCut desktop by Simonius'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Host "Created desktop shortcut: $linkPath"
