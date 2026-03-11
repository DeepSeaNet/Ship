use hkdf::Hkdf;
use sha2::Sha256;
use std::convert::TryInto;

use super::constants::{AES_KEY_SIZE, HASH_LEN};
use super::error::RatchetError;

/// MLS sender ratchet (RFC 9420 §9.1).
///
/// Per ratchet step:
///   key[n]        = ExpandWithLabel(secret[n], "key",    gen, 16)
///   nonce[n]      = ExpandWithLabel(secret[n], "nonce",  gen, 12)
///   secret[n+1]   = ExpandWithLabel(secret[n], "secret", gen, 32)
///
/// Encrypt / decrypt lives in TypeScript. Rust manages ratchet state and
/// exports the current secret for TypeScript reconstruction.
pub struct SenderRatchet {
    current_epoch: u32,
    /// Current ratchet secret (32 bytes = SHA-256 hash length).
    secret: [u8; HASH_LEN],
    generation: u32,
    pub public_key: Vec<u8>,
    pub user_id: u64,
}

impl SenderRatchet {
    /// Creates a sender ratchet from a 16-byte MLS-exported base secret.
    /// Expands it to 32 bytes: secret[0] = ExpandWithLabel(base, "init", [], 32).
    pub fn new(
        base_secret: &[u8; AES_KEY_SIZE],
        public_key: Vec<u8>,
        user_id: u64,
        group_epoch: u64,
    ) -> Self {
        let secret = expand_with_label(base_secret, "init", &[], HASH_LEN)
            .try_into()
            .expect("HASH_LEN matches");
        Self {
            current_epoch: group_epoch as u32,
            secret,
            generation: 0,
            public_key,
            user_id,
        }
    }

    /// Resets the ratchet for a new MLS epoch.
    pub fn update_epoch(&mut self, new_base: &[u8; AES_KEY_SIZE], group_epoch: u64) {
        self.secret = expand_with_label(new_base, "init", &[], HASH_LEN)
            .try_into()
            .expect("HASH_LEN matches");
        self.current_epoch = group_epoch as u32;
        self.generation = 0;
    }

    pub fn current_epoch(&self) -> u32 {
        self.current_epoch
    }
    pub fn generation(&self) -> u32 {
        self.generation
    }
    pub fn public_key(&self) -> &[u8] {
        &self.public_key
    }
    pub fn user_id(&self) -> u64 {
        self.user_id
    }
    /// Current ratchet secret — exported to TypeScript for ratchet reconstruction.
    pub fn secret(&self) -> [u8; HASH_LEN] {
        self.secret
    }
}

// ── MLS ExpandWithLabel (RFC 9420 §8.1) ──────────────────────────────────────

/// ExpandWithLabel(secret, label, context, length)
/// KDFLabel = u16(length) || u8(len("MLS 1.0 " + label)) || "MLS 1.0 " + label
///          || u8(len(context)) || context
pub fn expand_with_label(secret: &[u8], label: &str, context: &[u8], length: usize) -> Vec<u8> {
    let full_label = format!("MLS 1.0 {}", label);
    let lb = full_label.as_bytes();
    let mut kdf_label = Vec::with_capacity(2 + 1 + lb.len() + 1 + context.len());
    kdf_label.extend_from_slice(&(length as u16).to_be_bytes());
    kdf_label.push(lb.len() as u8);
    kdf_label.extend_from_slice(lb);
    kdf_label.push(context.len() as u8);
    kdf_label.extend_from_slice(context);

    let hk = Hkdf::<Sha256>::new(None, secret);
    let mut out = vec![0u8; length];
    hk.expand(&kdf_label, &mut out).expect("valid length");
    out
}

/// One MLS ratchet step → (key_16, nonce_12, next_secret_32).
pub fn mls_ratchet_step(
    secret: &[u8; HASH_LEN],
    generation: u32,
) -> ([u8; AES_KEY_SIZE], [u8; 12], [u8; HASH_LEN]) {
    let ctx = generation.to_be_bytes();
    let key: [u8; AES_KEY_SIZE] = expand_with_label(secret, "key", &ctx, AES_KEY_SIZE)
        .try_into()
        .unwrap();
    let nonce: [u8; 12] = expand_with_label(secret, "nonce", &ctx, 12)
        .try_into()
        .unwrap();
    let next_secret: [u8; HASH_LEN] = expand_with_label(secret, "secret", &ctx, HASH_LEN)
        .try_into()
        .unwrap();
    (key, nonce, next_secret)
}
