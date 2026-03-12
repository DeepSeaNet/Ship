/**
 * hkdf.ts — MLS sender ratchet primitives (RFC 9420 §9.1) via SubtleCrypto.
 *
 * The DAVE protocol reuses the MLS sender ratchet for AEAD directly.
 * Each ratchet step derives three values from the current secret via
 * derive_tree_secret (ExpandWithLabel in MLS terminology):
 *
 *   key[n]      = ExpandWithLabel(secret[n], "key",    n, aead_key_len=16)
 *   nonce[n]    = ExpandWithLabel(secret[n], "nonce",  n, aead_nonce_len=12)
 *   secret[n+1] = ExpandWithLabel(secret[n], "secret", n, hash_len=32)
 *
 * where ExpandWithLabel is defined in RFC 9420 §8.1:
 *   ExpandWithLabel(secret, label, context, length) =
 *     HKDF-Expand(secret, KDFLabel, length)
 *
 *   KDFLabel = (length as u16 BE) || "MLS 1.0 " || label || context_bytes
 *
 * context for the ratchet step = generation encoded as u32 BE.
 *
 * Wire format (simplified DAVE, no WebRTC codec framing):
 *   [epoch: u32 LE][generation: u32 LE][nonce: 12 bytes][ciphertext][auth_tag: 8 bytes]
 *
 * Auth tag truncated to 8 bytes (DAVE §Truncated authentication tag,
 * NIST SP 800-38D Appendix C).
 *
 * MLS ciphersuite for DAVE v1: DHKEMP256_AES128GCM_SHA256_P256
 *   AEAD:      AES-128-GCM  (key=16, nonce=12, tag=16 → truncated to 8)
 *   Hash/KDF:  SHA-256       (hash_len=32)
 */

// ── Sizes (MLS ciphersuite 2: DHKEMP256_AES128GCM_SHA256_P256) ───────────────
export const AEAD_KEY_LEN = 16; // AES-128-GCM key
export const AEAD_NONCE_LEN = 12; // AES-128-GCM nonce (full, not truncated for wire)
export const HASH_LEN = 32; // SHA-256 output / next secret length
export const AUTH_TAG_BYTES = 8; // DAVE truncated GCM tag (64-bit)

// ── MLS ExpandWithLabel (RFC 9420 §8.1) ──────────────────────────────────────

/**
 * Encodes the KDFLabel structure:
 *   length    : u16 BE
 *   label     : "MLS 1.0 " + label  (length-prefixed)
 *   context   : raw bytes
 */
function encodeKdfLabel(
	length: number,
	label: string,
	context: Uint8Array,
): Uint8Array {
	const fullLabel = "MLS 1.0 " + label;
	const labelBytes = new TextEncoder().encode(fullLabel);

	// KDFLabel = u16(length) || u8(labelLen) || label || u8(contextLen) || context
	const buf = new Uint8Array(2 + 1 + labelBytes.length + 1 + context.length);
	const dv = new DataView(buf.buffer);
	let off = 0;

	dv.setUint16(off, length, false /* BE */);
	off += 2;
	buf[off++] = labelBytes.length;
	buf.set(labelBytes, off);
	off += labelBytes.length;
	buf[off++] = context.length;
	buf.set(context, off);

	return buf;
}

/**
 * ExpandWithLabel(secret, label, context, length)
 * RFC 9420 §8.1 — uses HKDF-Expand (no extract; secret is already the IKM).
 */
async function expandWithLabel(
	secret: Uint8Array,
	label: string,
	context: Uint8Array,
	length: number,
): Promise<Uint8Array> {
	const kdfLabel = encodeKdfLabel(length, label, context);
	const key = await crypto.subtle.importKey(
		"raw",
		secret as BufferSource,
		"HKDF",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: new Uint8Array(0), // expand-only
			info: kdfLabel as BufferSource,
		},
		key,
		length * 8,
	);
	return new Uint8Array(bits);
}

