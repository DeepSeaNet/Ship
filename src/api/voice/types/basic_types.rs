use mls_rs::{crypto::SignatureSecretKey, identity::SigningIdentity};
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::api::voice::{types::ratchet_key::GroupRatchetManager, voice_user::MlsGroup};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct VoiceId(Vec<u8>);

impl VoiceId {
    pub fn to_vec(&self) -> Vec<u8> {
        self.0.clone()
    }

    pub fn from_string(s: &str) -> Self {
        let id = s.as_bytes().to_vec();
        Self(id)
    }
}

#[derive(Clone)]
pub struct Voice {
    pub voice_id: String,
    pub voice_name: String,
    pub mls_group: Arc<RwLock<MlsGroup>>,
    pub voice_ratchet_manager: Arc<RwLock<GroupRatchetManager>>,
}

pub const EXPORT_SECRET_LABEL: &str = "SHIP Voice Channel";
pub const EXPORT_SECRET_LENGTH: usize = 16;

#[derive(Clone, MlsSize, MlsEncode, MlsDecode)]
pub struct VoiceUserData {
    pub identity: SigningIdentity,
    pub signer: SignatureSecretKey,
    pub user_id: u64,
}
