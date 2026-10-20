param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$repoDir = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoDir 'apps\web'
$releaseRoot = Join-Path $repoDir 'release'
$staging = Join-Path $releaseRoot ('.build-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))

function Find-Executable([string]$name, [string[]]$candidates) {
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
    $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    throw "$name was not found. Install the tools listed in TAURI-DESKTOP.md."
}
function Assert-Exit([string]$step) { if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." } }
function Escape-Nsis([string]$value) { return $value.Replace('$', '$$').Replace('"', '$\"') }

try {
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    Start-Transcript -Path (Join-Path $staging 'build.log') | Out-Null
    $bunCandidates = @((Join-Path $env:USERPROFILE '.bun\bin\bun.exe'))
    $protoBun = Join-Path $env:USERPROFILE '.proto\tools\bun'
    if (Test-Path -LiteralPath $protoBun) {
        $bunCandidates += Get-ChildItem -LiteralPath $protoBun -Directory |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bun.exe') } |
            Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bun.exe' }
    }
    $bun = Find-Executable 'bun.exe' $bunCandidates
    $node = Find-Executable 'node.exe' @($env:OPENCUT_NODE, (Join-Path $env:ProgramFiles 'nodejs\node.exe'))
    $cargo = Find-Executable 'cargo.exe' @((Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'))
    $env:PATH = "$(Split-Path $bun);$(Split-Path $node);$(Split-Path $cargo);$env:PATH"
    $env:OPENCUT_NODE = $node
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $nodeInfo = & $node -p 'JSON.stringify({version:process.versions.node,arch:process.arch})' | ConvertFrom-Json
    Assert-Exit 'Node check'
    if ([int]$nodeInfo.version.Split('.')[0] -lt 22 -or $nodeInfo.arch -ne 'x64') { throw 'Windows x64 Node.js 22+ is required.' }
    $config = Get-Content -Raw -LiteralPath (Join-Path $webDir 'src-tauri\tauri.conf.json') | ConvertFrom-Json
    $version = $config.version
    if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'A numeric major.minor.patch version is required for Windows releases.' }
    if (-not $SkipBuild) {
        Set-Location -LiteralPath $repoDir
        Write-Host '[1/5] Checking project dependencies...'
        & $bun install --frozen-lockfile
        Assert-Exit 'Dependency installation'
        Set-Location -LiteralPath $webDir
        Write-Host '[2/5] Building production frontend, Rust release and Setup...'
        & $node (Join-Path $webDir 'node_modules\@tauri-apps\cli\tauri.js') build --bundles nsis -- --locked
        Assert-Exit 'Tauri release build'
    }
    $runtime = Join-Path $webDir 'desktop-runtime'
    $releaseExe = Join-Path $webDir 'src-tauri\target\release\opencut-tauri.exe'
    $setupExe = Join-Path $webDir "src-tauri\target\release\bundle\nsis\OpenCut_${version}_x64-setup.exe"
    foreach ($file in @($releaseExe, $setupExe, (Join-Path $runtime 'node.exe'), (Join-Path $runtime 'apps\web\server.js'))) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing build output: $file" }
    }
    $baseName = "OpenCut-Simonius-$version-windows-x64"
    $portableDir = Join-Path $staging $baseName
    New-Item -ItemType Directory -Path $portableDir | Out-Null
    Write-Host '[3/5] Assembling portable folder and ZIP...'
    Copy-Item -LiteralPath $releaseExe -Destination (Join-Path $portableDir 'OpenCut.exe')
    Copy-Item -LiteralPath $runtime -Destination (Join-Path $portableDir 'server') -Recurse
    Copy-Item -LiteralPath (Join-Path $repoDir 'LICENSE') -Destination (Join-Path $portableDir 'LICENSE.txt')
    @"
OpenCut desktop by Simonius - Windows x64 - $version

Run OpenCut.exe. Keep the server folder next to it.
Microsoft Edge WebView2 Runtime is required. Setup installs it if missing.
No Node.js, Bun or Rust installation is required to run this release.
Projects and preferences are stored in the app's local WebView2 profile.
This ZIP is portable for application files; user data is not stored in this folder.
The single-file edition extracts the same files to LocalAppData on first launch.
All editions share the same app identity and local projects. Run one at a time.
"@ | Set-Content -LiteralPath (Join-Path $portableDir 'README.txt') -Encoding UTF8
    $zipName = "$baseName-portable.zip"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $portableDir,
        (Join-Path $staging $zipName),
        [System.IO.Compression.CompressionLevel]::Optimal,
        $true
    )
    $buildId = (Get-FileHash -LiteralPath (Join-Path $staging $zipName) -Algorithm SHA256).Hash.Substring(0,16).ToLowerInvariant()
    Write-Host '[4/5] Building self-extracting single-file EXE...'
    $makensis = Find-Executable 'makensis.exe' @(
        (Join-Path $env:LOCALAPPDATA 'tauri\NSIS\makensis.exe'),
        (Join-Path $env:LOCALAPPDATA 'tauri\NSIS\Bin\makensis.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'NSIS\makensis.exe')
    )
    $singleName = "$baseName-single.exe"
    # NSIS uses legacy Windows file APIs; shorten the source path with a junction.
    $sfxWork = Join-Path $env:TEMP ('oc-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $sfxWork | Out-Null
    $sfxSource = Join-Path $sfxWork 'app'
    New-Item -ItemType Junction -Path $sfxSource -Target $portableDir | Out-Null
    $nsi = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'single-file.nsi')
    $nsi = $nsi.Replace('@@OUTPUT@@', (Escape-Nsis (Join-Path $staging $singleName))).
        Replace('@@ICON@@', (Escape-Nsis (Join-Path $webDir 'src-tauri\icons\icon.ico'))).
        Replace('@@PRODUCT_VERSION@@', "$version.0").Replace('@@VERSION@@', $version).
        Replace('@@BUILD_ID@@', $buildId).Replace('@@SOURCE@@', (Escape-Nsis $sfxSource))
    $nsiPath = Join-Path $staging 'single-file.nsi'
    $nsi | Set-Content -LiteralPath $nsiPath -Encoding UTF8
    try {
        & $makensis /V2 $nsiPath
        Assert-Exit 'Single-file compilation'
    } finally {
        # Non-recursive removal deletes only the junction, never its target.
        if ((Get-Item -LiteralPath $sfxSource).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            [IO.Directory]::Delete($sfxSource)
        }
        [IO.Directory]::Delete($sfxWork)
    }
    $setupName = "$baseName-setup.exe"
    Copy-Item -LiteralPath $setupExe -Destination (Join-Path $staging $setupName)
    Write-Host '[5/5] Publishing outputs and SHA256 checksums...'
    $outputDir = Join-Path $releaseRoot $version
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    $artifactNames = @($setupName, $singleName, $zipName)
    $checksums = foreach ($name in $artifactNames) {
        $artifact = Join-Path $staging $name
        if ((Get-Item -LiteralPath $artifact).Length -eq 0) { throw "Empty artifact: $name" }
        Copy-Item -LiteralPath $artifact -Destination (Join-Path $outputDir $name) -Force
        "$( (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant())  $name"
    }
    $checksums | Set-Content -LiteralPath (Join-Path $outputDir 'SHA256SUMS.txt') -Encoding ASCII
    Copy-Item -LiteralPath (Join-Path $portableDir 'README.txt') -Destination (Join-Path $outputDir 'README.txt') -Force
    Stop-Transcript | Out-Null
    Copy-Item -LiteralPath (Join-Path $staging 'build.log') -Destination (Join-Path $outputDir 'build.log') -Force
    # Delete only the generated staging directory, after checking its resolved boundary.
    $stagingResolved = (Resolve-Path -LiteralPath $staging).Path
    $releaseResolved = (Resolve-Path -LiteralPath $releaseRoot).Path
    if (-not $stagingResolved.StartsWith($releaseResolved + '\', [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $stagingResolved) -notlike '.build-*') {
        throw 'Refusing to remove a staging directory outside release.'
    }
    Remove-Item -LiteralPath $stagingResolved -Recurse -Force
    Write-Host "SUCCESS: $outputDir" -ForegroundColor Green
    Get-Item -LiteralPath ($artifactNames | ForEach-Object { Join-Path $outputDir $_ }) | Select-Object Name, Length
} catch {
    try { Stop-Transcript | Out-Null } catch {}
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Build files and log retained at: $staging"
    exit 1
}
