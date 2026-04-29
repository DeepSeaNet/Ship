#[allow(clippy::all, clippy::pedantic, clippy::restriction, clippy::nursery)]
pub mod group_microservice {
    tonic::include_proto!("group_microservice");
}

use crate::api::device::types::errors::GroupError;
use group_microservice::group_delivery_service_client::GroupDeliveryServiceClient;
use group_microservice::{
    GetUserCredentialRequest, GetUserKeyPackagesRequest, GetUsersDevicesRequest,
    InitGroupStreamRequest, RegisterGroupDeviceRequest, StreamMessage, StreamMessageGroupMessage,
    StreamResponse, UploadKeyPackagesRequest,
};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tauri::http::Uri;
use tokio::sync::{Mutex, mpsc};
use tokio_stream::StreamExt;
use tonic::{Request, Status, Streaming};
use tonic_h3::H3Channel;
use tonic_h3::quinn::H3QuinnConnector;

use crate::api::connection::endpoint::create_client_endpoint;
use crate::api::device::connection::group_microservice::{
    Device, GetDeviceKeyPackageRequest, StreamAckDeliveryRequest,
};

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
    pub fn new(address: String) -> Result<Self, GroupError> {
        let uri = Uri::from_str(&address.clone())
            .map_err(|e| GroupError::ConnectionError(e.to_string()))?;

        let endpoint = create_client_endpoint().map_err(|e| {
            log::error!("Failed to create endpoint: {}", e);
            GroupError::ConnectionError("Failed to create endpoint".to_string())
        })?;
        let connector = H3QuinnConnector::new(uri.clone(), "sea_group".to_string(), endpoint);

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
        let response = self
            .client
            .lock()
            .await
            .register_group_device(request)
            .await?;
        let response = response.into_inner();
        if !response.success {
            return Err(Status::internal(
                "Failed to register device: ".to_string() + &response.error,
            ));
        }
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
        let response = self
            .client
            .lock()
            .await
            .upload_key_packages(request)
            .await?;
        let response = response.into_inner();
        if !response.success {
            return Err(Status::internal(
                "Failed to upload key packages: ".to_string() + &response.error,
            ));
        }
        Ok(())
    }

    pub async fn get_user_credential(&self, user_id: u64) -> Result<Vec<u8>, Status> {
        let request = GetUserCredentialRequest { user_id };
        let response = self
            .client
            .lock()
            .await
            .get_user_credential(request)
            .await?;
        let response = response.into_inner();
        if !response.success {
            return Err(Status::internal(
                "Failed to get user credential: ".to_string() + &response.error,
            ));
        }
        Ok(response.user_credential)
    }

    pub async fn get_user_key_packages(
        &self,
        user_id: u64,
    ) -> Result<HashMap<String, Vec<u8>>, Status> {
        let request = GetUserKeyPackagesRequest { user_id };
        let response = self
            .client
            .lock()
            .await
            .get_user_key_packages(request)
            .await?;
        let response = response.into_inner();
        if !response.success {
            return Err(Status::internal(
                "Failed to get user key packages: ".to_string() + &response.error,
            ));
        }
        Ok(response.key_packages)
    }

    pub async fn get_users_devices(&self, user_id: u64) -> Result<Vec<Device>, Status> {
        let request = GetUsersDevicesRequest { user_id };
        let response = self.client.lock().await.get_users_devices(request).await?;
        let response = response.into_inner();
        if !response.success {
            return Err(Status::internal(
                "Failed to get users devices: ".to_string() + &response.error,
            ));
        }
        Ok(response.devices)
    }

    pub async fn get_device_key_package(
        &self,
        user_id: u64,
        device_id: String,
    ) -> Result<Vec<u8>, Status> {
        let request = GetDeviceKeyPackageRequest { user_id, device_id };
        let response = self
            .client
            .lock()
            .await
            .get_device_key_package(request)
            .await?;
        let response = response.into_inner();
        if !response.success {
            return Err(Status::internal(
                "Failed to get device key package: ".to_string() + &response.error,
            ));
        }
        Ok(response.key_package)
    }

    pub async fn init_stream(
        &self,
        user_id: u64,
        device_id: String,
        signature: Vec<u8>,
        date: u64,
    ) -> Result<(), Status> {
        if self.is_stream_active().await {
            log::warn!("Stream already initialized, closing existing stream");
            self.close_stream().await?;
        }

        let (stream_tx, stream_rx) = mpsc::channel::<StreamMessage>(100);
        let init_request = InitGroupStreamRequest {
            user_id,
            device_id: device_id.clone(),
            date,
            signature,
        };

        let stream_init_message = StreamMessage {
            message: Some(
                group_microservice::stream_message::Message::InitGroupStream(init_request),
            ),
        };

        if let Err(e) = stream_tx.send(stream_init_message).await {
            log::error!("Failed to send init message: {:?}", e);
            return Err(Status::internal("Failed to initialize stream"));
        }

        {
            let mut tx_guard = self.stream_tx.lock().await;
            *tx_guard = Some(stream_tx.clone());
        }
        let stream_req = Request::new(tokio_stream::wrappers::ReceiverStream::new(stream_rx));

        let stream = self
            .client
            .lock()
            .await
            .stream_messages(stream_req)
            .await?
            .into_inner();

        {
            let mut stream_guard = self.stream.lock().await;
            *stream_guard = Some(stream);
        }

        log::info!("Stream initialized successfully");
        Ok(())
    }

    pub async fn send_group_message(
        &self,
        message_id: u64,
        group_id: Vec<u8>,
        members: Vec<u64>,
        message: Vec<u8>,
    ) -> Result<(), Status> {
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

    pub async fn close_stream(&self) -> Result<(), Status> {
        *self.stream_tx.lock().await = None;

        *self.stream.lock().await = None;

        Ok(())
    }

    pub async fn is_stream_active(&self) -> bool {
        self.stream_tx.lock().await.is_some()
    }
}
