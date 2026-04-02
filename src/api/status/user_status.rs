use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::Mutex;

use crate::api::account::Account;
use crate::api::status::connection::Backend;
use crate::api::status::connection::user_service_proto::user_status_response;
use crate::api::status::connection::user_service_proto::{OnlineStatus, TypingStatus};
use crate::api::status::types::{
    Avatar, DisplayUserInfo, DisplayUserStatus, DisplayUserTypingStatus, UpdateUserAvatarResponse,
};
use crate::api::status::user_db::{UserManager, get_default_db_path};
use crate::commands::events::{emit_user_status_event, emit_user_typing_status_event};
use tokio::sync::RwLock;
/// Клиент для работы со статусами пользователя
pub struct UserStatusClient {
    account: Arc<Account>,
    online_status: Arc<RwLock<OnlineStatus>>,
    backend: Backend,
    // Кэш статусов пользователей
    status_cache: Arc<RwLock<HashMap<i64, UserStatus>>>,
    // Подписки на статусы пользователей
    subscriptions: Arc<Mutex<Vec<i64>>>,
    user_manager: UserManager,
    app_handler: Option<tauri::AppHandle>,
}

/// Статус пользователя для кэширования
#[derive(Clone, Debug)]
pub struct UserStatus {
    pub user_id: i64,
    pub online_status: OnlineStatus,
    pub last_seen: Option<SystemTime>,
}

impl UserStatusClient {
    /// Создает нового клиента для работы со статусами пользователей
    pub async fn new(
        account: Arc<Account>,
        app_handler: Option<tauri::AppHandle>,
    ) -> Result<Self, anyhow::Error> {
        // Создаем канал для отправки статусов
        let addr = account.server_address.clone();

        let status_cache = Arc::new(RwLock::new(HashMap::new()));
        let subscriptions = Arc::new(Mutex::new(Vec::new()));
        let user_manager = UserManager::new(get_default_db_path(account.user_id)).await?;
        // Создаем клиент
        let client = Self {
            account: account.clone(),
            online_status: Arc::new(RwLock::new(OnlineStatus::Online)),
            status_cache,
            subscriptions: subscriptions.clone(),
            app_handler,
            user_manager,
            backend: Backend::new(addr, subscriptions, account).await?,
        };

        // Инициализируем стрим
        client.initialize_stream().await?;

        Ok(client)
    }

    /// Обновляет статус пользователя
    pub async fn update_online_status(&mut self, status: String) -> Result<(), anyhow::Error> {
        let status = OnlineStatus::from_str_name(&status).unwrap_or(OnlineStatus::Offline);
        self.backend.update_online_status(status).await?;
        self.backend.send_online_status(status).await?;
        let mut online_status = self.online_status.write().await;
        *online_status = status;
        Ok(())
    }

    /// Получает статус пользователя
    pub async fn get_user_status(
        &mut self,
        user_id: i64,
    ) -> Result<DisplayUserStatus, anyhow::Error> {
        let response = self.backend.get_user_activity(user_id).await?;
        let status = response.online_status();
        let last_seen = if let Some(last_seen) = response.last_seen {
            last_seen.seconds
        } else {
            -1
        };
        let user_status = DisplayUserStatus {
            status: status.as_str_name().to_string(),
            user_id: response.user_id,
            last_seen,
            is_online: response.is_online,
        };

        Ok(user_status)
    }

    /// Получает информацию о пользователе
    pub async fn get_user_info(&mut self, user_id: i64) -> Result<DisplayUserInfo, anyhow::Error> {
        let response = self.backend.get_user_info(user_id).await?;
        self.user_manager.save_contact(response.clone()).await?;
        Ok(response)
    }

    pub async fn get_contacts(&mut self) -> Result<Vec<DisplayUserInfo>, anyhow::Error> {
        self.user_manager.get_contacts().await
    }

    /// Обновляет имя пользователя
    // TODO: оно сейчас неправильно работает, нужно переделать
    pub async fn update_username(&mut self, new_username: String) -> Result<bool, anyhow::Error> {
        let response = self
            .backend
            .update_username(self.account.user_id as i64, new_username.clone())
            .await?;

        Ok(response.success)
    }

    /// Обновляет аватар пользователя
    pub async fn update_avatar(
        &mut self,
        avatar: Avatar,
    ) -> Result<UpdateUserAvatarResponse, anyhow::Error> {
        let response = self
            .backend
            .update_avatar(self.account.user_id as i64, avatar)
            .await?;

        if !response.success {
            return Err(anyhow::anyhow!("Failed to update avatar"));
        }
        let avatar_url = format!("http://{}", response.user.unwrap().avatar_url);
        let update_avatar_response = UpdateUserAvatarResponse {
            success: response.success,
            avatar_url: avatar_url.clone(),
        };
        self.account.update_avatar(avatar_url).await?;
        Ok(update_avatar_response)
    }

    /// Отправляет статус набора текста
    pub async fn send_typing_status(
        &self,
        chat_id: String,
        status: String,
        subscribers: Vec<i64>,
    ) -> Result<(), anyhow::Error> {
        let status = TypingStatus::from_str_name(&status).unwrap_or(TypingStatus::NotTyping);
        self.backend
            .send_typing_status(chat_id, status, subscribers)
            .await?;
        Ok(())
    }

