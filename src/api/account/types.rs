use aes_gcm::aead::rand_core::OsRng;
use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, AeadCore, KeyInit},
};
use base64::{Engine as _, engine::general_purpose};
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ExportedAccount {
    pub account: Vec<u8>,
}

#[derive(Serialize, Deserialize, MlsSize, MlsEncode, MlsDecode)]
pub struct EncryptedData {
    ciphertext: String,
    nonce: String,
}

impl ExportedAccount {
    pub fn new(account: Vec<u8>) -> Self {
        Self { account }
    }

    /// Encrypts the account data using AES-GCM
    /// Returns the encrypted data as base64 string and the encryption key
    pub fn encrypt(&self) -> Result<(String, String), String> {
        // Generate a random 256-bit key
        let key = Aes256Gcm::generate_key(&mut OsRng);
        let cipher = Aes256Gcm::new(&key);

        // Generate a random nonce
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        // Encrypt the data
        let ciphertext = cipher
            .encrypt(&nonce, self.account.as_ref())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        // Create the encrypted data structure
        let encrypted_data = EncryptedData {
            ciphertext: general_purpose::STANDARD.encode(&ciphertext),
            nonce: general_purpose::STANDARD.encode(nonce),
        };

        // Serialize encrypted data to JSON and encode as base64
        let encrypted_bytes = encrypted_data
            .mls_encode_to_vec()
            .map_err(|e| e.to_string())?;

        let encrypted_base64 = general_purpose::STANDARD.encode(encrypted_bytes);

        // Encode the key as base64
        let key_base64 = general_purpose::STANDARD.encode(key);

        Ok((encrypted_base64, key_base64))
    }

    /// Decrypts the encrypted data using the provided key
    pub fn decrypt(encrypted_data: &str, key_base64: &str) -> Result<Self, String> {
        // Decode the key from base64
        let key_bytes = general_purpose::STANDARD
            .decode(key_base64)
            .map_err(|e| format!("Failed to decode key: {}", e))?;

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        // Decode the encrypted data from base64
        let encrypted_bytes = general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;

        let encrypted_data =
            EncryptedData::mls_decode(&mut &*encrypted_bytes).map_err(|e| e.to_string())?;

        // Decode ciphertext and nonce from base64
        let ciphertext = general_purpose::STANDARD
            .decode(&encrypted_data.ciphertext)
            .map_err(|e| format!("Failed to decode ciphertext: {}", e))?;

        let nonce_bytes = general_purpose::STANDARD
            .decode(&encrypted_data.nonce)
            .map_err(|e| format!("Failed to decode nonce: {}", e))?;

        let nonce = Nonce::from_slice(&nonce_bytes);

        // Decrypt the data
        let decrypted_data = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| format!("Decryption failed: {}", e))?;

        Ok(Self {
            account: decrypted_data,
        })
    }
}
