use crate::api::{
    account::Account,
    status::{Avatar, UserManager, get_default_db_path, user_status::UserStatusClient},
};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;

type SafeUserStatus = Arc<RwLock<Option<UserStatusClient>>>;
type SafeAccount = Arc<Account>;

#[tauri::command]
pub async fn get_user_status(
    user_status: tauri::State<'_, SafeUserStatus>,
    user_id: i64,
) -> Result<serde_json::Value, String> {
    log::debug!("Get user status called");

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        let status = user_status
            .get_user_status(user_id)
            .await
            .map_err(|e| e.to_string())?;

        Ok(json!(status))
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_user_info(
    user_status: tauri::State<'_, SafeUserStatus>,
    user_id: i64,
) -> Result<serde_json::Value, String> {
    log::debug!("Get user info called");

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        let user_info = user_status
            .get_user_info(user_id)
            .await
            .map_err(|e| e.to_string())?;

        Ok(json!(user_info))
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn update_username(
    user_status: tauri::State<'_, SafeUserStatus>,
    new_username: String,
) -> Result<bool, String> {
    log::debug!("Update username called");

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        let response = user_status
            .update_username(new_username)
            .await
            .map_err(|e| e.to_string())?;

        Ok(response)
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn update_avatar(
    user_status: tauri::State<'_, SafeUserStatus>,
    avatar: String,
    avatar_hash: String,
    file_size: i32,
    mime_type: String,
    width: i32,
    height: i32,
) -> Result<bool, String> {
    log::debug!("Update avatar called");

    let avatar = Avatar {
        avatar_url: avatar,
        avatar_hash,
        file_size,
        mime_type,
        width,
        height,
    };

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        let response = user_status
            .update_avatar(avatar)
            .await
            .map_err(|e| e.to_string())?;

        Ok(response.success)
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn set_user_status(
    user_status: tauri::State<'_, SafeUserStatus>,
    status: String,
) -> Result<(), String> {
    log::debug!("Set user status called");

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        user_status
            .update_online_status(status)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn send_typing_status(
    user_status: tauri::State<'_, SafeUserStatus>,
    chat_id: String,
    status: String,
    subscribers: Vec<i64>,
) -> Result<(), String> {
    log::debug!("Subscribe to users called");

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        user_status
            .send_typing_status(chat_id, status, subscribers)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn subscribe_to_users(
    user_status: tauri::State<'_, SafeUserStatus>,
    user_ids: Vec<i64>,
) -> Result<(), String> {
    log::debug!("Subscribe to users called");

    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        user_status
            .subscribe_to_users(user_ids)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn unsubscribe_from_users(
    user_status: tauri::State<'_, SafeUserStatus>,
    user_ids: Vec<i64>,
) -> Result<(), String> {
    let mut user_status = user_status.write().await;

    if let Some(user_status) = user_status.as_mut() {
        user_status
            .unsubscribe_from_users(user_ids)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("User status not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_contacts(
    user_status: tauri::State<'_, SafeUserStatus>,
    account: tauri::State<'_, SafeAccount>,
) -> Result<Vec<serde_json::Value>, String> {
    log::debug!("Get contacts called");
    let mut user_status = user_status.write().await;
    if let Some(user_status) = user_status.as_mut() {
        let contacts = user_status
            .get_contacts()
            .await
            .map_err(|e| e.to_string())?;
        let contacts_json: Vec<serde_json::Value> =
            contacts.into_iter().map(|contact| json!(contact)).collect();

        Ok(contacts_json)
    } else {
        let user_manager = UserManager::new(get_default_db_path(account.user_id))
            .await
            .map_err(|e| e.to_string())?;
        let contacts = user_manager
            .get_contacts()
            .await
            .map_err(|e| e.to_string())?;
        let contacts_json: Vec<serde_json::Value> =
            contacts.into_iter().map(|contact| json!(contact)).collect();

        Ok(contacts_json)
    }
}
