/**
 * SenderCryptoRatchet — TypeScript port of Rust SenderRatchet.
 * Uses SubtleCrypto for HKDF key derivation and AES-128-GCM encryption.
 *
 * Wire format (must match Rust sender.rs exactly):
 *   [pub_key_len: u32 LE][pub_key][user_id: u64 LE][epoch: u32 LE][generation: u32 LE][nonce: 12 bytes][ciphertext]
 */

import { AES_KEY_SIZE, NONCE_SIZE } from './constants';
import { deriveRatchetKeys, deriveMessageKey, aesGcmEncrypt } from './hkdf';

export class SenderCryptoRatchet {
    private currentEpoch: number;
    private rootKey: Uint8Array;
    private chainKey: Uint8Array;
    private generation: number;
    private publicKey: Uint8Array;
    private userId: bigint; // u64

    constructor(
        rootKey: Uint8Array,
        chainKey: Uint8Array,
        publicKey: Uint8Array,
        userId: bigint,
        epoch: number,
        generation: number
    ) {
        this.rootKey = rootKey;
        this.chainKey = chainKey;
        this.publicKey = publicKey;
        this.userId = userId;
        this.currentEpoch = epoch;
        this.generation = generation;
    }

    /**
     * Create from an initial shared secret (mirrors SenderRatchet::new in Rust).
     */
    static async fromSecret(
        sharedSecret: Uint8Array,
        publicKey: Uint8Array,
        userId: bigint,
        groupEpoch: number
    ): Promise<SenderCryptoRatchet> {
        const { rootKey, chainKey } = await deriveRatchetKeys(sharedSecret);
        return new SenderCryptoRatchet(rootKey, chainKey, publicKey, userId, groupEpoch, 0);
    }

    /**
     * Derives the next message key and advances the chain.
     */
    private async nextMessageKey(): Promise<Uint8Array> {
        const { newChainKey, messageKey } = await deriveMessageKey(this.rootKey, this.chainKey);
        this.chainKey = newChainKey;
        this.generation += 1;
        return messageKey;
    }

    /**
     * Updates epoch with a new secret (mirrors SenderRatchet::update_epoch).
     */
    async updateEpoch(newSecret: Uint8Array, groupEpoch: number): Promise<void> {
        const { rootKey, chainKey } = await deriveRatchetKeys(newSecret);
        this.rootKey = rootKey;
        this.chainKey = chainKey;
        this.currentEpoch = groupEpoch;
        this.generation = 0;
    }

    /**
     * Encrypts plaintext. Returns the full wire-format message.
     */
    async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
        const messageKey = await this.nextMessageKey();
        const generation = this.generation - 1; // After increment

        const { nonce, ciphertext } = await aesGcmEncrypt(messageKey, plaintext);

        // Build wire format: [key_len(4)][pub_key][user_id(8)][epoch(4)][generation(4)][nonce(12)][ciphertext]
        const keyLen = this.publicKey.length;
        const totalLen = 4 + keyLen + 8 + 4 + 4 + NONCE_SIZE + ciphertext.length;
        const result = new Uint8Array(totalLen);
        const view = new DataView(result.buffer);

        let offset = 0;

        // pub_key_len (u32 LE)
        view.setUint32(offset, keyLen, true);
        offset += 4;

        // pub_key
        result.set(this.publicKey, offset);
        offset += keyLen;

        // user_id (u64 LE)
        view.setBigUint64(offset, this.userId, true);
        offset += 8;

        // epoch (u32 LE)
        view.setUint32(offset, this.currentEpoch, true);
        offset += 4;

        // generation (u32 LE)
        view.setUint32(offset, generation, true);
        offset += 4;

        // nonce (12 bytes)
        result.set(nonce, offset);
        offset += NONCE_SIZE;

        // ciphertext
        result.set(ciphertext, offset);
        return result;
    }
}
