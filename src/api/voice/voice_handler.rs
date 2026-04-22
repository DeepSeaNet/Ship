use mls_rs::MlsMessage;
use mls_rs::group::{Member, ReceivedMessage};
use mls_rs::identity::SigningIdentity;
use mls_rs_codec::MlsEncode;
use mls_rs_core::identity::BasicCredential;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::api::voice::connection::voice_connection::Backend;
use crate::api::voice::types::VoiceChannel;

#[derive(Clone)]
pub struct VoiceHandler {
    voice: Arc<RwLock<Option<VoiceChannel>>>,
    user_id: u64,
    identity: SigningIdentity,
    backend: Backend,
}

impl VoiceHandler {
    pub fn new(
        voice: Arc<RwLock<Option<VoiceChannel>>>,
        user_id: u64,
        identity: SigningIdentity,
        backend: Backend,
    ) -> Self {
        Self {
            voice,
            user_id,
            identity,
            backend,
        }
    }

    pub async fn process_voice_data(&self, user_id: u64, voice_id: String, data: Vec<u8>) {
        log::info!(
            "Processing voice data from user {} for voice_id {}, size: {} bytes",
            user_id,
            voice_id,
            data.len()
        );

        let voice_lock = self.voice.read().await;
        let voice = match voice_lock.as_ref() {
            Some(v) => v,
            None => {
                log::error!("No active voice session");
                return;
            }
        };

        if data.is_empty() {
            return;
        }

        let message_in = MlsMessage::from_bytes(data.as_slice());
        let message_in = match message_in {
            Ok(m) => m,
            Err(e) => {
                log::error!("Failed to deserialize MLS message: {}", e);
                return;
            }
        };

        let mut mls_group = voice.mls_group.write().await;
        let processed = mls_group.process_incoming_message(message_in);
        let processed_message = match processed {
            Ok(p) => p,
            Err(e) => {
                log::error!("Failed to process message: {}", e);
                return;
            }
        };

        log::info!("Processed message: {:?}", processed_message);

        if let ReceivedMessage::Commit(commit) = processed_message {
            if let Err(e) = mls_group.write_to_storage() {
                log::error!("Failed to write to storage: {}", e);
                return;
            }
            log::debug!(
                "Commit sended by {} with effect: {:#?}",
                commit.committer,
                commit.effect
            );
            let mut ratchet_manager = voice.voice_ratchet_manager.write().await;
            if let Err(e) = ratchet_manager
                .update_voice_ratchet(&mls_group, self.user_id)
                .await
            {
                log::error!("Failed to update voice ratchet: {:?}", e);
            }
        }
    }

    async fn send_voice_message(&self, message: Vec<u8>) -> Result<(), anyhow::Error> {
        let voice_id = {
            let lock = self.voice.read().await;
            lock.as_ref()
                .map(|v| v.voice_id.clone())
                .ok_or_else(|| anyhow::anyhow!("No active voice session"))?
        };
        self.backend.send_voice_message(voice_id, message).await
    }

    async fn find_member_index(&self, name: u64, group: &VoiceChannel) -> Result<Member, String> {
        let mls_group = group.mls_group.read().await;
        let member_identity = BasicCredential::new(name.to_le_bytes().to_vec());
        mls_group
            .member_with_identity(&member_identity.identifier)
            .map_err(|e| e.to_string())
    }