    /// Подписывается на обновления статусов пользователей
    pub async fn subscribe_to_users(&self, user_ids: Vec<i64>) -> Result<(), anyhow::Error> {
        // Добавляем пользователей в список подписок
        {
            let mut subscriptions = self.subscriptions.lock().await;
            for user_id in user_ids.iter() {
                if !subscriptions.contains(user_id) {
                    subscriptions.push(*user_id);
                }
            }
        }
        let subscriptions = self.subscriptions.lock().await;

        self.backend
            .subscribe_to_users(subscriptions.clone())
            .await?;

        Ok(())
    }

    /// Отписывается от обновлений статусов пользователей
    pub async fn unsubscribe_from_users(&self, user_ids: Vec<i64>) -> Result<(), anyhow::Error> {
        // Удаляем пользователей из списка подписок
        {
            let mut subscriptions = self.subscriptions.lock().await;
            subscriptions.retain(|id| !user_ids.contains(id));
        }

        // Отправляем обновленный список подписок в стрим
        self.backend
            .send_online_status(*self.online_status.read().await)
            .await?;

        Ok(())
    }
    async fn initialize_stream(&self) -> Result<(), anyhow::Error> {
        // Инициализируем стрим — client лочится только на время handshake
        log::info!("Initializing stream");
        self.backend.init_stream().await?;

        let status_cache = self.status_cache.clone();
        let app_handler = self.app_handler.clone();
        let stream = self.backend.stream.clone();
        log::info!("Stream initialized");
        // Читаем стрим в отдельном таске — не трогаем client вообще
        tokio::spawn(async move {
            loop {
                let message = {
                    let mut stream_guard = stream.lock().await;
                    if let Some(s) = stream_guard.as_mut() {
                        s.message().await
                    } else {
                        break;
                    }
                }; // лок освобождается здесь перед обработкой

                match message {
                    Ok(Some(msg)) => match msg.message {
                        Some(user_status_response::Message::OnlineStatusResponse(status)) => {
                            if let Some(timestamp) = &status.timestamp {
                                let seconds = timestamp.seconds;
                                let last_seen = SystemTime::UNIX_EPOCH
                                    + Duration::from_secs(seconds as u64)
                                    + Duration::from_nanos(timestamp.nanos as u32 as u64);
                                let online_status = OnlineStatus::try_from(status.status)
                                    .unwrap_or(OnlineStatus::Offline);
                                let user_status = UserStatus {
                                    user_id: status.user_id,
                                    online_status,
                                    last_seen: Some(last_seen),
                                };
                                status_cache
                                    .write()
                                    .await
                                    .insert(status.user_id, user_status.clone());
                                if let Some(app) = &app_handler {
                                    let _ = emit_user_status_event(
                                        app,
                                        DisplayUserStatus {
                                            status: online_status.as_str_name().to_string(),
                                            user_id: status.user_id,
                                            last_seen: seconds,
                                            is_online: online_status != OnlineStatus::Offline,
                                        },
                                    );
                                }
                            }
                        }
                        Some(user_status_response::Message::TypingStatusResponse(status)) => {
                            let typing_status = TypingStatus::try_from(status.status)
                                .unwrap_or(TypingStatus::NotTyping);
                            if let Some(app) = &app_handler {
                                let _ = emit_user_typing_status_event(
                                    app,
                                    DisplayUserTypingStatus {
                                        user_id: status.user_id,
                                        chat_id: status.chat_id,
                                        status: typing_status.as_str_name().to_string(),
                                    },
                                );
                            }
                        }
                        Some(user_status_response::Message::InitStreamResponse(s)) => {
                            log::info!("Init stream response: {:?}", s);
                        }
                        Some(user_status_response::Message::UpdateUserSubscriptionResponse(s)) => {
                            log::info!("Subscription updated: {:?}", s);
                        }
                        None => {}
                    },
                    Ok(None) => {
                        log::info!("Stream closed");
                        break;
                    }
                    Err(e) => {
                        log::error!("Stream error: {:?}", e);
                        break;
                    }
                }
            }
        });

        // client свободен — эти вызовы не заблокируются
        self.backend
            .send_online_status(*self.online_status.read().await)
            .await?;

        // Синхронизация контактов
        let contacts = self.user_manager.get_contacts().await?;
        let ids: Vec<i64> = contacts.iter().map(|c| c.user_id).collect();
        let last_sync = self
            .user_manager
            .get_sync_metadata("last_contacts_sync")
            .await?
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        let mut backend = self.backend.clone();
        match backend.get_updated_users(ids, last_sync).await {
            Ok(updated_users) => {
                for user in updated_users {
                    if let Err(e) = self.user_manager.save_contact(user).await {
                        log::error!("Failed to save updated contact: {}", e);
                    }
                }
                let now = SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)?
                    .as_secs() as i64;
                self.user_manager
                    .set_sync_metadata("last_contacts_sync", &now.to_string())
                    .await?;
            }
            Err(e) => log::error!("Failed to sync contacts: {}", e),
        }

        Ok(())
    }

    /// Получает кэшированный статус пользователя
    pub async fn get_cached_status(&self, user_id: i64) -> Option<UserStatus> {
        self.status_cache.read().await.get(&user_id).cloned()
    }

    /// Получает все кэшированные статусы пользователей
    pub async fn get_all_cached_statuses(&self) -> HashMap<i64, UserStatus> {
        self.status_cache.read().await.clone()
    }
}
