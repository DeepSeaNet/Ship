use serde::Serialize;
use std::collections::HashMap;
use std::convert::TryInto;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::config::RatchetConfig;
use super::constants::AES_KEY_SIZE;
use super::error::RatchetError;
use super::receiver::ReceiverRatchet;
use super::sender::SenderRatchet;
use crate::api::voice::types::basic_types::{EXPORT_SECRET_LABEL, EXPORT_SECRET_LENGTH};
use crate::api::voice::voice_user::MlsGroup;

// ── Key-material export types ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ReceiverKeyInfo {
    pub user_id: u64,
    pub public_key: Vec<u8>,
    /// epoch → raw MLS-exported base secret (16 bytes).
    pub epoch_secrets: HashMap<u32, Vec<u8>>,
    pub current_epoch: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct VoiceKeysPayload {
    /// Current ratchet secret for the sender (32 bytes).
    /// TypeScript calls deriveInitialSecret() only once (at epoch start);
    /// after that it reconstructs from this 32-byte value + generation.
    pub sender_secret: Vec<u8>,
    pub sender_public_key: Vec<u8>,
    pub sender_user_id: u64,
    pub sender_epoch: u32,
    /// Generation the TypeScript ratchet should start from.
    pub sender_generation: u32,
    pub group_epoch: u64,
    pub receivers: Vec<ReceiverKeyInfo>,
}

// ── GroupRatchetManager ───────────────────────────────────────────────────────

pub struct GroupRatchetManager {
    sender_ratchet: Arc<RwLock<SenderRatchet>>,
    receiver_ratchets: Arc<RwLock<HashMap<u64, Arc<RwLock<ReceiverRatchet>>>>>,
    config: RatchetConfig,
    group_epoch: u64,
}

impl GroupRatchetManager {
    pub fn new(
        sender_base_secret: [u8; AES_KEY_SIZE],
        public_key: Vec<u8>,
        user_id: u64,
        config: Option<RatchetConfig>,
        group_epoch: u64,
    ) -> Self {
        let config = config.unwrap_or_default();
        let sender = SenderRatchet::new(&sender_base_secret, public_key, user_id, group_epoch);
        Self {
            sender_ratchet: Arc::new(RwLock::new(sender)),
            receiver_ratchets: Arc::new(RwLock::new(HashMap::new())),
            config,
            group_epoch,
        }
    }

    // ── Participant management ────────────────────────────────────────────────

    pub async fn add_participant(
        &mut self,
        user_id: u64,
        public_key: Vec<u8>,
        base_secret: Option<[u8; AES_KEY_SIZE]>,
    ) -> Result<(), RatchetError> {
        let epoch = self.group_epoch;
        {
            let guard = self.receiver_ratchets.read().await;
            if guard.contains_key(&user_id) {
                drop(guard);
                if let Some(s) = base_secret {
                    self.update_receiver_epoch_secret(user_id, epoch, s).await?;
                }
                return Ok(());
            }
        }
        let secret = base_secret.ok_or(RatchetError::MissingSharedSecret)?;
        let mut r = ReceiverRatchet::new(
            &secret,
            public_key,
            user_id,
            Some(self.config.clone()),
            epoch,
        );
        r.add_epoch_secret(epoch as u32, secret);
        self.receiver_ratchets
            .write()
            .await
            .insert(user_id, Arc::new(RwLock::new(r)));
        Ok(())
    }

    // ── Epoch management ──────────────────────────────────────────────────────

    pub async fn update_group_epoch(&mut self, epoch: u64) {
        self.group_epoch = epoch;
    }

    pub async fn update_sender_epoch(&mut self, new_base: &[u8; AES_KEY_SIZE], epoch: u64) {
        self.sender_ratchet
            .write()
            .await
            .update_epoch(new_base, epoch);
    }

    pub async fn update_receiver_epoch_secret(
        &self,
        user_id: u64,
        epoch: u64,
        secret: [u8; AES_KEY_SIZE],
    ) -> Result<(), RatchetError> {
        let guard = self.receiver_ratchets.read().await;
        let lock = guard.get(&user_id).ok_or_else(|| {
            RatchetError::DecryptError(format!("Receiver not found for user {}", user_id))
        })?;
        lock.write().await.add_epoch_secret(epoch as u32, secret);
        Ok(())
    }

    // ── MLS export ────────────────────────────────────────────────────────────

    /// DAVE §Sender Key Derivation:
    ///   sender_base_secret = MLS-Exporter("Discord Secure Frames v0", LE(user_id), 16)
    pub async fn export_secret(
        &self,
        voice: &MlsGroup,
        user_id_le_bytes: &[u8],
    ) -> Result<[u8; EXPORT_SECRET_LENGTH], RatchetError> {
        let s = voice
            .export_secret(
                EXPORT_SECRET_LABEL.as_bytes(),
                user_id_le_bytes,
                EXPORT_SECRET_LENGTH,
            )
            .await
            .map_err(|e| RatchetError::ExportError(e.to_string()))?;
        s.as_bytes()
            .try_into()
            .map_err(|_| RatchetError::ExportError("Secret length mismatch".into()))
    }

    /// Refreshes all ratchet state after an MLS epoch transition.
    pub async fn update_voice_ratchet(
        &mut self,
        voice: &MlsGroup,
        local_user_id: u64,
    ) -> Result<(), RatchetError> {
        let group_epoch = voice.context().epoch;
        log::info!(
            "update_voice_ratchet: user={} epoch={}",
            local_user_id,
            group_epoch
        );

        self.update_group_epoch(group_epoch).await;

        let sender_secret = self
            .export_secret(voice, &local_user_id.to_le_bytes())
            .await?;
        self.update_sender_epoch(&sender_secret, group_epoch).await;

        for member in voice.roster().members() {
            let credential = member
                .signing_identity
                .credential
                .as_basic()
                .unwrap()
                .clone();
            let id_bytes = credential.identifier;
            let member_id = u64::from_le_bytes(
                id_bytes
                    .clone()
                    .try_into()
                    .map_err(|_| RatchetError::ExportError("Invalid member ID".into()))?,
            );
            log::debug!(
                "update_voice_ratchet: member={} epoch={}",
                member_id,
                group_epoch
            );
            let secret = self.export_secret(voice, &id_bytes).await?;
            self.add_participant(
                member_id,
                member.signing_identity.signature_key.to_vec(),
                Some(secret),
            )
            .await?;
        }
        Ok(())
    }

    // ── Key material export ───────────────────────────────────────────────────

    pub async fn export_key_material(&self) -> VoiceKeysPayload {
        let sender = self.sender_ratchet.read().await;

        let receivers = {
            let guard = self.receiver_ratchets.read().await;
            let mut out = Vec::with_capacity(guard.len());
            for lock in guard.values() {
                let r = lock.read().await;
                let epoch_secrets = r
                    .epoch_secrets()
                    .iter()
                    .map(|(&k, v)| (k, v.to_vec()))
                    .collect();
                out.push(ReceiverKeyInfo {
                    user_id: r.sender_id(),
                    public_key: r.sender_public_key().to_vec(),
                    epoch_secrets,
                    current_epoch: r.current_epoch(),
                });
            }
            out
        };

        VoiceKeysPayload {
            sender_secret: sender.secret().to_vec(),
            sender_public_key: sender.public_key().to_vec(),
            sender_user_id: sender.user_id(),
            sender_epoch: sender.current_epoch(),
            sender_generation: sender.generation(),
            group_epoch: self.group_epoch,
            receivers,
        }
    }
}