    pub fn create_voice_data_handler(
        self,
    ) -> Arc<dyn Fn(u64, String, Vec<u8>) + Send + Sync + 'static> {
        Arc::new(move |user_id, voice_id, data| {
            let handler_clone = self.clone();
            tokio::spawn(async move {
                handler_clone
                    .process_voice_data(user_id, voice_id, data)
                    .await;
            });
        })
    }

    pub fn create_mls_event_handler(
        current_voice: Arc<RwLock<Option<VoiceChannel>>>,
        backend: Backend,
        user_id: u64,
    ) -> Arc<dyn Fn(String, Vec<u8>, Option<String>) + Send + Sync + 'static> {
        Arc::new(move |voice_id, data, commit_id| {
            let current_voice = current_voice.clone();
            let backend = backend.clone();

            tokio::spawn(async move {
                if let Some(commit_id) = commit_id {
                    // This is a ServerCommit
                    log::info!(
                        "Processing server commit for voice_id: {}, commit_id: {}",
                        voice_id,
                        commit_id
                    );

                    let lock = current_voice.read().await;
                    if let Some(voice) = lock.as_ref() {
                        if voice.voice_id != voice_id {
                            log::warn!(
                                "Voice ID mismatch: expected {}, got {}",
                                voice.voice_id,
                                voice_id
                            );
                            return;
                        }

                        let mut group = voice.mls_group.write().await;
                        group.clear_pending_commit();
                        // Process the commit
                        match MlsMessage::from_bytes(&data) {
                            Ok(commit_msg) => {
                                match group.process_incoming_message(commit_msg) {
                                    Ok(_) => {
                                        // Send ACK to server
                                        if let Err(e) = backend
                                            .send_commit_ack(commit_id.clone(), true, None)
                                            .await
                                        {
                                            log::error!("Failed to send commit ACK: {}", e);
                                        } else {
                                            log::info!("Server commit processed successfully");
                                            if let Err(e) = group.write_to_storage() {
                                                log::error!("Failed to write to storage: {}", e);
                                                return;
                                            }
                                            let mut ratchet_manager =
                                                voice.voice_ratchet_manager.write().await;
                                            if let Err(e) = ratchet_manager
                                                .update_voice_ratchet(&group, user_id)
                                                .await
                                            {
                                                log::error!(
                                                    "Failed to update voice ratchet: {:?}",
                                                    e
                                                );
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        log::error!("Failed to process commit: {}", e);
                                        let _ = backend
                                            .send_commit_ack(commit_id, false, Some(e.to_string()))
                                            .await;
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to deserialize commit: {}", e);
                                let _ = backend
                                    .send_commit_ack(commit_id, false, Some(e.to_string()))
                                    .await;
                            }
                        }
                    } else {
                        log::warn!("No active voice session");
                    }
                } else {
                    // This is an AddProposal
                    log::info!("Processing add proposal for voice_id: {}", voice_id);

                    let lock = current_voice.read().await;
                    if let Some(voice) = lock.as_ref() {
                        if voice.voice_id != voice_id {
                            log::warn!(
                                "Voice ID mismatch: expected {}, got {}",
                                voice.voice_id,
                                voice_id
                            );
                            return;
                        }
                        let mut group = voice.mls_group.write().await;
                        // Process the proposal
                        match MlsMessage::from_bytes(&data) {
                            Ok(proposal_msg) => {
                                log::info!("Processing proposal: {:?}", proposal_msg);
                                match group.process_incoming_message(proposal_msg) {
                                    Ok(proposal) => {
                                        // Commit the proposal
                                        log::info!("Committing proposal: {:?}", proposal);
                                        match group.commit(Vec::new()) {
                                            Ok(commit_output) => {
                                                log::info!("Commit output: {:?}", commit_output);
                                                // Serialize commit and welcome message
                                                match commit_output
                                                    .commit_message
                                                    .mls_encode_to_vec()
                                                {
                                                    Ok(commit_bytes) => {
                                                        // Serialize welcome message if present
                                                        let welcome_bytes = if !commit_output
                                                            .welcome_messages
                                                            .is_empty()
                                                        {
                                                            match commit_output.welcome_messages[0]
                                                                .mls_encode_to_vec()
                                                            {
                                                                Ok(bytes) => {
                                                                    log::info!(
                                                                        "Successfully serialized welcome message"
                                                                    );
                                                                    bytes
                                                                }
                                                                Err(e) => {
                                                                    log::error!(
                                                                        "Failed to serialize welcome: {}",
                                                                        e
                                                                    );
                                                                    return;
                                                                }
                                                            }
                                                        } else {
                                                            log::error!(
                                                                "No welcome message in commit output"
                                                            );
                                                            return;
                                                        };

                                                        // Send commit to server (with or without welcome message)
                                                        // Wait for ServerCommitResponse before applying
                                                        if let Err(e) = backend
                                                            .send_client_commit(
                                                                voice_id.clone(),
                                                                commit_bytes,
                                                                welcome_bytes,
                                                            )
                                                            .await
                                                        {
                                                            log::error!(
                                                                "Failed to send client commit: {}",
                                                                e
                                                            );
                                                            group.clear_pending_commit();
                                                        } else {
                                                            log::info!(
                                                                "Client commit sent, waiting for server response"
                                                            );
                                                            // Commit will be applied when ServerCommitResponse is received
                                                        }
                                                    }
                                                    Err(e) => log::error!(
                                                        "Failed to serialize commit: {}",
                                                        e
                                                    ),
                                                }
                                            }
                                            Err(e) => {
                                                log::error!("Failed to commit proposal: {}", e)
                                            }
                                        }
                                    }
                                    Err(e) => log::error!("Failed to process proposal: {}", e),
                                }
                            }
                            Err(e) => log::error!("Failed to deserialize proposal: {}", e),
                        }
                    } else {
                        log::warn!("No active voice session");
                    }
                }
            });
        })
    }

    pub fn create_commit_response_handler(
        current_voice: Arc<RwLock<Option<VoiceChannel>>>,
        user_id: u64,
    ) -> Arc<dyn Fn(String, bool, String) + Send + Sync + 'static> {
        Arc::new(move |voice_id, accepted, error_message| {
            let current_voice = current_voice.clone();

            tokio::spawn(async move {
                log::info!(
                    "Processing commit response for voice_id: {}, accepted: {}",
                    voice_id,
                    accepted
                );

                let lock = current_voice.read().await;
                if let Some(voice) = lock.as_ref() {
                    if voice.voice_id != voice_id {
                        log::warn!(
                            "Voice ID mismatch: expected {}, got {}",
                            voice.voice_id,
                            voice_id
                        );
                        return;
                    }

                    let mut group = voice.mls_group.write().await;

                    if accepted {
                        // Server accepted the commit - apply it
                        log::info!("Server accepted commit, applying pending commit");

                        match group.apply_pending_commit() {
                            Ok(_) => {
                                if let Err(e) = group.write_to_storage() {
                                    log::error!("Failed to write to storage: {}", e);
                                    return;
                                }

                                // Update ratchet manager
                                let mut ratchet_manager = voice.voice_ratchet_manager.write().await;
                                if let Err(e) =
                                    ratchet_manager.update_voice_ratchet(&group, user_id).await
                                {
                                    log::error!("Failed to update voice ratchet: {:?}", e);
                                } else {
                                    log::info!("Commit applied successfully");
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to apply pending commit: {}", e);
                            }
                        }
                    } else {
                        // Server rejected the commit - clear pending state
                        log::warn!("Server rejected commit: {}", error_message);
                        group.clear_pending_commit();
                        log::info!("Cleared pending commit and proposal cache");
                    }
                } else {
                    log::warn!("No active voice session");
                }
            });
        })
    }
}
