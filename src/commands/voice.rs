use crate::api::connection::get_avaliable_voice_servers;
use crate::api::voice::VoiceUser;
use crate::api::voice::types::codec_types::{CodecType, get_vp8_encryption_offset};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

type SafeVoiceUser = Arc<RwLock<VoiceUser>>;

// Шифрование байтов с учетом типа кодека
#[tauri::command]
pub async fn encrypt_voice(
    bytes: Vec<u8>,
    codec_type: Option<i32>,
    state: State<'_, SafeVoiceUser>,
) -> Result<Vec<u8>, String> {
    // Если тип кодека VP8, применяем особую обработку
    if let Some(codec_type) = codec_type {
        let codec = CodecType::from(codec_type);
        if codec == CodecType::VP8 && !bytes.is_empty() {
            // Определяем, сколько байт оставить незашифрованными
            let offset = get_vp8_encryption_offset(&bytes);

            if offset > 0 && offset < bytes.len() {
                // Разделяем на заголовок и данные
                let header = &bytes[0..offset];
                let payload = &bytes[offset..];

                // Шифруем только часть данных
                let voice_user = state.read().await;
                let encrypted_payload = voice_user
                    .encrypt_voice(payload.to_vec())
                    .await
                    .map_err(|e| e.to_string())?;

                // Объединяем незашифрованный заголовок и зашифрованные данные
                let mut result = Vec::with_capacity(header.len() + encrypted_payload.len());
                result.extend_from_slice(header);
                result.extend_from_slice(&encrypted_payload);

                return Ok(result);
            }
        }
    }

    // Для всех остальных случаев - обычное шифрование всего содержимого
    let voice_user = state.read().await;
    voice_user
        .encrypt_voice(bytes)
        .await
        .map_err(|e| e.to_string())
}

// Дешифрование байтов с учетом типа кодека
#[tauri::command]
pub async fn decrypt_voice(
    bytes: Vec<u8>,
    codec_type: Option<i32>,
    state: State<'_, SafeVoiceUser>,
) -> Result<Vec<u8>, String> {
    // Если тип кодека VP8, применяем особую обработку
    if let Some(codec_type) = codec_type {
        let codec = CodecType::from(codec_type);
        if codec == CodecType::VP8 && !bytes.is_empty() {
            // Определяем, сколько байт оставить незашифрованными
            let offset = get_vp8_encryption_offset(&bytes);

            if offset > 0 && offset < bytes.len() {
                // Разделяем на заголовок и данные
                let header = &bytes[0..offset];
                let payload = &bytes[offset..];

                // Дешифруем только зашифрованную часть данных
                let voice_user = state.read().await;
                let decrypted_payload = voice_user
                    .decrypt_voice(payload.to_vec())
                    .await
                    .map_err(|e| e.to_string())?;

                // Объединяем незашифрованный заголовок и дешифрованные данные
                let mut result = Vec::with_capacity(header.len() + decrypted_payload.len());
                result.extend_from_slice(header);
                result.extend_from_slice(&decrypted_payload);

                return Ok(result);
            }
        }
    }

    // Для всех остальных случаев - обычное дешифрование всего содержимого
    let voice_user = state.read().await;
    voice_user
        .decrypt_voice(bytes)
        .await
        .map_err(|e| e.to_string())
}

// Команда для инициализации соединения
#[tauri::command]
pub async fn initialize_connection(state: State<'_, SafeVoiceUser>) -> Result<(), String> {
    log::info!("Initializing connection...");
    let voice_user = state.read().await;

    match voice_user.initialize().await {
        Ok(_) => {
            log::info!("Connection initialized successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to initialize connection: {}", e);
            Err(format!("Failed to initialize connection: {}", e))
        }
    }
}

// Команда для присоединения к сессии
#[tauri::command]
pub async fn join_session(
    session_id: String,
    state: State<'_, SafeVoiceUser>,
) -> Result<(), String> {
    log::info!("join_session: session_id={}", session_id);

    let voice_user = state.read().await;
    voice_user.initialize().await.map_err(|e| e.to_string())?;
    match voice_user.join(session_id).await {
        Ok(_) => {
            log::info!("Successfully joined session");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to join session: {}", e);
            Err(format!("Join session failed: {}", e))
        }
    }
}

// Команда для отсоединения от сессии
#[tauri::command]
pub async fn leave_session(state: State<'_, SafeVoiceUser>) -> Result<(), String> {
    let voice_user = state.read().await;
    match voice_user.leave_voice_channel().await {
        Ok(_) => {
            log::info!("Successfully left voice channel");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to leave voice channel: {}", e);
            Err(format!("Failed to leave voice channel: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_voice_servers() -> Result<Vec<String>, String> {
    let servers = get_avaliable_voice_servers();
    Ok(vec![servers])
}
