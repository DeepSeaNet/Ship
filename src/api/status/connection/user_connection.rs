use std::str::FromStr;
// use mls_rs::time;
use std::sync::Arc;
use std::time::SystemTime;
use tauri::http::Uri;
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::Streaming;
use tonic::{Request, Status};
use tonic_h3::H3Channel;
use tonic_h3::quinn::H3QuinnConnector;
#[allow(clippy::all, clippy::pedantic, clippy::restriction, clippy::nursery)]
pub mod user_service_proto {
    tonic::include_proto!("status_service");
}

use crate::api::account::Account;
use crate::api::connection::endpoint::create_client_endpoint;
use crate::api::status::connection::user_connection::user_service_proto::{
    GetUpdatedUsersRequest, GetUserActivityRequest, GetUserActivityResponse, GetUserInfoRequest,
    InitStreamRequest, MarkMessageReadRequest, MarkMessageReadResponse, OnlineStatus,
    OnlineStatusRequest, TypingStatus, TypingStatusRequest, UpdateActivityRequest,
    UpdateAvatarRequest, UpdateAvatarResponse, UpdateUserSubscriptionRequest,
    UpdateUsernameRequest, UpdateUsernameResponse, UserStatusRequest,
    user_service_client::UserServiceClient,
};
use crate::api::status::connection::user_service_proto::UserStatusResponse;
use crate::api::status::types::Avatar;
use crate::api::status::types::DisplayUserInfo;
use user_service_proto::user_status_request;

#[derive(Clone)]
pub struct Backend {
    pub client: Arc<Mutex<UserServiceClient<H3Channel<H3QuinnConnector>>>>,
    pub stream_tx: Arc<Mutex<Option<mpsc::Sender<UserStatusRequest>>>>,
    pub stream: Arc<Mutex<Option<Streaming<UserStatusResponse>>>>,
    subscriptions: Arc<Mutex<Vec<i64>>>,
    account: Arc<Account>,
}

