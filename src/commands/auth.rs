use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user_id: u64,
    pub username: String,
    pub avatar_url: Option<String>,
    pub public_address: String,
    pub server_address: String,
    pub server_pub_key: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub username: String,
    pub user_id: u64,
    pub public_address: String,
    pub server_address: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceResponse {
    pub device_id: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedExportedAccount {
    pub encrypted_data: String,
    pub key: String,
}

use crate::api::account::Account;
use crate::api::account::AccountManager;
use crate::api::account::ExportedAccount;
use crate::api::account::get_default_db_path;

use crate::api::device::Device;
use crate::api::voice::VoiceUser;
use tauri::Manager;

type SafeAccount = Arc<Account>;
type SafeGroupUser = Arc<RwLock<Option<Device>>>;

use std::panic::{AssertUnwindSafe, catch_unwind};

#[tauri::command]
pub async fn login(app_handle: AppHandle, username: String) -> Result<LoginResponse, String> {
    let account = Account::load_from_db(username)
        .await
        .map_err(|e| e.to_string())?;
    let account = Arc::new(account);
    if !app_handle.manage(account.clone()) {
        log::error!("Failed to manage account")
    }

    let (group_account_result, voice_client_result, user_status_result) = tokio::join!(
        Device::load_from_db(account.clone(), Some(app_handle.clone())),
        VoiceUser::new(
            account.credential.account_id.user_id,
            Some(app_handle.clone())
        ),
        async {
            crate::api::status::user_status::UserStatusClient::new(
                account.clone(),
                Some(app_handle.clone()),
            )
            .await
        }
    );

    let group_account = group_account_result.map_err(|e| e.to_string())?;

    let state_result = catch_unwind(AssertUnwindSafe(|| {
        app_handle.state::<Arc<RwLock<Option<Device>>>>()
    }));

    match state_result {
        Ok(device_account_state) => {
            let mut guard = device_account_state.inner().write().await;
            *guard = Some(group_account);
        }
        Err(_) => {
            log::warn!("State not managed yet, managing now...");
            let safe_group_user = Arc::new(RwLock::new(Some(group_account)));
            app_handle.manage(safe_group_user.clone());
        }
    }

    let user_status = user_status_result.ok();
    let safe_user_status = Arc::new(RwLock::new(user_status));
    if !app_handle.manage(safe_user_status) {
        log::error!("Failed to manage user status")
    };

    let voice_client = voice_client_result.map_err(|e| e.to_string())?;
    let safe_voice_client = Arc::new(RwLock::new(voice_client));
    if !app_handle.manage(safe_voice_client) {
        log::error!("Failed to manage voice client")
    };

    Ok(LoginResponse {
        user_id: account.credential.account_id.user_id,
        username: account.username.clone(),
        avatar_url: account.avatar_url.clone(),
        public_address: account.public_address.clone(),
        server_address: account.server_address.clone(),
        server_pub_key: account.server_public_key.clone(),
    })
}

#[tauri::command]
pub async fn register(
    username: String,
    avatar_url: Option<String>,
    server_address: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let account = Account::register(username, avatar_url, server_address)
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
) -> Result<EncryptedExportedAccount, String> {
    let account_bytes = account_state.to_mls_bytes().map_err(|e| e.to_string())?;
    let exported = ExportedAccount::new(account_bytes);

    let (encrypted_data, key) = exported.encrypt().map_err(|e| e.to_string())?;

    Ok(EncryptedExportedAccount {
        encrypted_data,
        key,
    })
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
    app_handle.unmanage::<Arc<Account>>(); // Changing account to Account Option 
    // will cause too many problems
    // maybe after i will change it
    Ok("Logged out successfully".to_string())
}

#[tauri::command]
pub async fn get_account_list() -> Result<Vec<AccountInfo>, String> {
    let account_list = Account::list_accounts().await.map_err(|e| e.to_string())?;
    let account_list: Vec<AccountInfo> = account_list
        .into_iter()
        .map(|account| AccountInfo {
            username: account.username,
            user_id: account.user_id,
            public_address: account.public_address,
            server_address: account.server_address,
            avatar_url: account.avatar_url,
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

#[tauri::command]
pub async fn get_user_devices(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<Vec<DeviceResponse>, String> {
    let mut group_user = group_user_state.write().await;
    let group_user = group_user.as_mut().unwrap();
    let devices = group_user
        .get_account_devices()
        .await
        .map_err(|e| e.to_string())?;
    Ok(devices
        .into_iter()
        .map(|device| DeviceResponse {
            device_id: device.device_id,
            created_at: device.created_at,
        })
        .collect())
}
