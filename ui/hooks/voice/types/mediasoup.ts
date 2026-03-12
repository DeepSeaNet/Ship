import type { types as mediasoupTypes } from "mediasoup-client";

// Логирование
export type LogEntryType = "info" | "success" | "warning" | "error" | "debug";

export interface LogEntry {
	timestamp: Date;
	message: string;
	type: LogEntryType;
}

export type LoggerFunction = (message: string, type?: LogEntryType) => void;

export type MediaTrackType = "audio" | "video";
export type MediaSourceType = "camera" | "microphone" | "screen";
export type TransformApi = "script" | "encodedStreams" | "none";

export interface MediaTrackInfo {
	id: string;
	type: "video" | "audio";
	producerId?: string;
	consumerId?: string;
	participantId?: string;
	userId?: string;
	mediaStreamTrack?: MediaStreamTrack;
	sourceType: string;
}

// Типы сообщений для WebSocket
export type ConsumerId = string;

// Сообщения клиента
export interface BaseMessage {
	action: string;
	timestamp?: number;
	id?: string;
}

export interface ClientMessage extends BaseMessage {
	[key: string]: unknown;
	dtlsParameters?: any;
	rtpCapabilities?: any;
	kind?: string;
	appData?: AppData;
	producerId?: string;
}

export interface ServerMessage extends BaseMessage {
	[key: string]: unknown;
}
export interface ServerInit extends ServerMessage {
	action: "Init";
	routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
	producerTransportOptions: mediasoupTypes.TransportOptions;
	consumerTransportOptions: mediasoupTypes.TransportOptions;
}

export interface ServerConnectedProducerTransport extends ServerMessage {
	action: "ConnectedProducerTransport";
}

export interface ServerProduced extends ServerMessage {
	action: "Produced";
	id: string;
}

export interface ServerConnectedConsumerTransport extends ServerMessage {
	action: "ConnectedConsumerTransport";
}

export interface ServerConsumed extends ServerMessage {
	action: string;
	id: string;
	producerId: string;
	kind: MediaTrackType;
	rtpParameters: any;
	type?: MediaTrackType;
	appData?: {
		source?: MediaSourceType;
	};
}

export interface ServerError extends ServerMessage {
	action: "Error";
	message: string;
}

export type AppData = {
	sourceType: string;
	mediaType: string;
	shared: boolean;
	userId?: string;
};

export interface ServerProducerAdded extends ServerMessage {
	action: "producerAdded";
	producerId: string;
	participantId: string;
	appData: AppData;
}

export interface ServerProducerRemoved extends ServerMessage {
	action: "producerRemoved";
	producerId: string;
	participantId: string;
}

// Типы для инициализации WebRTC
export interface WebRTCInitOptions {
	serverUrl: string;
	onConnectionStateChange: (connected: boolean) => void;
}

export interface ICECandidate {
	candidate: string;
	sdpMid?: string | null;
	sdpMLineIndex?: number | null;
	usernameFragment?: string | null;
}

export interface IceConnectionState {
	send: RTCIceConnectionState;
	recv: RTCIceConnectionState;
}

export interface MediaDeviceInfo {
	deviceId: string;
	kind: MediaDeviceKind;
	label: string;
	groupId: string;
}
