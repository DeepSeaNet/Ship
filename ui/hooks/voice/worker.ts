/**
 * WebRTC Encoded Transform Worker
 *
 * Handles encryption & decryption of encoded frames using SubtleCrypto
 * via the DAVE-compliant GroupCryptoManager.
 *
 * senderId resolution strategy:
 *   - For ENCRYPT: we are the sender — no senderId needed.
 *   - For DECRYPT: senderId is passed in transformer.options.senderId when
 *     the RTCRtpScriptTransform is created (main thread maps SSRC → userId
 *     from the voice gateway roster and passes it here).
 *     As a fallback, chunk.getMetadata().synchronizationSource (SSRC) is
 *     used to look up the userId via the ssrcToUserId map sent from the
 *     main thread via "updateSsrcMapping".
 */

import { GroupCryptoManager } from "./crypto/groupCryptoManager";

// ==================== State ====================

const cryptoManager = new GroupCryptoManager();

/** SSRC (u32) → userId (bigint) — populated from the voice gateway roster. */
const ssrcToUserId = new Map<number, bigint>();

/** codec payload type → codec kind (1 = VP8, etc.) */
let codecMapping: Record<number, number> = {};

// ==================== VP8 unencrypted header offset ====================
// DAVE §Codec Handling: VP8 key frames leave 10 bytes unencrypted,
// inter frames leave 1 byte unencrypted.

function getVp8EncryptionOffset(data: Uint8Array): number {
	if (!data || data.length === 0) return 0;
	const pFlag = data[0] & 0x01;
	// P=0 → key frame (10 bytes), P=1 → inter frame (1 byte)
	return pFlag === 0 ? Math.min(10, data.length) : Math.min(1, data.length);
}

function isVp8Frame(
	chunk: RTCEncodedVideoFrame,
	metadata: RTCEncodedVideoFrameMetadata,
): boolean {
	if ((metadata as any)?.mimeType) {
		return (metadata as any).mimeType.toLowerCase().includes("vp8");
	}
	const pt = (chunk as any).payloadType ?? (metadata as any)?.payloadType;
	return pt !== undefined && codecMapping[pt] === 1;
}

// ==================== senderId resolution ====================

/**
 * Resolves the senderId for a decoded frame.
 *
 * Priority:
 *   1. options.senderId  — set by the main thread when creating the transform
 *      for a specific remote track (most reliable).
 *   2. ssrcToUserId map  — populated from the voice gateway roster via
 *      "updateSsrcMapping" message (fallback for dynamic tracks).
 *   3. Throws if neither is available.
 */
function resolveSenderId(
	options: Record<string, unknown>,
	metadata: RTCEncodedVideoFrameMetadata | RTCEncodedAudioFrameMetadata,
): bigint {
	// 1. Explicit senderId in transform options (preferred).
	if (options.senderId !== undefined) {
		return BigInt(options.senderId as number);
	}

	// 2. SSRC → userId lookup.
	const ssrc = (metadata as any).synchronizationSource as number | undefined;
	if (ssrc !== undefined) {
		const userId = ssrcToUserId.get(ssrc);
		if (userId !== undefined) return userId;
	}

	throw new Error(
		`Cannot resolve senderId: no options.senderId and SSRC ${
			(metadata as any).synchronizationSource
		} not in ssrcToUserId map`,
	);
}

// ==================== Core transform ====================

