/**
 * WebRTC Encoded Transform Worker
 * Handles off-main-thread processing for Encoded Frames.
 * Serves as a bridge between the WebRTC pipeline and the Main Thread (likely for Tauri/Rust processing).
 */

let mainPort = null;
const pendingRequests = new Map(); // Map<requestId, { resolve, reject }>
let requestIdCounter = 0;
let codecMapping = {};

// --- Communication with Main Thread ---

self.onmessage = (event) => {
    const { type, codecMapping: newMapping } = event.data;

    if (type === 'init') {
        mainPort = event.ports[0];
        mainPort.onmessage = handleMainThreadResponse;
        console.log('[Worker] Initialized with communication port.');
    } else if (type === 'updateCodecMapping') {
        codecMapping = newMapping || {};
        console.log('[Worker] Codec mapping updated:', codecMapping);
    }
};

/**
 * Handles responses coming back from the Main Thread (Tauri/Rust).
 */
function handleMainThreadResponse(event) {
    const { id, processedData, error } = event.data;

    const request = pendingRequests.get(id);

    if (request) {
        if (error) {
            console.error(`[Worker] Processing failed for request ${id}:`, error);
            request.reject(error);
        } else {
            // Expecting processedData to be an ArrayBuffer or convertable to one
            const buffer = new Uint8Array(processedData).buffer;
            request.resolve(buffer);
        }
        pendingRequests.delete(id);
    } else {
        console.warn(`[Worker] Received response for unknown Request ID: ${id}`);
    }
}

// --- Transform Logic ---

/**
 * Generic transform function that handles the async round-trip to the main thread.
 * @param {RTCEncodedVideoFrame | RTCEncodedAudioFrame} chunk
 * @param {TransformStreamDefaultController} controller
 * @param {'encrypt' | 'decrypt'} operationMode
 */
async function processChunk(chunk, controller, operationMode) {
    if (!mainPort) {
        console.error('[Worker] Port not initialized. Dropping frame.');
        // Option: controller.enqueue(chunk) to pass through untouched, or return to drop.
        return;
    }

    const originalData = chunk.data; // ArrayBuffer
    const requestId = requestIdCounter++;

    // Determine codec type based on frame metadata
    // 1 = Video (Key or Delta), -1 = Unknown/Audio
    let codecType = -1;
    if (chunk.type === 'key' || chunk.type === 'delta') {
        codecType = 1;
    }

    // Create a promise to pause the stream until the main thread returns data
    const responsePromise = new Promise((resolve, reject) => {
        pendingRequests.set(requestId, { resolve, reject });
    });

    // Send to Main Thread
    // Note: We are transferring the data. If Tauri requires a standard array (number[]),
    // you might need Array.from(new Uint8Array(originalData)), but that is performance heavy.
    mainPort.postMessage({
        type: operationMode, // 'encrypt' or 'decrypt'
        id: requestId,
        data: originalData,
        codecType: codecType,
        isKeyFrame: chunk.type === 'key'
    }, [originalData]);

    try {
        const processedBuffer = await responsePromise;
        chunk.data = processedBuffer;
        controller.enqueue(chunk);
    } catch (error) {
        console.error(`[Worker] ${operationMode} transformation failed:`, error);
        // Decision: Drop the frame on error to prevent corrupt stream
    }
}

// --- WebRTC Pipeline Integration ---

if (self.RTCTransformEvent) {
    self.onrtctransform = (event) => {
        const transformer = event.transformer;
        const { readable, writable, options } = transformer;

        // Determine mode based on the options passed from the main thread
        // Defaulting to "senderTransform" -> encrypt, "receiverTransform" -> decrypt
        const mode = options.name === 'senderTransform' ? 'encrypt' : 'decrypt';

        console.log(`[Worker] Attached to ${mode} pipeline.`);

        const transformStream = new TransformStream({
            transform: (chunk, controller) => processChunk(chunk, controller, mode)
        });

        readable
            .pipeThrough(transformStream)
            .pipeTo(writable)
            .catch((e) => {
                console.error(`[Worker] ${mode} pipe error:`, e);
                // Clean up streams on fatal error
                readable.cancel(e);
                writable.abort(e);
            });
    };
} else {
    console.error('[Worker] RTCRtpScriptTransform is not supported in this browser.');
}

console.log('[Worker] Script loaded successfully.');

export default {};