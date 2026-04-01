import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { types as mediasoupTypes } from "mediasoup-client";
import type {
	AppData,
	ClientMessage,
	LoggerFunction,
} from "../types/mediasoup";
import { minimalCapabilities } from "../utils/rtpCapabilities";
import type { IceCandidate } from "mediasoup-client/types";
import type { ProtoFingerprint, ProtoRtpCapabilities } from "../types/proto";
import {
	onVoiceEvent,
	type TransportOptions,
	type VoiceResponse,
} from "@/hooks/generated";

// ─── Adapter options ──────────────────────────────────────────────────────────

export interface GrpcSignalingAdapterOptions {
	sessionId: string;
	addLog: LoggerFunction;
	onProducerAdded: (
		producerId: string,
		participantId: string,
		appData: AppData,
	) => void;
	onProducerRemoved: (producerId: string, participantId: string) => void;
	onConnectionStateChange: (connected: boolean) => void;
	onMessage?: (message: VoiceResponse) => void;
}

export function parseRtpCapabilities(
	proto: ProtoRtpCapabilities | undefined,
	addLog: LoggerFunction,
): mediasoupTypes.RtpCapabilities {
	const raw = proto?.codecs?.[0]?.mimeType ?? proto?.codecs?.[0]?.mime_type;
	if (!raw) return { codecs: [], headerExtensions: [] };

	try {
		return JSON.parse(raw) as mediasoupTypes.RtpCapabilities;
	} catch (error) {
		addLog(`Failed to parse RtpCapabilities: ${error}`, "error");
		return { codecs: [], headerExtensions: [] };
	}
}

// ─── Adapter
export function parseRtpParameters(
	proto: VoiceResponse | undefined,
	addLog: LoggerFunction,
): mediasoupTypes.RtpParameters {
	if (proto?.type !== "consumed") {
		addLog(`Cannot parse RtpParameters: Invalid message type`, "error");
		return {} as mediasoupTypes.RtpParameters;
	}
	if (!proto?.data?.rtpParameters) {
		addLog(`Cannot parse RtpParameters: Invalid RTP parameters`, "error");
		return {} as mediasoupTypes.RtpParameters;
	}
	if (!proto?.data?.rtpParameters.mid)
		return {} as mediasoupTypes.RtpParameters;

	try {
		return JSON.parse(
			proto.data.rtpParameters.mid,
		) as mediasoupTypes.RtpParameters;
	} catch (error) {
		addLog(`Failed to parse RtpParameters: ${error}`, "error");
		return {} as mediasoupTypes.RtpParameters;
	}
}

export class GrpcSignalingAdapter {
	private readonly sessionId: string;
	private readonly addLog: LoggerFunction;
	private readonly onProducerAdded: GrpcSignalingAdapterOptions["onProducerAdded"];
	private readonly onProducerRemoved: GrpcSignalingAdapterOptions["onProducerRemoved"];
	private readonly onConnectionStateChange: GrpcSignalingAdapterOptions["onConnectionStateChange"];
	private readonly onMessage?: (message: VoiceResponse) => void;

	private unlistenFn: UnlistenFn | null = null;
	private isConnected = false;

	constructor(options: GrpcSignalingAdapterOptions) {
		this.sessionId = options.sessionId;
		this.addLog = options.addLog;
		this.onProducerAdded = options.onProducerAdded;
		this.onProducerRemoved = options.onProducerRemoved;
		this.onConnectionStateChange = options.onConnectionStateChange;
		this.onMessage = options.onMessage;
	}

	// ─── Public API ───────────────────────────────────────────────────────────

	public async connect(): Promise<void> {
		if (this.isConnected) {
			this.addLog("gRPC connection is already established", "warning");
			return;
		}

		this.addLog(
			`Connecting to gRPC SignalingStream: ${this.sessionId}`,
			"info",
		);

		try {
			await this.setupEventListener();

			await invoke("init_webrtc_signaling", {
				sessionId: this.sessionId,
				rtpCapabilities: JSON.stringify(minimalCapabilities),
			});

			this.isConnected = true;
			this.onConnectionStateChange(true);
			this.addLog("gRPC SignalingStream connected", "success");
		} catch (error) {
			this.addLog(`Failed to connect to gRPC: ${error}`, "error");
			throw error;
		}
	}

