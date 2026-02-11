/**
 * Constants matching the Rust ratchet_key implementation.
 * Must stay in sync with src/api/voice/types/ratchet_key/constants.rs
 */

export const AES_KEY_SIZE = 16;       // 128-bit AES key
export const NONCE_SIZE = 12;         // 96-bit GCM nonce
export const MAX_SKIP = 2048;         // Maximum skipped message keys
export const DEFAULT_MAX_EPOCHS = 5;  // Maximum previous epochs retained

// HKDF info strings — must match Rust exactly
export const SENDER_RATCHET_INIT_INFO = 'SenderRatchetInit';
export const MESSAGE_KEY_DERIVATION_INFO = 'MessageKeyDerivation';
