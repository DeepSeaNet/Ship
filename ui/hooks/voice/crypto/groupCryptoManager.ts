/**
 * groupManager.ts — DAVE group crypto manager (MLS RFC 9420 §9.1 ratchet).
 *
 * Manages one SenderCryptoRatchet (outbound) and N ReceiverCryptoRatchets.
 *
 * Sender identity is NOT in every media frame.  The caller supplies senderId
 * (from SSRC → user_id mapping) when decrypting.
 *
 * Wire format: [epoch(4 LE)][generation(4 LE)][nonce(12)][ciphertext][tag(8)]
 */

import { ReceiverCryptoRatchet } from "./receiverRatchet";
import { SenderCryptoRatchet } from "./senderRatchet";

// ── Rust ↔ TypeScript payload types ──────────────────────────────────────────
// Must match VoiceKeysPayload / ReceiverKeyInfo in manager.rs exactly.

export interface VoiceKeysPayload {
	/** Current 32-byte ratchet secret for the sender. */
	sender_secret: number[];
	sender_public_key: number[];
	sender_user_id: number;
	sender_epoch: number;
	sender_generation: number;
	group_epoch: number;
	receivers: ReceiverKeyInfo[];
}

export interface ReceiverKeyInfo {
	user_id: number;
	public_key: number[];
	/** epoch (string) → 16-byte MLS-exported base secret (number[]). */
	epoch_secrets: Record<string, number[]>;
	current_epoch: number;
}

// ── GroupCryptoManager ────────────────────────────────────────────────────────

export class GroupCryptoManager {
	private senderRatchet: SenderCryptoRatchet | null = null;
	private receiverRatchets: Map<bigint, ReceiverCryptoRatchet> = new Map();
	private initialized = false;

	// ── Key material ingestion ────────────────────────────────────────────────

	/**
	 * Initialises or refreshes all ratchet state from the Rust key export.
	 *
	 * The sender ratchet is reconstructed directly from the 32-byte secret
	 * + generation (no re-derivation needed — Rust already advanced the
	 * ratchet to sender_generation steps).
	 *
	 * Receiver ratchets store the 16-byte MLS base secrets per epoch and
	 * derive their 32-byte ratchet secrets lazily on first decrypt.
	 */
	async updateKeys(payload: VoiceKeysPayload): Promise<void> {
		// Reconstruct sender ratchet from the exported 32-byte secret.
		// We bypass fromSecret() because Rust already expanded the secret and
		// advanced the ratchet; we just restore the current state directly.
		this.senderRatchet = new SenderCryptoRatchet(
			new Uint8Array(payload.sender_secret),
			payload.sender_epoch,
			payload.sender_generation,
		);

		// Rebuild receiver ratchets.
		this.receiverRatchets.clear();
		for (const rx of payload.receivers) {
			const senderId = BigInt(rx.user_id);
			const receiver = new ReceiverCryptoRatchet(senderId);
			for (const [epochStr, secretArr] of Object.entries(rx.epoch_secrets)) {
				receiver.addEpochSecret(
					parseInt(epochStr, 10),
					new Uint8Array(secretArr),
				);
			}
			this.receiverRatchets.set(senderId, receiver);
		}

		this.initialized = true;
	}

	// ── Encrypt ───────────────────────────────────────────────────────────────

	async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
		if (!this.senderRatchet) throw new Error("SenderRatchet not initialised");
		return this.senderRatchet.encrypt(plaintext);
	}

	// ── Decrypt ───────────────────────────────────────────────────────────────

	/**
	 * Decrypts a DAVE wire-format frame.
	 *
	 * `senderId` must be supplied by the caller from the SSRC → user_id map
	 * maintained by the RTP / voice gateway layer.
	 */
	async decrypt(data: Uint8Array, senderId: bigint): Promise<Uint8Array> {
		const receiver = this.receiverRatchets.get(senderId);
		if (!receiver)
			throw new Error(`No receiver ratchet for sender ${senderId}`);
		return receiver.decrypt(data);
	}

	isInitialized(): boolean {
		return this.initialized;
	}
}
