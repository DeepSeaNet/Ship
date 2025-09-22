#[allow(clippy::all, clippy::pedantic, clippy::restriction, clippy::nursery)]
pub mod group_microservice {
    tonic::include_proto!("group_microservice");
}

use anyhow::Result;
use group_microservice::group_delivery_service_client::GroupDeliveryServiceClient;
use group_microservice::{
    GetUserCredentialRequest, GetUserKeyPackagesRequest, GetUsersDevicesRequest,
    InitGroupStreamRequest, RegisterGroupDeviceRequest, StreamMessage, StreamMessageGroupMessage,
    StreamResponse, UploadKeyPackagesRequest,
};
use quinn::{rustls, ClientConfig, Endpoint};
use tauri::http::Uri;
use tonic_h3::quinn::H3QuinnConnector;
use tonic_h3::H3Channel;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
use tokio_stream::StreamExt;
use tonic::{Request, Status, Streaming};

use crate::api::device::connection::endpoint::create_client_endpoint;
use crate::api::device::connection::group_microservice::{
    GetDeviceKeyPackageRequest, StreamAckDeliveryRequest, UpdateGroupSubscriptionsRequest,
};
use crate::api::device::types::group::GroupId;

use super::group_connection::group_microservice::StreamSendWelcomeMessageRequest;

#[derive(Clone)]
pub struct Backend {
    client: Arc<Mutex<GroupDeliveryServiceClient<H3Channel<H3QuinnConnector>>>>,
    // Отправитель сообщений в стрим
    stream_tx: Arc<Mutex<Option<mpsc::Sender<StreamMessage>>>>,
    // Сам стрим для приема сообщений
    stream: Arc<Mutex<Option<Streaming<StreamResponse>>>>,
}

impl Backend {
    pub async fn new(address: String) -> Result<Self> {
        let uri = Uri::from_str(&address.clone())?;
        
        let endpoint = create_client_endpoint().map_err(|e | {
            log::error!("Failed to create endpoint: {}", e);
            anyhow::anyhow!("Failed to create endpoint")
        })?;
        let connector = H3QuinnConnector::new(
            uri.clone(), "sea_group".to_string(), 
            endpoint);

        let channel = H3Channel::new(connector, uri);

        let client = GroupDeliveryServiceClient::new(channel);

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
            stream_tx: Arc::new(Mutex::new(None)),
            stream: Arc::new(Mutex::new(None)),
        })
    }
}

impl Backend {
    pub async fn register_device(
        &self,
        user_id: u64,
        device_id: String,
        key_package: Option<Vec<u8>>,
        signature: Vec<u8>,
    ) -> Result<(), Status> {
        let request = RegisterGroupDeviceRequest {
            user_id,
            device_id,
            key_package,
            signature,
        };
        let _response = self.client.lock().await.register_group_device(request).await.unwrap();
        Ok(())
    }

    pub async fn upload_key_packages(
        &self,
        user_id: u64,
        device_id: String,
        key_packages: Vec<Vec<u8>>,
        signature: Vec<u8>,
    ) -> Result<(), Status> {
        let request = UploadKeyPackagesRequest {
            user_id,
            device_id,
            key_packages,
            signature,
        };
        let _response = self.client.lock().await.upload_key_packages(request).await.unwrap();
        Ok(())
    }

    pub async fn get_user_credential(&self, user_id: u64) -> Result<Vec<u8>, Status> {
        let request = GetUserCredentialRequest { user_id };
        let response = self.client.lock().await.get_user_credential(request).await.unwrap();
        Ok(response.into_inner().user_credential)
    }

    pub async fn get_user_key_packages(
        &self,
        user_id: u64,
    ) -> Result<HashMap<String, Vec<u8>>, Status> {
        let request = GetUserKeyPackagesRequest { user_id };
        let response = self.client.lock().await.get_user_key_packages(request).await.unwrap();
        Ok(response.into_inner().key_packages)
    }

    pub async fn get_users_devices(&self, user_id: u64) -> Result<Vec<String>, Status> {
        let request = GetUsersDevicesRequest { user_id };
        let response = self.client.lock().await.get_users_devices(request).await.unwrap();
        Ok(response.into_inner().devices)
    }

    pub async fn get_device_key_package(
        &self,
        user_id: u64,
        device_id: String,
    ) -> Result<Vec<u8>, Status> {
        let request = GetDeviceKeyPackageRequest { user_id, device_id };
        let response = self.client.lock().await.get_device_key_package(request).await.unwrap();
        Ok(response.into_inner().key_package)
    }

    // Новые методы для работы со стримом

