import { Device, type types as mediasoupTypes } from "mediasoup-client";
import type { Consumer, Producer, Transport } from "mediasoup-client/types";
import type {
	AppData,
	ClientMessage,
	ConsumerId,
	LoggerFunction,
	ServerConsumed,
	ServerMessage,
	ServerProduced,
} from "../types/mediasoup";

import {
	applyDecryptionToReceiver,
	applyEncryptionToSender,
} from "../utils/encodedStreamsTransform";
import type { WorkerManager } from "./WorkerManager";

export interface MediasoupServiceOptions {
	sessionId: string;
	userId: string;
	addLog: LoggerFunction;
	onTransportsInitialized?: () => void;
	workerManager: WorkerManager;
}

export class MediasoupService {
	private device: Device | null = null;
	private sendTransport: Transport<AppData> | null = null;
	private recvTransport: Transport<AppData> | null = null;
	private producers: Map<string, Producer<AppData>> = new Map();
	private consumers: Map<ConsumerId, Consumer<AppData>> = new Map();
	private responseCallbacks: Map<string, (data: ServerMessage) => void> =
		new Map();
	private initialized = false;

	private addLog: LoggerFunction;
	private onTransportsInitialized?: () => void;
	private sessionId: string;
	private userId: string;
	private workerManager: WorkerManager;

	constructor(options: MediasoupServiceOptions) {
		this.addLog = options.addLog;
		this.sessionId = options.sessionId;
		this.userId = options.userId;
		this.onTransportsInitialized = options.onTransportsInitialized;
		this.workerManager = options.workerManager;
	}

	public getDevice(): Device | null {
		return this.device;
	}

	public getSendTransport(): Transport | null {
		return this.sendTransport;
	}

	public getRecvTransport(): Transport | null {
		return this.recvTransport;
	}

	public getProducers(): Map<string, Producer<AppData>> {
		return this.producers;
	}

	public getConsumers(): Map<ConsumerId, Consumer<AppData>> {
		return this.consumers;
	}

	public isDeviceLoaded(): boolean {
		return !!this.device && this.device.loaded;
	}

	public isTransportsReady(): boolean {
		return !!this.sendTransport && !!this.recvTransport;
	}

	public isInitialized(): boolean {
		return (
			this.initialized && this.isDeviceLoaded() && this.isTransportsReady()
		);
	}

	public setResponseCallback(
		action: string,
		callback: (data: ServerMessage) => void,
	): void {
		this.responseCallbacks.set(action, callback);
	}

	public handleCallback(action: string, data: ServerMessage): boolean {
		const callback = this.responseCallbacks.get(action);
		if (callback) {
			this.responseCallbacks.delete(action);
			try {
				callback(data);
				return true;
			} catch (error) {
				this.addLog(
					`Callback execution error for ${action}: ${error}`,
					"error",
				);
			}
		} else {
			// Only log as debug to avoid spamming the UI toast
			console.debug(
				`[MediasoupService] No callback registered for action: ${action}`,
			);
		}
		return false;
	}

	public async initializeDevice(
		routerRtpCapabilities: mediasoupTypes.RtpCapabilities,
	): Promise<void> {
		try {
			this.addLog("Creating mediasoup Device...", "info");
			this.device = new Device();
			await this.device.load({ routerRtpCapabilities });
			this.addLog("Device loaded with routerRtpCapabilities", "success");
		} catch (error) {
			this.addLog(`Device initialization error: ${error}`, "error");
			throw error;
		}
	}

	public createTransports(
		producerTransportOptions: mediasoupTypes.TransportOptions<AppData>,
		consumerTransportOptions: mediasoupTypes.TransportOptions<AppData>,
		sendMessage: (message: ClientMessage) => void | Promise<void>,
	): void {
		if (!this.device) {
			this.addLog("Cannot create transports: Device not initialized", "error");
			return;
		}

		// 1. Create Send Transport
		this.addLog("Creating Producer Transport...", "info");
		this.sendTransport = this.device.createSendTransport<AppData>(
			producerTransportOptions,
		);

		this.sendTransport.on("connect", ({ dtlsParameters }, callback) => {
			this.addLog("SendTransport event: connect", "info");
			sendMessage({ action: "ConnectProducerTransport", dtlsParameters });
			this.setResponseCallback("ConnectedProducerTransport", () => {
				this.addLog("SendTransport connected to server", "success");
				callback();
			});
		});

		this.sendTransport.on(
			"produce",
			async ({ kind, rtpParameters, appData }, callback) => {
				this.addLog(`SendTransport event: produce (${kind})`, "info");
				sendMessage({
					action: "Produce",
					kind,
					rtpParameters,
					appData: appData as AppData,
				});
				this.setResponseCallback("Produced", (response) => {
					const serverRes = response as ServerProduced;
					this.addLog(
						`Producer ${serverRes.id} (${kind}) created on server`,
						"success",
					);
					callback(serverRes);
				});
			},
		);

		this.sendTransport.on("connectionstatechange", (state) => {
			this.addLog(
				`SendTransport ICE state: ${state}`,
				state === "connected"
					? "success"
					: state === "failed"
						? "error"
						: "info",
			);
		});

		// 2. Create Receive Transport
		this.addLog("Creating Consumer Transport...", "info");
		this.recvTransport = this.device.createRecvTransport<AppData>(
			consumerTransportOptions,
		);

		this.recvTransport.on("connect", ({ dtlsParameters }, callback) => {
			this.addLog("RecvTransport event: connect", "info");
			sendMessage({ action: "ConnectConsumerTransport", dtlsParameters });
			this.setResponseCallback("ConnectedConsumerTransport", () => {
				this.addLog("RecvTransport connected to server", "success");
				callback();
			});
		});

		this.recvTransport.on("connectionstatechange", (state) => {
			this.addLog(
				`RecvTransport ICE state: ${state}`,
				state === "connected"
					? "success"
					: state === "failed"
						? "error"
						: "info",
			);
		});

		this.initialized = true;
		if (this.onTransportsInitialized) this.onTransportsInitialized();
	}

