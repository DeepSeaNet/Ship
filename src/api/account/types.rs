use aes_gcm::aead::rand_core::OsRng;
use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, AeadCore, KeyInit},
};
use base64::{Engine as _, engine::general_purpose};
use mls_rs::crypto::SignaturePublicKey;
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt::{Display, Formatter, Result as FmtResult};
use std::str::FromStr;

#[derive(
    Debug, Copy, Clone, PartialEq, Eq, Hash, MlsSize, MlsEncode, MlsDecode, PartialOrd, Ord,
)]
pub struct UserId([u8; 32]);
impl UserId {
    pub fn from_pubkey(pk: SignaturePublicKey) -> Self {
        let hash = blake3::hash(pk.as_bytes());
        UserId(*hash.as_bytes())
    }
    pub fn from_bytes(bytes: &[u8]) -> Self {
        let inner: [u8; 32] = bytes.try_into().expect("UserId must be 32 bytes");
        UserId(inner)
    }
    pub fn to_bytes(self) -> Vec<u8> {
        self.0.to_vec()
    }
    pub fn as_array(&self) -> [u8; 32] {
        self.0
    }
}

impl FromStr for UserId {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let bytes = hex::decode(s).map_err(|e| e.to_string())?;
        let inner: [u8; 32] = bytes
            .try_into()
            .map_err(|_| "Invalid UserId length: expected 32 bytes".to_string())?;
        Ok(UserId(inner))
    }
}

impl Display for UserId {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        write!(f, "{}", hex::encode(self.0))
    }
}
impl Serialize for UserId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&hex::encode(self.0))
    }
}

impl<'de> Deserialize<'de> for UserId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let vec = hex::decode(s).map_err(serde::de::Error::custom)?;

        let mut inner = [0u8; 32];
        if vec.len() != 32 {
            return Err(serde::de::Error::custom("Invalid UserId length"));
        }
        inner.copy_from_slice(&vec);
        Ok(UserId(inner))
    }
}

#[derive(Serialize, Deserialize)]
pub struct ExportedAccount {
    pub account: Vec<u8>,
}

#[derive(Serialize, Deserialize, MlsSize, MlsEncode, MlsDecode)]
pub struct EncryptedData {
    ciphertext: Vec<u8>,
    nonce: Vec<u8>,
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
            ciphertext,
            nonce: nonce.to_vec(),
        };

        // Serialize encrypted data to bytes and encode as base64
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

        let cipher = Aes256Gcm::new_from_slice(&key_bytes)
            .map_err(|e| format!("Failed to create cipher: {}", e))?;

        // Decode the encrypted data from base64
        let encrypted_bytes = general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;

        let encrypted_data =
            EncryptedData::mls_decode(&mut &*encrypted_bytes).map_err(|e| e.to_string())?;

        let nonce = Nonce::from_slice(&encrypted_data.nonce);

        // Decrypt the data
        let decrypted_data = cipher
            .decrypt(nonce, encrypted_data.ciphertext.as_ref())
            .map_err(|e| format!("Decryption failed: {}", e))?;

        Ok(Self {
            account: decrypted_data,
        })
    }
}
