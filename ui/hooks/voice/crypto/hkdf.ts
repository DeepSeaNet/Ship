/**
 * HKDF-SHA256 utilities using Web Crypto API (SubtleCrypto).
 * Mirrors the Rust hkdf::Hkdf<Sha256> usage in ratchet_key/sender.rs and receiver.rs.
 *
 * IMPORTANT: The Rust code uses HKDF with:
 *   - salt = None (for SenderRatchetInit) → HKDF-Extract produces PRK from IKM
 *   - salt = root_key (for MessageKeyDerivation) → HKDF-Extract with explicit salt
 *   - info = b"SenderRatchetInit" or b"MessageKeyDerivation"
 *   - output length = 32 bytes (2 × AES_KEY_SIZE)
 */

import {
	AES_KEY_SIZE,
	MESSAGE_KEY_DERIVATION_INFO,
	SENDER_RATCHET_INIT_INFO,
} from "./constants";

const encoder = new TextEncoder();

/**
 * Performs HKDF-SHA256 Extract + Expand to derive `length` bytes.
 *
 * @param ikm  - Input keying material (the "secret")
 * @param salt - Optional salt. If null, SubtleCrypto uses a zero-filled buffer.
 * @param info - Context string for domain separation
 * @param length - Number of output bytes
 * @returns Derived key bytes
 */
export async function hkdfDerive(
	ikm: Uint8Array,
	salt: Uint8Array | null,
	info: string,
	length: number,
): Promise<Uint8Array> {
	// Import IKM as raw key material for HKDF
	const baseKey = await crypto.subtle.importKey(
		"raw",
		ikm as any,
		"HKDF",
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: (salt ?? new Uint8Array(32)) as any, // Match Rust Hkdf::new(None, ...) → zero salt
			info: encoder.encode(info) as any,
		},
		baseKey,
		length * 8, // deriveBits expects bits
	);

	return new Uint8Array(derivedBits);
}

/**
 * Derives root_key + chain_key from a shared secret using SenderRatchetInit info.
 * Returns [root_key (16 bytes), chain_key (16 bytes)].
 */
export async function deriveRatchetKeys(
	sharedSecret: Uint8Array,
): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
	const derived = await hkdfDerive(
		sharedSecret,
		null,
		SENDER_RATCHET_INIT_INFO,
		AES_KEY_SIZE * 2,
	);

	return {
		rootKey: derived.slice(0, AES_KEY_SIZE),
		chainKey: derived.slice(AES_KEY_SIZE),
	};
}

/**
 * Derives a message key from root_key + chain_key and returns:
 *   - newChainKey (first 16 bytes)
 *   - messageKey (second 16 bytes)
 *
 * This mirrors the Rust HKDF with salt=root_key, ikm=chain_key, info="MessageKeyDerivation".
 */
export async function deriveMessageKey(
	rootKey: Uint8Array,
	chainKey: Uint8Array,
): Promise<{ newChainKey: Uint8Array; messageKey: Uint8Array }> {
	// In Rust: Hkdf::new(Some(&root_key), &chain_key) → Extract with salt=root_key, ikm=chain_key
	// Then expand with info="MessageKeyDerivation"
	const derived = await hkdfDerive(
		chainKey,
		rootKey,
		MESSAGE_KEY_DERIVATION_INFO,
		AES_KEY_SIZE * 2,
	);

	return {
		newChainKey: derived.slice(0, AES_KEY_SIZE),
		messageKey: derived.slice(AES_KEY_SIZE),
	};
}

/**
 * Encrypts plaintext using AES-128-GCM with a random nonce.
 * Returns { nonce (12 bytes), ciphertext (includes GCM tag) }.
 */
export async function aesGcmEncrypt(
	key: Uint8Array,
	plaintext: Uint8Array,
): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
	const nonce = crypto.getRandomValues(new Uint8Array(12));

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key as any,
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);

	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: nonce as any },
		cryptoKey,
		plaintext as any,
	);

	return {
		nonce,
		ciphertext: new Uint8Array(encrypted),
	};
}

/**
 * Decrypts ciphertext using AES-128-GCM.
 */
export async function aesGcmDecrypt(
	key: Uint8Array,
	nonce: Uint8Array,
	ciphertext: Uint8Array,
): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key as any,
		{ name: "AES-GCM" },
		false,
		["decrypt"],
	);

	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: nonce as any },
		cryptoKey,
		ciphertext as any,
	);

	return new Uint8Array(decrypted);
}
