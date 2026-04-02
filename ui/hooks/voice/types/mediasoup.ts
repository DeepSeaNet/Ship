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

export type AppData = {
	sourceType: MediaSourceType | string;
	mediaType: MediaTrackType | string;
	shared: boolean;
	userId?: string;
};

// Типы для инициализации WebRTC
export interface WebRTCInitOptions {
	serverUrl: string;
	onConnectionStateChange: (connected: boolean) => void;
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
