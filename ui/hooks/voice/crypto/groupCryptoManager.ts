/**
 * GroupCryptoManager — TypeScript port of Rust GroupRatchetManager.
 * Manages one SenderCryptoRatchet and N ReceiverCryptoRatchets.
 *
 * This class is designed to run inside a Web Worker,
 * using SubtleCrypto for all cryptographic operations.
 */

import { NONCE_SIZE } from "./constants";
import { ReceiverCryptoRatchet } from "./receiverRatchet";
import { SenderCryptoRatchet } from "./senderRatchet";

/** Key material payload from Rust (matches VoiceKeysPayload in manager.rs) */
export interface VoiceKeysPayload {
	sender_root_key: number[];
	sender_chain_key: number[];
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
	epoch_secrets: Record<string, number[]>;
	current_epoch: number;
}

export class GroupCryptoManager {
	private senderRatchet: SenderCryptoRatchet | null = null;
	private receiverRatchets: Map<bigint, ReceiverCryptoRatchet> = new Map();
	private initialized = false;

	/**
	 * Initialize or update the crypto state from Rust-provided key material.
	 */
	async updateKeys(payload: VoiceKeysPayload): Promise<void> {
		// Build sender ratchet from pre-derived keys
		this.senderRatchet = new SenderCryptoRatchet(
			new Uint8Array(payload.sender_root_key),
			new Uint8Array(payload.sender_chain_key),
			new Uint8Array(payload.sender_public_key),
			BigInt(payload.sender_user_id),
			payload.sender_epoch,
			payload.sender_generation,
		);

		// Build receiver ratchets
		this.receiverRatchets.clear();
		for (const rx of payload.receivers) {
			const senderId = BigInt(rx.user_id);
			const publicKey = new Uint8Array(rx.public_key);

			// Create receiver ratchet and add all epoch secrets
			const receiver = new ReceiverCryptoRatchet(publicKey, senderId);

			for (const [epochStr, secretArr] of Object.entries(rx.epoch_secrets)) {
				const epoch = parseInt(epochStr, 10);
				receiver.addEpochSecret(epoch, new Uint8Array(secretArr));
			}

			this.receiverRatchets.set(senderId, receiver);
		}

		this.initialized = true;
	}

	/**
	 * Encrypt plaintext using the sender ratchet.
	 */
	async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
		if (!this.senderRatchet) {
			throw new Error("SenderRatchet not initialized");
		}
		return this.senderRatchet.encrypt(plaintext);
	}

	/**
	 * Decrypt a full wire-format message.
	 * Parses the header to identify the sender, then delegates to the correct receiver.
	 */
	async decrypt(data: Uint8Array): Promise<Uint8Array> {
		if (data.length < 4) {
			throw new Error("Message too short to decrypt");
		}

		// Parse just enough of the header to identify the sender
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		let offset = 0;

		// pub_key_len (u32 LE)
		const keyLen = view.getUint32(offset, true);
		offset += 4;

		if (data.length < 4 + keyLen + 8) {
			throw new Error("Message too short to read sender ID");
		}

		// Skip pub_key
		offset += keyLen;

		// user_id (u64 LE)
		const senderId = view.getBigUint64(offset, true);

		const receiver = this.receiverRatchets.get(senderId);
		if (!receiver) {
			throw new Error(`No receiver ratchet for sender ${senderId}`);
		}

		return receiver.decrypt(data);
	}

	/**
	 * Whether the manager has been initialized with key material.
	 */
	isInitialized(): boolean {
		return this.initialized;
	}
}
