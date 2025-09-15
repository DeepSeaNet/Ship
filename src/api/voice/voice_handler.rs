use mls_rs::MlsMessage;
use mls_rs::group::{Member, ReceivedMessage};
use mls_rs::identity::SigningIdentity;
use mls_rs_codec::MlsEncode;
use mls_rs_core::identity::BasicCredential;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::api::voice::connection::voice_connection::Backend;
use crate::api::voice::types::basic_types::Voice;
use crate::api::voice::types::client_messages::*;

pub struct VoiceHandler {
    voice: Arc<RwLock<Option<Voice>>>,
    user_id: u64,
    identity: SigningIdentity,
    backend: Backend,
}

impl VoiceHandler {
    pub fn new(
        voice: Arc<RwLock<Option<Voice>>>,
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

    pub async fn process_message(
        &self,
        voice_message: crate::api::voice::grpc_generated::echolocator::VoiceMessage,
    ) {
        let sender_id = voice_message.user_id;
        let message_data = voice_message.message;

        log::info!(
            "Processing voice message from user {}, size: {} bytes",
            sender_id,
            message_data.len()
        );

        let voice_lock = self.voice.read().await;
        let voice = voice_lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No active voice session"))
            .unwrap();

        if message_data.is_empty() {
            return;
        }

        let message_in = MlsMessage::from_bytes(message_data.as_slice());
        let message_in = match message_in {
            Ok(m) => m,
            Err(e) => {
                log::error!("Failed to deserialize MLS message: {}", e);
                return;
            }
        };

        let mut mls_group = voice.mls_group.write().await;
        let processed = mls_group.process_incoming_message(message_in).await;
        let processed_message = match processed {
            Ok(p) => p,
            Err(e) => {
                log::error!("Failed to process message: {}", e);
                return;
            }
        };

        log::info!("Processed message: {:?}", processed_message);

        if let ReceivedMessage::Commit(commit) = processed_message {
            mls_group.write_to_storage().await.unwrap();
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
        self.backend
            .send_voice_message(self.user_id, voice_id, message)
            .await
    }

    async fn find_member_index(&self, name: u64, group: &Voice) -> Result<Member, String> {
        let mls_group = group.mls_group.read().await;
        let member_identity = BasicCredential::new(name.to_le_bytes().to_vec());
        mls_group
            .member_with_identity(&member_identity.identifier)
            .await
            .map_err(|e| e.to_string())
    }

    async fn process_remove_user_message(
        &self,
        remove_user_message: RemoveUserMessage,
    ) -> Result<(), anyhow::Error> {
        log::info!("Received remove user message: {:?}", remove_user_message);
        let voice_lock = self.voice.read().await;
        let voice = voice_lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No active voice session"))?;

        let mut voice_mls_group = voice.mls_group.write().await;

        if let Ok(member) = self
            .find_member_index(remove_user_message.user_id, voice)
            .await
        {
            let mut commit_builder = voice_mls_group.commit_builder();
            commit_builder = commit_builder.remove_member(member.index)?;

            let commit = commit_builder
                .build()
                .await
                .map_err(|e| anyhow::anyhow!("Failed to build commit: {}", e))?;

            let leave_message_bytes = commit
                .commit_message
                .mls_encode_to_vec()
                .map_err(|e| anyhow::anyhow!("Failed to serialize leave message: {}", e))?;

            let _ = self.send_voice_message(leave_message_bytes).await;
        }

        Ok(())
    }

    pub fn create_handler(
        &self,
    ) -> impl Fn(crate::api::voice::grpc_generated::echolocator::VoiceMessage) + Send + Sync + 'static
    {
        let voice = self.voice.clone();
        let user_id = self.user_id;
        let identity = self.identity.clone();
        let backend = self.backend.clone();

        move |voice_message| {
            let voice_clone = voice.clone();
            let identity_clone = identity.clone();
            let backend_clone = backend.clone();

            tokio::spawn(async move {
                let handler =
                    VoiceHandler::new(voice_clone, user_id, identity_clone, backend_clone);
                handler.process_message(voice_message).await;
            });
        }
    }
}
