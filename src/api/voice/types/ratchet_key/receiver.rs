use aes_gcm::{Aes128Gcm, KeyInit, Nonce, aead::Aead};
use hkdf::Hkdf;
use sha2::Sha256;
use std::collections::HashMap;
use std::convert::TryInto;

use super::config::RatchetConfig;
use super::constants::{AES_KEY_SIZE, MAX_SKIP, NONCE_SIZE};
use super::epoch_keys::EpochKeys;
use super::error::RatchetError;

/// Приемник для дешифровки сообщений
pub struct ReceiverRatchet {
    // Текущий эпох и ключи для каждого эпоха
    current_epoch: u32,
    epoch_keys: HashMap<u32, EpochKeys>,
    // Публичный ключ отправителя
    sender_public_key: Vec<u8>,
    // ID отправителя
    sender_id: u64,
    // Конфигурация
    config: RatchetConfig,
    // New field to store epoch secrets
    epoch_secrets: HashMap<u32, [u8; AES_KEY_SIZE]>,
}

impl ReceiverRatchet {
    /// Создает новый храповик получателя
    pub fn new(
        shared_secret: &[u8; AES_KEY_SIZE],
        sender_public_key: Vec<u8>,
        sender_id: u64,
        config: Option<RatchetConfig>,
        group_epoch: u64,
    ) -> Self {
        // Выводим начальные ключи
        let hk = Hkdf::<Sha256>::new(None, shared_secret);
        let mut derived_keys = [0u8; AES_KEY_SIZE * 2];
        hk.expand(b"SenderRatchetInit", &mut derived_keys)
            .expect("HKDF expand should work with this size");

        let root_key = derived_keys[0..AES_KEY_SIZE].try_into().unwrap();
        let chain_key = derived_keys[AES_KEY_SIZE..].try_into().unwrap();

        let initial_keys = EpochKeys {
            root_key,
            chain_key,
            generation: 0,
            skipped_keys: HashMap::new(),
        };

        let mut epoch_keys = HashMap::new();
        epoch_keys.insert(group_epoch as u32, initial_keys); // Use group_epoch as the initial epoch key

        // Initialize epoch_secrets with the initial secret for the group_epoch
        let mut epoch_secrets = HashMap::new();
        epoch_secrets.insert(group_epoch as u32, *shared_secret);

        Self {
            current_epoch: group_epoch as u32,
            epoch_keys,
            sender_public_key,
            sender_id,
            config: config.unwrap_or_default(),
            epoch_secrets,
        }
    }

    /// Выводит ключ сообщения для указанного эпоха и поколения
    fn derive_message_key(
        &mut self,
        epoch: u32,
        target_generation: u32,
    ) -> Result<[u8; AES_KEY_SIZE], RatchetError> {
        // Проверяем, есть ли у нас ключи для этого эпоха
        let epoch_keys = match self.epoch_keys.get_mut(&epoch) {
            Some(keys) => keys,
            None => return Err(RatchetError::EpochNotFound),
        };

        // Если поколение меньше текущего, ищем в пропущенных ключах
        if target_generation < epoch_keys.generation {
            match epoch_keys.skipped_keys.remove(&target_generation) {
                Some(key) => return Ok(key),
                None => {
                    return Err(RatchetError::DecryptError(
                        "Message key not available".into(),
                    ));
                }
            }
        }

        // Если поколение впереди, генерируем промежуточные ключи
        if target_generation > epoch_keys.generation {
            if target_generation - epoch_keys.generation > MAX_SKIP as u32 {
                return Err(RatchetError::TooManySkippedMessages);
            }

            // Сохраняем пропущенные ключи
            while epoch_keys.generation < target_generation {
                let hk = Hkdf::<Sha256>::new(Some(&epoch_keys.root_key), &epoch_keys.chain_key);
                let mut output = [0u8; AES_KEY_SIZE * 2];

                hk.expand(b"MessageKeyDerivation", &mut output)
                    .expect("HKDF expand should not fail");

                // Обновляем chain_key и сохраняем ключ сообщения
                epoch_keys.chain_key = output[0..AES_KEY_SIZE].try_into().unwrap();
                let message_key = output[AES_KEY_SIZE..].try_into().unwrap();

                epoch_keys
                    .skipped_keys
                    .insert(epoch_keys.generation, message_key);
                epoch_keys.generation += 1;
            }
        }

        // Генерируем ключ для текущего поколения
        let hk = Hkdf::<Sha256>::new(Some(&epoch_keys.root_key), &epoch_keys.chain_key);
        let mut output = [0u8; AES_KEY_SIZE * 2];

        hk.expand(b"MessageKeyDerivation", &mut output)
            .expect("HKDF expand should not fail");

        epoch_keys.chain_key = output[0..AES_KEY_SIZE].try_into().unwrap();
        let message_key = output[AES_KEY_SIZE..].try_into().unwrap();

        epoch_keys.generation += 1;
        Ok(message_key)
    }

