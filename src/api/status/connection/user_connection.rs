use prost::Message;
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
    GetUserActivityRequest, GetUserActivityResponse, GetUserInfoRequest, MarkMessageReadRequest,
    MarkMessageReadResponse, OnlineStatus, OnlineStatusRequest, TypingStatus, TypingStatusRequest,
    UpdateActivityRequest, UpdateAvatarRequest, UpdateAvatarResponse, UpdateUsernameRequest,
    UpdateUsernameResponse, UserStatusRequest, user_service_client::UserServiceClient,
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
        let request_bytes = request.encode_to_vec();
        let signature = self.account.sign_message(&request_bytes).await?;
        // Отправляем запрос на сервер
        let response = self.client.update_activity(Request::new(request)).await?;
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

        let response = self.client.update_username(Request::new(request)).await?;
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

        let response = self.client.update_avatar(Request::new(request)).await?;
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

        let response = self.client.mark_message_read(Request::new(request)).await?;
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

        // Получаем текущие подписки
        let subscriptions = self.subscriptions.lock().await.clone();

        // Создаем запрос статуса для стрима
        let online_request = OnlineStatusRequest {
            user_id: self.user_id,
            status: status as i32,
            timestamp: Some(timestamp),
            subscribe_to_users: subscriptions,
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
}
