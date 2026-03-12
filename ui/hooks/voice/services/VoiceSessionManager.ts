import { GrpcSignalingAdapter } from "./GrpcSignalingAdapter";
import { MediaManager } from "./MediaManager";
import { MediasoupService } from "./MediasoupService";
import { WorkerManager } from "./WorkerManager";
import type {
	ClientMessage,
	LogEntry,
	LogEntryType,
	MediaTrackInfo,
	ServerInit,
	ServerMessage,
} from "../types/mediasoup";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@heroui/react";
import type { Consumer } from "mediasoup-client/types";

export type CallStatus = "idle" | "calling" | "connected" | "error" | "ended";

export interface VoiceSessionState {
	status: CallStatus;
	sessionId: string | null;
	logs: LogEntry[];
	isVideoEnabled: boolean;
	isAudioEnabled: boolean;
	isScreenShareEnabled: boolean;
	localVideoStream: MediaStream | null;
	localAudioStream: MediaStream | null;
	screenShareStream: MediaStream | null;
	remoteTracks: MediaTrackInfo[];
	participants: Record<string, string>;
}

export class VoiceSessionManager {
	private state: VoiceSessionState;
	private onStateChange: (state: VoiceSessionState) => void;

	private signaling: GrpcSignalingAdapter | null = null;
	private mediasoupService: MediasoupService | null = null;
	private mediaManager: MediaManager | null = null;
	private workerManager: WorkerManager | null = null;

	private consumedProducers: Set<string> = new Set();
	private pendingProducers: Array<{
		producerId: string;
		participantId: string;
		appData: any;
	}> = [];
	private starting = false;

	constructor(
		private userId: string | undefined,
		onStateChange: (state: VoiceSessionState) => void,
	) {
		this.onStateChange = onStateChange;
		this.state = {
			status: "idle",
			sessionId: null,
			logs: [],
			isVideoEnabled: false,
			isAudioEnabled: false,
			isScreenShareEnabled: false,
			localVideoStream: null,
			localAudioStream: null,
			screenShareStream: null,
			remoteTracks: [],
			participants: {},
		};
	}

	private updateState(partial: Partial<VoiceSessionState>) {
		this.state = { ...this.state, ...partial };
		this.onStateChange(this.state);
	}

	public addLog = (message: string, type: LogEntryType = "info") => {
		const entry: LogEntry = {
			timestamp: new Date(),
			message,
			type,
		};
		// Limit logs size appropriately if needed, here we just append
		this.updateState({ logs: [...this.state.logs, entry] });
		console.log(`[VoiceSessionManager] [${type.toUpperCase()}] ${message}`);
		if (type === "error" || type === "warning")
			toast.danger(`[VoiceSessionManager] [${type.toUpperCase()}] ${message}`);
	};

	public cleanup = () => {
		this.mediaManager?.stopAllMedia();
		this.mediasoupService?.cleanup();
		this.workerManager?.cleanup();
		this.signaling?.closeConnection();

		this.signaling = null;
		this.mediasoupService = null;
		this.mediaManager = null;
		this.workerManager = null;
		this.consumedProducers.clear();
		this.pendingProducers = [];
		this.starting = false;

		this.updateState({
			status: "idle",
			sessionId: null,
			localVideoStream: null,
			localAudioStream: null,
			screenShareStream: null,
			remoteTracks: [],
			participants: {},
			isVideoEnabled: false,
			isAudioEnabled: false,
			isScreenShareEnabled: false,
		});
	};

	private handleTrackAdded = (
		track: MediaStreamTrack,
		consumerId: string,
		producerId: string,
		participantId?: string,
		appData?: any,
	) => {
		const prev = this.state.remoteTracks;
		if (prev.some((t) => t.id === track.id)) return;
		const trackType = track.kind === "video" ? "video" : "audio";
		const mediaTrackInfo: MediaTrackInfo = {
			id: track.id,
			type: trackType,
			producerId,
			consumerId,
			participantId,
			userId: appData?.userId,
			mediaStreamTrack: track,
			sourceType: appData?.sourceType || "unknown",
		};
		this.updateState({ remoteTracks: [...prev, mediaTrackInfo] });
	};

