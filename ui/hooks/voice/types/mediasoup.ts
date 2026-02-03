import { types as mediasoupTypes } from 'mediasoup-client'

// Логирование
export type LogEntryType = 'info' | 'success' | 'warning' | 'error' | 'debug'

export interface LogEntry {
  timestamp: Date
  message: string
  type: LogEntryType
}

export type LoggerFunction = (message: string, type?: LogEntryType) => void

export type MediaTrackType = 'audio' | 'video'
export type MediaSourceType = 'camera' | 'microphone' | 'screen'
export type TransformApi = 'script' | 'encodedStreams' | 'none'

export interface MediaTrackInfo {
  id: string
  type: 'video' | 'audio'
  producerId?: string
  consumerId?: string
  participantId?: string
  mediaStreamTrack?: MediaStreamTrack
  sourceType: string
}

// Типы сообщений для WebSocket
export type ConsumerId = string

// Сообщения клиента
export interface BaseMessage {
  action: string
  timestamp?: number
  id?: string
}

export interface ClientMessage extends BaseMessage {
  [key: string]: unknown
}

export interface ServerMessage extends BaseMessage {
  [key: string]: unknown
}
export interface ServerInit extends ServerMessage {
  action: 'Init'
  routerRtpCapabilities: mediasoupTypes.RtpCapabilities
  producerTransportOptions: mediasoupTypes.TransportOptions
  consumerTransportOptions: mediasoupTypes.TransportOptions
}

export interface ServerConnectedProducerTransport extends ServerMessage {
  action: 'ConnectedProducerTransport'
}

export interface ServerProduced extends ServerMessage {
  action: 'Produced'
  id: string
}

export interface ServerConnectedConsumerTransport extends ServerMessage {
  action: 'ConnectedConsumerTransport'
}

export interface ServerConsumed extends ServerMessage {
  action: 'Consumed'
  id: string
  producerId: string
  kind: MediaTrackType
  rtpParameters: any
  type?: MediaTrackType
  appData?: {
    source?: MediaSourceType
  }
}

export type AppData = {
  sourceType: string
  mediaType: string
  shared: boolean
}

export interface ServerProducerAdded extends ServerMessage {
  action: 'ProducerAdded'
  producerId: string
  participantId: string
  appData: AppData
}

export interface ServerProducerRemoved extends ServerMessage {
  action: 'ProducerRemoved'
  producerId: string
  participantId: string
}

// Типы для инициализации WebRTC
export interface WebRTCInitOptions {
  serverUrl: string
  onConnectionStateChange: (connected: boolean) => void
}

export interface ICECandidate {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

export interface IceConnectionState {
  send: RTCIceConnectionState
  recv: RTCIceConnectionState
}

export interface MediaDeviceInfo {
  deviceId: string
  kind: MediaDeviceKind
  label: string
  groupId: string
}
