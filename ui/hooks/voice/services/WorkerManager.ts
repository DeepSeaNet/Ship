import { getVoiceKeys, onVoiceEvent } from "@/hooks/generated";
import type { LoggerFunction } from "../types/mediasoup";
import {
	getEncodedStreamWorker,
	terminateEncodedStreamWorker,
} from "../utils/encodedStreamsTransform";

export interface WorkerManagerOptions {
	sessionId: string;
	addLog: LoggerFunction;
}

export class WorkerManager {
	private sessionId: string;
	private addLog: LoggerFunction;

	// Unified worker for WebRTC Encoded Transforms
	private encodedStreamWorker: Worker | null = null;

	constructor(options: WorkerManagerOptions) {
		this.sessionId = options.sessionId;
		this.addLog = options.addLog;
	}

	/**
	 * Get the unified encoded stream worker instance
	 */
	public getEncodedStreamWorker(): Worker | null {
		return this.encodedStreamWorker;
	}

	/**
	 * Initializes the unified worker (SubtleCrypto mode — no per-frame bridge needed).
	 */
	public initializeEncodedStreamWorker(): void {
		this.addLog(
			"Initializing encoded stream worker (SubtleCrypto mode)...",
			"info",
		);

		try {
			// 1. Get or create the worker instance
			this.encodedStreamWorker = getEncodedStreamWorker();

			// 2. Initialize worker (no MessagePort needed — crypto is in-worker)
			this.encodedStreamWorker.postMessage({ type: "init" });

			// 3. Fetch key material from Rust and send to worker
			this.fetchAndSyncKeys();

			// 4. Listen for key refresh events from Rust
			this.listenVoiceEvenets();

			this.addLog("Worker initialized (SubtleCrypto mode)", "success");
		} catch (error) {
			this.addLog(`Failed to initialize worker: ${error}`, "error");
		}
	}

	/**
	 * Fetches key material from Rust via Tauri and sends it to the Worker.
	 */
	public async fetchAndSyncKeys(): Promise<void> {
		if (!this.encodedStreamWorker) return;

		try {
			const keys = await getVoiceKeys();

			this.encodedStreamWorker.postMessage({
				type: "updateKeys",
				keys,
			});

			this.addLog("Key material synced to worker", "info");
		} catch (error: unknown) {
			// This is expected if no voice session is active yet
			const msg = error instanceof Error ? error.message : String(error);
			if (!msg.includes("No active voice session")) {
				this.addLog(`Key sync error: ${msg}`, "error");
			}
		}
	}

	private async listenVoiceEvenets(): Promise<void> {
		const _unlisten = await onVoiceEvent((event) => {
			if (event.type === "server_commit") {
				this.fetchAndSyncKeys();
			}
		});
	}

	/**
	 * Clean up worker resources
	 */
	public cleanup(): void {
		this.addLog("Cleaning up worker resources...", "info");

		if (this.encodedStreamWorker) {
			terminateEncodedStreamWorker();
			this.encodedStreamWorker = null;
		}

		this.addLog("Worker cleanup completed", "info");
	}
}
