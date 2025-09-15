import { MediasoupService } from './MediasoupService'
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
  serverUrl: string
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
  private ws: WebSocket | null = null
  private sessionId: string
  private serverUrl: string
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
    this.serverUrl = options.serverUrl
    this.addLog = options.addLog
    this.mediasoupService = options.mediasoupService
    this.onProducerAdded = options.onProducerAdded
    this.onProducerRemoved = options.onProducerRemoved
    this.onConnectionStateChange = options.onConnectionStateChange
  }

  // Начать WebRTC соединение
  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.addLog('Соединение уже установлено', 'warning')
      return
    }

    const wsUrl = `${this.serverUrl}/ws?roomId=${encodeURIComponent(this.sessionId)}`
    this.addLog(`Подключение к WebSocket: ${wsUrl}`, 'info')

    const ws = new WebSocket(wsUrl)
    this.ws = ws

    // Очищаем очередь при новом подключении
    this.pendingMessagesQueue = []

    ws.onopen = async () => {
      this.addLog('WebSocket соединение установлено', 'success')
      await invoke('join_session', { sessionId: this.sessionId })
    }

    ws.onmessage = this.handleMessage.bind(this)

    ws.onerror = (error) => {
      this.addLog(`Ошибка WebSocket: ${error}`, 'error')
      this.closeConnection()
    }

    ws.onclose = (event) => {
      this.addLog(
        `WebSocket соединение закрыто: код=${event.code}, причина=${event.reason}`,
        event.wasClean ? 'info' : 'warning',
      )
      this.onConnectionStateChange(false)
      // Можно добавить логику автоматического переподключения здесь
    }
  }

  // Закрыть соединение
  public closeConnection(): void {
    if (this.ws) {
      this.addLog('Закрытие WebSocket соединения...', 'info')
      this.ws.close()
      this.ws = null
    }
    this.mediasoupService.cleanup()
    this.onConnectionStateChange(false)
  }

  // Отправить сообщение серверу
  public sendMessage(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageString = JSON.stringify(message)
      this.addLog(`Отправка WS сообщения: ${message.action}`, 'info')
      this.ws.send(messageString)
    } else {
      this.addLog(
        `Не удалось отправить WS сообщение (${message.action}): WebSocket не готов`,
        'error',
      )
    }
  }

  // Обработка входящих сообщений
  private async handleMessage(event: MessageEvent): Promise<void> {
    let message: ServerMessage
    try {
      message = JSON.parse(event.data)
      this.addLog(`Получено WS сообщение: ${message.action}`, 'info')
    } catch (error) {
      this.addLog(`Ошибка парсинга WS сообщения: ${error}`, 'error')
      return
    }

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

      // Отправляем наши rtpCapabilities серверу
      this.sendMessage({
        action: 'Init',
        rtpCapabilities: this.mediasoupService.getDevice()!.rtpCapabilities,
      })

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
        // Создаем фейковое событие с данными сообщения
        const fakeEvent = { data: JSON.stringify(message) } as MessageEvent
        this.handleMessage(fakeEvent)
      })
    }
  }
}
