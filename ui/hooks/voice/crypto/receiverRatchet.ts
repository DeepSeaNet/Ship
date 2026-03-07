/**
 * ReceiverCryptoRatchet — TypeScript port of Rust ReceiverRatchet.
 * Handles decryption of messages from a single sender using SubtleCrypto.
 *
 * Wire format parsed (must match Rust sender.rs):
 *   [pub_key_len: u32 LE][pub_key][user_id: u64 LE][epoch: u32 LE][generation: u32 LE][nonce: 12 bytes][ciphertext]
 */

import {
	AES_KEY_SIZE,
	DEFAULT_MAX_EPOCHS,
	MAX_SKIP,
	NONCE_SIZE,
} from "./constants";
import { aesGcmDecrypt, deriveMessageKey, deriveRatchetKeys } from "./hkdf";

interface EpochKeys {
	rootKey: Uint8Array;
	chainKey: Uint8Array;
	generation: number;
	skippedKeys: Map<number, Uint8Array>; // generation → messageKey
}

export class ReceiverCryptoRatchet {
	private currentEpoch: number;
	private epochKeys: Map<number, EpochKeys> = new Map();
	private senderPublicKey: Uint8Array;
	private senderId: bigint;
	private maxPreviousEpochs: number;
	private epochSecrets: Map<number, Uint8Array> = new Map();

	constructor(
		senderPublicKey: Uint8Array,
		senderId: bigint,
		maxPreviousEpochs: number = DEFAULT_MAX_EPOCHS,
	) {
		this.senderPublicKey = senderPublicKey;
		this.senderId = senderId;
		this.maxPreviousEpochs = maxPreviousEpochs;
		this.currentEpoch = 0;
	}

	/**
	 * Create from an initial shared secret (mirrors ReceiverRatchet::new in Rust).
	 */
	static async fromSecret(
		sharedSecret: Uint8Array,
		senderPublicKey: Uint8Array,
		senderId: bigint,
		groupEpoch: number,
		maxPreviousEpochs: number = DEFAULT_MAX_EPOCHS,
	): Promise<ReceiverCryptoRatchet> {
		const ratchet = new ReceiverCryptoRatchet(
			senderPublicKey,
			senderId,
			maxPreviousEpochs,
		);
		ratchet.currentEpoch = groupEpoch;

		const { rootKey, chainKey } = await deriveRatchetKeys(sharedSecret);
		ratchet.epochKeys.set(groupEpoch, {
			rootKey,
			chainKey,
			generation: 0,
			skippedKeys: new Map(),
		});
		ratchet.epochSecrets.set(groupEpoch, new Uint8Array(sharedSecret));

		return ratchet;
	}

	/**
	 * Adds an epoch secret for lazy key derivation.
	 */
	addEpochSecret(epoch: number, secret: Uint8Array): void {
		this.epochSecrets.set(epoch, new Uint8Array(secret));
	}

	/**
	 * Derives keys for an epoch from stored secret, if not already derived.
	 */
	private async ensureEpochKeys(epoch: number): Promise<void> {
		if (this.epochKeys.has(epoch)) return;

		const secret = this.epochSecrets.get(epoch);
		if (!secret) {
			throw new Error(`No secret for epoch ${epoch}`);
		}

		const { rootKey, chainKey } = await deriveRatchetKeys(secret);
		this.epochKeys.set(epoch, {
			rootKey,
			chainKey,
			generation: 0,
			skippedKeys: new Map(),
		});

		// Prune old epochs
		if (this.epochKeys.size > this.maxPreviousEpochs) {
			const epochs = [...this.epochKeys.keys()].sort((a, b) => a - b);
			while (this.epochKeys.size > this.maxPreviousEpochs) {
				const oldest = epochs.shift()!;
				this.epochKeys.delete(oldest);
				this.epochSecrets.delete(oldest);
			}
		}

		if (epoch > this.currentEpoch) {
			this.currentEpoch = epoch;
		}
	}

	/**
	 * Derives the message key for a specific epoch + generation, handling skipped messages.
	 */
	private async deriveMessageKeyForGeneration(
		epoch: number,
		targetGeneration: number,
	): Promise<Uint8Array> {
		await this.ensureEpochKeys(epoch);

		const keys = this.epochKeys.get(epoch);
		if (!keys) {
			throw new Error(`Epoch ${epoch} not found after ensureEpochKeys`);
		}

		// Check skipped keys first
		if (targetGeneration < keys.generation) {
			const skippedKey = keys.skippedKeys.get(targetGeneration);
			if (skippedKey) {
				keys.skippedKeys.delete(targetGeneration);
				return skippedKey;
			}
			throw new Error(
				`Message key for generation ${targetGeneration} not available (current: ${keys.generation})`,
			);
		}

		// Skip forward if needed
		if (targetGeneration > keys.generation) {
			if (targetGeneration - keys.generation > MAX_SKIP) {
				throw new Error(
					`Too many skipped messages: ${targetGeneration - keys.generation}`,
				);
			}

			while (keys.generation < targetGeneration) {
				const { newChainKey, messageKey } = await deriveMessageKey(
					keys.rootKey,
					keys.chainKey,
				);
				keys.chainKey = newChainKey;
				keys.skippedKeys.set(keys.generation, messageKey);
				keys.generation += 1;
			}
		}

		// Derive the key for the target generation
		const { newChainKey, messageKey } = await deriveMessageKey(
			keys.rootKey,
			keys.chainKey,
		);
		keys.chainKey = newChainKey;
		keys.generation += 1;

		return messageKey;
	}

	/**
	 * Decrypts a full wire-format message.
	 * Parses header, validates sender, derives key, and decrypts.
	 */
	async decrypt(data: Uint8Array): Promise<Uint8Array> {
		if (data.length < 4) {
			throw new Error("Message too short");
		}

		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		let offset = 0;

		// pub_key_len (u32 LE)
		const keyLen = view.getUint32(offset, true);
		offset += 4;

		const minLen = 4 + keyLen + 8 + 4 + 4 + NONCE_SIZE;
		if (data.length < minLen) {
			throw new Error("Message too short for header");
		}

		// pub_key
		const receivedKey = data.slice(offset, offset + keyLen);
		offset += keyLen;

		// Validate sender public key
		if (!this.arraysEqual(receivedKey, this.senderPublicKey)) {
			throw new Error("Incorrect sender public key");
		}

		// user_id (u64 LE)
		const receivedUserId = view.getBigUint64(offset, true);
		offset += 8;

		if (receivedUserId !== this.senderId) {
			throw new Error(
				`Incorrect sender ID. Expected ${this.senderId}, got ${receivedUserId}`,
			);
		}

		// epoch (u32 LE)
		const epoch = view.getUint32(offset, true);
		offset += 4;

		// generation (u32 LE)
		const generation = view.getUint32(offset, true);
		offset += 4;

		// nonce (12 bytes)
		const nonce = data.slice(offset, offset + NONCE_SIZE);
		offset += NONCE_SIZE;

		// ciphertext (remainder)
		const ciphertext = data.slice(offset);

		// Derive the message key
		const messageKey = await this.deriveMessageKeyForGeneration(
			epoch,
			generation,
		);

		// Decrypt
		return aesGcmDecrypt(messageKey, nonce, ciphertext);
	}

	/** Returns the sender ID */
	getSenderId(): bigint {
		return this.senderId;
	}

	private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}
}