async function processChunk(
	chunk: RTCEncodedVideoFrame | RTCEncodedAudioFrame,
	controller: TransformStreamDefaultController,
	mode: "encrypt" | "decrypt",
	options: Record<string, unknown>,
): Promise<void> {
	// Pass through if keys not yet loaded to avoid freezing the pipeline.
	if (!cryptoManager.isInitialized()) {
		controller.enqueue(chunk);
		return;
	}

	const originalData = new Uint8Array(chunk.data);
	const metadata = chunk.getMetadata() as any;

	// VP8 partial encryption (only for video frames).
	const isVp8 = isVp8Frame(chunk as RTCEncodedVideoFrame, metadata);
	const offset = isVp8 ? getVp8EncryptionOffset(originalData) : 0;
	try {
		let processedBuffer: Uint8Array;

		if (offset > 0 && offset < originalData.length) {
			// Partial: encrypt/decrypt only the payload after the unencrypted header.
			const header = originalData.slice(0, offset);
			const payload = originalData.slice(offset);

			let result: Uint8Array;
			if (mode === "encrypt") {
				result = await cryptoManager.encrypt(payload);
			} else {
				const senderId = resolveSenderId(options, metadata);
				result = await cryptoManager.decrypt(payload, senderId);
			}

			processedBuffer = new Uint8Array(header.length + result.length);
			processedBuffer.set(header, 0);
			processedBuffer.set(result, header.length);
		} else {
			// Full frame.
			if (mode === "encrypt") {
				processedBuffer = await cryptoManager.encrypt(originalData);
			} else {
				const senderId = resolveSenderId(options, metadata);
				processedBuffer = await cryptoManager.decrypt(originalData, senderId);
			}
		}

		chunk.data = processedBuffer.buffer as ArrayBuffer;
		controller.enqueue(chunk);
	} catch (error: any) {
		// Drop the frame on error — better than forwarding corrupt data.
		console.error(`[Worker] ${mode} failed:`, error.message);
	}
}

// ==================== Message handling ====================

self.onmessage = async (event: MessageEvent) => {
	const { type } = event.data;

	switch (type) {
		case "updateKeys":
			try {
				await cryptoManager.updateKeys(event.data.keys);
				console.log("[Worker] Keys updated.");
			} catch (e) {
				console.error("[Worker] Failed to update keys:", e);
			}
			break;

		/**
		 * updateSsrcMapping: { type: "updateSsrcMapping", mapping: { [ssrc: number]: number } }
		 *
		 * The main thread sends this whenever the voice gateway roster changes.
		 * It maps each participant's SSRC (from RTP) to their snowflake userId.
		 *
		 * Example (main thread):
		 *   worker.postMessage({
		 *     type: "updateSsrcMapping",
		 *     mapping: { 12345678: 1090123456789012345 }
		 *   });
		 */
		case "updateSsrcMapping": {
			const mapping = event.data.mapping as Record<number, number>;
			ssrcToUserId.clear();
			for (const [ssrc, userId] of Object.entries(mapping)) {
				ssrcToUserId.set(Number(ssrc), BigInt(userId));
			}
			console.log(
				"[Worker] SSRC mapping updated:",
				ssrcToUserId.size,
				"entries",
			);
			break;
		}

		case "updateCodecMapping":
			codecMapping = event.data.codecMapping ?? {};
			console.log("[Worker] Codec mapping updated:", codecMapping);
			break;

		case "init":
			console.log("[Worker] Initialized.");
			break;
	}
};

// ==================== RTCTransformEvent ====================

if ((self as any).RTCTransformEvent) {
	(self as any).onrtctransform = (event: any) => {
		const { readable, writable, options } = event.transformer;

		// options.name:     "senderTransform" | "receiverTransform"
		// options.senderId: userId of the remote peer (set by main thread,
		//                   only present for receiverTransform)
		const mode: "encrypt" | "decrypt" =
			options.name === "senderTransform" ? "encrypt" : "decrypt";
		console.log(
			`[Worker] Attached to ${mode} pipeline.`,
			mode === "decrypt"
				? `senderId=${options.senderId ?? "from SSRC map"}`
				: "",
		);

		const transformStream = new TransformStream({
			transform: (chunk, controller) =>
				processChunk(chunk, controller, mode, options),
		});

		readable
			.pipeThrough(transformStream)
			.pipeTo(writable)
			.catch((e: Error) =>
				console.error(`[Worker] ${mode} pipeline error:`, e),
			);
	};
} else {
	console.error(
		"[Worker] RTCRtpScriptTransform not supported in this environment.",
	);
}
