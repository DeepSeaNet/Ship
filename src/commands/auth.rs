use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

use crate::api::account::Account;
use crate::api::account::AccountManager;
use crate::api::account::ExportedAccount;
use crate::api::account::get_default_db_path;

use crate::api::device::Device;
use crate::api::voice::VoiceUser;
use tauri::Manager;

type SafeAccount = Arc<Account>;
type SafeGroupUser = Arc<RwLock<Option<Device>>>;
#[tauri::command]
pub async fn grpc_login(
    app_handle: AppHandle,
    username: String,
) -> Result<serde_json::Value, String> {
    let account = Account::load_from_db(username)
        .await
        .map_err(|e| e.to_string())?;
    let account = Arc::new(account);
    app_handle.manage(account.clone());

    let app_handle_clone = app_handle.clone();

    let (group_account_result, voice_client_result, user_status_result) = tokio::join!(
        Device::load_from_db(account.clone(), Some(app_handle.clone())),
        VoiceUser::new(account.credential.account_id.user_id as i64),
        async {
            crate::api::status::user_status::UserStatusClient::new(
                account.user_id as i64,
                account.clone(),
                Some(app_handle_clone),
            )
            .await
        }
    );

    let group_account = group_account_result.map_err(|e| e.to_string())?;
    let safe_group_user = Arc::new(RwLock::new(Some(group_account)));
    app_handle.manage(safe_group_user);

    let user_status = user_status_result.ok();
    let safe_user_status = Arc::new(RwLock::new(user_status));
    app_handle.manage(safe_user_status);

    let voice_client = voice_client_result;
    let safe_voice_client = Arc::new(RwLock::new(voice_client));
    app_handle.manage(safe_voice_client);

    Ok(serde_json::json!({
        "user_id": account.credential.account_id.user_id,
        "username": account.username,
        "public_address": account.public_address,
        "server_address": account.server_address,
        "server_pub_key": account.server_public_key,
    }))
}

#[tauri::command]
pub async fn grpc_register(
    username: String,
    avatar_url: Option<String>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let account = Account::register(username, avatar_url)
        .await
        .map_err(|e| e.to_string())?;

    let device_id = uuid::Uuid::new_v4().to_string();

    let account = Arc::new(account);
    app_handle.manage(account.clone());

    let _ = Device::register_new_device(account.clone(), &device_id, Some(app_handle.clone()))
        .await
        .map_err(|e| e.to_string())?;

    Ok("Registration successful".to_string())
}

#[tauri::command]
pub async fn reconnect(user_account: tauri::State<'_, SafeGroupUser>) -> Result<(), String> {
    let mut user_account = user_account.write().await;
    if let Some(user_account) = user_account.as_mut() {
        user_account
            .init_backend()
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn export_account(
    account_state: tauri::State<'_, SafeAccount>,
) -> Result<(String, String), String> {
    let account_bytes = account_state.to_mls_bytes().map_err(|e| e.to_string())?;
    let exported = ExportedAccount::new(account_bytes);

    let encrypted_data = exported.encrypt().map_err(|e| e.to_string())?;

    Ok(encrypted_data)
}

#[tauri::command]
pub async fn import_account(
    app_handle: AppHandle,
    exported_account: String,
    key: String,
) -> Result<u64, String> {
    let exported = ExportedAccount::decrypt(&exported_account, &key)?;

    let account = Account::from_mls_bytes(&mut &*exported.account).map_err(|e| e.to_string())?;

    account.save_to_db().await.map_err(|e| e.to_string())?;
    let account = Arc::new(account);
    let device_id = uuid::Uuid::new_v4().to_string();

    let _ = Device::register_new_device(account.clone(), &device_id, Some(app_handle))
        .await
        .map_err(|e| e.to_string())?;

    Ok(account.user_id)
}

#[tauri::command]
pub async fn log_out(app_handle: AppHandle) -> Result<String, String> {
    app_handle
        .state::<Arc<RwLock<Option<Device>>>>()
        .inner()
        .write()
        .await
        .take();
    Ok("Logged out successfully".to_string())
}

#[tauri::command]
pub async fn get_account_list() -> Result<Vec<serde_json::Value>, String> {
    let account_list = Account::list_accounts().await.map_err(|e| e.to_string())?;
    let account_list: Vec<serde_json::Value> = account_list
        .into_iter()
        .map(|account| {
            serde_json::json!({
                "username": account.username,
                "user_id": account.user_id,
                "public_address": account.public_address,
                "server_address": account.server_address,
                "avatar_url": account.avatar_url,
            })
        })
        .collect();
    Ok(account_list)
}

#[tauri::command]
pub async fn delete_account(username: String) -> Result<String, String> {
    let db = AccountManager::new(get_default_db_path()).await.unwrap();
    db.delete_account(&username)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Account deleted".to_string())
}