impl Backend {
    pub fn new(
        address: String,
        subscriptions: Arc<Mutex<Vec<i64>>>,
        account: Arc<Account>,
    ) -> Result<Self, anyhow::Error> {
        let uri = Uri::from_str(&address)?;
        let endpoint = create_client_endpoint()
            .map_err(|e| anyhow::anyhow!("Failed to create endpoint: {}", e))?;
        let connector = H3QuinnConnector::new(uri.clone(), "sea_status".to_string(), endpoint);
        let channel = H3Channel::new(connector, uri);
        let client = UserServiceClient::new(channel);

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
            stream_tx: Arc::new(Mutex::new(None)),
            stream: Arc::new(Mutex::new(None)),
            subscriptions,
            account,
        })
    }

    pub async fn init_stream(&self) -> Result<(), anyhow::Error> {
        let (tx, rx) = mpsc::channel::<UserStatusRequest>(100);

        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs();
        let subscriptions = self.subscriptions.lock().await.clone();

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update((self.account.user_id).to_be_bytes());
        hasher.update(timestamp.to_be_bytes());
        for &sub_id in &subscriptions {
            hasher.update((sub_id as u64).to_be_bytes());
        }
        let hash = hasher.finalize();
        let signature = self
            .account
            .sign_message(&hash)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to sign: {}", e))?;

        let request = UserStatusRequest {
            message: Some(user_status_request::Message::InitStreamRequest(
                InitStreamRequest {
                    user_id: self.account.user_id as i64,
                    timestamp: timestamp as i64,
                    subscribe_to_users: subscriptions,
                    signature,
                },
            )),
        };

        if let Err(e) = tx.send(request).await {
            log::error!("Failed to send init message: {:?}", e);
            return Err(anyhow::anyhow!("Failed to initialize stream"));
        }

        {
            let mut tx_guard = self.stream_tx.lock().await;
            *tx_guard = Some(tx.clone());
        }

        let stream_req = Request::new(ReceiverStream::new(rx));

        let stream = self
            .client
            .lock()
            .await
            .stream_user_status(stream_req)
            .await?
            .into_inner();

        {
            let mut stream_guard = self.stream.lock().await;
            *stream_guard = Some(stream);
        }
        Ok(())
    }

    pub async fn update_online_status(&self, status: OnlineStatus) -> Result<(), anyhow::Error> {
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };

        let request = UpdateActivityRequest {
            user_id: self.account.user_id as i64,
            status: status as i32,
            last_seen: Some(timestamp),
        };

        let response = self.client.lock().await.update_activity(request).await?;
        if !response.into_inner().success {
            return Err(anyhow::anyhow!("Failed to update online status"));
        }
        Ok(())
    }
    pub async fn get_user_activity(&self, user_id: i64) -> Result<GetUserActivityResponse, Status> {
        let request = GetUserActivityRequest { user_id };

        let response = self
            .client
            .lock()
            .await
            .get_user_activity(Request::new(request))
            .await?;
        Ok(response.into_inner())
    }

    pub async fn get_user_info(&self, user_id: i64) -> Result<DisplayUserInfo, anyhow::Error> {
        let request = GetUserInfoRequest { user_id };

        let response = self
            .client
            .lock()
            .await
            .get_user_info(Request::new(request))
            .await?;
        let user_info = response.into_inner();
        if let Some(user) = user_info.user {
            let last_seen = if let Some(last_seen) = user.last_seen {
                last_seen.seconds
            } else {
                -1
            };
            let created_at = if let Some(created_at) = user.created_at {
                created_at.seconds
            } else {
                -1
            };
            let online_status = user.online_status();
            Ok(DisplayUserInfo {
                user_id: user.user_id,
                username: user.username,
                avatar: format!("http://{}", user.avatar_url),
                status: online_status.as_str_name().to_string(),
                last_seen,
                created_at,
                trust_level: 0,
            })
        } else {
            Err(anyhow::anyhow!("User not found"))
        }
    }

    pub async fn update_username(
        &self,
        user_id: i64,
        new_username: String,
    ) -> Result<UpdateUsernameResponse, Status> {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update((user_id as u64).to_be_bytes());
        hasher.update((timestamp as u64).to_be_bytes());
        hasher.update(new_username.as_bytes());
        let hash = hasher.finalize();

        let signature = self
            .account
            .sign_message(&hash)
            .await
            .map_err(|e| Status::internal(format!("Failed to sign username update: {}", e)))?;

        let request = UpdateUsernameRequest {
            user_id,
            new_username,
            timestamp,
            signature,
        };

        let response = self.client.lock().await.update_username(request).await?;
        Ok(response.into_inner())
    }

    pub async fn update_avatar(
        &self,
        user_id: i64,
        avatar: Avatar,
    ) -> Result<UpdateAvatarResponse, Status> {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update((user_id as u64).to_be_bytes());
        hasher.update((timestamp as u64).to_be_bytes());
        hasher.update(avatar.avatar_hash.as_bytes());
        hasher.update((avatar.file_size as u32).to_be_bytes());
        hasher.update(avatar.mime_type.as_bytes());
        hasher.update((avatar.width as u32).to_be_bytes());
        hasher.update((avatar.height as u32).to_be_bytes());
        let hash = hasher.finalize();

        let signature = self
            .account
            .sign_message(&hash)
            .await
            .map_err(|e| Status::internal(format!("Failed to sign avatar update: {}", e)))?;

        let request = UpdateAvatarRequest {
            user_id,
            image_data: avatar.avatar_data,
            avatar_hash: avatar.avatar_hash,
            file_size: avatar.file_size,
            mime_type: avatar.mime_type,
            width: avatar.width,
            height: avatar.height,
            timestamp,
            signature,
        };

        let response = self.client.lock().await.update_avatar(request).await?;
        Ok(response.into_inner())
    }

    pub async fn mark_message_read(
        &self,
        message_id: i64,
        chat_id: i64,
    ) -> Result<MarkMessageReadResponse, Status> {
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };
        let request = MarkMessageReadRequest {
            user_id: self.account.user_id as i64,
            message_id,
            chat_id,
            read_at: Some(timestamp),
        };

        let response = self.client.lock().await.mark_message_read(request).await?;
        Ok(response.into_inner())
    }

    pub async fn send_typing_status(
        &self,
        chat_id: String,
        status: TypingStatus,
        subscribers: Vec<i64>,
    ) -> Result<(), Status> {
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };

        let request = TypingStatusRequest {
            user_id: self.account.user_id as i64,
            chat_id,
            status: status as i32,
            timestamp: Some(timestamp),
            subscribers,
        };

        let status_request = UserStatusRequest {
            message: Some(user_status_request::Message::TypingStatusRequest(request)),
        };

        self.send_to_stream(status_request).await
    }

    pub async fn send_online_status(&self, status: OnlineStatus) -> Result<(), Status> {
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };

        // Создаем запрос статуса для стрима
        let online_request = OnlineStatusRequest {
            user_id: self.account.user_id as i64,
            status: status as i32,
            timestamp: Some(timestamp),
        };

        // Создаем общее сообщение для стрима
        let status_request = UserStatusRequest {
            message: Some(user_status_request::Message::OnlineStatusRequest(
                online_request,
            )),
        };

        // Отправляем в канал стрима
        self.send_to_stream(status_request).await
    }

    pub async fn subscribe_to_users(&self, user_ids: Vec<i64>) -> Result<(), Status> {
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };

        let request = UpdateUserSubscriptionRequest {
            user_id: self.account.user_id as i64,
            subscribe_to_users: user_ids,
            timestamp: timestamp.seconds,
        };

        let status_request = UserStatusRequest {
            message: Some(user_status_request::Message::UpdateUserSubscriptionRequest(
                request,
            )),
        };

        self.send_to_stream(status_request).await
    }

    pub async fn get_updated_users(
        &self,
        ids: Vec<i64>,
        timestamp: i64,
    ) -> Result<Vec<DisplayUserInfo>, anyhow::Error> {
        let request = GetUpdatedUsersRequest { ids, timestamp };

        let response = self
            .client
            .lock()
            .await
            .get_updated_users(Request::new(request))
            .await?;
        let users = response.into_inner().users;

        let res = users
            .into_iter()
            .map(|user| {
                let last_seen = user.last_seen.map(|t| t.seconds).unwrap_or(-1);
                let created_at = user.created_at.map(|t| t.seconds).unwrap_or(-1);
                let online_status =
                    OnlineStatus::try_from(user.online_status).unwrap_or(OnlineStatus::Offline);
                DisplayUserInfo {
                    user_id: user.user_id,
                    username: user.username,
                    avatar: format!("http://{}", user.avatar_url),
                    status: online_status.as_str_name().to_string(),
                    last_seen,
                    created_at,
                    trust_level: 0,
                }
            })
            .collect();

        Ok(res)
    }

    pub async fn send_to_stream(&self, request: UserStatusRequest) -> Result<(), Status> {
        let tx = self.stream_tx.lock().await;
        if let Some(tx) = tx.as_ref() {
            tx.send(request)
                .await
                .map_err(|_| Status::internal("Stream channel closed"))?;
        }
        Ok(())
    }
}
