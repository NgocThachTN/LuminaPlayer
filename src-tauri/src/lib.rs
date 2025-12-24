use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileBuffer {
    pub buffer: String, // base64 encoded
    pub mime_type: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub title: String,
    pub artist: String,
    pub name: String,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistItem {
    pub path: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct AppConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    playlist: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_song_index: Option<i32>,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_config_path() -> PathBuf {
    let app_data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let config_dir = app_data.join("com.lumina.musicplayer");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("config.json")
}

fn get_config() -> AppConfig {
    let config_path = get_config_path();
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

fn save_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path();
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())
}

fn get_mime_type(extension: &str) -> &'static str {
    match extension.to_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "wma" => "audio/x-ms-wma",
        _ => "audio/mpeg",
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

// -- File Operations --

#[tauri::command]
async fn read_file_buffer(file_path: String) -> Result<Option<FileBuffer>, String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Ok(None);
    }

    let buffer = fs::read(&path).map_err(|e| e.to_string())?;
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("mp3");
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    
    Ok(Some(FileBuffer {
        buffer: STANDARD.encode(&buffer),
        mime_type: get_mime_type(extension).to_string(),
        name,
    }))
}

#[tauri::command]
async fn file_exists(file_path: String) -> bool {
    PathBuf::from(&file_path).exists()
}

// -- Dialog Operations --

#[tauri::command]
async fn open_folder_dialog(window: tauri::Window) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let folder = window
        .dialog()
        .file()
        .set_title("Select Music Folder")
        .blocking_pick_folder();
    
    match folder {
        Some(path) => {
            let folder_path = path.to_string();
            let audio_extensions = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma"];
            
            let entries = fs::read_dir(&folder_path).map_err(|e| e.to_string())?;
            let mut files: Vec<String> = entries
                .filter_map(|entry| entry.ok())
                .filter(|entry| {
                    if let Some(ext) = entry.path().extension() {
                        audio_extensions.contains(&ext.to_str().unwrap_or("").to_lowercase().as_str())
                    } else {
                        false
                    }
                })
                .filter_map(|entry| entry.path().to_str().map(|s| s.to_string()))
                .collect();
            
            files.sort();
            Ok(files)
        }
        None => Ok(vec![]),
    }
}

#[tauri::command]
async fn open_file_dialog(window: tauri::Window) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let files = window
        .dialog()
        .file()
        .set_title("Select Music Files")
        .add_filter("Audio Files", &["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma"])
        .blocking_pick_files();
    
    match files {
        Some(paths) => {
            Ok(paths.iter().filter_map(|p| Some(p.to_string())).collect())
        }
        None => Ok(vec![]),
    }
}

// -- File Info --

#[tauri::command]
async fn get_file_info(file_path: String) -> Result<FileInfo, String> {
    let path = PathBuf::from(&file_path);
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    let name_without_ext = path.file_stem().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    
    let size = fs::metadata(&path).ok().map(|m| m.len());
    
    // Try to parse "Artist - Title" format
    let (artist, title) = if let Some(idx) = name_without_ext.find(" - ") {
        let first = name_without_ext[..idx].trim();
        let second = name_without_ext[idx + 3..].trim();
        
        // If first part is numeric, it's a track number
        if first.chars().all(|c| c.is_ascii_digit()) {
            ("Unknown Artist".to_string(), second.to_string())
        } else {
            (first.to_string(), second.to_string())
        }
    } else {
        ("Unknown Artist".to_string(), name_without_ext.clone())
    };
    
    Ok(FileInfo {
        title,
        artist,
        name,
        size,
    })
}

// -- API Key Management --

#[tauri::command]
async fn get_api_key() -> String {
    get_config().api_key.unwrap_or_default()
}

#[tauri::command]
async fn set_api_key(api_key: String) -> Result<bool, String> {
    let mut config = get_config();
    config.api_key = Some(api_key);
    save_config(&config)?;
    Ok(true)
}

#[tauri::command]
async fn has_api_key() -> bool {
    get_config().api_key.is_some()
}

// -- Playlist Persistence --

#[tauri::command]
async fn save_playlist(items: Vec<serde_json::Value>) -> Result<bool, String> {
    let mut config = get_config();
    config.playlist = Some(items);
    save_config(&config)?;
    Ok(true)
}

#[tauri::command]
async fn get_playlist() -> Vec<serde_json::Value> {
    get_config().playlist.unwrap_or_default()
}

#[tauri::command]
async fn save_current_index(index: i32) -> Result<bool, String> {
    let mut config = get_config();
    config.current_song_index = Some(index);
    save_config(&config)?;
    Ok(true)
}

#[tauri::command]
async fn get_current_index() -> i32 {
    get_config().current_song_index.unwrap_or(-1)
}

// -- Discord RPC Placeholder --
// Discord RPC will be handled in frontend using existing JS library

#[tauri::command]
async fn update_discord_presence(_data: serde_json::Value) -> bool {
    // Placeholder - Discord RPC is handled via frontend JS
    true
}

#[tauri::command]
async fn clear_discord_presence() -> bool {
    // Placeholder - Discord RPC is handled via frontend JS
    true
}

// -- LDAC Placeholder --

#[tauri::command]
async fn check_ldac_support() -> bool {
    // LDAC support deferred to Phase 2
    false
}

// ============================================================================
// Tauri App Entry
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // File operations
            read_file_buffer,
            file_exists,
            // Dialog operations
            open_folder_dialog,
            open_file_dialog,
            // File info
            get_file_info,
            // API Key
            get_api_key,
            set_api_key,
            has_api_key,
            // Playlist
            save_playlist,
            get_playlist,
            save_current_index,
            get_current_index,
            // Discord (placeholder)
            update_discord_presence,
            clear_discord_presence,
            // LDAC (placeholder)
            check_ldac_support,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
