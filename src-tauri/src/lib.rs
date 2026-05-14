use std::net::TcpListener;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

static BACKEND_PORT: OnceLock<u16> = OnceLock::new();

pub fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind to find free port")
        .local_addr()
        .unwrap()
        .port()
}

#[tauri::command]
fn get_backend_port() -> u16 {
    *BACKEND_PORT.get().expect("Backend port not initialized")
}

struct SidecarHandle(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = find_free_port();
    BACKEND_PORT.set(port).expect("Port already set");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let sidecar_command = app
                .shell()
                .sidecar("Topica.Api")
                .expect("Topica.Api sidecar not found")
                .env("TOPICA_PORT", port.to_string());

            let (_rx, child) = sidecar_command
                .spawn()
                .expect("Failed to spawn Topica.Api sidecar");

            app.manage(SidecarHandle(Mutex::new(Some(child))));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(child) = window
                    .app_handle()
                    .state::<SidecarHandle>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
