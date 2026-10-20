$ErrorActionPreference = 'Stop'
$repoDir = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoDir 'apps\web'

function Find-Executable([string]$name, [string[]]$candidates) {
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    throw "$name was not found. Install the development tools described in TAURI-DESKTOP.md."
}

try {
    Set-Location -LiteralPath $repoDir
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

    $nodeMajor = & $node -p 'process.versions.node.split(String.fromCharCode(46))[0]'
    if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }

    if (-not (Test-Path -LiteralPath (Join-Path $webDir 'node_modules\next\package.json'))) {
        Write-Host 'Installing project dependencies...'
        & $bun install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    Set-Location -LiteralPath $webDir
    $nextCli = & $node -p "require.resolve('next/dist/bin/next')"
    if ($LASTEXITCODE -ne 0) { throw 'Next.js was not found. Run bun install from the repository root.' }
    $env:OPENCUT_DEV_NODE = $node
    $env:OPENCUT_DEV_NEXT = $nextCli

    # The Tauri resource directory must exist even in development mode.
    New-Item -ItemType Directory -Force -Path (Join-Path $webDir 'desktop-runtime') | Out-Null
    Write-Host 'Starting OpenCut desktop with live frontend updates...'
    Write-Host 'The first launch compiles Rust. Close the OpenCut window to stop its server.'
    Write-Host 'If an older OpenCut instance is open, close it first to load the latest source.'
    & $cargo run --locked --manifest-path (Join-Path $webDir 'src-tauri\Cargo.toml')
    if ($LASTEXITCODE -ne 0) { throw "OpenCut exited with code $LASTEXITCODE." }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