    /// Обновляет эпох с новым shared_secret
    pub fn update_epoch(
        &mut self,
        epoch: u32,
        new_secret: &[u8; AES_KEY_SIZE],
    ) -> Result<(), RatchetError> {
        // Проверяем, что эпох новый
        if self.epoch_keys.contains_key(&epoch) {
            // Update epoch secrets even if epoch keys exist
            self.epoch_secrets.insert(epoch, *new_secret);
            return Ok(()); // Эпох уже существует, но секрет может быть обновлен
        }

        // Добавляем секрет для нового эпоха
        self.epoch_secrets.insert(epoch, *new_secret);

        // Удаляем старые эпохи, если превышен лимит
        if self.epoch_keys.len() >= self.config.max_previous_epochs
            && let Some(min_epoch) = self.epoch_keys.keys().min().cloned()
            && epoch > min_epoch + self.config.max_previous_epochs as u32
        {
            self.epoch_keys.remove(&min_epoch);
            self.epoch_secrets.remove(&min_epoch); // Remove the secret too
        }

        // Выводим новые ключи
        let hk = Hkdf::<Sha256>::new(None, new_secret);
        let mut derived_keys = [0u8; AES_KEY_SIZE * 2];
        hk.expand(b"SenderRatchetInit", &mut derived_keys)
            .expect("HKDF expand should work with this size");

        let root_key = derived_keys[0..AES_KEY_SIZE].try_into().unwrap();
        let chain_key = derived_keys[AES_KEY_SIZE..].try_into().unwrap();

        // Добавляем новый эпох
        self.epoch_keys.insert(
            epoch,
            EpochKeys {
                root_key,
                chain_key,
                generation: 0,
                skipped_keys: HashMap::new(),
            },
        );

        // Обновляем текущий эпох, если новый больше
        if epoch > self.current_epoch {
            self.current_epoch = epoch;
        }

        Ok(())
    }

    /// Add a method to update epoch secrets
    pub fn add_epoch_secret(&mut self, epoch: u32, secret: [u8; AES_KEY_SIZE]) {
        self.epoch_secrets.insert(epoch, secret);
        // Check if we need to derive keys for this epoch immediately
        // Or maybe it's better to derive them lazily in decrypt/derive_message_key
        // For now, just store the secret.
    }

    /// Дешифрует сообщение
    pub fn decrypt(&mut self, ciphertext: &[u8]) -> Result<Vec<u8>, RatchetError> {
        if ciphertext.len() < 4 {
            // Need at least key_len
            return Err(RatchetError::InvalidFormat);
        }

        // Извлекаем длину публичного ключа
        let key_len = u32::from_le_bytes(ciphertext[0..4].try_into().unwrap()) as usize;

        // Minimum length check based on key_len
        // [key_len (4)] + [key (key_len)] + [user_id (8)] + [epoch (4)] + [generation (4)] + [nonce (NONCE_SIZE)] + [ciphertext (>0)]
        let min_len = 4 + key_len + 8 + 4 + 4 + NONCE_SIZE;
        if ciphertext.len() < min_len {
            return Err(RatchetError::InvalidFormat);
        }

        let received_key = &ciphertext[4..4 + key_len];

        // Проверяем отправителя (публичный ключ)
        if received_key != self.sender_public_key {
            // Allow decryption even if the key doesn't match initially,
            // as the key might be updated later?
            // Let's keep the check for now for security.
            return Err(RatchetError::DecryptError(format!(
                "Incorrect sender public key. Expected {:?}, got {:?}",
                self.sender_public_key, received_key
            )));
        }

        // Извлекаем user_id (sender_id)
        let user_id_offset = 4 + key_len;
        let received_user_id = u64::from_le_bytes(
            ciphertext[user_id_offset..user_id_offset + 8]
                .try_into()
                .unwrap(),
        );

        // Проверяем ID отправителя
        if received_user_id != self.sender_id {
            return Err(RatchetError::DecryptError(format!(
                "Incorrect sender ID. Expected {}, got {}",
                self.sender_id, received_user_id
            )));
        }

        // Извлекаем epoch и generation
        let epoch_offset = user_id_offset + 8;
        let epoch = u32::from_le_bytes(
            ciphertext[epoch_offset..epoch_offset + 4]
                .try_into()
                .unwrap(),
        );
        let generation_offset = epoch_offset + 4;
        let generation = u32::from_le_bytes(
            ciphertext[generation_offset..generation_offset + 4]
                .try_into()
                .unwrap(),
        );

        // Check if we have keys for this epoch and update if needed using stored secrets
        if !self.epoch_keys.contains_key(&epoch) {
            let secret_clone = self.epoch_secrets.get(&epoch).cloned(); // Clone to avoid borrowing issue
            if let Some(secret) = secret_clone {
                // Update epoch will derive keys from the secret
                self.update_epoch(epoch, &secret)?;
                // Re-check if keys are available after update
                if !self.epoch_keys.contains_key(&epoch) {
                    // This case should ideally not happen if update_epoch works correctly
                    return Err(RatchetError::EpochNotFound); // Or a more specific error
                }
            } else {
                // Secret for this epoch is missing
                return Err(RatchetError::EpochNotFound);
            }
        }

        // Извлекаем nonce и шифротекст
        let nonce_offset = generation_offset + 4;
        let nonce_bytes = &ciphertext[nonce_offset..nonce_offset + NONCE_SIZE];
        let actual_ciphertext = &ciphertext[nonce_offset + NONCE_SIZE..];

        // Получаем ключ сообщения
        let message_key = self.derive_message_key(epoch, generation)?;

        // Дешифруем сообщение
        let nonce = Nonce::from_slice(nonce_bytes);
        let cipher = Aes128Gcm::new_from_slice(&message_key)
            .map_err(|_| RatchetError::DecryptError("Failed to initialize cipher".into()))?;

        cipher
            .decrypt(nonce, actual_ciphertext)
            .map_err(|e| RatchetError::DecryptError(format!("Failed to decrypt message: {}", e)))
    }
}