	private handleTrackRemoved = (trackId: string) => {
		this.updateState({
			remoteTracks: this.state.remoteTracks.filter((t) => t.id !== trackId),
		});
	};

	public startCall = async (manualSessionId?: string) => {
		if (
			this.state.status !== "idle" &&
			this.state.status !== "ended" &&
			this.state.status !== "error"
		)
			return;
		if (this.starting) return;

		this.starting = true;
		const newSessionId = manualSessionId || crypto.randomUUID();
		this.updateState({ sessionId: newSessionId, status: "calling", logs: [] });

		try {
			this.addLog(
				`Starting call initialization... SessionID: ${newSessionId}`,
				"info",
			);

			try {
				await Promise.race([
					invoke("join_session", { sessionId: newSessionId }),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error("Timeout")), 5000),
					),
				]);
			} catch (error) {
				this.addLog(`Failed to join session: ${error}`, "error");
				return;
			}

			this.addLog(`Joined session: ${newSessionId}`, "info");
			// 1. Initialize Signaling
			this.signaling = new GrpcSignalingAdapter({
				sessionId: newSessionId,
				addLog: this.addLog,
				onProducerAdded: async (producerId, participantId, appData) => {
					if (typeof appData?.userId === "string") {
						this.updateState({
							participants: {
								...this.state.participants,
								[participantId]: appData.userId,
							},
						});
					}

					if (this.consumedProducers.has(producerId)) return;
					this.consumedProducers.add(producerId);

					if (!this.mediasoupService?.isInitialized()) {
						this.addLog(
							`Queuing producer ${producerId} - service not initialized yet`,
							"info",
						);
						this.pendingProducers.push({ producerId, participantId, appData });
						return;
					}

					await this.requestConsume(producerId, participantId, appData);
				},
				onProducerRemoved: (producerId, _participantId) => {
					this.consumedProducers.delete(producerId);
					this.mediasoupService
						?.getConsumers()
						.forEach((consumer: Consumer) => {
							if (consumer.producerId === producerId) {
								this.mediasoupService?.removeConsumer(
									consumer.id,
									this.handleTrackRemoved,
								);
							}
						});
				},
				onConnectionStateChange: (connected) => {
					if (!connected && this.state.status === "connected") {
						this.addLog("Signaling disconnected", "warning");
					}
				},
				onMessage: async (msg) => {
					if (this.mediasoupService?.handleCallback(msg.action, msg)) {
						return;
					}

					if (msg.action === "Init") {
						const initMsg = msg as ServerInit;
						try {
							await this.mediasoupService?.initializeDevice(
								initMsg.routerRtpCapabilities,
							);
							await this.mediasoupService?.createTransports(
								initMsg.producerTransportOptions,
								initMsg.consumerTransportOptions,
								(m: ClientMessage) => this.signaling!.sendMessage(m),
							);
							this.updateState({ status: "connected" });
							this.addLog("Call connected & initialized!", "success");

							// Process pending producers
							if (this.pendingProducers.length > 0) {
								this.addLog(
									`Processing ${this.pendingProducers.length} pending producers...`,
									"info",
								);
								const toProcess = [...this.pendingProducers];
								this.pendingProducers = [];

								for (const p of toProcess) {
									await this.requestConsume(
										p.producerId,
										p.participantId,
										p.appData,
									);
								}
							}
						} catch (error: any) {
							this.addLog(`Initialization Error: ${error.message}`, "error");
							this.updateState({ status: "error" });
						}
					}
				},
			});

			this.workerManager = new WorkerManager({
				sessionId: newSessionId,
				addLog: this.addLog,
			});
			this.workerManager.initializeEncodedStreamWorker();

			this.mediasoupService = new MediasoupService({
				sessionId: newSessionId,
				userId: this.userId || "",
				addLog: this.addLog,
				transformApi: "encodedStreams",
				workerManager: this.workerManager,
			});

			this.mediaManager = new MediaManager({
				mediasoupService: this.mediasoupService,
				addLog: this.addLog,
			});

			await this.signaling.connect();
		} catch (err: any) {
			this.addLog(`Failed to start call: ${err.message}`, "error");
			this.updateState({ status: "error" });
		} finally {
			this.starting = false;
		}
	};

	public endCall = async () => {
		this.addLog("Ending call...", "info");
		await invoke("leave_session");
		this.cleanup();
	};

	public toggleVideo = async () => {
		if (!this.mediaManager) return;
		if (this.state.isVideoEnabled) {
			this.mediaManager.stopVideo();
			this.updateState({ localVideoStream: null, isVideoEnabled: false });
		} else {
			const producer = await this.mediaManager.startVideo();
			if (producer) {
				this.updateState({
					localVideoStream: this.mediaManager.getLocalVideoStream(),
					isVideoEnabled: true,
				});
			}
		}
	};

	public toggleAudio = async () => {
		if (!this.mediaManager) return;
		if (this.state.isAudioEnabled) {
			this.mediaManager.stopAudio();
			this.updateState({ localAudioStream: null, isAudioEnabled: false });
		} else {
			const producer = await this.mediaManager.startAudio();
			if (producer) {
				this.updateState({
					localAudioStream: this.mediaManager.getLocalAudioStream(),
					isAudioEnabled: true,
				});
			}
		}
	};

	public toggleScreenShare = async () => {
		if (!this.mediaManager) return;

		if (this.state.isScreenShareEnabled) {
			this.mediaManager.stopScreenShare();
			this.updateState({
				screenShareStream: null,
				isScreenShareEnabled: false,
			});
			this.addLog("Screen share stopped", "info");
		} else {
			try {
				this.addLog("Requesting screen share...", "info");
				const stream = await this.mediaManager.startScreenShare();
				if (stream) {
					await this.mediaManager.publishScreenShare();
					this.updateState({
						screenShareStream: stream,
						isScreenShareEnabled: true,
					});
					this.addLog("Screen share started", "success");

					const videoTrack = stream.getVideoTracks()[0];
					if (videoTrack) {
						videoTrack.onended = () => {
							this.updateState({
								screenShareStream: null,
								isScreenShareEnabled: false,
							});
							this.addLog("Screen share ended natively", "info");
						};
					}
				}
			} catch (err: any) {
				this.addLog(`Screen share error: ${err.message || err}`, "error");
				this.updateState({
					isScreenShareEnabled: false,
					screenShareStream: null,
				});
			}
		}
	};

	private requestConsume = async (
		producerId: string,
		participantId: string,
		appData: any,
	) => {
		if (!this.mediasoupService || !this.signaling) return;

		this.addLog(
			`Requesting consume for producer ${producerId} from participant ${participantId}`,
			"info",
		);

		// Set callback FIRST to avoid race condition
		this.mediasoupService.setResponseCallback(
			`consumed:${producerId}`,
			async (data: any) => {
				const userId = appData?.userId;
				if (typeof userId === "string") {
					this.addLog(`Creating consumer for producer ${producerId}...`, "info");
					const consumer = await this.mediasoupService?.createConsumer(
						data,
						userId,
						(track, consumerId, newProducerId) => {
							this.handleTrackAdded(
								track,
								consumerId,
								newProducerId,
								participantId,
								appData,
							);
						},
						(m: ClientMessage) => this.signaling!.sendMessage(m),
					);

					if (!consumer) {
						this.addLog(
							`Failed to create consumer for producer ${producerId}`,
							"error",
						);
					}
				} else {
					this.addLog(
						`Cannot create consumer for producer ${producerId}: missing userId in appData`,
						"warning",
					);
				}
			},
		);

		const rtpCapabilities = this.mediasoupService.getDevice()?.rtpCapabilities;
		await this.signaling.sendMessage({
			action: "Consume",
			producerId: producerId,
			rtpCapabilities,
		});
	};
}
