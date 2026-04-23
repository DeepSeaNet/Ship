use mls_rs::MlsMessage;
use mls_rs::group::{Member, ReceivedMessage};
use mls_rs::identity::SigningIdentity;
use mls_rs_codec::MlsEncode;
use mls_rs_core::identity::BasicCredential;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;
use tokio::sync::mpsc;

use crate::api::voice::connection::echolocator;
use crate::api::voice::connection::voice_connection::Backend;
use crate::api::voice::types::VoiceChannel;
use crate::api::voice::{VoiceError, VoiceResult};
use crate::commands::events::{emit_voice_server_commit, emit_voice_signaling_message};

#[derive(Clone)]
struct VoiceEvent {
    voice_id: String,
    event: Event,
}

#[derive(Clone)]
enum Event {
    Commit(Vec<u8>, String),
    Proposal(Vec<u8>),
}

/// Owns all MLS voice-session logic: incoming message dispatch, MLS state updates,
/// ratchet key rotation and Tauri event emission.
///
/// Lifecycle:
/// 1. Created after `Backend::init_signaling_stream` succeeds.
/// 2. `process_stream` is spawned in a task; it loops until the channel closes.
/// 3. `Backend` is used only for outbound sends (`send_client_commit`, `send_commit_ack`, …).
pub struct VoiceHandler {
    voice: Arc<RwLock<Option<VoiceChannel>>>,
    user_id: u64,
    identity: SigningIdentity,
    backend: Backend,
    app_handle: Option<AppHandle>,
}

impl VoiceHandler {
    pub fn new(
        voice: Arc<RwLock<Option<VoiceChannel>>>,
        user_id: u64,
        identity: SigningIdentity,
        backend: Backend,
        app_handle: Option<AppHandle>,
    ) -> Self {
        Self {
            voice,
            user_id,
            identity,
            backend,
            app_handle,
        }
    }

    // ── Public entry point ────────────────────────────────────────────────────

