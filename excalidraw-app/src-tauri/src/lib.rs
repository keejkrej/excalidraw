use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::Serialize;
use tauri::{Emitter, Manager};

const DESKTOP_OPEN_FILES_EVENT: &str = "desktop-open-files";

#[derive(Clone, Serialize)]
struct DesktopOpenFilesPayload {
    paths: Vec<String>,
}

#[derive(Clone, Serialize)]
struct ReadFileResponse {
    #[serde(rename = "bytesBase64")]
    bytes_base64: String,
    name: String,
}

fn stringify_path(path: &Path) -> Option<String> {
    path.to_str().map(ToOwned::to_owned)
}

fn resolve_file_argument(argument: &str, cwd: &Path) -> Option<PathBuf> {
    if argument.starts_with('-') {
        return None;
    }

    let candidate = PathBuf::from(argument);
    let resolved = if candidate.is_absolute() {
        candidate
    } else {
        cwd.join(candidate)
    };

    if resolved.is_file() {
        return Some(resolved);
    }

    None
}

fn collect_launch_paths<I, S>(arguments: I, cwd: &Path) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    arguments
        .into_iter()
        .filter_map(|argument| resolve_file_argument(argument.as_ref(), cwd))
        .filter_map(|path| stringify_path(&path))
        .collect()
}

fn emit_open_paths(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    let _ = app.emit(DESKTOP_OPEN_FILES_EVENT, DesktopOpenFilesPayload { paths });
}

#[tauri::command]
fn get_launch_paths() -> Vec<String> {
    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    collect_launch_paths(env::args().skip(1), &cwd)
}

#[tauri::command]
fn read_file(path: String) -> Result<ReadFileResponse, String> {
    let path_buf = PathBuf::from(&path);
    let bytes = fs::read(&path_buf)
        .map_err(|error| format!("Failed to read file {}: {error}", path_buf.display()))?;
    let name = path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Failed to resolve file name for {}", path_buf.display()))?;

    Ok(ReadFileResponse {
        bytes_base64: BASE64.encode(bytes),
        name,
    })
}

#[tauri::command]
fn write_file(path: String, bytes_base64: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    let bytes = BASE64
        .decode(bytes_base64.as_bytes())
        .map_err(|error| format!("Failed to decode file bytes: {error}"))?;

    fs::write(&path_buf, bytes)
        .map_err(|error| format!("Failed to write file {}: {error}", path_buf.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let cwd_path = PathBuf::from(cwd);
            let paths = collect_launch_paths(argv.into_iter().skip(1), &cwd_path);
            emit_open_paths(app, paths);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_launch_paths,
            read_file,
            write_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Excalidraw desktop");
}