    /// Инициализирует стрим сообщений с сервером
    pub async fn init_stream(
        &self,
        user_id: u64,
        device_id: String,
        signature: Vec<u8>,
        date: u64,
        group_ids: Vec<GroupId>,
    ) -> Result<(), Status> {
        // Проверяем, что стрим еще не инициализирован
        if self.is_stream_active().await {
            log::warn!("Stream already initialized, closing existing stream");
            self.close_stream().await?;
        }

        // Создаем постоянный канал для отправки сообщений в стрим
        let (stream_tx, stream_rx) = mpsc::channel::<StreamMessage>(100);
        let group_ids = group_ids.iter().map(|id| id.to_vec()).collect();
        // Создаем запрос на инициализацию стрима
        let init_request = InitGroupStreamRequest {
            user_id,
            device_id: device_id.clone(),
            date,
            signature,
            group_ids,
        };

        // Создаем сообщение для инициализации стрима
        let stream_init_message = StreamMessage {
            message: Some(
                group_microservice::stream_message::Message::InitGroupStream(init_request),
            ),
        };

        // Отправляем сообщение инициализации
        if let Err(e) = stream_tx.send(stream_init_message).await {
            log::error!("Failed to send init message: {:?}", e);
            return Err(Status::internal("Failed to initialize stream"));
        }

        // Сохраняем отправитель для последующего использования
        {
            let mut tx_guard = self.stream_tx.lock().await;
            *tx_guard = Some(stream_tx.clone());
        }

        // Создаем стрим с постоянным каналом
        let stream_req = Request::new(tokio_stream::wrappers::ReceiverStream::new(stream_rx));

        // Открываем двусторонний стрим с сервером
        let stream = self.client.lock().await.stream_messages(stream_req).await?.into_inner();

        // Сохраняем стрим для получения ответов
        {
            let mut stream_guard = self.stream.lock().await;
            *stream_guard = Some(stream);
        }

        log::info!("Stream initialized successfully");
        Ok(())
    }

    /// Отправляет групповое сообщение через стрим
    pub async fn send_group_message(
        &self,
        message_id: u64,
        group_id: Vec<u8>,
        members: Vec<u64>,
        message: Vec<u8>,
    ) -> Result<(), Status> {
        // Создаем групповое сообщение
        let group_message = StreamMessageGroupMessage {
            message_id,
            group_id,
            members,
            message,
        };

        let stream_message = StreamMessage {
            message: Some(group_microservice::stream_message::Message::GroupMessage(
                group_message,
            )),
        };

        // Отправляем сообщение через существующий стрим, если он доступен
        if let Some(tx) = self.stream_tx.lock().await.as_ref() {
            if let Err(e) = tx.send(stream_message).await {
                log::error!(
                    "Failed to send group message through existing stream: {:?}",
                    e
                );
                return Err(Status::internal("Failed to send message"));
            }
            return Ok(());
        }
        Ok(())
    }

    pub async fn send_welcome_message(
        &self,
        message_id: u64,
        user_id: u64,
        welcome_message: Vec<u8>,
    ) -> Result<(), Status> {
        let request = StreamSendWelcomeMessageRequest {
            message_id,
            user_id,
            welcome_message,
        };
        let stream_message = StreamMessage {
            message: Some(group_microservice::stream_message::Message::SendWelcomeMessage(request)),
        };
        if let Some(tx) = self.stream_tx.lock().await.as_ref() {
            if let Err(e) = tx.send(stream_message).await {
                log::error!(
                    "Failed to send welcome message through existing stream: {:?}",
                    e
                );
                return Err(Status::internal("Failed to send message"));
            }
            return Ok(());
        }
        log::error!("No stream to send message");
        Err(Status::internal("No stream to send message"))
    }

    pub async fn ack_delivery(
        &self,
        message_id: u64,
        user_id: u64,
        device_id: String,
        group_id: Vec<u8>,
    ) -> Result<(), Status> {
        let request = StreamAckDeliveryRequest {
            message_id,
            user_id,
            device_id,
            group_id,
        };
        let stream_message = StreamMessage {
            message: Some(group_microservice::stream_message::Message::AckDelivery(
                request,
            )),
        };
        if let Some(tx) = self.stream_tx.lock().await.as_ref() {
            if let Err(e) = tx.send(stream_message).await {
                log::error!(
                    "Failed to send ack delivery through existing stream: {:?}",
                    e
                );
                return Err(Status::internal("Failed to send message"));
            }
            return Ok(());
        }
        log::error!("No stream to send message");
        Err(Status::internal("No stream to send message"))
    }

    pub async fn next_message(&self) -> Option<Result<StreamResponse, Status>> {
        let mut stream_guard = self.stream.lock().await;
        match stream_guard.as_mut() {
            Some(stream) => {
                let fut = stream.next();
                fut.await
            }
            None => None,
        }
    }

    pub async fn update_group_subscriptions(
        &self,
        add_group_ids: Vec<Vec<u8>>,
        remove_group_ids: Vec<Vec<u8>>,
    ) -> Result<(), Status> {
        let request = UpdateGroupSubscriptionsRequest {
            add_group_ids,
            remove_group_ids,
        };
        let stream_message = StreamMessage {
            message: Some(
                group_microservice::stream_message::Message::UpdateGroupSubscriptions(request),
            ),
        };
        if let Some(tx) = self.stream_tx.lock().await.as_ref() {
            if let Err(e) = tx.send(stream_message).await {
                log::error!(
                    "Failed to send update group subscriptions through existing stream: {:?}",
                    e
                );
                return Err(Status::internal("Failed to send message"));
            }
            return Ok(());
        }
        log::error!("No stream to send message");
        Err(Status::internal("No stream to send message"))
    }

    /// Закрывает активный стрим
    pub async fn close_stream(&self) -> Result<(), Status> {
        // Очищаем отправитель сообщений
        *self.stream_tx.lock().await = None;

        // Очищаем стрим
        *self.stream.lock().await = None;

        Ok(())
    }

    // Вспомогательный метод для проверки активности стрима
    pub async fn is_stream_active(&self) -> bool {
        self.stream_tx.lock().await.is_some()
    }
}
