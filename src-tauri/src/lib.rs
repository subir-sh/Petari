use tauri::Manager;

#[tauri::command]
fn open_url(url: String) {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return;
    }

    let _ = std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![open_url])
        .on_window_event(|window, event| {
            if window.label() == "list" && matches!(event, tauri::WindowEvent::Destroyed) {
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Petari");
}
