import { MediasoupService } from './MediasoupService'
import { GrpcSignalingAdapter } from './GrpcSignalingAdapter'
import {
  ServerMessage,
  ClientMessage,
  ServerInit,
  ServerProducerAdded,
  ServerProducerRemoved,
  LoggerFunction,
  ServerConsumed,
} from '../types/mediasoup'
import { invoke } from '@tauri-apps/api/core'

// Type for server error messages
interface ServerError extends ServerMessage {
  action: 'Error'
  message: string
}

export interface WebRTCConnectionOptions {
  sessionId: string
  addLog: LoggerFunction
  mediasoupService: MediasoupService
  onProducerAdded: (
    producerId: string,
    participantId: string,
    appData: any,
  ) => void
  onProducerRemoved: (producerId: string, participantId: string) => void
  onConnectionStateChange: (state: boolean) => void
}

export class WebRTCConnectionManager {
  private grpcAdapter: GrpcSignalingAdapter | null = null
  private sessionId: string
  private addLog: LoggerFunction
  private mediasoupService: MediasoupService
  private pendingMessagesQueue: ServerMessage[] = []
  private onProducerAdded: (
    producerId: string,
    participantId: string,
    appData: any,
  ) => void
  private onProducerRemoved: (producerId: string, participantId: string) => void
  private onConnectionStateChange: (state: boolean) => void

  constructor(options: WebRTCConnectionOptions) {
    this.sessionId = options.sessionId
    this.addLog = options.addLog
    this.mediasoupService = options.mediasoupService
    this.onProducerAdded = options.onProducerAdded
    this.onProducerRemoved = options.onProducerRemoved
    this.onConnectionStateChange = options.onConnectionStateChange
  }

  // Начать WebRTC соединение
  public async connect(): Promise<void> {
    if (this.grpcAdapter) {
      this.addLog('gRPC соединение уже установлено', 'warning')
      return
    }

    this.addLog(`Подключение к gRPC SignalingStream: ${this.sessionId}`, 'info')

    // Создаем gRPC адаптер
    this.grpcAdapter = new GrpcSignalingAdapter({
      sessionId: this.sessionId,
      addLog: this.addLog,
      onProducerAdded: this.onProducerAdded,
      onProducerRemoved: this.onProducerRemoved,
      onConnectionStateChange: this.onConnectionStateChange,
      onMessage: this.handleMessage.bind(this),
    })

    // Очищаем очередь при новом подключении
    this.pendingMessagesQueue = []

    try {
      // Подключаемся через gRPC
      await this.grpcAdapter.connect()

      // Присоединяемся к сессии
      await invoke('join_session', { sessionId: this.sessionId })

      this.addLog('gRPC SignalingStream соединение установлено', 'success')
    } catch (error) {
      this.addLog(`Ошибка gRPC соединения: ${error}`, 'error')
      this.closeConnection()
      throw error
    }
  }

  // Закрыть соединение
  public closeConnection(): void {
    if (this.grpcAdapter) {
      this.addLog('Закрытие gRPC соединения...', 'info')
      this.grpcAdapter.closeConnection()
      this.grpcAdapter = null
    }
    this.mediasoupService.cleanup()
    this.onConnectionStateChange(false)
  }

  // Отправить сообщение серверу
  public async sendMessage(message: ClientMessage): Promise<void> {
    if (this.grpcAdapter) {
      await this.grpcAdapter.sendMessage(message)
    } else {
      this.addLog(
        `Не удалось отправить gRPC сообщение (${message.action}): соединение не установлено`,
        'error',
      )
    }
  }

  // Обработка входящих сообщений (теперь вызывается из GrpcSignalingAdapter)
  public async handleMessage(message: ServerMessage): Promise<void> {
    this.addLog(`Получено gRPC сообщение: ${message.action}`, 'info')

    // Проверяем, есть ли колбэк для этого типа сообщения в MediasoupService
    // Проверка для общих сообщений
    if (this.mediasoupService.handleCallback(message.action, message)) {
      return // Обработка была передана в MediasoupService
    }

    // Проверка для Consumed сообщений, которые связаны с конкретным producerId
    if (message.action === 'Consumed') {
      const consumedMessage = message as ServerConsumed
      const callbackKey = `Consumed:${consumedMessage.producerId}`
      if (this.mediasoupService.handleCallback(callbackKey, consumedMessage)) {
        return // Обработка была передана в MediasoupService
      }
    }

    // Если транспорты ещё не инициализированы и сообщение не относится к инициализации,
    // добавляем его в очередь для последующей обработки
    if (!this.mediasoupService.isInitialized() && message.action !== 'Init') {
      this.addLog(
        `Транспорты не инициализированы. Сообщение ${message.action} добавлено в очередь`,
        'info',
      )
      this.pendingMessagesQueue.push(message)
      return
    }

    // Обработка сообщений сервера
    switch (message.action) {
      case 'Init':
        await this.handleInitMessage(message as ServerInit)
        break
      case 'ProducerAdded':
        const producerAddedMsg = message as ServerProducerAdded
        console.log(message)
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
          `Получено необработанное WS сообщение: ${message.action}`,
          'info',
        )
    }
  }

  // Обработка сообщения инициализации
  private async handleInitMessage(initMessage: ServerInit): Promise<void> {
    this.addLog('Получено сообщение Init от сервера', 'success')

    try {
      // Инициализируем mediasoup Device
      await this.mediasoupService.initializeDevice(
        initMessage.routerRtpCapabilities,
      )

      // Создаем транспорты
      this.mediasoupService.createTransports(
        initMessage.producerTransportOptions,
        initMessage.consumerTransportOptions,
        this.sendMessage.bind(this),
      )

      this.onConnectionStateChange(true)
      this.addLog(
        'Mediasoup Device и транспорты успешно инициализированы',
        'success',
      )

      // Обрабатываем отложенные сообщения
      this.processPendingMessages()
    } catch (error) {
      this.addLog(`Ошибка во время Init от сервера: ${error}`, 'error')
      this.closeConnection()
    }
  }

  // Обработка отложенных сообщений
  private processPendingMessages(): void {
    if (this.pendingMessagesQueue.length > 0) {
      this.addLog(
        `Обработка ${this.pendingMessagesQueue.length} отложенных сообщений`,
        'info',
      )

      // Создаем копию, чтобы избежать проблем при рекурсивной обработке
      const messagesToProcess = [...this.pendingMessagesQueue]

      // Очищаем очередь
      this.pendingMessagesQueue = []

      // Обрабатываем каждое сообщение
      messagesToProcess.forEach((message) => {
        this.handleMessage(message)
      })
    }
  }
}