	public async createProducer(
		track: MediaStreamTrack,
		sourceType: string,
	): Promise<Producer<AppData> | null> {
		if (!this.sendTransport) {
			this.addLog(
				`Cannot create producer for ${track.kind}: SendTransport not initialized`,
				"error",
			);
			return null;
		}

		try {
			const producer = await this.sendTransport.produce<AppData>({
				track,
				appData: {
					sourceType,
					mediaType: track.kind,
					shared: true,
					userId: this.userId,
				},
			});
			this.producers.set(track.kind, producer);
			this.addLog(`Producer ${producer.id} created (${track.kind})`, "success");

			// Apply Transformation/Encryption
			await this.applyEncryptionToProducer(producer);

			producer.on("transportclose", () => this.producers.delete(track.kind));
			producer.on("trackended", () => this.producers.delete(track.kind));
			return producer;
		} catch (error) {
			this.addLog(`Producer creation error: ${error}`, "error");
			return null;
		}
	}

	private async applyEncryptionToProducer(
		producer: Producer<AppData>,
	): Promise<void> {
		if (!producer.rtpSender) return;

		this.addLog(
			`Applying Encoded Transform encryption to ${producer.kind} Producer`,
			"info",
		);
		try {
			const worker = this.workerManager.getEncodedStreamWorker();
			if (!worker) throw new Error("Worker not available");
			await applyEncryptionToSender(
				producer.rtpSender,
				this.userId,
				this.sessionId,
			);
			this.addLog(`Encryption applied to Producer ${producer.id}`, "success");
		} catch (e) {
			this.addLog(
				`Encryption error for Producer ${producer.id}: ${e}`,
				"error",
			);
		}
	}

	public async createConsumer(
		consumedMessage: ServerConsumed,
		senderId: string,
		onTrackAdded: (
			track: MediaStreamTrack,
			consumerId: ConsumerId,
			producerId: string,
		) => void,
		sendMessage: (message: ClientMessage) => void,
	): Promise<Consumer<AppData> | null> {
		if (!this.recvTransport) {
			this.addLog(
				`Cannot create consumer for producer ${consumedMessage.producerId}: RecvTransport not initialized`,
				"error",
			);
			return null;
		}

		try {
			this.addLog(
				`Consuming Producer ${consumedMessage.producerId}...`,
				"info",
			);
			const consumer = await this.recvTransport.consume<AppData>({
				id: consumedMessage.id,
				producerId: consumedMessage.producerId,
				kind: consumedMessage.kind,
				rtpParameters: consumedMessage.rtpParameters,
				appData: consumedMessage.appData,
			});

			this.consumers.set(consumer.id, consumer);

			// Apply Transformation/Decryption
			await this.applyDecryptionToConsumer(consumer, senderId);

			onTrackAdded(consumer.track, consumer.id, consumer.producerId);
			sendMessage({ action: "ConsumerResume", id: consumer.id });

			consumer.on("transportclose", () => this.removeConsumer(consumer.id));
			consumer.on("trackended", () => this.removeConsumer(consumer.id));

			return consumer;
		} catch (error) {
			this.addLog(`Consumer creation error: ${error}`, "error");
			return null;
		}
	}

	private async applyDecryptionToConsumer(
		consumer: Consumer<AppData>,
		senderId: string,
	): Promise<void> {
		if (!consumer.rtpReceiver) return;

		this.addLog(
			`Applying Encoded Transform decryption to ${consumer.kind} Consumer`,
			"info",
		);
		try {
			const worker = this.workerManager.getEncodedStreamWorker();
			if (!worker) throw new Error("Worker not available");
			await applyDecryptionToReceiver(
				consumer.rtpReceiver,
				senderId,
				this.sessionId,
			);
			this.addLog(`Decryption applied to Consumer ${consumer.id}`, "success");
		} catch (e) {
			this.addLog(
				`Decryption error for Consumer ${consumer.id}: ${e}`,
				"error",
			);
		}
	}

	public removeConsumer(
		consumerId: ConsumerId,
		onTrackRemoved?: (trackId: string) => void,
	): void {
		const consumer = this.consumers.get(consumerId);
		if (consumer) {
			if (consumer.track && onTrackRemoved) onTrackRemoved(consumer.track.id);
			consumer.close();
			this.consumers.delete(consumerId);
		}
	}

	public cleanup(): void {
		this.addLog("Cleaning up Mediasoup resources...", "info");
		this.consumers.forEach((c) => {
			c.close();
		});
		this.consumers.clear();
		this.producers.forEach((p) => {
			p.close();
		});
		this.producers.clear();

		if (this.sendTransport) this.sendTransport.close();
		if (this.recvTransport) this.recvTransport.close();

		this.device = null;
		this.initialized = false;
		this.responseCallbacks.clear();
		this.addLog("Cleanup complete", "success");
	}
}