	public closeConnection(): void {
		this.unlistenFn?.();
		this.unlistenFn = null;
		this.isConnected = false;
		this.onConnectionStateChange(false);
		this.addLog("gRPC SignalingStream connection closed", "info");
	}

	public async sendMessage(message: ClientMessage): Promise<void> {
		if (!this.isConnected) {
			this.addLog(
				`Cannot send gRPC message (${message.action}): not connected`,
				"debug",
			);
			return;
		}

		try {
			const protoMessage = this.convertToProto(message);
			this.addLog(`Sending gRPC message: ${message.action}`, "info");
			console.log(message, JSON.stringify(protoMessage));
			await invoke("send_webrtc_message", {
				messageJson: JSON.stringify(protoMessage),
			});
		} catch (error) {
			this.addLog(
				`Failed to send gRPC message (${message.action}): ${error}`,
				"error",
			);
		}
	}

	// ─── Event listener ───────────────────────────────────────────────────────

	private async setupEventListener(): Promise<void> {
		this.unlistenFn = await onVoiceEvent((event) => {
			console.log("Received voice event:", event);
			const { type, data } = event;
			if (type === "signaling_message") {
				this.handleMessage(data);
			}
		});
	}

	// ─── Message handling ─────────────────────────────────────────────────────

	private handleMessage(message: VoiceResponse): void {
		this.onMessage?.(message);
		console.log("Received voice message:", message, message.type, message.data);
		switch (message.type) {
			case "init":
				this.addLog("Received Init message from server", "success");
				// Initialization is handled by WebRTCConnectionManager
				break;

			case "producerAdded": {
				this.addLog(
					`New producer [${message.data.producerId}] from participant ${message.data.participantId}`,
					"info",
				);
				const appData: AppData = JSON.parse(message.data.appData);
				this.onProducerAdded(
					message.data.producerId,
					message.data.participantId,
					appData,
				);
				break;
			}

			case "producerRemoved": {
				this.addLog(
					`Producer [${message.data.producerId}] removed from participant ${message.data.participantId}`,
					"info",
				);
				this.onProducerRemoved(
					message.data.producerId,
					message.data.participantId,
				);
				break;
			}

			default:
				this.addLog(
					`Unhandled gRPC message: ${message.type} ${JSON.stringify(message.data)}`,
					"info",
				);
		}
	}

	// ─── Proto field parsers ──────────────────────────────────────────────────

	private parseCandidateType(
		raw?: string,
	): "host" | "srflx" | "prflx" | "relay" {
		if (!raw) return "host";

		const match = raw.match(/type:\s*(\w+)/i);
		const type = match?.[1]?.toLowerCase();

		if (
			type === "host" ||
			type === "srflx" ||
			type === "prflx" ||
			type === "relay"
		) {
			return type;
		}

		return "host";
	}

	public parseTransportOptions(
		transportOptions: TransportOptions | undefined,
	): mediasoupTypes.TransportOptions<AppData> {
		if (!transportOptions)
			return {} as mediasoupTypes.TransportOptions<AppData>;
		const iceParams = transportOptions.iceParameters;
		const iceCandidates = transportOptions.iceCandidates;
		const dtlsParams = transportOptions.dtlsParameters;

		return {
			id: transportOptions.id,
			iceParameters: {
				usernameFragment: iceParams?.usernameFragment ?? "",
				password: iceParams?.password ?? "",
				iceLite: iceParams?.iceLite ?? false,
			},
			iceCandidates: iceCandidates.map(
				(candidate): IceCandidate => ({
					foundation: candidate.foundation,
					priority: candidate.priority,
					address: candidate.address,
					ip: candidate.address,
					protocol: candidate.protocol?.toLowerCase() === "tcp" ? "tcp" : "udp",
					port: candidate.port,
					type: this.parseCandidateType(candidate.type),
					tcpType: candidate.tcpType as "passive" | "active" | "so",
				}),
			),
			dtlsParameters: {
				role: this.parseDtlsRole(dtlsParams?.role),
				fingerprints: (dtlsParams?.fingerprints ?? []).map((fp) =>
					this.parseFingerprint(fp),
				),
			},
		};
	}

