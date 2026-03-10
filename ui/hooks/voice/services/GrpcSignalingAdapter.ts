import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { types as mediasoupTypes } from "mediasoup-client";
import type {
	ClientMessage,
	LoggerFunction,
	ServerConsumed,
	ServerError,
	ServerInit,
	ServerMessage,
	ServerProducerAdded,
	ServerProducerRemoved,
} from "../types/mediasoup";
import { minimalCapabilities } from "../utils/rtpCapabilities";
import type { AppData, IceCandidate } from "mediasoup-client/types";
import type { ProtoFingerprint, ProtoRtpCapabilities, ProtoRtpParameters, ProtoServerMessage, ProtoTransportOptions, VoiceEventPayload } from "../types/proto";

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
	onMessage?: (message: ServerMessage) => void;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class GrpcSignalingAdapter {
	private readonly sessionId: string;
	private readonly addLog: LoggerFunction;
	private readonly onProducerAdded: GrpcSignalingAdapterOptions["onProducerAdded"];
	private readonly onProducerRemoved: GrpcSignalingAdapterOptions["onProducerRemoved"];
	private readonly onConnectionStateChange: GrpcSignalingAdapterOptions["onConnectionStateChange"];
	private readonly onMessage?: (message: ServerMessage) => void;

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

		this.addLog(`Connecting to gRPC SignalingStream: ${this.sessionId}`, "info");

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
				"error",
			);
			return;
		}

		try {
			const protoMessage = this.convertToProto(message);
			this.addLog(`Sending gRPC message: ${message.action}`, "info");
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
		this.unlistenFn = await listen<VoiceEventPayload>(
			"voice-event",
			(event) => {
				const { type, data } = event.payload;
				if (type === "signaling_message") {
					this.handleMessage(data);
				}
			},
		);
	}

	// ─── Message handling ─────────────────────────────────────────────────────

	private handleMessage(raw: ProtoServerMessage): void {
		const message = this.convertProtoToMediasoup(raw);

		if (!message) {
			const keys = raw.message ? Object.keys(raw.message).join(", ") : "none";
			this.addLog(`Failed to convert proto message: ${keys}`, "error");
			return;
		}

		this.onMessage?.(message);

		switch (message.action) {
			case "Init":
				this.addLog("Received Init message from server", "success");
				// Initialization is handled by WebRTCConnectionManager
				break;

			case "producerAdded": {
				const msg = message as ServerProducerAdded;
				this.addLog(
					`New producer [${msg.producerId}] from participant ${msg.participantId}`,
					"info",
				);
				this.onProducerAdded(msg.producerId, msg.participantId, msg.appData);
				break;
			}

			case "producerRemoved": {
				const msg = message as ServerProducerRemoved;
				this.addLog(
					`Producer [${msg.producerId}] removed from participant ${msg.participantId}`,
					"info",
				);
				this.onProducerRemoved(msg.producerId, msg.participantId);
				break;
			}

			case "Error":
				this.addLog(
					`Server error: ${(message as ServerError).message}`,
					"error",
				);
				break;

			default:
				if (!message.action.startsWith("consumed:")) {
					this.addLog(`Unhandled gRPC message: ${message.action}`, "info");
				}
		}
	}

	// ─── Proto → mediasoup conversion ─────────────────────────────────────────

	private convertProtoToMediasoup(
		proto: ProtoServerMessage,
	): ServerMessage | null {
		const msg = proto.message;
		if (!msg) {
			this.addLog("Proto message has no 'message' field", "error");
			return null;
		}

		if (msg.init) {
			return {
				action: "Init",
				routerRtpCapabilities: this.parseRtpCapabilities(
					msg.init.routerRtpCapabilities ?? msg.init.router_rtp_capabilities,
				),
				producerTransportOptions: this.parseTransportOptions(
					msg.init.producerTransportOptions ?? msg.init.producer_transport_options,
				),
				consumerTransportOptions: this.parseTransportOptions(
					msg.init.consumerTransportOptions ?? msg.init.consumer_transport_options,
				),
			} as ServerInit;
		}

		const producerAdded = msg.producerAdded ?? msg.producer_added;
		if (producerAdded) {
			return {
				action: "producerAdded",
				producerId: producerAdded.producerId ?? producerAdded.producer_id ?? "",
				participantId:
					producerAdded.participantId ?? producerAdded.participant_id ?? "",
				appData: JSON.parse(
					producerAdded.appData ?? producerAdded.app_data ?? "{}",
				),
			} as ServerProducerAdded;
		}

		const producerRemoved = msg.producerRemoved ?? msg.producer_removed;
		if (producerRemoved) {
			return {
				action: "producerRemoved",
				producerId:
					producerRemoved.producerId ?? producerRemoved.producer_id ?? "",
				participantId:
					producerRemoved.participantId ?? producerRemoved.participant_id ?? "",
			} as ServerProducerRemoved;
		}

		if (msg.consumed) {
			const c = msg.consumed;
			const producerId = c.producerId ?? c.producer_id ?? "";
			return {
				action: `consumed:${producerId}`,
				id: c.consumerId ?? c.consumer_id ?? "",
				producerId,
				kind: c.kind === 2 ? "video" : "audio",
				rtpParameters: this.parseRtpParameters(
					c.rtpParameters ?? c.rtp_parameters,
				),
			} as ServerConsumed;
		}

		if (msg.connectedProducerTransport ?? msg.connected_producer_transport) {
			return { action: "ConnectedProducerTransport", success: true };
		}

		if (msg.connectedConsumerTransport ?? msg.connected_consumer_transport) {
			return { action: "ConnectedConsumerTransport", success: true };
		}

		if (msg.produced) {
			return {
				action: "Produced",
				id: msg.produced.producerId ?? msg.produced.producer_id ?? "",
			};
		}

		if (msg.error) {
			return {
				action: "Error",
				message: msg.error.errorMessage ?? msg.error.error_message ?? "",
			} as ServerError;
		}

		this.addLog(
			`Unknown proto message type: ${Object.keys(msg).join(", ")}`,
			"error",
		);
		return null;
	}

	// ─── Proto field parsers ──────────────────────────────────────────────────

	private parseRtpCapabilities(
		proto: ProtoRtpCapabilities | undefined,
	): mediasoupTypes.RtpCapabilities {
		const raw = proto?.codecs?.[0]?.mimeType ?? proto?.codecs?.[0]?.mime_type;
		if (!raw) return { codecs: [], headerExtensions: [] };

		try {
			return JSON.parse(raw) as mediasoupTypes.RtpCapabilities;
		} catch (error) {
			this.addLog(`Failed to parse RtpCapabilities: ${error}`, "error");
			return { codecs: [], headerExtensions: [] };
		}
	}

	private parseCandidateType(raw?: string): "host" | "srflx" | "prflx" | "relay" {
		if (!raw) return "host";

		const match = raw.match(/type:\s*(\w+)/i);
		const type = match?.[1]?.toLowerCase();

		if (type === "host" || type === "srflx" || type === "prflx" || type === "relay") {
			return type;
		}

		return "host";
	}

	private parseTransportOptions(
		proto: ProtoTransportOptions | undefined,
	): mediasoupTypes.TransportOptions {
		if (!proto) return {} as mediasoupTypes.TransportOptions;

		const iceParams = proto.iceParameters ?? proto.ice_parameters;
		const iceCandidates = proto.iceCandidates ?? proto.ice_candidates ?? [];
		const dtlsParams = proto.dtlsParameters ?? proto.dtls_parameters;

		return {
			id: proto.id,
			iceParameters: {
				usernameFragment:
					iceParams?.usernameFragment ?? iceParams?.username_fragment ?? "",
				password: iceParams?.password ?? "",
				iceLite: iceParams?.iceLite ?? iceParams?.ice_lite ?? false,
			},
			iceCandidates: iceCandidates.map((candidate): IceCandidate => ({
				foundation: candidate.foundation,
				priority: candidate.priority,
				address: candidate.address,
				ip: candidate.address,
				protocol: (candidate.protocol?.toLowerCase() === "tcp" ? "tcp" : "udp"),
				port: candidate.port,
				type: this.parseCandidateType(candidate.type),
				tcpType: candidate.tcpType as 'passive' | 'active' | 'so',
			})),
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
			value = value.replace(/"/g, "").replace(/\s*}\s*$/, "").trim();
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

	private parseRtpParameters(
		proto: ProtoRtpParameters | undefined,
	): mediasoupTypes.RtpParameters {
		if (!proto?.mid) return {} as mediasoupTypes.RtpParameters;

		try {
			return JSON.parse(proto.mid) as mediasoupTypes.RtpParameters;
		} catch (error) {
			this.addLog(`Failed to parse RtpParameters: ${error}`, "error");
			return {} as mediasoupTypes.RtpParameters;
		}
	}

	// ─── mediasoup → Proto conversion ─────────────────────────────────────────

	public convertToProto(message: ClientMessage): object {
		switch (message.action) {
			case "Init":
				return {
					message: {
						init: {
							roomId: this.sessionId,
							rtpCapabilities: {
								codecs: [
									{
										mimeType: JSON.stringify(message.rtpCapabilities),
										kind: "serialized",
										preferredPayloadType: 0,
										clockRate: 0,
										channels: 0,
										parameters: "",
										rtcpFeedback: "",
									},
								],
								headerExtensions: [],
							},
						},
					},
				};

			case "ConnectProducerTransport":
				return {
					message: {
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
					message: {
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
					message: {
						produce: {
							kind: message.kind === "audio" ? 1 : 2,
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
					message: {
						consume: {
							producerId: message.producerId,
							rtpCapabilities: JSON.stringify(message.rtpCapabilities ?? {}),
						},
					},
				};

			case "ConsumerResume":
				return {
					message: {
						consumerResume: {
							consumerId: (message as ClientMessage & { id: string }).id,
						},
					},
				};

			default:
				return { action: message.action };
		}
	}
}