use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::Mutex;

use crate::api::account::Account;
use crate::api::connection::get_status_servers;
use crate::api::status::connection::Backend;
use crate::api::status::connection::user_service_proto::user_status_response;
use crate::api::status::connection::user_service_proto::{
    OnlineStatus, TypingStatus, UserStatusRequest,
};
use crate::api::status::types::{
    Avatar, DisplayUserInfo, DisplayUserStatus, DisplayUserTypingStatus, UpdateUserAvatarResponse,
};
use crate::api::status::user_db::{UserManager, get_default_db_path};
use tauri::Emitter;
use tokio::sync::RwLock;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
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
        let addr = get_status_servers();
        let (status_tx, status_rx) = mpsc::channel(100);

        let status_cache = Arc::new(RwLock::new(HashMap::new()));
        let subscriptions = Arc::new(Mutex::new(Vec::new()));
        let user_id = account.user_id as i64;
        let user_manager = UserManager::new(get_default_db_path(user_id as u64)).await?;
        // Создаем клиент
        let client = Self {
            account: account.clone(),
            online_status: Arc::new(RwLock::new(OnlineStatus::Online)),
            status_cache,
            subscriptions: subscriptions.clone(),
            app_handler,
            user_manager,
            backend: Backend::new(addr, subscriptions, user_id, status_tx.clone(), account).await?,
        };

        // Инициализируем стрим
        client.initialize_stream(status_rx).await?;

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

    /// Инициализирует стрим для обмена статусами
    async fn initialize_stream(
        &self,
        status_rx: mpsc::Receiver<UserStatusRequest>,
    ) -> Result<(), anyhow::Error> {
        // Клонируем клиента для использования в потоке
        let mut backend = self.backend.clone();
        let status_cache = self.status_cache.clone();
        let app_handler = self.app_handler.clone();

        // Создаем поток из канала
        let request_stream = ReceiverStream::new(status_rx);

        // Запускаем двунаправленный стрим
        tokio::spawn(async move {
            match backend.client.stream_user_status(request_stream).await {
                Ok(response) => {
                    let mut stream = response.into_inner();

                    // Обрабатываем входящие сообщения
                    while let Ok(Some(message)) = stream.message().await {
                        match message.message {
                            Some(user_status_response::Message::OnlineStatusResponse(status)) => {
                                // Кэшируем статус пользователя
                                if let Some(timestamp) = &status.timestamp {
                                    let seconds = timestamp.seconds;
                                    let nanos = timestamp.nanos as u32;

                                    let last_seen = SystemTime::UNIX_EPOCH
                                        + Duration::from_secs(seconds as u64)
                                        + Duration::from_nanos(nanos as u64);
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
                                    if let Some(app_handler) = &app_handler {
                                        let display_user_status = DisplayUserStatus {
                                            status: user_status
                                                .online_status
                                                .as_str_name()
                                                .to_string(),
                                            user_id: user_status.user_id,
                                            last_seen: seconds,
                                            is_online: online_status != OnlineStatus::Offline,
                                        };
                                        let event_payload = json!({
                                            "type": "user_status_changed",
                                            "data": display_user_status,
                                        });
                                        app_handler.emit("server-event", event_payload).unwrap();
                                    }
                                }
                            }
                            Some(user_status_response::Message::TypingStatusResponse(status)) => {
                                let typing_status = TypingStatus::try_from(status.status)
                                    .unwrap_or(TypingStatus::NotTyping);
                                if let Some(app_handler) = &app_handler {
                                    let display_user_typing_status = DisplayUserTypingStatus {
                                        user_id: status.user_id,
                                        chat_id: status.chat_id,
                                        status: typing_status.as_str_name().to_string(),
                                    };
                                    let event_payload = json!({
                                        "type": "user_typing_status_changed",
                                        "data": display_user_typing_status,
                                    });
                                    app_handler.emit("server-event", event_payload).unwrap();
                                }
                            }
                            Some(
                                user_status_response::Message::UpdateUserSubscriptionResponse(
                                    status,
                                ),
                            ) => {
                                log::info!("Update user subscription response: {:?}", status);
                            }
                            Some(user_status_response::Message::InitStreamResponse(status)) => {
                                log::info!("Init stream response: {:?}", status);
                            }
                            None => {}
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Stream error: {:?}", e);
                }
            }
        });

        self.backend.send_init_stream().await?;
        self.backend
            .send_online_status(*self.online_status.read().await)
            .await?;

        // Синхронизация контактов
        let mut backend = self.backend.clone();
        let contacts = self.user_manager.get_contacts().await?;
        let ids: Vec<i64> = contacts.iter().map(|c| c.user_id).collect();
        let last_sync = self
            .user_manager
            .get_sync_metadata("last_contacts_sync")
            .await?
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        log::info!(
            "Starting contacts sync for {} users since {}",
            ids.len(),
            last_sync
        );

        match backend.get_updated_users(ids, last_sync).await {
            Ok(updated_users) => {
                log::info!("Received {} updated users", updated_users.len());
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
            Err(e) => {
                log::error!("Failed to sync contacts: {}", e);
            }
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
