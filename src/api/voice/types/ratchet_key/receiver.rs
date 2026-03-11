use std::collections::HashMap;
use std::convert::TryInto;

use super::config::RatchetConfig;
use super::constants::{AES_KEY_SIZE, HASH_LEN};
use super::sender::expand_with_label;

/// MLS receiver ratchet (RFC 9420 §9.1).
///
/// Mirrors SenderRatchet on the receiving side.  Ratchet state is derived
/// lazily from stored MLS-exported base secrets and exported to TypeScript
/// for AES-GCM decryption via SubtleCrypto.
pub struct ReceiverRatchet {
    current_epoch: u32,
    sender_public_key: Vec<u8>,
    sender_id: u64,
    config: RatchetConfig,
    /// Raw MLS-exported base secrets per epoch (16 bytes each).
    epoch_base_secrets: HashMap<u32, [u8; AES_KEY_SIZE]>,
}

impl ReceiverRatchet {
    pub fn new(
        base_secret: &[u8; AES_KEY_SIZE],
        sender_public_key: Vec<u8>,
        sender_id: u64,
        config: Option<RatchetConfig>,
        group_epoch: u64,
    ) -> Self {
        let mut epoch_base_secrets = HashMap::new();
        epoch_base_secrets.insert(group_epoch as u32, *base_secret);

        Self {
            current_epoch: group_epoch as u32,
            sender_public_key,
            sender_id,
            config: config.unwrap_or_default(),
            epoch_base_secrets,
        }
    }

    /// Registers a new MLS-exported base secret for an epoch.
    ///
    /// Prunes epochs beyond `max_previous_epochs` to bound memory usage.
    /// DAVE allows ~10 s of key overlap during transitions.
    pub fn add_epoch_secret(&mut self, epoch: u32, secret: [u8; AES_KEY_SIZE]) {
        self.epoch_base_secrets.insert(epoch, secret);

        if self.epoch_base_secrets.len() > self.config.max_previous_epochs {
            if let Some(&min_epoch) = self.epoch_base_secrets.keys().min().copied().as_ref() {
                if epoch > min_epoch + self.config.max_previous_epochs as u32 {
                    self.epoch_base_secrets.remove(&min_epoch);
                }
            }
        }

        if epoch > self.current_epoch {
            self.current_epoch = epoch;
        }
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    pub fn sender_id(&self) -> u64 {
        self.sender_id
    }
    pub fn current_epoch(&self) -> u32 {
        self.current_epoch
    }
    pub fn sender_public_key(&self) -> &[u8] {
        &self.sender_public_key
    }

    /// All stored epoch base secrets — exported to TypeScript so it can
    /// reconstruct the MLS ratchet for every epoch independently.
    pub fn epoch_secrets(&self) -> &HashMap<u32, [u8; AES_KEY_SIZE]> {
        &self.epoch_base_secrets
    }
}
