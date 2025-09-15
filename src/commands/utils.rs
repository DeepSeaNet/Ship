use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub async fn save_media_file(file_data: Vec<u8>, file_name: String) -> Result<String, String> {
    save_to_downloads(&file_data, &file_name)
}

#[tauri::command]
pub async fn save_file_from_memory(
    file_data: Vec<u8>,
    file_name: String,
) -> Result<String, String> {
    save_to_downloads(&file_data, &file_name)
}

// Helper function to save data to downloads folder
fn save_to_downloads(file_data: &[u8], file_name: &str) -> Result<String, String> {
    let mut downloads_dir =
        dirs::download_dir().ok_or_else(|| "Could not find downloads directory".to_string())?;
    downloads_dir.push("anongram");
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("Could not create anongram directory: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let path = PathBuf::from(file_name);
    let file_ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");

    let unique_name = format!(
        "{}_{}.{}",
        path.file_stem().unwrap().to_str().unwrap(),
        timestamp,
        file_ext
    );

    let file_path = downloads_dir.join(&unique_name);

    fs::write(&file_path, file_data).map_err(|e| format!("Failed to save file: {}", e))?;

    file_path
        .to_str()
        .ok_or_else(|| "Invalid file path".to_string())
        .map(|s| s.to_string())
}
