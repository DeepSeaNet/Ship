/**
 * WebRTC Encoded Transform Worker
 * Handles encryption & decryption of encoded frames using SubtleCrypto.
 * * This version uses the imported GroupCryptoManager for state and logic.
 */

import { GroupCryptoManager } from './crypto/groupCryptoManager';

// ==================== Constants & Configuration ====================
const cryptoManager = new GroupCryptoManager();
let codecMapping = {};

// ==================== VP8 Offset Helper ====================
/**
 * VP8 frames should not be fully encrypted to allow SFUs to read 
 * the payload header if necessary.
 */
function getVp8EncryptionOffset(data) {
    if (!data || data.length === 0) return 0;
    const pFlag = data[0] & 0x01;
    // P=0 -> key frame (10 bytes unencrypted), P=1 -> inter frame (1 byte)
    return pFlag === 0 ? Math.min(10, data.length) : Math.min(1, data.length);
}

function isVp8Frame(chunk, metadata) {
    if (metadata && metadata.mimeType) {
        return metadata.mimeType.toLowerCase().includes('vp8');
    }
    const pt = chunk.payloadType !== undefined ? chunk.payloadType : metadata?.payloadType;
    // Assume 1 maps to VP8 in our mapping
    return pt !== undefined && codecMapping[pt] === 1;
}

// ==================== Transform Logic ====================

/**
 * Processes a single chunk through the GroupCryptoManager.
 */
async function processChunk(chunk, controller, operationMode) {
    if (!cryptoManager.isInitialized()) {
        // Pass through untouched if keys not yet loaded to avoid freezing the stream
        controller.enqueue(chunk);
        return;
    }
    const originalData = new Uint8Array(chunk.data);
    const metadata = chunk.getMetadata();
    const isVp8 = isVp8Frame(chunk, metadata);

    try {
        let processedBuffer;
        const offset = isVp8 ? getVp8EncryptionOffset(originalData) : 0;

        if (offset > 0 && offset < originalData.length) {
            // Partial encryption/decryption for VP8
            const header = originalData.slice(0, offset);
            const payload = originalData.slice(offset);
            
            const result = (operationMode === 'encrypt') 
                ? await cryptoManager.encrypt(payload) 
                : await cryptoManager.decrypt(payload);

            processedBuffer = new Uint8Array(header.length + result.length);
            processedBuffer.set(header, 0);
            processedBuffer.set(result, header.length);
        } else {
            // Full encryption/decryption
            processedBuffer = (operationMode === 'encrypt') 
                ? await cryptoManager.encrypt(originalData) 
                : await cryptoManager.decrypt(originalData);
        }

        chunk.data = processedBuffer.buffer;
        controller.enqueue(chunk);
    } catch (error) {
        console.error(`[Worker] ${operationMode} failed:`, error.message);
        // We drop the frame on error to prevent sending corrupt "half-encrypted" noise
    }
}

// ==================== Communication & Lifecycle ====================

self.onmessage = async (event) => {
    const { type, keys, codecMapping: newMapping } = event.data;

    switch (type) {
        case 'updateKeys':
            try {
                await cryptoManager.updateKeys(keys);
                console.log('[Worker] Keys updated successfully.');
            } catch (e) {
                console.error('[Worker] Failed to update keys:', e);
            }
            break;

        case 'updateCodecMapping':
            codecMapping = newMapping || {};
            console.log('[Worker] Codec mapping updated:', codecMapping);
            break;

        case 'init':
            console.log('[Worker] Initialized.');
            break;
    }
};

if (self.RTCTransformEvent) {
    self.onrtctransform = (event) => {
        const transformer = event.transformer;
        const { readable, writable, options } = transformer;

        // Identify if this is a sender (encrypt) or receiver (decrypt) transform
        const mode = options.name === 'senderTransform' ? 'encrypt' : 'decrypt';
        console.log(`[Worker] Attached to ${mode} pipeline.`);

        const transformStream = new TransformStream({
            transform: (chunk, controller) => processChunk(chunk, controller, mode)
        });

        readable
            .pipeThrough(transformStream)
            .pipeTo(writable)
            .catch((e) => {
                console.error(`[Worker] ${mode} pipeline error:`, e);
            });
    };
} else {
    console.error('[Worker] RTCRtpScriptTransform not supported.');
}