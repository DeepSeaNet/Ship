use crate::api::connection::get_avaliable_voice_servers;
use crate::api::voice::grpc_generated::echolocator::signaling_service_client::SignalingServiceClient;
use crate::api::voice::grpc_generated::echolocator::{
    TryGetRoomRequest, UpdateGroupInfoRequest, VoiceMessage,
};
use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::Channel;

pub type VoiceStreamHandler = Arc<dyn Fn(VoiceMessage) + Send + Sync + 'static>;

#[derive(Debug, Clone)]
pub struct Backend {
    client: Arc<Mutex<Option<SignalingServiceClient<Channel>>>>,
    grpc_url: String,
    voice_message_sender: Arc<Mutex<Option<mpsc::Sender<VoiceMessage>>>>,
}

impl Default for Backend {
    fn default() -> Self {
        Self::new()
    }
}

impl Backend {
    pub fn new() -> Self {
        let addr = get_avaliable_voice_servers();
        Backend {
            client: Arc::new(Mutex::new(None)),
            grpc_url: format!("http://{}:50059", addr),
            voice_message_sender: Arc::new(Mutex::new(None)),
        }
    }

    // Инициализация соединения
    pub async fn initialize(&self) -> Result<()> {
        let grpc_client = SignalingServiceClient::connect(self.grpc_url.clone()).await?;

        let mut client_guard = self.client.lock().await;
        *client_guard = Some(grpc_client);

        log::info!("Successfully connected to gRPC server");
        Ok(())
    }

    // Проверка существования сессии
    pub async fn try_get_room(&self, session_id: String) -> Result<Option<Vec<u8>>> {
        let mut client_guard = self.client.lock().await;
        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC клиент не инициализирован"))?;

        let request = tonic::Request::new(TryGetRoomRequest { session_id });
        let response = client.try_get_room(request).await?.into_inner();
        log::info!("Try get room: {:?}", response);
        if response.exists {
            return Ok(Some(response.group_info));
        }
        Ok(None)
    }

    pub async fn update_group_info(&self, session_id: String, group_info: Vec<u8>) -> Result<()> {
        let update_request = UpdateGroupInfoRequest {
            session_id: session_id.clone(),
            group_info,
        };

        let mut client_guard = self.client.lock().await;

        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC клиент не инициализирован"))?;

        println!(
            "Sending request to update group_info for session {}, size: {} bytes",
            session_id,
            update_request.group_info.len()
        );

        match client.update_group_info(update_request).await {
            Ok(response) => {
                let inner_response = response.into_inner();

                if inner_response.success {
                    log::info!("Group info updated successfully");
                    Ok(())
                } else {
                    log::error!("Server failed to update group_info");
                    Err(anyhow!("Server failed to update group_info"))
                }
            }
            Err(e) => {
                log::error!("Error updating group_info: {}", e);
                Err(anyhow!("Error updating group_info: {}", e))
            }
        }
    }

    // Инициализация голосового потока с указанием voice_id
    pub async fn init_voice_stream(&self, user_id: u64, handler: VoiceStreamHandler) -> Result<()> {
        let mut client_guard = self.client.lock().await;

        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        log::info!("Initializing voice stream for user {}...", user_id);

        let (tx, rx) = mpsc::channel(100);

        {
            let mut sender_guard = self.voice_message_sender.lock().await;
            *sender_guard = Some(tx.clone());
        }

        let outbound = ReceiverStream::new(rx);

        // Создаем метаданные с user_id
        let mut metadata = tonic::metadata::MetadataMap::new();
        metadata.insert("user-id", user_id.to_string().parse().unwrap());

        // Отправляем запрос на создание двунаправленного потока с метаданными
        let request = tonic::Request::from_parts(metadata, tonic::Extensions::default(), outbound);

        let response = client.voice_stream(request).await?;
        let mut inbound = response.into_inner();

        println!("Voice stream initialized successfully for user {}", user_id);

        tokio::spawn(async move {
            log::info!("Starting voice stream processing task");

            while let Some(message) = inbound.next().await {
                match message {
                    Ok(voice_message) => {
                        log::info!(
                            "Received voice message, user_id: {}, voice_id: {}, size: {} bytes",
                            voice_message.user_id,
                            voice_message.voice_id,
                            voice_message.message.len()
                        );

                        // Вызываем обработчик для полученного сообщения
                        handler(voice_message);
                    }
                    Err(e) => {
                        log::error!("Error in voice stream: {}", e);
                        break;
                    }
                }
            }

            log::info!("Voice stream terminated");
        });

        Ok(())
    }

    // Инициализация голосового потока для конкретного voice_id
    pub async fn init_voice_stream_for_channel(
        &self,
        user_id: u64,
        voice_id: String,
        handler: VoiceStreamHandler,
    ) -> Result<()> {
        let mut client_guard = self.client.lock().await;

        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        log::info!(
            "Initializing voice stream for user {} in channel {}...",
            user_id,
            voice_id
        );

        let (tx, rx) = mpsc::channel(100);

        {
            let mut sender_guard = self.voice_message_sender.lock().await;
            *sender_guard = Some(tx.clone());
        }

        let outbound = ReceiverStream::new(rx);

        let mut metadata = tonic::metadata::MetadataMap::new();
        metadata.insert("user-id", user_id.to_string().parse().unwrap());

        let request = tonic::Request::from_parts(metadata, tonic::Extensions::default(), outbound);

        let response = client.voice_stream(request).await?;
        let mut inbound = response.into_inner();

        println!("Voice stream initialized successfully for user {}", user_id);

        let init_message = VoiceMessage {
            user_id,
            voice_id: voice_id.clone(),
            message: vec![],
        };

        // Отправляем инициализирующее сообщение
        if let Err(e) = tx.send(init_message).await {
            log::error!("Error sending init message: {}", e);
            return Err(anyhow!("Failed to send init message: {}", e));
        }

        log::info!("Init message with voice_id={} successfully sent", voice_id);

        // Запускаем задачу для обработки входящих сообщений
        tokio::spawn(async move {
            log::info!(
                "Starting voice stream processing task for channel {}",
                voice_id
            );

            while let Some(message) = inbound.next().await {
                match message {
                    Ok(voice_message) => {
                        log::info!(
                            "Received voice message, user_id: {}, voice_id: {}, size: {} bytes",
                            voice_message.user_id,
                            voice_message.voice_id,
                            voice_message.message.len()
                        );

                        // Вызываем обработчик для полученного сообщения
                        handler(voice_message);
                    }
                    Err(e) => {
                        log::error!("Error in voice stream: {}", e);
                        break;
                    }
                }
            }

            log::info!("Voice stream terminated");
        });

        Ok(())
    }

    // Отправка голосового сообщения
    pub async fn send_voice_message(
        &self,
        user_id: u64,
        voice_id: String,
        message: Vec<u8>,
    ) -> Result<()> {
        let sender_guard = self.voice_message_sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            let voice_message = VoiceMessage {
                user_id,
                voice_id: voice_id.clone(),
                message,
            };

            log::info!(
                "Sending message: user_id={}, voice_id={}, size={} bytes",
                user_id,
                voice_id,
                voice_message.message.len()
            );

            match sender.send(voice_message).await {
                Ok(_) => {
                    log::info!("Message successfully queued for sending");
                    Ok(())
                }
                Err(e) => {
                    log::error!("Error sending voice message: {}", e);
                    Err(anyhow!("Failed to send voice message: {}", e))
                }
            }
        } else {
            log::error!("Voice stream not initialized");
            Err(anyhow!("Voice stream not initialized"))
        }
    }
}
