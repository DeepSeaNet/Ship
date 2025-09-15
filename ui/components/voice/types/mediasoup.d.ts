import { types as mediasoupTypes } from 'mediasoup-client'
// --- Используем типы из mediasoupTypes ---
type Transport = mediasoupTypes.Transport
type TransportOptions = mediasoupTypes.TransportOptions
type Producer = mediasoupTypes.Producer
// type ProducerOptions = mediasoupTypes.ProducerOptions; // Не используется напрямую
type Consumer = mediasoupTypes.Consumer
// type ConsumerOptions = mediasoupTypes.ConsumerOptions; // Не используется напрямую
type RtpCapabilities = mediasoupTypes.RtpCapabilities
type RtpParameters = mediasoupTypes.RtpParameters
type MediaKind = mediasoupTypes.MediaKind
// type SctpCapabilities = mediasoupTypes.SctpCapabilities; // Не используется
type DtlsParameters = mediasoupTypes.DtlsParameters
// --- Типы сообщений сервера ---
type RoomId = string // Упростим типы брендов для примера
type ParticipantId = string
type ConsumerId = string
type ProducerId = string

interface ServerInit {
  action: 'Init'
  roomId: RoomId
  consumerTransportOptions: TransportOptions
  producerTransportOptions: TransportOptions
  routerRtpCapabilities: RtpCapabilities
}

interface ServerProducerAdded {
  action: 'ProducerAdded'
  participantId: ParticipantId
  producerId: ProducerId
  kind: MediaKind // Добавим kind, чтобы знать, какой consumer создавать
}

interface ServerProducerRemoved {
  action: 'ProducerRemoved'
  participantId: ParticipantId
  producerId: ProducerId
}

interface ServerConnectedProducerTransport {
  action: 'ConnectedProducerTransport'
  // Обычно ответ пустой или содержит подтверждение
}

interface ServerProduced {
  action: 'Produced'
  id: ProducerId // ID созданного producer на сервере
}

interface ServerConnectedConsumerTransport {
  action: 'ConnectedConsumerTransport'
  // Обычно ответ пустой или содержит подтверждение
}

interface ServerConsumed {
  action: 'Consumed'
  id: ConsumerId
  producerId: ProducerId // Добавим producerId для связи
  kind: MediaKind
  rtpParameters: RtpParameters
}

// Добавляем тип для ошибки от сервера
interface ServerError {
  action: 'Error'
  message: string
}

type ServerMessage =
  | ServerInit
  | ServerProducerAdded
  | ServerProducerRemoved
  | ServerConnectedProducerTransport
  | ServerProduced
  | ServerConnectedConsumerTransport
  | ServerConsumed
  | ServerError // Добавляем ServerError

// --- Типы сообщений клиента ---
interface ClientInit {
  action: 'Init'
  rtpCapabilities: RtpCapabilities
}

interface ClientConnectProducerTransport {
  action: 'ConnectProducerTransport'
  dtlsParameters: DtlsParameters
}

interface ClientConnectConsumerTransport {
  action: 'ConnectConsumerTransport'
  dtlsParameters: DtlsParameters
}

interface ClientProduce {
  action: 'Produce'
  kind: MediaKind
  rtpParameters: RtpParameters
  // Дополнительные параметры, если нужны (например, appData)
}

interface ClientConsume {
  action: 'Consume'
  producerId: ProducerId
  // Указываем rtpCapabilities для получения нужного consumer
  rtpCapabilities: RtpCapabilities
}

interface ClientConsumerResume {
  action: 'ConsumerResume'
  id: ConsumerId
}

type ClientMessage =
  | ClientInit
  | ClientConnectProducerTransport
  | ClientProduce
  | ClientConnectConsumerTransport
  | ClientConsume
  | ClientConsumerResume

// Определение типа для записи лога
interface LogEntry {
  timestamp: Date
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
}

interface MediaTrackInfo {
  id: string // Track ID
  type: 'audio' | 'video'
  producerId: ProducerId // Mediasoup Producer ID
  consumerId?: ConsumerId // Mediasoup Consumer ID
}

export {
  Transport,
  TransportOptions,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters,
  MediaKind,
  DtlsParameters,
  ServerMessage,
  ClientMessage,
  LogEntry,
  MediaTrackInfo,
  ServerInit,
  ServerProducerAdded,
  ServerProducerRemoved,
  ServerConnectedProducerTransport,
  ServerProduced,
  ServerConnectedConsumerTransport,
  ServerConsumed,
  ConsumerId,
}
