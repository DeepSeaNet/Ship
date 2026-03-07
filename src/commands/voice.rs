use crate::api::connection::get_avaliable_voice_servers;
use crate::api::voice::VoiceUser;
use crate::api::voice::grpc_generated::echolocator::ClientMessage;
use crate::api::voice::types::ratchet_key::VoiceKeysPayload;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

type SafeVoiceUser = Arc<RwLock<VoiceUser>>;

/// Export key material for TypeScript SubtleCrypto
#[tauri::command]
pub async fn get_voice_keys(state: State<'_, SafeVoiceUser>) -> Result<VoiceKeysPayload, String> {
    let voice_user = state.read().await;
    voice_user.get_voice_keys().await.map_err(|e| e.to_string())
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
    if voice_user.is_joined().await {
        log::error!("Already joined session");
        return Err("Already joined session".to_string());
    }
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

// Команда для инициализации WebRTC signaling stream
#[tauri::command]
pub async fn init_webrtc_signaling(
    session_id: String,
    rtp_capabilities: Option<String>,
    state: State<'_, SafeVoiceUser>,
) -> Result<(), String> {
    let voice_user = state.read().await;
    voice_user
        .init_signaling_stream(session_id, rtp_capabilities)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Команда для отправки WebRTC сообщения
#[tauri::command]
pub async fn send_webrtc_message(
    message_json: String,
    state: State<'_, SafeVoiceUser>,
) -> Result<(), String> {
    // Parse JSON to ClientMessage
    let client_message: ClientMessage = serde_json::from_str(&message_json)
        .map_err(|e| format!("Failed to parse message JSON: {}", e))?;

    let voice_user = state.read().await;
    voice_user
        .send_signaling_message(client_message)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
