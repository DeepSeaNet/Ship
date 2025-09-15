//! Credential types and related functionality

use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::{
    crypto::SignaturePublicKey,
    identity::{Credential, CredentialType, CustomCredential, MlsCredential},
};

use crate::api::device::types::{config::CREDENTIAL_V1, errors::GroupError};

#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct AccountId {
    pub user_id: u64,
    pub public_address: String,
}

/// Credential for a user (contains user-level information)
#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct AccountCredential {
    pub account_id: AccountId,
    pub public_key: SignaturePublicKey,
    pub cert: Vec<u8>,
}

/// Credential for an MLS member (device owned by a user)

#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct DeviceId {
    pub user_id: u64,
    pub device_id: String,
}

#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct DeviceCredential {
    pub device_id: DeviceId,
    pub user_public_key: SignaturePublicKey, // Identifies the owning user
    pub signature: Vec<u8>,
}

/// Structure used for signing member credentials
#[derive(MlsSize, MlsEncode)]
pub struct DeviceCredentialTBS<'a> {
    pub user_id: u64,
    pub user_public_key: &'a SignaturePublicKey,
    pub public_key: &'a SignaturePublicKey,
}

impl MlsCredential for DeviceCredential {
    type Error = GroupError;

    fn credential_type() -> CredentialType {
        CREDENTIAL_V1
    }

    fn into_credential(self) -> Result<Credential, Self::Error> {
        Ok(Credential::Custom(CustomCredential::new(
            Self::credential_type(),
            self.mls_encode_to_vec()?,
        )))
    }
}
