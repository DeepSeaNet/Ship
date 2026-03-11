/**
 * constants.ts — DAVE protocol constants.
 *
 * References:
 *   DAVE §MLS Parameters          — MLS ciphersuite, AES-128-GCM
 *   DAVE §Sender Key Derivation   — export label, context length
 *   DAVE §Truncated auth tag      — 8-byte (64-bit) tag
 *   DAVE §Truncated sync nonce    — 32-bit nonce, expanded to 96-bit
 */

/** AES-128 key size in bytes. */
export const AES_KEY_SIZE = 16;

/** SHA-256 output length (bytes) — used as ratchet secret length (RFC 9420 §9.1). */
export const HASH_LEN = 32;

/** AES-128-GCM nonce length (bytes). */
export const AEAD_NONCE_LEN = 12;

/**
 * MLS exporter label for per-sender base secrets.
 * DAVE §Sender Key Derivation:
 *   sender_base_secret = MLS-Exporter("SHIP Voice Channel V0", LE(user_id), 16)
 *
 * Must match EXPORT_SECRET_LABEL in Rust (basic_types.rs).
 */
export const EXPORT_SECRET_LABEL  = "SHIP Voice Channel V0";

/** Length of the MLS-exported base secret (= AES_KEY_SIZE). */
export const EXPORT_SECRET_LENGTH = 16;

/**
 * Wire-format nonce size in bytes.
 * DAVE §Truncated synchronization nonce: 32-bit truncated, expanded to 96-bit
 * for AES-GCM via: fullNonce[0..8]=0x00, fullNonce[8..12]=truncatedNonce (BE).
 */
export const NONCE_SIZE = 4;

/**
 * AES-GCM authentication tag size in bytes.
 * DAVE §Truncated authentication tag: 64-bit (8 bytes), per NIST SP 800-38D
 * Appendix C.
 */
export const AUTH_TAG_SIZE = 8;

/**
 * Maximum number of out-of-order generations to buffer per epoch.
 * DAVE §Key Rotation: keys for previous generations retained for ~10 s.
 */
export const MAX_SKIP = 500;

/**
 * Maximum number of previous epochs to retain derived keys for.
 * Allows decryption of in-flight frames during epoch transitions (DAVE spec
 * allows up to ~10 s of overlap).
 */
export const DEFAULT_MAX_EPOCHS = 3;