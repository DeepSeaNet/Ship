use crate::api::connection::get_avaliable_voice_servers;
use crate::api::voice::grpc_generated::echolocator::signaling_service_client::SignalingServiceClient;
use crate::api::voice::grpc_generated::echolocator::{
    TryGetRoomRequest, UpdateGroupInfoRequest, ClientMessage, ServerMessage,
};
use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::Channel;
use tauri::{AppHandle, Emitter};

pub type VoiceDataHandler = Arc<dyn Fn(u64, String, Vec<u8>) + Send + Sync + 'static>;

#[derive(Clone)]
pub struct Backend {
    client: Arc<Mutex<Option<SignalingServiceClient<Channel>>>>,
    grpc_url: String,
    signaling_message_sender: Arc<Mutex<Option<mpsc::Sender<ClientMessage>>>>,
    voice_data_handler: Arc<Mutex<Option<VoiceDataHandler>>>,
    app_handle: Option<AppHandle>,
}

impl std::fmt::Debug for Backend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Backend")
            .field("grpc_url", &self.grpc_url)
            .field("app_handle", &self.app_handle)
            .finish()
    }
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
            signaling_message_sender: Arc::new(Mutex::new(None)),
            voice_data_handler: Arc::new(Mutex::new(None)),
            app_handle: None,
        }
    }

    pub fn with_app_handle(app_handle: AppHandle) -> Self {
        let addr = get_avaliable_voice_servers();
        Backend {
            client: Arc::new(Mutex::new(None)),
            grpc_url: format!("http://{}:50059", addr),
            signaling_message_sender: Arc::new(Mutex::new(None)),
            voice_data_handler: Arc::new(Mutex::new(None)),
            app_handle: Some(app_handle),
        }
    }
    
    /// Set handler for incoming voice data
    pub async fn set_voice_data_handler(&self, handler: VoiceDataHandler) {
        let mut handler_guard = self.voice_data_handler.lock().await;
        *handler_guard = Some(handler);
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

    // Отправка голосового сообщения через signaling stream
    pub async fn send_voice_message(
        &self,
        voice_id: String,
        data: Vec<u8>,
    ) -> Result<()> {
        let sender_guard = self.signaling_message_sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            let voice_data_message = ClientMessage {
                message: Some(crate::api::voice::grpc_generated::echolocator::client_message::Message::VoiceData(
                    crate::api::voice::grpc_generated::echolocator::VoiceDataRequest {
                        voice_id: voice_id.clone(),
                        data: data.clone(),
                    }
                ))
            };

            log::info!(
                "Sending voice data: voice_id={}, size={} bytes",
                voice_id,
                data.len()
            );

            match sender.send(voice_data_message).await {
                Ok(_) => {
                    log::info!("Voice data successfully queued for sending");
                    Ok(())
                }
                Err(e) => {
                    log::error!("Error sending voice data: {}", e);
                    Err(anyhow!("Failed to send voice data: {}", e))
                }
            }
        } else {
            log::error!("Signaling stream not initialized");
            Err(anyhow!("Signaling stream not initialized"))
        }
    }

    // Инициализация SignalingStream для WebRTC
    pub async fn init_signaling_stream(&self, room_id: String, rtp_capabilities: Option<String>) -> Result<()> {
        let mut client_guard = self.client.lock().await;

        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        log::info!("Initializing signaling stream for room {}...", room_id);

        let (tx, rx) = mpsc::channel(100);

        // Создаем начальное Init сообщение
        let init_message = if let Some(rtp_caps_json) = rtp_capabilities {
            // Парсим RTP capabilities из JSON
            let rtp_caps: serde_json::Value = serde_json::from_str(&rtp_caps_json)
                .map_err(|e| anyhow!("Failed to parse RTP capabilities: {}", e))?;
            
            ClientMessage {
                message: Some(crate::api::voice::grpc_generated::echolocator::client_message::Message::Init(
                    crate::api::voice::grpc_generated::echolocator::InitRequest {
                        room_id: room_id.clone(),
                        rtp_capabilities: Some(crate::api::voice::grpc_generated::echolocator::RtpCapabilities {
                            codecs: vec![crate::api::voice::grpc_generated::echolocator::RtpCodecCapability {
                                kind: "serialized".to_string(),
                                mime_type: rtp_caps.to_string(),
                                preferred_payload_type: 0,
                                clock_rate: 0,
                                channels: 0,
                                parameters: String::new(),
                                rtcp_feedback: String::new(),
                            }],
                            header_extensions: vec![],
                        }),
                    }
                ))
            }
        } else {
            // Если RTP capabilities не переданы, используем минимальные
            ClientMessage {
                message: Some(crate::api::voice::grpc_generated::echolocator::client_message::Message::Init(
                    crate::api::voice::grpc_generated::echolocator::InitRequest {
                        room_id: room_id.clone(),
                        rtp_capabilities: Some(crate::api::voice::grpc_generated::echolocator::RtpCapabilities {
                            codecs: vec![],
                            header_extensions: vec![],
                        }),
                    }
                ))
            }
        };

        // Отправляем Init сообщение первым в канал
        if let Err(e) = tx.send(init_message).await {
            log::error!("Failed to send init message: {}", e);
            return Err(anyhow!("Failed to send init message: {}", e));
        }

        log::info!("Init message sent for room {}", room_id);

        // Сохраняем отправитель для последующих сообщений
        {
            let mut sender_guard = self.signaling_message_sender.lock().await;
            *sender_guard = Some(tx.clone());
        }

        let outbound = ReceiverStream::new(rx);

        let request = tonic::Request::new(outbound);

        let response = client.signaling_stream(request).await?;
        let mut inbound = response.into_inner();

        log::info!("Signaling stream initialized successfully for room {}", room_id);

        // Запускаем задачу для обработки входящих сообщений
        let app_handle = self.app_handle.clone();
        let voice_data_handler = self.voice_data_handler.clone();
        
        tokio::spawn(async move {
            log::info!("Starting signaling stream processing task for room {}", room_id);

            while let Some(message) = inbound.next().await {
                match message {
                    Ok(server_message) => {
                        // Check if this is VoiceData message
                        if let Some(ref msg) = server_message.message {
                            if let crate::api::voice::grpc_generated::echolocator::server_message::Message::VoiceData(voice_data) = msg {
                                log::debug!("Received voice data: user_id={}, voice_id={}, size={} bytes", 
                                    voice_data.user_id, voice_data.voice_id, voice_data.data.len());
                                
                                // Call voice data handler if set
                                let handler_guard = voice_data_handler.lock().await;
                                if let Some(handler) = handler_guard.as_ref() {
                                    handler(voice_data.user_id, voice_data.voice_id.clone(), voice_data.data.clone());
                                } else {
                                    log::warn!("Voice data received but no handler set");
                                }
                                continue;
                            }
                        }
                        
                        log::debug!("Received signaling message: {:?}", server_message);

                        // Emit Tauri event for WebRTC signaling messages
                        if let Some(app_handle) = &app_handle {
                            let event_payload = serde_json::json!({
                                "type": "signaling_message",
                                "data": server_message
                            });

                            if let Err(e) = app_handle.emit("voice-event", event_payload) {
                                log::error!("Failed to emit voice-event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Error in signaling stream: {}", e);
                        break;
                    }
                }
            }

            log::info!("Signaling stream terminated");
        });

        Ok(())
    }

    // Отправка signaling сообщения
    pub async fn send_signaling_message(&self, message: ClientMessage) -> Result<()> {
        let sender_guard = self.signaling_message_sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            log::info!("Sending signaling message: {:?}", message);

            match sender.send(message).await {
                Ok(_) => {
                    log::info!("Signaling message successfully queued for sending");
                    Ok(())
                }
                Err(e) => {
                    log::error!("Error sending signaling message: {}", e);
                    Err(anyhow!("Failed to send signaling message: {}", e))
                }
            }
        } else {
            log::error!("Signaling stream not initialized");
            Err(anyhow!("Signaling stream not initialized"))
        }
    }
}
