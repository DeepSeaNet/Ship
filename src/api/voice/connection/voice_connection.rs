use crate::api::connection::get_avaliable_voice_servers;
use crate::api::voice::grpc_generated::echolocator::signaling_service_client::SignalingServiceClient;
use crate::api::voice::grpc_generated::echolocator::{
    ClientMessage, ServerInfoRequest, TryGetRoomRequest,
};
use anyhow::{Result, anyhow};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::Channel;

pub type VoiceDataHandler = Arc<dyn Fn(u64, String, Vec<u8>) + Send + Sync + 'static>;
pub type MlsEventHandler = Arc<dyn Fn(String, Vec<u8>, Option<String>) + Send + Sync + 'static>;
pub type CommitResponseHandler = Arc<dyn Fn(String, bool, String) + Send + Sync + 'static>;

#[derive(Clone)]
pub struct Backend {
    client: Arc<Mutex<Option<SignalingServiceClient<Channel>>>>,
    grpc_url: String,
    signaling_message_sender: Arc<Mutex<Option<mpsc::Sender<ClientMessage>>>>,
    voice_data_handler: Arc<Mutex<Option<VoiceDataHandler>>>,
    mls_event_handler: Arc<Mutex<Option<MlsEventHandler>>>,
    commit_response_handler: Arc<Mutex<Option<CommitResponseHandler>>>,
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
            mls_event_handler: Arc::new(Mutex::new(None)),
            commit_response_handler: Arc::new(Mutex::new(None)),
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
            mls_event_handler: Arc::new(Mutex::new(None)),
            commit_response_handler: Arc::new(Mutex::new(None)),
            app_handle: Some(app_handle),
        }
    }

    /// Set handler for incoming voice data
    pub async fn set_voice_data_handler(&self, handler: VoiceDataHandler) {
        let mut handler_guard = self.voice_data_handler.lock().await;
        *handler_guard = Some(handler);
    }

    /// Set handler for MLS events (AddProposal, ServerCommit)
    pub async fn set_mls_event_handler(&self, handler: MlsEventHandler) {
        let mut handler_guard = self.mls_event_handler.lock().await;
        *handler_guard = Some(handler);
    }

    /// Set handler for commit response (ServerCommitResponse)
    pub async fn set_commit_response_handler(&self, handler: CommitResponseHandler) {
        let mut handler_guard = self.commit_response_handler.lock().await;
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
    pub async fn try_get_room(&self, session_id: String) -> Result<bool> {
        let mut client_guard = self.client.lock().await;
        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        let request = tonic::Request::new(TryGetRoomRequest { session_id });
        let response = client.try_get_room(request).await?.into_inner();
        log::info!("Try get room: {:?}", response);
        if response.exists {
            return Ok(response.exists);
        }
        Ok(false)
    }

    pub async fn get_server_info(&self) -> Result<Vec<u8>> {
        let mut client_guard = self.client.lock().await;
        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        let request = tonic::Request::new(ServerInfoRequest {});
        let response = client.get_server_info(request).await?.into_inner();
        Ok(response.server_identity)
    }

    // Send group info to server for observation (when creating new room)
    pub async fn send_group_info_to_server(
        &self,
        room_id: String,
        group_info: Vec<u8>,
    ) -> Result<()> {
        let mut client_guard = self.client.lock().await;

        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        log::info!(
            "Sending group_info to server for room {}, size: {} bytes",
            room_id,
            group_info.len()
        );

        let request = crate::api::voice::grpc_generated::echolocator::GetOrCreateRoomRequest {
            room_id: room_id.clone(),
            group_info: group_info.clone(),
        };

        match client.get_or_create_room(request).await {
            Ok(response) => {
                let inner = response.into_inner();
                log::info!(
                    "Server observed group for room {}: created={}",
                    room_id,
                    inner.created
                );
                Ok(())
            }
            Err(e) => {
                log::error!("Error sending group_info to server: {}", e);
                Err(anyhow!("Error sending group_info to server: {}", e))
            }
        }
    }

    // Join room by sending key package
    pub async fn join_room(&self, room_id: String, key_package: Vec<u8>) -> Result<Vec<u8>> {
        let mut client_guard = self.client.lock().await;

        let client = client_guard
            .as_mut()
            .ok_or_else(|| anyhow!("gRPC client not initialized"))?;

        log::info!("Joining room {} with key package", room_id);

        let request = crate::api::voice::grpc_generated::echolocator::JoinRoomRequest {
            voice_id: room_id.clone(),
            key_package,
        };

        match client.join_room(request).await {
            Ok(response) => {
                let inner = response.into_inner();
                if inner.success {
                    log::info!("Successfully joined room {}", room_id);
                    Ok(inner.welcome_message)
                } else {
                    Err(anyhow!("Server failed to join room"))
                }
            }
            Err(e) => {
                log::error!("Error joining room: {}", e);
                Err(anyhow!("Error joining room: {}", e))
            }
        }
    }

    // Send client commit (after processing add proposal)
    pub async fn send_client_commit(
        &self,
        voice_id: String,
        commit: Vec<u8>,
        welcome_message: Vec<u8>,
    ) -> Result<()> {
        log::info!("Trying to send client commit");
        let sender_guard = self.signaling_message_sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            let commit_message = crate::api::voice::grpc_generated::echolocator::ClientMessage {
                message: Some(crate::api::voice::grpc_generated::echolocator::client_message::Message::ClientCommit(
                    crate::api::voice::grpc_generated::echolocator::ClientCommitRequest {
                        voice_id,
                        commit,
                        welcome_message,
                    }
                ))
            };

            log::info!("Sending client commit");

            match sender.send(commit_message).await {
                Ok(_) => {
                    log::info!("Client commit successfully sent");
                    Ok(())
                }
                Err(e) => {
                    log::error!("Error sending client commit: {}", e);
                    Err(anyhow!("Failed to send client commit: {}", e))
                }
            }
        } else {
            log::error!("Signaling stream not initialized");
            Err(anyhow!("Signaling stream not initialized"))
        }
    }

    // Send commit ACK
    pub async fn send_commit_ack(
        &self,
        commit_id: String,
        success: bool,
        error_message: Option<String>,
    ) -> Result<()> {
        let sender_guard = self.signaling_message_sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            let ack_message = crate::api::voice::grpc_generated::echolocator::ClientMessage {
                message: Some(crate::api::voice::grpc_generated::echolocator::client_message::Message::CommitAck(
                    crate::api::voice::grpc_generated::echolocator::CommitAckRequest {
                        commit_id: commit_id.clone(),
                        success,
                        error_message: error_message.unwrap_or_default(),
                    }
                ))
            };

            log::info!("Sending commit ACK for commit_id: {}", commit_id);

            match sender.send(ack_message).await {
                Ok(_) => {
                    log::info!("Commit ACK successfully sent");
                    Ok(())
                }
                Err(e) => {
                    log::error!("Error sending commit ACK: {}", e);
                    Err(anyhow!("Failed to send commit ACK: {}", e))
                }
            }
        } else {
            log::error!("Signaling stream not initialized");
            Err(anyhow!("Signaling stream not initialized"))
        }
    }

    // Отправка голосового сообщения через signaling stream
    pub async fn send_voice_message(&self, voice_id: String, data: Vec<u8>) -> Result<()> {
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
    pub async fn init_signaling_stream(
        &self,
        room_id: String,
        rtp_capabilities: Option<String>,
    ) -> Result<()> {
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
                message: Some(
                    crate::api::voice::grpc_generated::echolocator::client_message::Message::Init(
                        crate::api::voice::grpc_generated::echolocator::InitRequest {
                            room_id: room_id.clone(),
                            rtp_capabilities: Some(
                                crate::api::voice::grpc_generated::echolocator::RtpCapabilities {
                                    codecs: vec![],
                                    header_extensions: vec![],
                                },
                            ),
                        },
                    ),
                ),
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

        log::info!(
            "Signaling stream initialized successfully for room {}",
            room_id
        );

        // Запускаем задачу для обработки входящих сообщений
        let app_handle = self.app_handle.clone();
        let voice_data_handler = self.voice_data_handler.clone();
        let mls_event_handler = self.mls_event_handler.clone();
        let commit_response_handler = self.commit_response_handler.clone();

        tokio::spawn(async move {
            log::info!(
                "Starting signaling stream processing task for room {}",
                room_id
            );

            while let Some(message) = inbound.next().await {
                match message {
                    Ok(server_message) => {
                        // Check message type and handle accordingly
                        if let Some(ref msg) = server_message.message {
                            match msg {
                                crate::api::voice::grpc_generated::echolocator::server_message::Message::VoiceData(voice_data) => {
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
                                crate::api::voice::grpc_generated::echolocator::server_message::Message::AddProposal(add_proposal) => {
                                    log::info!("Received add proposal for voice_id: {}", add_proposal.voice_id);
                                    // Call MLS event handler for AddProposal
                                    let handler_guard = mls_event_handler.lock().await;
                                    if let Some(handler) = handler_guard.as_ref() {
                                        handler(add_proposal.voice_id.clone(), add_proposal.proposal.clone(), None);
                                    } else {
                                        log::warn!("AddProposal received but no MLS handler set");
                                    }
                                    continue;
                                }
                                crate::api::voice::grpc_generated::echolocator::server_message::Message::ServerCommit(server_commit) => {
                                    log::info!("Received server commit for voice_id: {}, commit_id: {}", 
                                        server_commit.voice_id, server_commit.commit_id);
                                    // Call MLS event handler for ServerCommit
                                    let handler_guard = mls_event_handler.lock().await;
                                    if let Some(handler) = handler_guard.as_ref() {
                                        handler(server_commit.voice_id.clone(), server_commit.commit.clone(), Some(server_commit.commit_id.clone()));
                                    } else {
                                        log::warn!("ServerCommit received but no MLS handler set");
                                    }
                                    continue;
                                }
                                crate::api::voice::grpc_generated::echolocator::server_message::Message::ServerCommitResponse(commit_response) => {
                                    log::info!("Received server commit response for voice_id: {}, accepted: {}", 
                                        commit_response.voice_id, commit_response.accepted);
                                    // Call commit response handler
                                    let handler_guard = commit_response_handler.lock().await;
                                    if let Some(handler) = handler_guard.as_ref() {
                                        handler(commit_response.voice_id.clone(), commit_response.accepted, commit_response.error_message.clone());
                                    } else {
                                        log::warn!("ServerCommitResponse received but no handler set");
                                    }
                                    continue;
                                }
                                _ => {
                                    //log::debug!("Received signaling message: {:?}", server_message);
                                }
                            }
                        }

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
