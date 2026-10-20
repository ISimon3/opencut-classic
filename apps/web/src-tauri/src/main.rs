#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, File},
    io::{self, Read, Write},
    net::{SocketAddr, TcpStream},
    path::Path,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_opener::OpenerExt;

// IndexedDB and OPFS are scoped to the origin, so keep this port stable.
const PORT: u16 = 32123;
const ADDRESS: SocketAddr =
    SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), PORT);

struct Server(Child);

impl Drop for Server {
    fn drop(&mut self) {
        #[cfg(windows)]
        if matches!(self.0.try_wait(), Ok(None)) {
            use std::os::windows::process::CommandExt;
            // Next dev forks a worker; terminate only this owned process tree.
            let _ = Command::new("taskkill.exe")
                .args(["/PID", &self.0.id().to_string(), "/T", "/F"])
                .creation_flags(0x08000000)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn health_check() -> bool {
    let Ok(mut stream) = TcpStream::connect_timeout(&ADDRESS, Duration::from_millis(250)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    if stream
        .write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut response = [0; 256];
    matches!(stream.read(&mut response), Ok(length) if response[..length].starts_with(b"HTTP/1.1 200 "))
}

fn start_server(runtime: &Path, log_dir: &Path) -> io::Result<Server> {
    // Tauri returns verbatim Windows paths (\\?\); Node's module loader expects
    // a conventional drive/UNC path for its entry point.
    let runtime = dunce::simplified(runtime);
    if TcpStream::connect_timeout(&ADDRESS, Duration::from_millis(250)).is_ok() {
        return Err(io::Error::new(
            io::ErrorKind::AddrInUse,
            "OpenCut's local port 32123 is occupied. Close the other process and try again.",
        ));
    }
    fs::create_dir_all(log_dir)?;
    let log_path = log_dir.join("server.log");
    let log = File::create(&log_path)?;
    let server_dir = runtime.join("apps").join("web");
    let development = cfg!(debug_assertions)
        && std::env::var_os("OPENCUT_DEV_NODE").is_some()
        && std::env::var_os("OPENCUT_DEV_NEXT").is_some();
    let mut command = if development {
        let mut command = Command::new(std::env::var_os("OPENCUT_DEV_NODE").unwrap_or_default());
        command
            .arg(std::env::var_os("OPENCUT_DEV_NEXT").unwrap_or_default())
            .args([
                "dev",
                "--turbopack",
                "--hostname",
                "127.0.0.1",
                "--port",
                "32123",
            ])
            .current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join(".."))
            .env("NODE_ENV", "development")
            .env_remove("NODE_PATH");
        command
    } else {
        let mut command = Command::new(runtime.join("node.exe"));
        command
            .arg(server_dir.join("server.js"))
            .current_dir(&server_dir)
            .env("NODE_ENV", "production")
            .env(
                "NODE_PATH",
                runtime
                    .join("node_modules")
                    .join(".bun")
                    .join("node_modules"),
            );
        command
    };
    command
        .env("PORT", PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("NEXT_TELEMETRY_DISABLED", "1")
        .stdin(Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log);
    // Upstream requires these environment values even for local editing.
    // Online integrations require real credentials; these defaults disable them.
    for (key, value) in [
        ("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:32123"),
        ("NEXT_PUBLIC_MARBLE_API_URL", "https://api.marblecms.com"),
        (
            "BETTER_AUTH_SECRET",
            "local-desktop-secret-0123456789abcdef",
        ),
        (
            "DATABASE_URL",
            "postgresql://opencut:opencut@127.0.0.1:5432/opencut",
        ),
        ("UPSTASH_REDIS_REST_URL", "http://127.0.0.1:8079"),
        ("UPSTASH_REDIS_REST_TOKEN", "desktop-unconfigured"),
        ("MARBLE_WORKSPACE_KEY", "desktop-unconfigured"),
        ("FREESOUND_CLIENT_ID", "desktop-unconfigured"),
        ("FREESOUND_API_KEY", "desktop-unconfigured"),
    ] {
        if std::env::var_os(key).is_none() {
            command.env(key, value);
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let mut server = Server(command.spawn()?);
    let deadline = Instant::now() + Duration::from_secs(60);
    loop {
        if let Some(status) = server.0.try_wait()? {
            return Err(io::Error::other(format!(
                "OpenCut server exited ({status}). See {}",
                log_path.display()
            )));
        }
        if health_check() {
            return Ok(server);
        }
        if Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                format!(
                    "OpenCut server did not start within 60 seconds. See {}",
                    log_path.display()
                ),
            ));
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

fn main() {
    let result = tauri::Builder::default()
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let runtime = if cfg!(debug_assertions) {
                Path::new(env!("CARGO_MANIFEST_DIR")).join("../desktop-runtime")
            } else {
                app.path().resource_dir()?.join("server")
            };
            let server = start_server(&runtime, &app.path().app_log_dir()?)?;
            app.manage(Mutex::new(Some(server)));
            let link_handler = app.handle().clone();
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External("http://127.0.0.1:32123/projects".parse()?),
            )
            .title("OpenCut")
            .inner_size(1440.0, 900.0)
            .min_inner_size(1024.0, 640.0)
            .drag_and_drop(false)
            .on_new_window(move |url, _| {
                if url.as_str() == "https://github.com/ISimon3/opencut-classic" {
                    if let Err(error) = link_handler.opener().open_url(url.as_str(), None::<&str>) {
                        eprintln!("Could not open GitHub in the default browser: {error}");
                    }
                }
                tauri::webview::NewWindowResponse::Deny
            })
            .build()?;
            let open_item = MenuItem::with_id(app, "open", "打开 OpenCut", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| io::Error::other("The OpenCut application icon is missing"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(icon.clone())?;
            }
            TrayIconBuilder::with_id("opencut")
                .icon(icon)
                .tooltip("OpenCut · 岑默之Simonius")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .build(tauri::generate_context!());
    match result {
        Ok(app) => app.run(|handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(server) = handle.try_state::<Mutex<Option<Server>>>() {
                    if let Ok(mut child) = server.lock() {
                        child.take();
                    }
                }
            }
        }),
        Err(error) => {
            eprintln!("OpenCut could not start: {error}");
            rfd::MessageDialog::new()
                .set_title("OpenCut could not start")
                .set_description(error.to_string())
                .set_level(rfd::MessageLevel::Error)
                .show();
            std::process::exit(1);
        }
    }
}