    /// Main message loop. Spawn this in a `tokio::spawn` after calling
    /// `Backend::init_signaling_stream`:
    ///
    /// ```ignore
    /// let rx = backend.init_signaling_stream(room_id, rtp_caps).await?;
    /// let handler = VoiceHandler::new(...);
    /// tokio::spawn(async move { handler.process_stream(rx).await; });
    /// ```
    pub async fn process_stream(&self, mut rx: mpsc::Receiver<echolocator::ServerMessage>) {
        log::info!("VoiceHandler: stream processing started");

        while let Some(server_msg) = rx.recv().await {
            self.dispatch(server_msg).await;
        }

        log::info!("VoiceHandler: stream closed");
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    async fn dispatch(&self, server_msg: echolocator::ServerMessage) {
        use echolocator::server_message::VoiceResponse;

        if let Some(ref response) = server_msg.voice_response {
            match response {
                VoiceResponse::VoiceData(d) => {
                    log::debug!(
                        "Received voice data: user_id={}, voice_id={}, size={} bytes",
                        d.user_id,
                        d.voice_id,
                        d.data.len()
                    );
                    self.process_voice_data(d.user_id, d.voice_id.clone(), d.data.clone())
                        .await;
                    return; // voice data is not re-emitted as a signaling message
                }

                VoiceResponse::AddProposal(p) => {
                    log::info!("Received AddProposal for voice_id={}", p.voice_id);
                    let event = VoiceEvent {
                        voice_id: p.voice_id.clone(),
                        event: Event::Proposal(p.proposal.clone()),
                    };
                    self.handle_mls_event(event).await;
                    return;
                }

                VoiceResponse::ServerCommit(c) => {
                    log::info!(
                        "Received ServerCommit for voice_id={}, commit_id={}",
                        c.voice_id,
                        c.commit_id
                    );
                    let event = VoiceEvent {
                        voice_id: c.voice_id.clone(),
                        event: Event::Commit(c.commit.clone(), c.commit_id.clone()),
                    };
                    self.handle_mls_event(event).await;
                    if let Some(app_handle) = &self.app_handle
                        && let Err(e) = emit_voice_server_commit(
                            app_handle,
                            c.voice_id.clone(),
                            c.commit_id.clone(),
                        )
                        .await
                    {
                        log::error!("Failed to emit voice-server-commit event: {}", e);
                    }
                    return;
                }

                VoiceResponse::ServerCommitResponse(r) => {
                    log::info!(
                        "Received ServerCommitResponse for voice_id={}, accepted={}",
                        r.voice_id,
                        r.accepted
                    );
                    self.handle_commit_response(
                        r.voice_id.clone(),
                        r.accepted,
                        r.error_message.clone(),
                    )
                    .await;
                    if r.accepted
                        && let Some(app_handle) = &self.app_handle
                        && let Err(e) = emit_voice_server_commit(
                            app_handle,
                            r.voice_id.clone(),
                            r.commit_id.clone(),
                        )
                        .await
                    {
                        log::error!("Failed to emit voice-server-commit event: {}", e);
                    }
                    return;
                }

                _ => {
                    // Other variants fall through to the generic signaling emit below
                }
            }
        }

        // Forward remaining messages (WebRTC signaling etc.) to the frontend
        if let Some(app_handle) = &self.app_handle
            && let Err(e) = emit_voice_signaling_message(app_handle, server_msg).await
        {
            log::error!("Failed to emit signaling message: {}", e);
        }
    }

    // ── Voice data ────────────────────────────────────────────────────────────

    async fn process_voice_data(&self, user_id: u64, voice_id: String, data: Vec<u8>) {
        if data.is_empty() {
            return;
        }

        let voice_lock = self.voice.read().await;
        let voice = match voice_lock.as_ref() {
            Some(v) => v,
            None => {
                log::error!("process_voice_data: no active voice session");
                return;
            }
        };

        if voice.voice_id != voice_id {
            log::warn!(
                "process_voice_data: voice_id mismatch (expected {}, got {})",
                voice.voice_id,
                voice_id
            );
            return;
        }

        let message_in = match MlsMessage::from_bytes(data.as_slice()) {
            Ok(m) => m,
            Err(e) => {
                log::error!("Failed to deserialise MLS message: {e}");
                return;
            }
        };

        let mut mls_group = voice.mls_group.write().await;
        let processed = match mls_group.process_incoming_message(message_in) {
            Ok(p) => p,
            Err(e) => {
                log::error!("Failed to process voice MLS message: {e}");
                return;
            }
        };

        log::info!("process_voice_data from user {}: {:?}", user_id, processed);

        if let ReceivedMessage::Commit(commit) = processed {
            if let Err(e) = mls_group.write_to_storage() {
                log::error!("Failed to write to storage: {e}");
                return;
            }
            log::debug!(
                "Commit by {} — effect: {:#?}",
                commit.committer,
                commit.effect
            );
            let mut ratchet_manager = voice.voice_ratchet_manager.write().await;
            if let Err(e) = ratchet_manager
                .update_voice_ratchet(&mls_group, self.user_id)
                .await
            {
                log::error!("Failed to update voice ratchet: {e:?}");
            }
        }
    }

    // ── MLS events (AddProposal / ServerCommit) ───────────────────────────────

    async fn handle_mls_event(&self, event: VoiceEvent) {
        let lock = self.voice.read().await;
        let voice = match lock.as_ref() {
            Some(v) => v,
            None => {
                log::warn!("handle_mls_event: no active voice session");
                return;
            }
        };

        if voice.voice_id != event.voice_id {
            log::warn!(
                "handle_mls_event: voice_id mismatch (expected {}, got {})",
                voice.voice_id,
                event.voice_id
            );
            return;
        }

        match event.event {
            Event::Commit(data, commit_id) => {
                self.handle_server_commit(voice, &data, commit_id).await;
            }
            Event::Proposal(data) => {
                self.handle_proposal(voice, &event.voice_id, &data).await;
            }
        }
    }

    /// Applies a commit received from the server (external committer path).
    async fn handle_server_commit(&self, voice: &VoiceChannel, data: &[u8], commit_id: String) {
        log::info!("Applying ServerCommit commit_id={commit_id}");

        let mut group = voice.mls_group.write().await;
        group.clear_pending_commit();

        let commit_msg = match MlsMessage::from_bytes(data) {
            Ok(m) => m,
            Err(e) => {
                log::error!("Failed to deserialise server commit: {e}");
                let _ = self
                    .backend
                    .send_commit_ack(commit_id, false, Some(e.to_string()))
                    .await;
                return;
            }
        };

        match group.process_incoming_message(commit_msg) {
            Ok(_) => {
                if let Err(e) = self
                    .backend
                    .send_commit_ack(commit_id.clone(), true, None)
                    .await
                {
                    log::error!("Failed to send commit ACK: {e}");
                    return;
                }
                if let Err(e) = group.write_to_storage() {
                    log::error!("Failed to write to storage: {e}");
                    return;
                }
                let mut ratchet = voice.voice_ratchet_manager.write().await;
                if let Err(e) = ratchet.update_voice_ratchet(&group, self.user_id).await {
                    log::error!("Failed to update voice ratchet: {e:?}");
                } else {
                    log::info!("ServerCommit applied successfully (commit_id={commit_id})");
                }
            }
            Err(e) => {
                log::error!("Failed to process ServerCommit: {e}");
                let _ = self
                    .backend
                    .send_commit_ack(commit_id, false, Some(e.to_string()))
                    .await;
            }
        }
    }

    /// Processes an Proposal and sends the resulting commit to the server.
    async fn handle_proposal(&self, voice: &VoiceChannel, voice_id: &str, data: &[u8]) {
        log::info!("Processing Proposal for voice_id={voice_id}");

        let mut group = voice.mls_group.write().await;

        let proposal_msg = match MlsMessage::from_bytes(data) {
            Ok(m) => m,
            Err(e) => {
                log::error!("Failed to deserialise proposal: {}", e);
                return;
            }
        };

        let proposal = match group.process_incoming_message(proposal_msg) {
            Ok(p) => p,
            Err(e) => {
                log::error!("Failed to process Proposal: {}", e);
                return;
            }
        };

        log::info!("Committing proposal: {:?}", proposal);

        let commit_output = match group.commit(Vec::new()) {
            Ok(o) => o,
            Err(e) => {
                log::error!("Failed to commit proposal: {}", e);
                return;
            }
        };

        let commit_bytes = match commit_output.commit_message.mls_encode_to_vec() {
            Ok(b) => b,
            Err(e) => {
                log::error!("Failed to serialise commit: {}", e);
                return;
            }
        };

        let welcome_bytes = match commit_output.welcome_messages.first() {
            Some(w) => match w.mls_encode_to_vec() {
                Ok(b) => b,
                Err(e) => {
                    log::error!("Failed to serialise welcome message: {}", e);
                    return;
                }
            },
            None => {
                log::error!("No welcome message in commit output");
                return;
            }
        };

        if let Err(e) = self
            .backend
            .send_client_commit(voice_id.to_string(), commit_bytes, welcome_bytes)
            .await
        {
            log::error!("Failed to send client commit: {}", e);
            group.clear_pending_commit();
        } else {
            log::info!("Client commit sent — waiting for ServerCommitResponse");
        }
    }

    // ── Commit response (ServerCommitResponse) ────────────────────────────────

    async fn handle_commit_response(
        &self,
        voice_id: String,
        accepted: bool,
        error_message: String,
    ) {
        let lock = self.voice.read().await;
        let voice = match lock.as_ref() {
            Some(v) => v,
            None => {
                log::warn!("handle_commit_response: no active voice session");
                return;
            }
        };

        if voice.voice_id != voice_id {
            log::warn!(
                "handle_commit_response: voice_id mismatch (expected {}, got {})",
                voice.voice_id,
                voice_id
            );
            return;
        }

        let mut group = voice.mls_group.write().await;

        if accepted {
            log::info!("Server accepted commit — applying pending commit");
            match group.apply_pending_commit() {
                Ok(_) => {
                    if let Err(e) = group.write_to_storage() {
                        log::error!("Failed to write to storage: {e}");
                        return;
                    }
                    let mut ratchet = voice.voice_ratchet_manager.write().await;
                    if let Err(e) = ratchet.update_voice_ratchet(&group, self.user_id).await {
                        log::error!("Failed to update voice ratchet: {e:?}");
                    } else {
                        log::info!("Pending commit applied successfully");
                    }
                }
                Err(e) => log::error!("Failed to apply pending commit: {e}"),
            }
        } else {
            log::warn!("Server rejected commit: {error_message}");
            group.clear_pending_commit();
            log::info!("Pending commit cleared");
        }
    }

    // ── Misc helpers ──────────────────────────────────────────────────────────

    pub async fn send_voice_message(&self, message: Vec<u8>) -> VoiceResult<()> {
        let voice_id = {
            let lock = self.voice.read().await;
            lock.as_ref()
                .map(|v| v.voice_id.clone())
                .ok_or(VoiceError::NoActiveSession)?
        };
        self.backend.send_voice_message(voice_id, message).await
    }

    async fn find_member_index(&self, name: u64, group: &VoiceChannel) -> VoiceResult<Member> {
        let mls_group = group.mls_group.read().await;
        let member_identity = BasicCredential::new(name.to_le_bytes().to_vec());
        mls_group
            .member_with_identity(&member_identity.identifier)
            .map_err(VoiceError::Mls)
    }
}
