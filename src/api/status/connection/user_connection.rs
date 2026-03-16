use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tonic::transport::Channel;
use tonic::{Request, Status};
#[allow(clippy::all, clippy::pedantic, clippy::restriction, clippy::nursery)]
pub mod user_service_proto {
    tonic::include_proto!("status_service");
}

use crate::api::account::Account;
use crate::api::status::connection::user_connection::user_service_proto::{
    GetUserActivityRequest, GetUserActivityResponse, GetUserInfoRequest, InitStreamRequest,
    MarkMessageReadRequest, MarkMessageReadResponse, OnlineStatus, OnlineStatusRequest,
    TypingStatus, TypingStatusRequest, UpdateActivityRequest, UpdateAvatarRequest,
    UpdateAvatarResponse, UpdateUserSubscriptionRequest,
    UpdateUsernameRequest, UpdateUsernameResponse, UserStatusRequest,
    user_service_client::UserServiceClient,
};
use crate::api::status::types::Avatar;
use crate::api::status::types::DisplayUserInfo;
use user_service_proto::user_status_request;

#[derive(Clone)]
pub struct Backend {
    pub client: UserServiceClient<Channel>,
    pub status_tx: mpsc::Sender<UserStatusRequest>,
    subscriptions: Arc<Mutex<Vec<i64>>>,
    user_id: i64,
    account: Arc<Account>,
}

impl Backend {
    pub async fn new(
        server_address: String,
        subscriptions: Arc<Mutex<Vec<i64>>>,
        user_id: i64,
        status_tx: mpsc::Sender<UserStatusRequest>,
        account: Arc<Account>,
    ) -> Result<Self, anyhow::Error> {
        let channel = Channel::from_shared(server_address)?.connect().await?;

        Ok(Self {
            client: UserServiceClient::new(channel),
            status_tx,
            subscriptions,
            user_id,
            account,
        })
    }

    pub async fn update_online_status(
        &mut self,
        status: OnlineStatus,
    ) -> Result<(), anyhow::Error> {
        // Создаем запрос на обновление статуса
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };

        let request = UpdateActivityRequest {
            user_id: self.user_id,
            status: status as i32,
            last_seen: Some(timestamp),
        };

        let response = self.client.update_activity(request).await?;
        if !response.into_inner().success {
            return Err(anyhow::anyhow!("Failed to update online status"));
        }
        Ok(())
    }
    pub async fn get_user_activity(
        &mut self,
        user_id: i64,
    ) -> Result<GetUserActivityResponse, Status> {
        let request = GetUserActivityRequest { user_id };

        let response = self.client.get_user_activity(Request::new(request)).await?;
        Ok(response.into_inner())
    }

    pub async fn get_user_info(&mut self, user_id: i64) -> Result<DisplayUserInfo, anyhow::Error> {
        let request = GetUserInfoRequest { user_id };

        let response = self.client.get_user_info(Request::new(request)).await?;
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
                avatar: user.avatar_url,
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
        &mut self,
        user_id: i64,
        new_username: String,
    ) -> Result<UpdateUsernameResponse, Status> {
        let request = UpdateUsernameRequest {
            user_id,
            new_username,
        };

        let response = self.client.update_username(request).await?;
        Ok(response.into_inner())
    }

    pub async fn update_avatar(
        &mut self,
        user_id: i64,
        avatar: Avatar,
    ) -> Result<UpdateAvatarResponse, Status> {
        let request = UpdateAvatarRequest {
            user_id,
            avatar_url: avatar.avatar_url,
            avatar_hash: avatar.avatar_hash,
            file_size: avatar.file_size,
            mime_type: avatar.mime_type,
            width: avatar.width,
            height: avatar.height,
        };

        let response = self.client.update_avatar(request).await?;
        Ok(response.into_inner())
    }

    pub async fn mark_message_read(
        &mut self,
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
            user_id: self.user_id,
            message_id,
            chat_id,
            read_at: Some(timestamp),
        };

        let response = self.client.mark_message_read(request).await?;
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
            user_id: self.user_id,
            chat_id,
            status: status as i32,
            timestamp: Some(timestamp),
            subscribers,
        };

        let status_request = UserStatusRequest {
            message: Some(user_status_request::Message::TypingStatusRequest(request)),
        };

        self.status_tx
            .send(status_request)
            .await
            .map_err(|_| Status::internal("Failed to send typing status"))?;
        Ok(())
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
            user_id: self.user_id,
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
        self.status_tx
            .send(status_request)
            .await
            .map_err(|_| Status::internal("Failed to send online status"))?;

        Ok(())
    }

    pub async fn subscribe_to_users(&self, user_ids: Vec<i64>) -> Result<(), Status> {
        let timestamp = SystemTime::now();
        let seconds = timestamp
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let timestamp = prost_types::Timestamp { seconds, nanos: 0 };

        let request = UpdateUserSubscriptionRequest {
            user_id: self.user_id,
            subscribe_to_users: user_ids,
            timestamp: timestamp.seconds,
        };

        let status_request = UserStatusRequest {
            message: Some(user_status_request::Message::UpdateUserSubscriptionRequest(
                request,
            )),
        };

        self.status_tx
            .send(status_request)
            .await
            .map_err(|_| Status::internal("Failed to subscribe to users"))?;
        Ok(())
    }

    pub async fn send_init_stream(&self) -> Result<(), anyhow::Error> {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs();

        let subscriptions = self.subscriptions.lock().await.clone();

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update((self.user_id as u64).to_be_bytes());
        hasher.update(timestamp.to_be_bytes());
        for &sub_id in &subscriptions {
            hasher.update((sub_id as u64).to_be_bytes());
        }
        let hash = hasher.finalize();

        let signature = self
            .account
            .sign_message(&hash)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to sign init stream: {}", e))?;

        let request = InitStreamRequest {
            user_id: self.user_id,
            timestamp: timestamp as i64,
            subscribe_to_users: subscriptions,
            signature,
        };

        let status_request = UserStatusRequest {
            message: Some(user_status_request::Message::InitStreamRequest(request)),
        };

        self.status_tx
            .send(status_request)
            .await
            .map_err(|_| anyhow::anyhow!("Failed to send init stream request to channel"))?;

        Ok(())
    }
}
