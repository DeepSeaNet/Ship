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

/// Менеджер рачет-ключей для группового общения
pub struct GroupRatchetManager {
    // Храповик для отправки сообщений
    sender_ratchet: Arc<RwLock<SenderRatchet>>,

    // Храповики для приема сообщений от других участников
    receiver_ratchets: Arc<RwLock<HashMap<u64, Arc<RwLock<ReceiverRatchet>>>>>,

    // Конфигурация
    config: RatchetConfig,

    group_epoch: u64,
}

impl GroupRatchetManager {
    /// Создает нового менеджера рачет-ключей
    pub fn new(
        shared_secret: [u8; AES_KEY_SIZE],
        public_key: Vec<u8>,
        user_id: u64,
        config: Option<RatchetConfig>,
        group_epoch: u64,
    ) -> Self {
        let config = config.unwrap_or_default();
        let sender_ratchet = SenderRatchet::new(&shared_secret, public_key, user_id, group_epoch);

        Self {
            sender_ratchet: Arc::new(RwLock::new(sender_ratchet)),
            receiver_ratchets: Arc::new(RwLock::new(HashMap::new())),
            config,
            group_epoch,
        }
    }

    /// Шифрует сообщение для отправки группе
    pub async fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>, RatchetError> {
        let mut sender_ratchet = self.sender_ratchet.write().await;
        sender_ratchet.encrypt(plaintext)
    }

    /// Добавляет участника группы
    pub async fn add_participant(
        &mut self,
        user_id: u64,
        public_key: Vec<u8>,
        initial_secret: Option<[u8; AES_KEY_SIZE]>,
    ) -> Result<(), RatchetError> {
        let current_group_epoch = self.group_epoch;

        // Check if participant exists
        let receiver_ratchets_guard = self.receiver_ratchets.read().await;
        if receiver_ratchets_guard.get(&user_id).is_some() {
            if let Some(secret) = initial_secret {
                self.update_receiver_epoch_secret(user_id, current_group_epoch, secret)
                    .await?;
            }
            Ok(()) // Participant updated or already exists
        } else {
            // Participant does not exist, create a new one
            // Drop the write guard before potentially blocking on new receiver creation
            drop(receiver_ratchets_guard);

            // Проверяем, что начальный секрет предоставлен for new participant
            let shared_secret = match initial_secret {
                Some(secret) => secret,
                None => return Err(RatchetError::MissingSharedSecret), // Cannot create without initial secret
            };

            let mut receiver = ReceiverRatchet::new(
                &shared_secret,
                public_key,
                user_id,
                Some(self.config.clone()),
                current_group_epoch,
            );

            // Add epoch secret explicitly (though `new` already does it for the initial epoch)
            receiver.add_epoch_secret(current_group_epoch as u32, shared_secret);

            // Re-acquire write lock to insert the new receiver
            self.receiver_ratchets
                .write()
                .await
                .insert(user_id, Arc::new(RwLock::new(receiver)));
            Ok(())
        }
    }

    pub async fn update_group_epoch(&mut self, group_epoch: u64) {
        self.group_epoch = group_epoch;
    }

    /// Обновляет эпох для отправителя
    pub async fn update_sender_epoch(&mut self, new_secret: &[u8; AES_KEY_SIZE], group_epoch: u64) {
        let mut sender_ratchet = self.sender_ratchet.write().await;
        sender_ratchet.update_epoch(new_secret, group_epoch);
    }

    pub async fn export_secret(
        &self,
        voice: &MlsGroup,
        user_id: &[u8],
    ) -> Result<[u8; EXPORT_SECRET_LENGTH], RatchetError> {
        let secret = voice
            .export_secret(
                EXPORT_SECRET_LABEL.as_bytes(),
                user_id,
                EXPORT_SECRET_LENGTH,
            )
            .await
            .unwrap();

        let secret_array: [u8; EXPORT_SECRET_LENGTH] = secret
            .as_bytes()
            .try_into()
            .expect("Secret must be exactly 16 bytes");

        Ok(secret_array)
    }

    pub async fn update_voice_ratchet(
        &mut self,
        voice: &MlsGroup,
        user_id: u64,
    ) -> Result<(), RatchetError> {
        let group_epoch = voice.context().epoch;
        self.update_group_epoch(group_epoch).await;
        let sender_secret = self.export_secret(voice, &user_id.to_le_bytes()).await?;
        self.update_sender_epoch(&sender_secret, group_epoch).await;

        for member in voice.roster().members() {
            let credential = member
                .signing_identity
                .credential
                .as_basic()
                .unwrap()
                .clone();
            let member_id_bytes = credential.identifier;
            let member_id = u64::from_le_bytes(member_id_bytes.clone().try_into().unwrap());

            let secret = self.export_secret(voice, &member_id_bytes).await?;
            self.add_participant(
                member_id,
                member.signing_identity.signature_key.to_vec(),
                Some(secret),
            )
            .await?;
        }
        Ok(())
    }

    /// Обновляет секрет эпохи для конкретного получателя
    pub async fn update_receiver_epoch_secret(
        &self,
        user_id: u64,
        epoch: u64,
        secret: [u8; AES_KEY_SIZE],
    ) -> Result<(), RatchetError> {
        let receiver_ratchets = self.receiver_ratchets.read().await;
        if let Some(receiver_lock) = receiver_ratchets.get(&user_id) {
            let mut receiver = receiver_lock.write().await;
            receiver.add_epoch_secret(epoch as u32, secret);
            Ok(())
        } else {
            Err(RatchetError::DecryptError(
                "Receiver ratchet not found".into(),
            ))
        }
    }

    /// Simplified decrypt method
    pub async fn decrypt(&self, ciphertext: &[u8]) -> Result<Vec<u8>, RatchetError> {
        if ciphertext.len() < 4 {
            // Need at least key_len
            return Err(RatchetError::InvalidFormat);
        }

        // Extract header info
        let key_len = u32::from_le_bytes(ciphertext[0..4].try_into().unwrap()) as usize;
        let min_len = 4 + key_len + 8 + 4 + 4; // key_len + key + user_id + epoch + generation
        if ciphertext.len() < min_len {
            // Ensure enough bytes for header before nonce/ciphertext
            return Err(RatchetError::InvalidFormat);
        }

        let sender_id_offset = 4 + key_len;
        let sender_id = u64::from_le_bytes(
            ciphertext[sender_id_offset..sender_id_offset + 8]
                .try_into()
                .unwrap(),
        );

        // Get the appropriate receiver
        let receiver_ratchets = self.receiver_ratchets.read().await;
        let receiver_lock = receiver_ratchets.get(&sender_id).ok_or_else(|| {
            RatchetError::DecryptError(format!("Sender ratchet for user {} not found", sender_id))
        })?;

        // Clone Arc to drop the read lock on the map before acquiring write lock on the receiver
        let receiver_lock_clone = Arc::clone(receiver_lock);
        drop(receiver_ratchets);

        // Let the receiver handle the rest
        let mut receiver = receiver_lock_clone.write().await;
        receiver.decrypt(ciphertext)
    }
}
