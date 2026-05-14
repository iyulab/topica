use std::net::TcpListener;
use std::sync::OnceLock;
use tauri_plugin_shell::ShellExt;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = find_free_port();
    BACKEND_PORT.set(port).expect("Port already set");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let sidecar_command = app
                .shell()
                .sidecar("Topica.Api")
                .expect("Topica.Api sidecar not found")
                .env("TOPICA_PORT", port.to_string());

            let (_rx, _child) = sidecar_command
                .spawn()
                .expect("Failed to spawn Topica.Api sidecar");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
