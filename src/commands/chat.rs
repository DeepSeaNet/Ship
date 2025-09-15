#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn send_message() -> Result<String, String> {
    Ok("".to_string())
}

#[tauri::command]
pub async fn create_chat() -> Result<String, String> {
    Ok("Template chat id".to_string())
}

#[tauri::command]
pub async fn get_chats() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn get_messages() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!(""))
}
