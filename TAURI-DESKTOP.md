# OpenCut Tauri desktop (Windows x64)

This fork packages the classic editor used by https://opencut.app. The upstream
`OpenCut-app/OpenCut` repository is a separate rewrite. This integration lives in
`apps/web/src-tauri`; the upstream GPUI app in `apps/desktop` is independent.

## Build

For release distributions, double-click `Build-Release.cmd` in the repository root.
It builds the production frontend and Rust release, then produces all three files
in `release/<version>/`:

- `OpenCut-Simonius-<version>-windows-x64-setup.exe`: NSIS installer.
- `OpenCut-Simonius-<version>-windows-x64-single.exe`: one executable that extracts
  its bundled runtime to `%LOCALAPPDATA%\app.opencut.desktop\runtime\<build-id>` on
  first use, then launches the app. Later runs reuse that build's cache.
- `OpenCut-Simonius-<version>-windows-x64-portable.zip`: extract and run
  `OpenCut.exe`, keeping the `server` folder next to it.

The output also includes SHA256 checksums, runtime notes and a build log. Failed
builds retain their log under `release/.build-*`; previous release artifacts are
preserved until the new build succeeds. Use `scripts/build-release.ps1 -SkipBuild`
only to repackage an existing successful release build.

The portable and single-file editions require WebView2 to be installed already.
They need no separately installed Node, Bun or Rust. All editions retain the same
application identity and WebView2 profile; portable application files do not mean
user data is stored in the ZIP folder. This script targets Windows x64 and creates
unsigned builds.

For local editing, double-click `Start-OpenCut.cmd` in the repository root.
It detects installed Node/Bun/Rust, installs missing project dependencies,
compiles the debug desktop shell, and starts Next.js with hot reload inside
Tauri. No installer is generated. Close the desktop window to stop its server.
The first Rust build takes longer; frontend edits then appear automatically.
Close any previously running desktop instance before using the launcher.

Install Bun (the repository pins 1.2.18), Windows x64 Node.js 22 or newer, Rust
stable with the MSVC target, and Visual Studio C++ Build Tools with a Windows SDK.
The installed app includes Node; end users do not need development tools.

From the repository root, in PowerShell:

```powershell
bun install --frozen-lockfile
bun run desktop:build
```

If Node is outside PATH, set `$env:OPENCUT_NODE` to the absolute path of `node.exe`
before building. Preparation builds Next.js with TypeScript checking enabled,
stages its standalone server, static assets and public files, and includes Node
and its license notices. The generated `desktop-runtime` directory is ignored by
Git. The first Rust compilation can take several minutes.

The installer is generated at:

```text
apps/web/src-tauri/target/release/bundle/nsis/OpenCut_0.1.0_x64-setup.exe
```

Development: `bun run desktop:dev`. It first builds the server, then starts Tauri
with Rust hot reload. After changing frontend code, rebuild the server.

## Runtime

- Tauri 2 uses Windows WebView2. The installer bootstraps WebView2 if needed;
  this may require an internet connection on machines without WebView2.
- The bundled Next.js server listens only on `127.0.0.1:32123`. The app checks
  `/api/health` before opening `/projects`, hides the Node console, and terminates
  its server on normal exit. A second launch focuses the existing window.
- Keep the port and `app.opencut.desktop` identifier stable across releases.
  Projects/media use the existing IndexedDB and OPFS implementation, stored in
  this desktop app's WebView2 profile; website/browser projects are separate.
- An unrelated process occupying port 32123 produces an error instead of opening
  that process's page. Server logs are under Tauri's app log directory, normally
  `%LOCALAPPDATA%\app.opencut.desktop\logs\server.log`.
- Local project creation, editing, media import and export use the existing web
  editor. Account authentication, Freesound search, feedback and remote assets
  require their upstream services, internet access and/or real credentials.
  The build supplies placeholder values for upstream environment validation;
  it does not provision PostgreSQL, Redis, or cloud accounts. Real server values
  can be supplied through environment variables. `NEXT_PUBLIC_*` values are
  compiled into the frontend and must be set before building.
- Normal exit cleans up the server; forced termination by Task Manager may leave
  it running. Close that process before relaunching.
- This build targets Windows x64 and is unsigned.

## Source fixes needed by the upstream snapshot

The fork also restores the missing shortcut/action validators and updates
IndexedDB and sticker registry call sites to their current object parameters.
Migration fixes preserve the persisted data format. Two existing test
expectations use branded `MediaTime` values so production type checking passes.

## Verification

Build with `bun run desktop:build`; check frontend types with
`bun --cwd apps/web x tsc --noEmit` after Next has generated content collections.
Rust formatting/lint commands run from `apps/web/src-tauri`:

```powershell
cargo fmt --all -- --check
cargo clippy --locked -- -D warnings
```

The upstream `opencut-wasm` bundler package currently does not initialize under
Bun's test runner, which prevents the time-line WASM tests from running normally.
This limitation is separate from the Next.js browser bundle.
