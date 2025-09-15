use super::{
    config::cipher_suite,
    custom_mls::credentials::{DeviceCredential, DeviceCredentialTBS, DeviceId},
    errors::GroupError,
};
/// Identity keypair for group member authentication
use crate::api::account::Account;
use mls_rs::CipherSuiteProvider;
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::crypto::{SignaturePublicKey, SignatureSecretKey};

#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct IdentityKeypair {
    pub credential: DeviceCredential,
    pub public_key: SignaturePublicKey,
    pub signer: SignatureSecretKey,
}

impl IdentityKeypair {
    /// Create identity keypair for the device
    pub async fn new(device_id: &str, account: &Account) -> Result<IdentityKeypair, GroupError> {
        let (signer, public_key) = cipher_suite()
            .signature_key_generate()
            .await
            .map_err(|_| GroupError::CryptoError("Key generation failed:".to_string()))?;

        let tbs = DeviceCredentialTBS {
            user_id: account.credential.account_id.user_id,
            user_public_key: &account.credential.public_key,
            public_key: &public_key,
        };

        let tbs_bytes = tbs.mls_encode_to_vec().map_err(|e| {
            GroupError::EncodingError(format!("Failed to encode member credential TBS: {}", e))
        })?;

        let signature = account.sign_message(&tbs_bytes).await?;

        let device_id = DeviceId {
            user_id: account.credential.account_id.user_id,
            device_id: device_id.to_string(),
        };

        let credential = DeviceCredential {
            device_id,
            user_public_key: account.credential.public_key.clone(),
            signature,
        };

        Ok(IdentityKeypair {
            credential,
            public_key,
            signer,
        })
    }

    pub fn from_bytes(bytes: &mut &[u8]) -> Result<Self, GroupError> {
        let identity = IdentityKeypair::mls_decode(bytes)?;
        Ok(identity)
    }
}
