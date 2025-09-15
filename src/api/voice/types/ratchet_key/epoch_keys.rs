use super::constants::AES_KEY_SIZE;
use std::collections::HashMap;

/// Key material for a specific epoch
#[derive(Clone)]
pub(crate) struct EpochKeys {
    pub(crate) root_key: [u8; AES_KEY_SIZE],
    pub(crate) chain_key: [u8; AES_KEY_SIZE],
    pub(crate) generation: u32,
    pub(crate) skipped_keys: HashMap<u32, [u8; AES_KEY_SIZE]>,
}
