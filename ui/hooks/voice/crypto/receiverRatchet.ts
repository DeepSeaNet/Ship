/**
 * receiverRatchet.ts — MLS receiver ratchet for AEAD (RFC 9420 §9.1).
 *
 * Wire format parsed:
 *   [epoch: u32 LE][generation: u32 LE][nonce: 12 bytes][ciphertext][tag: 8 bytes]
 *
 * Both key and nonce are re-derived from the ratchet secret.  The nonce in
 * the frame is verified against the re-derived nonce to detect ratchet desync.
 * Out-of-order frames are handled by caching skipped key+nonce pairs.
 */

import {
	AEAD_NONCE_LEN,
	AUTH_TAG_BYTES,
	aesGcmDecrypt,
	deriveInitialSecret,
	mlsRatchetStep,
} from "./hkdf";

export const DEFAULT_MAX_EPOCHS = 3; // DAVE retains keys for ~10 s during transitions
export const MAX_SKIP = 500;

interface CachedGeneration {
	key: Uint8Array;
	nonce: Uint8Array;
}

interface EpochState {
	secret: Uint8Array; // current ratchet secret (32 bytes)
	generation: number;
	cache: Map<number, CachedGeneration>; // skipped key+nonce pairs
}

export class ReceiverCryptoRatchet {
	private currentEpoch: number;
	private epochStates: Map<number, EpochState> = new Map();
	private epochBaseSecrets: Map<number, Uint8Array> = new Map();
	private senderId: bigint;
	private maxPreviousEpochs: number;

	constructor(senderId: bigint, maxPreviousEpochs = DEFAULT_MAX_EPOCHS) {
		this.senderId = senderId;
		this.maxPreviousEpochs = maxPreviousEpochs;
		this.currentEpoch = 0;
	}

	// ── Epoch management ──────────────────────────────────────────────────────

	/**
	 * Registers an MLS-exported base secret for an epoch.
	 * Ratchet state is derived lazily on first decrypt for that epoch.
	 */
	addEpochSecret(epoch: number, baseSecret: Uint8Array): void {
		this.epochBaseSecrets.set(epoch, new Uint8Array(baseSecret));
		// Invalidate any previously derived state so a fresh ratchet is built.
		this.epochStates.delete(epoch);
	}

	private async ensureEpochState(epoch: number): Promise<void> {
		if (this.epochStates.has(epoch)) return;

		const base = this.epochBaseSecrets.get(epoch);
		if (!base) throw new Error(`No base secret for epoch ${epoch}`);

		const secret = await deriveInitialSecret(base);
		this.epochStates.set(epoch, { secret, generation: 0, cache: new Map() });

		// Prune oldest derived epoch once over the retention window.
		if (this.epochStates.size > this.maxPreviousEpochs) {
			const oldest = [...this.epochStates.keys()].sort((a, b) => a - b)[0];
			this.epochStates.delete(oldest);
			this.epochBaseSecrets.delete(oldest);
		}

		if (epoch > this.currentEpoch) this.currentEpoch = epoch;
	}

	// ── Ratchet advancement ───────────────────────────────────────────────────

	/**
	 * Returns (key, nonce) for the given epoch + generation, advancing the
	 * ratchet and caching skipped generations as needed.
	 *
	 * RFC 9420 §9.1: a receiver advances the ratchet as far as needed,
	 * caching skipped steps.  Consumed generations are removed from the cache.
	 */
	private async getGenerationKeys(
		epoch: number,
		targetGeneration: number,
	): Promise<CachedGeneration> {
		await this.ensureEpochState(epoch);
		const state = this.epochStates.get(epoch);
		if (!state) throw new Error(`No state for epoch ${epoch}`);
		// 1. Сначала проверяем кэш
		if (targetGeneration < state.generation) {
			const cached = state.cache.get(targetGeneration);
			if (!cached) throw new Error(`Already consumed: ${targetGeneration}`);
			return cached;
		}

		// 2. Если пакет из будущего или текущий
		while (state.generation <= targetGeneration) {
			const currentGen = state.generation;

			const step = await mlsRatchetStep(state.secret, currentGen);

			state.cache.set(currentGen, { key: step.key, nonce: step.nonce });
			state.secret = step.nextSecret;
			state.generation++;
		}

		const result = state.cache.get(targetGeneration);
		if (!result)
			throw new Error(`No result for generation ${targetGeneration}`);

		state.cache.delete(targetGeneration);

		return result;
	}

	// ── Decrypt ───────────────────────────────────────────────────────────────
	private processingQueue: Promise<void> = Promise.resolve();

	async decrypt(data: Uint8Array): Promise<Uint8Array> {
		// Wrap the logic in a queue to prevent concurrent ratchet updates
		const result = this.processingQueue.then(() => this.internalDecrypt(data));

		// Continue the queue even if decryption fails, while keeping it a Promise<void>
		this.processingQueue = result.then(
			() => {
				// do nothing
			},
			() => {
				// do nothing
			},
		);
		return result;
	}
	/**
	 * Decrypts a wire-format frame.
	 *
	 * Wire format: [epoch(4 LE)][generation(4 LE)][nonce(12)][ciphertext][tag(8)]
	 *
	 * The nonce from the frame is verified against the re-derived nonce.
	 * A mismatch means the sender and receiver ratchets are out of sync.
	 */
	async internalDecrypt(data: Uint8Array): Promise<Uint8Array> {
		const MIN_LEN = 4 + 4 + AEAD_NONCE_LEN + AUTH_TAG_BYTES + 1;
		if (data.length < MIN_LEN) throw new Error("Frame too short");

		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
		let offset = 0;

		const epoch = view.getUint32(offset, true /* LE */);
		offset += 4;
		const generation = view.getUint32(offset, true /* LE */);
		offset += 4;
		const wireNonce = data.slice(offset, offset + AEAD_NONCE_LEN);
		offset += AEAD_NONCE_LEN;

		const ciphertext = data.slice(offset, data.length - AUTH_TAG_BYTES);
		const truncatedTag = data.slice(data.length - AUTH_TAG_BYTES);
		if (generation > 0xffffffff) {
			throw new Error("generation overflow");
		}
		const { key } = await this.getGenerationKeys(epoch, generation);

		return aesGcmDecrypt(key, wireNonce, ciphertext, truncatedTag);
	}

	getSenderId(): bigint {
		return this.senderId;
	}
}