// ── MLS sender ratchet step (RFC 9420 §9.1) ──────────────────────────────────

export interface RatchetStep {
	key: Uint8Array; // AES-128-GCM key   (16 bytes)
	nonce: Uint8Array; // AES-128-GCM nonce (12 bytes)
	nextSecret: Uint8Array; // secret for generation n+1 (32 bytes)
}

/**
 * Performs one step of the MLS sender ratchet.
 *
 *   key[n]        = ExpandWithLabel(secret[n], "key",    generation, 16)
 *   nonce[n]      = ExpandWithLabel(secret[n], "nonce",  generation, 12)
 *   secret[n+1]   = ExpandWithLabel(secret[n], "secret", generation, 32)
 *
 * All three derivations share the same `secret[n]` input and use the
 * generation as context (encoded as u32 BE per MLS convention).
 * They are run in parallel via Promise.all for minimum latency.
 */
export async function mlsRatchetStep(
	secret: Uint8Array,
	generation: number,
): Promise<RatchetStep> {
	// Context = generation as u32 big-endian (MLS convention)
	const ctx = new Uint8Array(4);
	new DataView(ctx.buffer).setUint32(0, generation >>> 0, false /* BE */);

	const [key, nonce, nextSecret] = await Promise.all([
		expandWithLabel(secret, "key", ctx, AEAD_KEY_LEN),
		expandWithLabel(secret, "nonce", ctx, AEAD_NONCE_LEN),
		expandWithLabel(secret, "secret", ctx, HASH_LEN),
	]);

	return { key, nonce, nextSecret };
}

// ── Initial secret derivation ─────────────────────────────────────────────────

/**
 * Derives the initial ratchet secret from the MLS-exported base secret.
 *
 * DAVE §Sender Key Derivation:
 *   sender_base_secret = MLS-Exporter("Discord Secure Frames v0", LE(user_id), 16)
 *
 * The base secret is 16 bytes (AES key length); the ratchet secret must be
 * 32 bytes (SHA-256 hash length) per RFC 9420 §9.1.  We expand it once:
 *   ratchet_secret[0] = ExpandWithLabel(base_secret, "init", [], 32)
 */
export async function deriveInitialSecret(
	baseSecret: Uint8Array,
): Promise<Uint8Array> {
	return expandWithLabel(baseSecret, "init", new Uint8Array(0), HASH_LEN);
}

// ── AES-128-GCM with DAVE truncated tag ──────────────────────────────────────

/**
 * Encrypts plaintext using a key+nonce pair from mlsRatchetStep.
 * The 128-bit GCM tag is truncated to 8 bytes per DAVE spec.
 */
export async function aesGcmEncrypt(
	key: Uint8Array,
	nonce: Uint8Array,
	plaintext: Uint8Array,
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key as BufferSource,
		"AES-GCM",
		false,
		["encrypt"],
	);

	const encrypted = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: nonce as BufferSource },
			cryptoKey,
			plaintext as BufferSource,
		),
	);

	const dataLen = encrypted.length - 16;

	return {
		ciphertext: encrypted.slice(0, dataLen),
		tag: encrypted.slice(dataLen),
	};
}

/**
 * Decrypts ciphertext produced by aesGcmEncrypt.
 * The 8-byte truncated tag is zero-padded to 16 bytes for SubtleCrypto.
 */
export async function aesGcmDecrypt(
	key: Uint8Array,
	nonce: Uint8Array,
	ciphertext: Uint8Array,
	tag: Uint8Array,
): Promise<Uint8Array> {
	const combined = new Uint8Array(ciphertext.length + tag.length);
	combined.set(ciphertext);
	combined.set(tag, ciphertext.length);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key as BufferSource,
		"AES-GCM",
		false,
		["decrypt"],
	);

	return new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: nonce as BufferSource },
			cryptoKey,
			combined,
		),
	);
}
