use crate::api::connection::get_avaliable_voice_servers;
use crate::api::voice::connection::echolocator::{
    self, ClientMessage, ServerInfoRequest, TryGetRoomRequest,
    signaling_service_client::SignalingServiceClient,
};
use crate::api::voice::{VoiceError, VoiceResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::Channel;

/// Pure transport layer for the voice signaling gRPC channel.
///
/// Responsibilities:
/// - Manage the gRPC connection lifecycle (`initialize`, `close_signaling_stream`)
/// - Set up the bidirectional signaling stream (`init_signaling_stream`) and hand
///   the inbound [`mpsc::Receiver`] to the caller so **all** message-handling logic
///   lives in [`VoiceHandler`], not here.
/// - Provide send helpers (`send_voice_message`, `send_client_commit`, `send_commit_ack`,
///   `send_signaling_message`).
#[derive(Clone)]
pub struct Backend {
    client: Arc<Mutex<Option<SignalingServiceClient<Channel>>>>,
    grpc_url: String,
    signaling_message_sender: Arc<Mutex<Option<mpsc::Sender<ClientMessage>>>>,
}

impl std::fmt::Debug for Backend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Backend")
            .field("grpc_url", &self.grpc_url)
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
        }
    }

    // ── Connection lifecycle ────────────────────────────────────────────────

    pub async fn initialize(&self) -> VoiceResult<()> {
        let grpc_client = SignalingServiceClient::connect(self.grpc_url.clone()).await?;
        let mut client_guard = self.client.lock().await;
        *client_guard = Some(grpc_client);
        log::info!("Successfully connected to gRPC server");
        Ok(())
    }

    pub async fn close_signaling_stream(&self) -> VoiceResult<()> {
        *self.client.lock().await = None;
        *self.signaling_message_sender.lock().await = None;
        Ok(())
    }

    // ── Room management ─────────────────────────────────────────────────────

    pub async fn try_get_room(&self, session_id: String) -> VoiceResult<bool> {
        let mut guard = self.client.lock().await;
        let client = guard.as_mut().ok_or(VoiceError::Backend(
            "gRPC client not initialized".to_string(),
        ))?;
        let response = client
            .try_get_room(tonic::Request::new(TryGetRoomRequest { session_id }))
            .await?
            .into_inner();
        log::info!("Try get room: {:?}", response);
        Ok(response.exists)
    }

    pub async fn get_server_info(&self) -> VoiceResult<Vec<u8>> {
        let mut guard = self.client.lock().await;
        let client = guard.as_mut().ok_or(VoiceError::Backend(
            "gRPC client not initialized".to_string(),
        ))?;
        let response = client
            .get_server_info(tonic::Request::new(ServerInfoRequest {}))
            .await?
            .into_inner();
        Ok(response.server_identity)
    }

    pub async fn send_group_info_to_server(
        &self,
        room_id: String,
        group_info: Vec<u8>,
    ) -> VoiceResult<()> {
        let mut guard = self.client.lock().await;
        let client = guard.as_mut().ok_or(VoiceError::Backend(
            "gRPC client not initialized".to_string(),
        ))?;

        log::info!(
            "Sending group_info to server for room {}, size: {} bytes",
            room_id,
            group_info.len()
        );

        let request = echolocator::GetOrCreateRoomRequest {
            room_id: room_id.clone(),
            group_info,
        };
        match client.get_or_create_room(request).await {
            Ok(response) => {
                log::info!(
                    "Server observed group for room {}: created={}",
                    room_id,
                    response.into_inner().created
                );
                Ok(())
            }
            Err(e) => Err(VoiceError::Backend(format!(
                "Error sending group_info to server: {}",
                e
            ))),
        }
    }

    pub async fn join_room(&self, room_id: String, key_package: Vec<u8>) -> VoiceResult<Vec<u8>> {
        let mut guard = self.client.lock().await;
        let client = guard.as_mut().ok_or(VoiceError::Backend(
            "gRPC client not initialized".to_string(),
        ))?;

        log::info!("Joining room {} with key package", room_id);

        let request = echolocator::JoinRoomRequest {
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
                    Err(VoiceError::Backend(
                        "Server failed to join room".to_string(),
                    ))
                }
            }
            Err(e) => Err(VoiceError::Backend(format!("Error joining room: {}", e))),
        }
    }

    // ── Signaling stream setup ───────────────────────────────────────────────

    /// Initialises the bidirectional signaling stream and returns a receiver for
    /// incoming [`echolocator::ServerMessage`]s.
    ///
    /// The caller is responsible for consuming the receiver (typically by spawning
    /// [`VoiceHandler::process_stream`]). When the receiver is dropped the background
    /// forwarding task exits automatically.
    pub async fn init_signaling_stream(
        &self,
        room_id: String,
        rtp_capabilities: Option<String>,
    ) -> VoiceResult<mpsc::Receiver<echolocator::ServerMessage>> {
        let mut guard = self.client.lock().await;
        let client = guard.as_mut().ok_or(VoiceError::Backend(
            "gRPC client not initialized".to_string(),
        ))?;

        log::info!("Initialising signaling stream for room {}...", room_id);

        let (outbound_tx, outbound_rx) = mpsc::channel::<ClientMessage>(100);

        // Build the initial Init message
        let init_message = build_init_message(room_id.clone(), rtp_capabilities);

        outbound_tx
            .send(init_message)
            .await
            .map_err(|e| VoiceError::Backend(format!("Failed to send init message: {}", e)))?;

        // Persist the sender so callers can push outgoing messages later
        *self.signaling_message_sender.lock().await = Some(outbound_tx);

        let outbound_stream = ReceiverStream::new(outbound_rx);
        let mut inbound = client
            .signaling_stream(tonic::Request::new(outbound_stream))
            .await?
            .into_inner();

        log::info!("Signaling stream connected for room {}", room_id);

        // Spawn a thin forwarding task; all logic lives in VoiceHandler
        let (server_tx, server_rx) = mpsc::channel::<echolocator::ServerMessage>(100);
        tokio::spawn(async move {
            log::info!("Signaling forward task started for room {}", room_id);
            while let Some(msg) = inbound.next().await {
                match msg {
                    Ok(server_msg) => {
                        if server_tx.send(server_msg).await.is_err() {
                            log::info!("VoiceHandler receiver dropped — stopping forward task");
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("Signaling stream error: {}", e);
                        break;
                    }
                }
            }
            log::info!("Signaling forward task terminated for room {}", room_id);
        });

        Ok(server_rx)
    }

    // ── Send helpers ─────────────────────────────────────────────────────────

    pub async fn send_voice_message(&self, voice_id: String, data: Vec<u8>) -> VoiceResult<()> {
        log::info!(
            "Sending voice data: voice_id={}, size={} bytes",
            voice_id,
            data.len()
        );
        let message = ClientMessage {
            voice_request: Some(echolocator::client_message::VoiceRequest::VoiceData(
                echolocator::VoiceDataRequest { voice_id, data },
            )),
        };
        self.send_outbound(message).await
    }

    pub async fn send_client_commit(
        &self,
        voice_id: String,
        commit: Vec<u8>,
        welcome_message: Vec<u8>,
    ) -> VoiceResult<()> {
        log::info!("Sending client commit for voice_id={}", voice_id);
        let message = ClientMessage {
            voice_request: Some(echolocator::client_message::VoiceRequest::ClientCommit(
                echolocator::ClientCommitRequest {
                    voice_id,
                    commit,
                    welcome_message,
                },
            )),
        };
        self.send_outbound(message).await
    }

    pub async fn send_commit_ack(
        &self,
        commit_id: String,
        success: bool,
        error_message: Option<String>,
    ) -> VoiceResult<()> {
        log::info!("Sending commit ACK for commit_id={}", commit_id);
        let message = ClientMessage {
            voice_request: Some(echolocator::client_message::VoiceRequest::CommitAck(
                echolocator::CommitAckRequest {
                    commit_id,
                    success,
                    error_message: error_message.unwrap_or_default(),
                },
            )),
        };
        self.send_outbound(message).await
    }

    pub async fn send_signaling_message(&self, message: ClientMessage) -> VoiceResult<()> {
        log::info!("Sending signaling message: {:?}", message);
        self.send_outbound(message).await
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    async fn send_outbound(&self, message: ClientMessage) -> VoiceResult<()> {
        let guard = self.signaling_message_sender.lock().await;
        let sender = guard.as_ref().ok_or(VoiceError::Backend(
            "Signaling stream not initialised".to_string(),
        ))?;
        sender
            .send(message)
            .await
            .map_err(|e| VoiceError::Backend(format!("Failed to send message: {}", e)))
    }
}

// ── Free helpers ─────────────────────────────────────────────────────────────

fn build_init_message(room_id: String, rtp_capabilities: Option<String>) -> ClientMessage {
    let rtp_caps = rtp_capabilities
        .map(|json| echolocator::RtpCapabilities {
            codecs: vec![echolocator::RtpCodecCapability {
                kind: "audio".to_string(),
                mime_type: json,
                preferred_payload_type: None,
                clock_rate: 0,
                channels: None,
                parameters: HashMap::new(),
                rtcp_feedback: vec![],
            }],
            header_extensions: vec![],
        })
        .unwrap_or_else(|| echolocator::RtpCapabilities {
            codecs: vec![],
            header_extensions: vec![],
        });

    ClientMessage {
        voice_request: Some(echolocator::client_message::VoiceRequest::Init(
            echolocator::InitRequest {
                room_id,
                rtp_capabilities: Some(rtp_caps),
            },
        )),
    }
}
