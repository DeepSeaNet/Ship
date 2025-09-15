use anyhow::Result;
use mls_rs::CipherSuiteProvider;
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::crypto::{SignaturePublicKey, SignatureSecretKey};

use crate::api::account::AccountManager;
use crate::api::account::get_default_db_path;
use crate::api::device::types::{
    config::cipher_suite, custom_mls::credentials::AccountCredential, errors::GroupError,
};

#[derive(Clone, MlsSize, MlsEncode, MlsDecode)]
pub struct Account {
    pub user_id: u64,
    pub username: String,
    pub public_address: String,
    pub server_address: String,
    pub server_public_key: Option<Vec<u8>>,
    pub avatar_url: Option<String>,
    // MLS credential and signing key (replaces ed25519 keys)
    pub credential: AccountCredential,
    pub signer: SignatureSecretKey,
}

impl Account {
    /// Creates Account with existing MLS keys and credential
    pub fn new_with_existing_keys(
        user_id: u64,
        username: String,
        public_address: String,
        server_address: String,
        server_public_key: Option<Vec<u8>>,
        avatar_url: Option<String>,
        credential: AccountCredential,
        signer: SignatureSecretKey,
    ) -> Self {
        Account {
            user_id,
            username,
            public_address,
            server_address,
            server_public_key,
            avatar_url,
            credential,
            signer,
        }
    }
    /// Generates a new MLS key pair and returns them
    pub async fn create_keys() -> Result<(SignatureSecretKey, SignaturePublicKey), GroupError> {
        cipher_suite()
            .signature_key_generate()
            .await
            .map_err(|_| GroupError::MlsError("Error generating signature keys".to_string()))
    }

    /// Sign data with account's MLS signature key
    pub async fn sign_message(&self, message: &[u8]) -> Result<Vec<u8>, GroupError> {
        cipher_suite()
            .sign(&self.signer, message)
            .await
            .map_err(|_| GroupError::CryptoError("Message signature failed".to_string()))
    }

    /// Verify signature using provided public key
    pub async fn verify_with_public_key(
        &self,
        public_key: &SignaturePublicKey,
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), GroupError> {
        cipher_suite()
            .verify(public_key, message, signature)
            .await
            .map_err(|_| GroupError::CryptoError("Message verification failed".to_string()))
    }

    /// Serialize to bytes using MLS encoding
    pub fn to_mls_bytes(&self) -> Result<Vec<u8>, GroupError> {
        self.mls_encode_to_vec()
            .map_err(|e| GroupError::EncodingError(format!("Failed to encode account: {}", e)))
    }

    /// Deserialize from bytes using MLS encoding
    pub fn from_mls_bytes(bytes: &mut &[u8]) -> Result<Self, GroupError> {
        Self::mls_decode(bytes)
            .map_err(|e| GroupError::EncodingError(format!("Failed to decode account: {}", e)))
    }
}

impl Account {
    pub async fn save_to_db(&self) -> Result<()> {
        let account_manager = AccountManager::new(get_default_db_path()).await?;
        account_manager.save_account(self).await
    }

    pub async fn load_from_db(username: String) -> Result<Self> {
        let account_manager = AccountManager::new(get_default_db_path()).await?;
        account_manager
            .get_account_by_username(&username)
            .await?
            .ok_or(anyhow::anyhow!(
                "Account with username: {} doesnt exist in database",
                username
            ))
    }

    pub async fn list_accounts() -> Result<Vec<Account>> {
        let account_manager = AccountManager::new(get_default_db_path()).await?;
        account_manager.list_accounts().await
    }
}
