use std::net::TcpListener;
use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;

pub struct BackendPort(pub u16);

pub fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind to find free port")
        .local_addr()
        .unwrap()
        .port()
}

mod commands {
    use super::BackendPort;
    use std::sync::Mutex;

    #[tauri::command]
    pub fn get_backend_port(state: tauri::State<'_, Mutex<BackendPort>>) -> u16 {
        state.lock().unwrap().0
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = find_free_port();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(BackendPort(port)))
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
        .invoke_handler(tauri::generate_handler![commands::get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
