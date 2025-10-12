import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { types as mediasoupTypes } from 'mediasoup-client'
import {
  ServerMessage,
  ClientMessage,
  ServerInit,
  ServerProducerAdded,
  ServerProducerRemoved,
  ServerConsumed,
  LoggerFunction,
} from '../types/mediasoup'

// Type for server error messages
interface ServerError extends ServerMessage {
  action: 'Error'
  message: string
}

export interface GrpcSignalingAdapterOptions {
  sessionId: string
  addLog: LoggerFunction
  onProducerAdded: (
    producerId: string,
    participantId: string,
    appData: any,
  ) => void
  onProducerRemoved: (producerId: string, participantId: string) => void
  onConnectionStateChange: (state: boolean) => void
  onMessage?: (message: ServerMessage) => void
}

export class GrpcSignalingAdapter {
  private sessionId: string
  private addLog: LoggerFunction
  private onProducerAdded: (
    producerId: string,
    participantId: string,
    appData: any,
  ) => void
  private onProducerRemoved: (producerId: string, participantId: string) => void
  private onConnectionStateChange: (state: boolean) => void
  private onMessage?: (message: ServerMessage) => void
  private unlistenFn: UnlistenFn | null = null
  private isConnected = false

  constructor(options: GrpcSignalingAdapterOptions) {
    this.sessionId = options.sessionId
    this.addLog = options.addLog
    this.onProducerAdded = options.onProducerAdded
    this.onProducerRemoved = options.onProducerRemoved
    this.onConnectionStateChange = options.onConnectionStateChange
    this.onMessage = options.onMessage
  }

  // Начать gRPC соединение
  public async connect(): Promise<void> {
    if (this.isConnected) {
      this.addLog('gRPC соединение уже установлено', 'warning')
      return
    }

    this.addLog(`Подключение к gRPC SignalingStream: ${this.sessionId}`, 'info')

    try {
      // Настраиваем слушатель событий сначала
      await this.setupEventListener()
      
      // Создаем минимальные RTP capabilities для инициализации
      const minimalCapabilities = {
        codecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {},
            rtcpFeedback: []
          }
        ],
        headerExtensions: []
      }
      
      // Инициализируем signaling stream с RTP capabilities
      // Init сообщение отправляется автоматически на стороне Rust
      await invoke('init_webrtc_signaling', { 
        sessionId: this.sessionId,
        rtpCapabilities: JSON.stringify(minimalCapabilities)
      })
      
