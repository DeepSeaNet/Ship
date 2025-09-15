use aes_gcm::aead::OsRng;
use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{Aes128Gcm, KeyInit, Nonce, aead::Aead};
use hkdf::Hkdf;
use sha2::Sha256;
use std::collections::HashMap;
use std::convert::TryInto;

use super::constants::{AES_KEY_SIZE, NONCE_SIZE};
use super::epoch_keys::EpochKeys;
use super::error::RatchetError;

/// Рачет-ключ для одностороннего шифрования
pub struct SenderRatchet {
    // Текущий эпох и ключи
    current_epoch: u32,
    current_keys: EpochKeys,
    // Публичный ключ отправителя
    public_key: Vec<u8>,
    // ID пользователя (для создания новых секретов)
    user_id: u64,
}

impl SenderRatchet {
    /// Создает новый храповик отправителя
    pub fn new(
        shared_secret: &[u8; AES_KEY_SIZE],
        public_key: Vec<u8>,
        user_id: u64,
        group_epoch: u64,
    ) -> Self {
        // Выводим начальные ключи
        let hk = Hkdf::<Sha256>::new(None, shared_secret);
        let mut derived_keys = [0u8; AES_KEY_SIZE * 2];
        hk.expand(b"SenderRatchetInit", &mut derived_keys)
            .expect("HKDF expand should work with this size");

        let root_key = derived_keys[0..AES_KEY_SIZE].try_into().unwrap();
        let chain_key = derived_keys[AES_KEY_SIZE..].try_into().unwrap();

        Self {
            current_epoch: group_epoch as u32,
            current_keys: EpochKeys {
                root_key,
                chain_key,
                generation: 0,
                skipped_keys: HashMap::new(),
            },
            public_key,
            user_id,
        }
    }

    /// Получает следующий ключ сообщения и обновляет цепочку
    fn next_message_key(&mut self) -> [u8; AES_KEY_SIZE] {
        // Выводим ключ сообщения из текущего chain_key
        let hk = Hkdf::<Sha256>::new(
            Some(&self.current_keys.root_key),
            &self.current_keys.chain_key,
        );
        let mut output = [0u8; AES_KEY_SIZE * 2];

        hk.expand(b"MessageKeyDerivation", &mut output)
            .expect("HKDF expand should not fail");

        // Первая половина становится новым chain_key, вторая половина - ключом сообщения
        self.current_keys.chain_key = output[0..AES_KEY_SIZE].try_into().unwrap();
        let message_key = output[AES_KEY_SIZE..].try_into().unwrap();

        self.current_keys.generation += 1;
        message_key
    }

    /// Обновляет эпох с новым shared_secret
    pub fn update_epoch(&mut self, new_secret: &[u8; AES_KEY_SIZE], group_epoch: u64) {
        // Выводим новые ключи
        let hk = Hkdf::<Sha256>::new(None, new_secret);
        let mut derived_keys = [0u8; AES_KEY_SIZE * 2];
        hk.expand(b"SenderRatchetInit", &mut derived_keys)
            .expect("HKDF expand should work with this size");

        let root_key = derived_keys[0..AES_KEY_SIZE].try_into().unwrap();
        let chain_key = derived_keys[AES_KEY_SIZE..].try_into().unwrap();

        self.current_epoch = group_epoch as u32;
        self.current_keys = EpochKeys {
            root_key,
            chain_key,
            generation: 0,
            skipped_keys: HashMap::new(),
        };
    }

    /// Шифрует сообщение
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<Vec<u8>, RatchetError> {
        // Получаем ключ сообщения
        let message_key = self.next_message_key();
        let generation = self.current_keys.generation - 1; // После инкремента

        // Генерируем случайный nonce
        let mut rng = OsRng;
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        rng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Инициализируем шифр
        let cipher = Aes128Gcm::new_from_slice(&message_key)
            .expect("AES-GCM initialization should not fail");

        // Шифруем сообщение
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| RatchetError::EncryptError(format!("Failed to encrypt message: {}", e)))?;

        // Формируем сообщение: [pub_key_len][pub_key][user_id][epoch][generation][nonce][ciphertext]
        let mut result = Vec::new();

        // Добавляем публичный ключ
        let key_len = self.public_key.len() as u32;
        result.extend_from_slice(&key_len.to_le_bytes());
        result.extend_from_slice(&self.public_key);

        // Добавляем user_id
        result.extend_from_slice(&self.user_id.to_le_bytes());

        // Добавляем epoch и generation
        result.extend_from_slice(&self.current_epoch.to_le_bytes());
        result.extend_from_slice(&generation.to_le_bytes());

        // Добавляем nonce и шифротекст
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }
}