	private parseFingerprint(
		fp: ProtoFingerprint,
	): mediasoupTypes.DtlsFingerprint {
		let { algorithm, value } = fp;

		// Rust Debug format: "Sha256 { value: \"...\" }" → normalize to "sha-256"
		if (algorithm.includes("{")) {
			const base = algorithm.split(" ")[0].toLowerCase();
			const normalized: Record<string, string> = {
				sha1: "sha-1",
				sha224: "sha-224",
				sha256: "sha-256",
				sha384: "sha-384",
				sha512: "sha-512",
			};
			algorithm = normalized[base] ?? base;
		}

		if (value.includes('"')) {
			value = value
				.replace(/"/g, "")
				.replace(/\s*}\s*$/, "")
				.trim();
		}

		this.addLog(
			`Fingerprint parsed: ${algorithm} = ${value.substring(0, 20)}...`,
			"debug",
		);

		return {
			algorithm: algorithm as mediasoupTypes.FingerprintAlgorithm,
			value,
		};
	}

	private parseDtlsRole(
		role: string | undefined,
	): "auto" | "client" | "server" {
		const normalized = role?.toLowerCase();
		if (
			normalized === "auto" ||
			normalized === "client" ||
			normalized === "server"
		) {
			return normalized;
		}
		return "auto";
	}

	// ─── mediasoup → Proto conversion ─────────────────────────────────────────

	public convertToProto(message: ClientMessage): object {
		switch (message.action) {
			case "Init":
				return {
					voiceRequest: {
						init: {
							roomId: this.sessionId,
							rtpCapabilities: {
								codecs: [
									{
										mimeType: JSON.stringify(message.rtpCapabilities),
										kind: message.kind || "audio",
										preferredPayloadType: 0,
										clockRate: 0,
										channels: 0,
										parameters: [],
										rtcpFeedback: [],
									},
								],
								headerExtensions: [],
							},
						},
					},
				};

			case "ConnectProducerTransport":
				return {
					voiceRequest: {
						connectProducerTransport: {
							dtlsParameters: {
								fingerprints: message.dtlsParameters?.fingerprints ?? [],
								role: message.dtlsParameters?.role ?? "auto",
							},
						},
					},
				};

			case "ConnectConsumerTransport":
				return {
					voiceRequest: {
						connectConsumerTransport: {
							dtlsParameters: {
								fingerprints: message.dtlsParameters?.fingerprints ?? [],
								role: message.dtlsParameters?.role ?? "auto",
							},
						},
					},
				};

			case "Produce":
				return {
					voiceRequest: {
						produce: {
							kind: message.kind,
							rtpParameters: {
								mid: JSON.stringify(message.rtpParameters),
								codecs: [],
								headerExtensions: [],
								encodings: [],
								rtcp: { cname: "", reducedSize: false },
							},
							appData: JSON.stringify(message.appData ?? {}),
						},
					},
				};

			case "Consume":
				return {
					voiceRequest: {
						consume: {
							producerId: message.producerId,
							rtpCapabilities: JSON.stringify(message.rtpCapabilities ?? {}),
						},
					},
				};

			case "ConsumerResume":
				return {
					voiceRequest: {
						consumerResume: {
							consumerId: (message as ClientMessage & { id: string }).id,
						},
					},
				};

			case "CloseProducer":
				return {
					voiceRequest: {
						closeProducer: {
							producerId: (message as ClientMessage & { producerId: string })
								.producerId,
						},
					},
				};

			case "Leave":
				return {
					voiceRequest: {
						leave: {},
					},
				};

			default:
				return { action: message.action };
		}
	}
}