      this.isConnected = true
      this.onConnectionStateChange(true)
      this.addLog('gRPC SignalingStream соединение установлено', 'success')
    } catch (error) {
      this.addLog(`Ошибка подключения к gRPC: ${error}`, 'error')
      throw error
    }
  }

  // Закрыть соединение
  public closeConnection(): void {
    if (this.unlistenFn) {
      this.unlistenFn()
      this.unlistenFn = null
    }
    this.isConnected = false
    this.onConnectionStateChange(false)
    this.addLog('gRPC SignalingStream соединение закрыто', 'info')
  }

  // Отправить сообщение серверу
  public async sendMessage(message: ClientMessage): Promise<void> {
    if (!this.isConnected) {
      this.addLog(
        `Не удалось отправить gRPC сообщение (${message.action}): соединение не установлено`,
        'error',
      )
      return
    }

    try {
      // Конвертируем TypeScript ClientMessage в proto формат
      const protoMessage = this.convertToProto(message)
      const messageString = JSON.stringify(protoMessage)
      
      this.addLog(`Отправка gRPC сообщения: ${message.action}`, 'info')
      await invoke('send_webrtc_message', { messageJson: messageString })
    } catch (error) {
      this.addLog(
        `Ошибка отправки gRPC сообщения (${message.action}): ${error}`,
        'error',
      )
    }
  }

  // Настройка слушателя событий
  private async setupEventListener(): Promise<void> {
    this.unlistenFn = await listen('voice-event', (event) => {
      const { type, data } = event.payload as any
      
      if (type === 'signaling_message') {
        this.handleMessage(data)
      }
    })
  }

  // Обработка входящих сообщений
  private handleMessage(serverMessage: any): void {
    // Определяем тип сообщения для логирования
    const messageType = serverMessage.message ? Object.keys(serverMessage.message)[0] : 'unknown'
    this.addLog(`Получено gRPC сообщение: ${messageType}`, 'info')

    // Конвертируем proto message в mediasoup format
    const message = this.convertProtoToMediasoup(serverMessage)
    
    if (!message) {
      this.addLog(`Не удалось конвертировать proto сообщение типа: ${messageType}`, 'error')
      return
    }

    // Если есть внешний обработчик сообщений, передаем ему
    if (this.onMessage) {
      this.onMessage(message)
      return
    }

    // Обработка сообщений сервера (fallback)
    switch (message.action) {
      case 'Init':
        this.handleInitMessage(message as ServerInit)
        break
      case 'ProducerAdded':
        const producerAddedMsg = message as ServerProducerAdded
        this.addLog(
          `Сервер сообщил о новом продюсере [${producerAddedMsg.producerId}] от участника ${producerAddedMsg.participantId}`,
          'info',
        )
        this.onProducerAdded(
          producerAddedMsg.producerId,
          producerAddedMsg.participantId,
          producerAddedMsg.appData,
        )
        break
      case 'ProducerRemoved':
        const producerRemovedMsg = message as ServerProducerRemoved
        this.addLog(
          `Сервер сообщил об удалении продюсера [${producerRemovedMsg.producerId}] от участника ${producerRemovedMsg.participantId}`,
          'info',
        )
        this.onProducerRemoved(
          producerRemovedMsg.producerId,
          producerRemovedMsg.participantId,
        )
        break
      case 'Error':
        this.addLog(
          `Ошибка от сервера: ${(message as ServerError).message}`,
          'error',
        )
        break
      default:
        this.addLog(
          `Получено необработанное gRPC сообщение: ${message.action}`,
          'info',
        )
    }
  }

  // Конвертация proto сообщения в mediasoup формат
  private convertProtoToMediasoup(protoMessage: any): ServerMessage | null {
    const message = protoMessage.message
    
    if (!message) {
      this.addLog('Proto message не содержит поле message', 'error')
      return null
    }

    // Определяем тип сообщения по oneof field (camelCase)
    if (message.init) {
      return {
        action: 'Init',
        routerRtpCapabilities: this.parseRtpCapabilities(message.init.routerRtpCapabilities || message.init.router_rtp_capabilities),
        producerTransportOptions: this.parseTransportOptions(message.init.producerTransportOptions || message.init.producer_transport_options),
        consumerTransportOptions: this.parseTransportOptions(message.init.consumerTransportOptions || message.init.consumer_transport_options),
      } as ServerInit
    }
    
    if (message.producerAdded || message.producer_added) {
      const data = message.producerAdded || message.producer_added
      return {
        action: 'ProducerAdded',
        producerId: data.producerId || data.producer_id,
        participantId: data.participantId || data.participant_id,
        appData: JSON.parse(data.appData || data.app_data || '{}'),
      } as ServerProducerAdded
    }
    
    if (message.producerRemoved || message.producer_removed) {
      const data = message.producerRemoved || message.producer_removed
      return {
        action: 'ProducerRemoved',
        producerId: data.producerId || data.producer_id,
        participantId: data.participantId || data.participant_id,
      } as ServerProducerRemoved
    }
    
    if (message.consumed) {
      return {
        action: 'Consumed',
        id: message.consumed.consumerId || message.consumed.consumer_id,
        producerId: message.consumed.producerId || message.consumed.producer_id,
        kind: this.convertMediaKind(message.consumed.kind),
        rtpParameters: this.parseRtpParameters(message.consumed.rtpParameters || message.consumed.rtp_parameters),
      } as ServerConsumed
    }
    
    if (message.connectedProducerTransport || message.connected_producer_transport) {
      return {
        action: 'ConnectedProducerTransport',
        success: true,
      } as ServerMessage
    }
    
    if (message.connectedConsumerTransport || message.connected_consumer_transport) {
      return {
        action: 'ConnectedConsumerTransport',
        success: true,
      } as ServerMessage
    }
    
    if (message.produced) {
      return {
        action: 'Produced',
        id: message.produced.producerId || message.produced.producer_id,
      } as ServerMessage
    }
    
    if (message.error) {
      return {
        action: 'Error',
        message: message.error.errorMessage || message.error.error_message,
      } as ServerError
    }

    this.addLog(`Неизвестный тип proto сообщения: ${Object.keys(message).join(', ')}`, 'error')
    return null
  }

  // Парсинг RtpCapabilities из proto
  private parseRtpCapabilities(proto: any): mediasoupTypes.RtpCapabilities {
    if (!proto || !proto.codecs || !proto.codecs[0]) {
      return { codecs: [], headerExtensions: [] }
    }
    
    const mimeType = proto.codecs[0].mimeType || proto.codecs[0].mime_type
    if (!mimeType) {
      return { codecs: [], headerExtensions: [] }
    }
    
    try {
      // RtpCapabilities сериализованы в JSON в поле mimeType/mime_type
      return JSON.parse(mimeType)
    } catch (error) {
      this.addLog(`Ошибка парсинга RtpCapabilities: ${error}`, 'error')
      return { codecs: [], headerExtensions: [] }
    }
  }

  // Парсинг TransportOptions из proto
  private parseTransportOptions(proto: any): mediasoupTypes.TransportOptions {
    if (!proto) {
      return {} as mediasoupTypes.TransportOptions
    }

    const iceParams = proto.iceParameters || proto.ice_parameters
    const iceCandidates = proto.iceCandidates || proto.ice_candidates
    const dtlsParams = proto.dtlsParameters || proto.dtls_parameters

    // Парсим fingerprints, которые могут прийти в Debug формате из Rust
    const fingerprints = dtlsParams?.fingerprints?.map((fp: any) => {
      let algorithm = fp.algorithm
      let value = fp.value
      
      // Если algorithm содержит "Sha1 { value" и т.д., извлекаем правильное имя
      if (algorithm.includes('{')) {
        algorithm = algorithm.split(' ')[0].toLowerCase() // "Sha1" -> "sha1"
        // Нормализуем имена алгоритмов для mediasoup
        if (algorithm === 'sha1') algorithm = 'sha-1'
        else if (algorithm === 'sha224') algorithm = 'sha-224'
        else if (algorithm === 'sha256') algorithm = 'sha-256'
        else if (algorithm === 'sha384') algorithm = 'sha-384'
        else if (algorithm === 'sha512') algorithm = 'sha-512'
      }
      
      // Если value содержит кавычки и закрывающую скобку, очищаем
      if (value.includes('"')) {
        value = value.replace(/"/g, '').replace(/\s*}\s*$/, '').trim()
      }
      
      this.addLog(`Fingerprint parsed: ${algorithm} = ${value.substring(0, 20)}...`, 'debug')
      
      return {
        algorithm,
        value,
      }
    }) || []

    // Парсим DTLS role
    let dtlsRole: 'auto' | 'client' | 'server' = 'auto'
    if (dtlsParams?.role) {
      const role = dtlsParams.role.toLowerCase()
      if (role === 'auto' || role === 'client' || role === 'server') {
        dtlsRole = role as 'auto' | 'client' | 'server'
      }
    }

    return {
      id: proto.id,
      iceParameters: {
        usernameFragment: iceParams?.usernameFragment || iceParams?.username_fragment || '',
        password: iceParams?.password || '',
        iceLite: iceParams?.iceLite || iceParams?.ice_lite || false,
      },
      iceCandidates: iceCandidates?.map((candidate: any) => ({
        foundation: candidate.foundation,
        priority: candidate.priority,
        ip: candidate.address,
        protocol: (candidate.protocol?.toLowerCase() || 'udp') as 'udp' | 'tcp',
        port: candidate.port,
        type: 'host' as 'host' | 'srflx' | 'prflx' | 'relay',
        tcpType: candidate.tcpType || candidate.tcp_type || undefined,
      })) || [],
      dtlsParameters: {
        role: dtlsRole,
        fingerprints,
      },
    }
  }

  // Парсинг RtpParameters из proto
  private parseRtpParameters(proto: any): any {
    if (!proto || !proto.mid) {
      return {}
    }
    
    try {
      // RtpParameters сериализованы в JSON в поле mid
      return JSON.parse(proto.mid)
    } catch (error) {
      this.addLog(`Ошибка парсинга RtpParameters: ${error}`, 'error')
      return {}
    }
  }

  // Конвертация MediaKind из proto enum
  private convertMediaKind(kind: number): 'audio' | 'video' {
    switch (kind) {
      case 1: // AUDIO
        return 'audio'
      case 2: // VIDEO
        return 'video'
      default:
        return 'audio'
    }
  }

  // Конвертация mediasoup сообщения в proto формат
  public convertToProto(message: ClientMessage): any {
    const baseMessage = {
      action: message.action,
    }

    switch (message.action) {
      case 'Init':
        return {
          message: {
            init: {
              roomId: this.sessionId,
              rtpCapabilities: {
                codecs: [{
                  mimeType: JSON.stringify(message.rtpCapabilities),
                  kind: 'serialized',
                  preferredPayloadType: 0,
                  clockRate: 0,
                  channels: 0,
                  parameters: '',
                  rtcpFeedback: '',
                }],
                headerExtensions: [],
              },
            },
          },
        }
      
      case 'ConnectProducerTransport':
        return {
          message: {
            connectProducerTransport: {
              dtlsParameters: {
                fingerprints: message.dtlsParameters?.fingerprints?.map(fp => ({
                  algorithm: fp.algorithm,
                  value: fp.value,
                })) || [],
                role: message.dtlsParameters?.role || 'auto',
              },
            },
          },
        }
      
      case 'ConnectConsumerTransport':
        return {
          message: {
            connectConsumerTransport: {
              dtlsParameters: {
                fingerprints: message.dtlsParameters?.fingerprints?.map(fp => ({
                  algorithm: fp.algorithm,
                  value: fp.value,
                })) || [],
                role: message.dtlsParameters?.role || 'auto',
              },
            },
          },
        }
      
      case 'Produce':
        return {
          message: {
            produce: {
              kind: message.kind === 'audio' ? 1 : 2, // AUDIO = 1, VIDEO = 2
              rtpParameters: {
                mid: JSON.stringify(message.rtpParameters),
                codecs: [],
                headerExtensions: [],
                encodings: [],
                rtcp: {
                  cname: '',
                  reducedSize: false,
                },
              },
              appData: JSON.stringify(message.appData || {}),
            },
          },
        }
      
      case 'Consume':
        return {
          message: {
            consume: {
              producerId: message.producerId,
            },
          },
        }
      
      case 'ConsumerResume':
        return {
          message: {
            consumerResume: {
              consumerId: message.consumerId,
            },
          },
        }
      
      default:
        return baseMessage
    }
  }

  // Обработка сообщения инициализации
  private handleInitMessage(initMessage: ServerInit): void {
    this.addLog('Получено сообщение Init от сервера', 'success')
    // Инициализация обрабатывается в WebRTCConnectionManager
  }
}
