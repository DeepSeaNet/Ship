/**
 * senderRatchet.ts — MLS sender ratchet for AEAD (RFC 9420 §9.1).
 *
 * Wire format:
 *   [epoch: u32 LE][generation: u32 LE][nonce: 12 bytes][ciphertext][tag: 8 bytes]
 *
 * Both key and nonce are derived from the ratchet secret at each step —
 * the nonce is NOT a counter.  It is included in the frame so the receiver
 * can verify it independently (nonce mismatch = ratchet desync).
 */

import {
    AEAD_NONCE_LEN,
    AUTH_TAG_BYTES,
    aesGcmEncrypt,
    deriveInitialSecret,
    mlsRatchetStep,
} from "./hkdf";

export class SenderCryptoRatchet {
    private currentEpoch: number;
    /** Current ratchet secret (32 bytes = SHA-256 hash_len). */
    private secret:     Uint8Array;
    private generation: number;
    private publicKey:  Uint8Array;
    private userId:     bigint;

    constructor(
        secret: Uint8Array,
        publicKey: Uint8Array,
        userId: bigint,
        epoch: number,
        generation: number,
    ) {
        this.secret       = secret;
        this.publicKey    = publicKey;
        this.userId       = userId;
        this.currentEpoch = epoch;
        this.generation   = generation;
    }

    /**
     * Creates a sender ratchet from an MLS-exported base secret (16 bytes).
     * Expands it to a 32-byte ratchet secret via ExpandWithLabel(..., "init", [], 32).
     */
    static async fromSecret(
        baseSecret: Uint8Array,
        publicKey: Uint8Array,
        userId: bigint,
        groupEpoch: number,
    ): Promise<SenderCryptoRatchet> {
        const secret = await deriveInitialSecret(baseSecret);
        return new SenderCryptoRatchet(secret, publicKey, userId, groupEpoch, 0);
    }

    /** Resets the ratchet for a new MLS epoch. */
    async updateEpoch(newBaseSecret: Uint8Array, groupEpoch: number): Promise<void> {
        this.secret       = await deriveInitialSecret(newBaseSecret);
        this.currentEpoch = groupEpoch;
        this.generation   = 0;
    }

    /**
     * Encrypts plaintext and returns the full wire-format frame.
     *
     * Wire format: [epoch(4 LE)][generation(4 LE)][nonce(12)][ciphertext][tag(8)]
     */
    async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
        const generation = this.generation;
        const { key, nonce, nextSecret } = await mlsRatchetStep(this.secret, generation);

        // Advance ratchet state atomically before any further awaits.
        this.secret     = nextSecret;
        this.generation = generation + 1;

        const { ciphertext, tag } = await aesGcmEncrypt(key, nonce, plaintext);

        const totalLen = 4 + 4 + AEAD_NONCE_LEN + ciphertext.length + tag.length;
        const result   = new Uint8Array(totalLen);
        const view     = new DataView(result.buffer);
        let   offset   = 0;

        view.setUint32(offset, this.currentEpoch, true); offset += 4;
        view.setUint32(offset, generation,         true); offset += 4;
        result.set(nonce,      offset); offset += AEAD_NONCE_LEN;
        result.set(ciphertext, offset); offset += ciphertext.length;
        result.set(tag,        offset);

        return result;

        return result;
    }

    // ── Accessors (used by GroupCryptoManager to reconstruct from Rust export) ─

    getSecret():     Uint8Array { return this.secret; }
    getGeneration(): number     { return this.generation; }
    getEpoch():      number     { return this.currentEpoch; }
}