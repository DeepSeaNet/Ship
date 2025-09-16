import { Device, types as mediasoupTypes } from 'mediasoup-client'
import { Transport } from 'mediasoup-client/types'
import { Producer } from 'mediasoup-client/types'
import { Consumer } from 'mediasoup-client/types'
import { RtpParameters, MediaKind } from 'mediasoup-client/types'
import { DtlsParameters } from 'mediasoup-client/types'
import {
  ServerProduced,
  ServerConsumed,
  ConsumerId,
  LoggerFunction,
  TransformApi,
} from '../types/mediasoup'
import {
  applyEncryptionToSender,
  applyDecryptionToReceiver,
  initEncodedStreamWorker,
  terminateEncodedStreamWorker,
} from '../utils/encodedStreamsTransform'

// Type definitions for callback responses
interface CallbackResponse {
  [key: string]: unknown
}

interface WebSocketMessage {
  action: string
  [key: string]: unknown
}

export interface MediasoupServiceOptions {
  sessionId: string
  addLog: LoggerFunction
  onTransportsInitialized?: () => void
  transformApi: TransformApi
  encryptionWorker?: Worker | null
  decryptionWorker?: Worker | null
}

export class MediasoupService {
  private device: Device | null = null
  private sendTransport: Transport | null = null
  private recvTransport: Transport | null = null
  private producers: Map<string, Producer> = new Map()
  private consumers: Map<ConsumerId, Consumer> = new Map()
  private responseCallbacks: Map<string, (data: CallbackResponse) => void> =
    new Map()
  private initialized = false

  private addLog: LoggerFunction
  private onTransportsInitialized?: () => void
  private transformApi: TransformApi
  private sessionId: string
  private encryptionWorker: Worker | null
  private decryptionWorker: Worker | null
  private encodedStreamWorker: Worker | null = null

  constructor(options: MediasoupServiceOptions) {
    this.addLog = options.addLog
    this.sessionId = options.sessionId
    this.transformApi = options.transformApi
    this.onTransportsInitialized = options.onTransportsInitialized
    this.encryptionWorker = options.encryptionWorker || null
    this.decryptionWorker = options.decryptionWorker || null

    // Initialize encoded stream worker if using that API
    if (this.transformApi === 'encodedStreams') {
      this.initEncodedStreamWorker()
    }
  }

  /**
   * Initialize encoded stream worker
   */
  private initEncodedStreamWorker(): void {
    try {
      this.addLog('Initializing encoded stream worker...', 'info')
      this.encodedStreamWorker = initEncodedStreamWorker()
      this.addLog('Encoded stream worker initialized successfully', 'success')
    } catch (error) {
      this.addLog(
        `Failed to initialize encoded stream worker: ${error}`,
        'error',
      )
    }
  }

  public getDevice(): Device | null {
    return this.device
  }

  public getSendTransport(): Transport | null {
    return this.sendTransport
  }

  public getRecvTransport(): Transport | null {
    return this.recvTransport
  }

  public getProducers(): Map<string, Producer> {
    return this.producers
  }

  public getConsumers(): Map<ConsumerId, Consumer> {
    return this.consumers
  }

  public isInitialized(): boolean {
    return this.initialized
  }

  public setResponseCallback(
    action: string,
    callback: (data: CallbackResponse) => void,
  ): void {
    this.responseCallbacks.set(action, callback)
  }

  public handleCallback(action: string, data: CallbackResponse): boolean {
    const callback = this.responseCallbacks.get(action)
    if (callback) {
      this.responseCallbacks.delete(action)
      try {
        callback(data)
        return true
      } catch (error) {
        this.addLog(
          `Ошибка выполнения callback для ${action}: ${error}`,
          'error',
        )
      }
    }
    return false
  }

  // Инициализация медиасуп устройства
  public async initializeDevice(
    routerRtpCapabilities: mediasoupTypes.RtpCapabilities,
  ): Promise<void> {
    try {
      this.addLog('Создание mediasoup Device...', 'info')
      const device = new Device()
      this.device = device
      this.addLog('Device создан', 'success')

      await device.load({ routerRtpCapabilities })
      this.addLog('Device загружен с routerRtpCapabilities', 'success')
    } catch (error) {
      this.addLog(`Ошибка инициализации Device: ${error}`, 'error')
      throw error
    }
  }

  // Создание транспортов отправки и получения
  public createTransports(
    producerTransportOptions: mediasoupTypes.TransportOptions,
    consumerTransportOptions: mediasoupTypes.TransportOptions,
    sendMessage: (message: WebSocketMessage) => void,
  ): void {
    if (!this.device) {
      this.addLog(
        'Невозможно создать транспорты: Device не инициализирован',
        'error',
      )
      return
    }

    // Создание Send Transport
    this.addLog('Создание Producer Transport...', 'info')
    const transport_options = { ...producerTransportOptions }
    if (this.transformApi === 'encodedStreams') {
      transport_options.additionalSettings = {
        //encodedInsertableStreams: true,
      }
    }

    const sendTransport = this.device.createSendTransport(transport_options)
    this.sendTransport = sendTransport

    sendTransport.on(
      'connect',
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
      ) => {
        this.addLog('SendTransport событие: connect', 'info')
        sendMessage({ action: 'ConnectProducerTransport', dtlsParameters })
        this.setResponseCallback(
          'ConnectedProducerTransport',
          (response: CallbackResponse) => {
            console.log(response)
            this.addLog('SendTransport успешно подключен к серверу', 'success')
            callback()
          },
        )
      },
    )

    sendTransport.on(
      'produce',
      async (
        {
          kind,
          rtpParameters,
          appData,
        }: { kind: MediaKind; rtpParameters: RtpParameters; appData: any },
        callback: (response: ServerProduced) => void,
      ) => {
        this.addLog(`SendTransport событие: produce (kind: ${kind})`, 'info')
        sendMessage({ action: 'Produce', kind, rtpParameters, appData })
        this.setResponseCallback('Produced', (response: CallbackResponse) => {
          this.addLog(
            `Producer ${(response as ServerProduced).id} (kind: ${kind}) успешно создан на сервере`,
            'success',
          )
          callback(response as ServerProduced)
        })
      },
    )

    sendTransport.on('connectionstatechange', (state: string) => {
      this.addLog(
        `SendTransport состояние ICE изменено: ${state}`,
        state === 'connected'
          ? 'success'
          : state === 'failed' || state === 'disconnected'
            ? 'error'
            : 'info',
      )
      if (
        state === 'failed' ||
        state === 'disconnected' ||
        state === 'closed'
      ) {
        this.addLog(
          `SendTransport ICE соединение ${state}, возможна проблема`,
          'warning',
        )
      }
    })

    // Создание Receive Transport
    this.addLog('Создание Consumer Transport...', 'info')
    let recvTransport: Transport
    if (this.transformApi === 'encodedStreams') {
      recvTransport = this.device.createRecvTransport({
        ...consumerTransportOptions,
        additionalSettings: {
          //encodedInsertableStreams: true,
        },
      })
    } else {
      recvTransport = this.device.createRecvTransport(consumerTransportOptions)
    }
    this.recvTransport = recvTransport

    recvTransport.on(
      'connect',
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
      ) => {
        this.addLog('RecvTransport событие: connect', 'info')
        sendMessage({ action: 'ConnectConsumerTransport', dtlsParameters })
        this.setResponseCallback(
          'ConnectedConsumerTransport',
          (response: CallbackResponse) => {
            console.log(response)
            this.addLog('RecvTransport успешно подключен к серверу', 'success')
            callback()
          },
        )
      },
    )

    recvTransport.on('connectionstatechange', (state: string) => {
      this.addLog(
        `RecvTransport состояние ICE изменено: ${state}`,
        state === 'connected'
          ? 'success'
          : state === 'failed' || state === 'disconnected'
            ? 'error'
            : 'info',
      )
      if (
        state === 'failed' ||
        state === 'disconnected' ||
        state === 'closed'
      ) {
        this.addLog(
          `RecvTransport ICE соединение ${state}, возможна проблема`,
          'warning',
        )
      }
    })

    this.initialized = true
    if (this.onTransportsInitialized) {
      this.onTransportsInitialized()
    }
  }

  // Создание продюсера для аудио или видео
  public async createProducer(
    track: MediaStreamTrack,
    sourceType: string,
  ): Promise<Producer | null> {
    if (!this.sendTransport) {
      this.addLog(
        'Невозможно создать Producer: SendTransport не инициализирован',
        'error',
      )
      return null
    }

    try {
      const producer = await this.sendTransport.produce({
        track,
        appData: { sourceType, mediaType: track.kind, shared: true },
      })
      console.log(producer)
      this.producers.set(track.kind, producer)
      this.addLog(
        `Producer ${producer.id} создан (Track: ${track.id})`,
        'success',
      )

      // Применяем шифрование к producer.rtpSender
      await this.applyEncryptionToProducer(producer)

      producer.on('transportclose', () => {
        this.addLog(`Transport закрыт для Producer ${producer.id}`, 'warning')
        this.producers.delete(track.kind)
      })

      producer.on('trackended', () => {
        this.addLog(`Трек завершен для Producer ${producer.id}`, 'warning')
        this.producers.delete(track.kind)
      })
      return producer
    } catch (error) {
      this.addLog(`Ошибка создания Producer: ${error}`, 'error')
      return null
    }
  }

  // Применение шифрования к продюсеру
  private async applyEncryptionToProducer(producer: Producer): Promise<void> {
    if (!producer.rtpSender) {
      this.addLog(`Не найден rtpSender для Producer ${producer.id}`, 'warning')
      return
    }

    const kind = producer.kind

    if (this.transformApi === 'script' && this.encryptionWorker) {
      this.addLog(
        `Применение SCRIPT шифрования к ${kind} Producer ${producer.id}`,
        'info',
      )
      try {
        const transform = new RTCRtpScriptTransform(this.encryptionWorker, {})
        producer.rtpSender.transform = transform
        this.addLog(
          `SCRIPT шифрование ${kind} успешно применено к Producer ${producer.id}`,
          'success',
        )
      } catch (e: unknown) {
        this.addLog(
          `Ошибка SCRIPT шифрования для ${kind} Producer ${producer.id}: ${e}`,
          'error',
        )
      }
    } else if (this.transformApi === 'encodedStreams') {
      this.addLog(
        `Применение ENCODED STREAMS шифрования к ${kind} Producer ${producer.id}`,
        'info',
      )
      try {
        await applyEncryptionToSender(producer.rtpSender)
        this.addLog(
          `ENCODED STREAMS шифрование ${kind} успешно применено к Producer ${producer.id}`,
          'success',
        )
      } catch (e: unknown) {
        this.addLog(
          `Ошибка ENCODED STREAMS шифрования для ${kind} Producer ${producer.id}: ${e}`,
          'error',
        )
      }
    } else {
      this.addLog(
        `${kind} шифрование не применено к Producer ${producer.id}: API не поддерживается (${this.transformApi})`,
        'warning',
      )
    }
  }

  // Создание консюмера для удаленного трека
  public async createConsumer(
    consumedMessage: ServerConsumed,
    onTrackAdded: (
      track: MediaStreamTrack,
      consumerId: ConsumerId,
      producerId: string,
    ) => void,
    sendMessage: (message: WebSocketMessage) => void,
  ): Promise<Consumer | null> {
    if (!this.recvTransport) {
      this.addLog(
        `Невозможно создать Consumer ${consumedMessage.id}: RecvTransport не существует.`,
        'error',
      )
      return null
    }

    try {
      this.addLog(
        `Получены параметры для Consumer ${consumedMessage.id}, создаем...`,
        'info',
      )
      const consumer: Consumer = await this.recvTransport.consume({
        id: consumedMessage.id,
        producerId: consumedMessage.producerId,
        kind: consumedMessage.kind,
        rtpParameters: consumedMessage.rtpParameters,
      })

      this.addLog(
        `Consumer ${consumer.id} (kind: ${consumer.kind}) создан для Producer ${consumer.producerId}`,
        'success',
      )
      this.consumers.set(consumer.id, consumer)

      // Применяем дешифрование к consumer.rtpReceiver
      await this.applyDecryptionToConsumer(consumer)

      // Добавляем трек в UI через колбэк
      onTrackAdded(consumer.track, consumer.id, consumer.producerId)

      // Возобновляем consumer на сервере
      this.addLog(
        `Отправка запроса на возобновление Consumer ${consumer.id}`,
        'info',
      )
      sendMessage({ action: 'ConsumerResume', id: consumer.id })

      // Обработка закрытия consumer
      consumer.on('transportclose', () => {
        this.addLog(`Transport закрыт для Consumer ${consumer.id}`, 'warning')
        this.removeConsumer(consumer.id)
      })

      consumer.on('trackended', () => {
        this.addLog(`Трек завершен для Consumer ${consumer.id}`, 'warning')
        this.removeConsumer(consumer.id)
      })

      return consumer
    } catch (error) {
      this.addLog(
        `Ошибка создания Consumer для Producer ${consumedMessage.producerId}: ${error}`,
        'error',
      )
      return null
    }
  }

  // Применение дешифрования к консюмеру
  private async applyDecryptionToConsumer(consumer: Consumer): Promise<void> {
    if (!consumer.rtpReceiver) {
      this.addLog(
        `Не найден rtpReceiver для Consumer ${consumer.id}`,
        'warning',
      )
      return
    }

    if (this.transformApi === 'script' && this.decryptionWorker) {
      this.addLog(
        `Применение SCRIPT дешифрования к Consumer ${consumer.id}`,
        'info',
      )
      try {
        const transform = new RTCRtpScriptTransform(this.decryptionWorker, {})
        consumer.rtpReceiver.transform = transform
        this.addLog(
          `SCRIPT дешифрование успешно применено к Consumer ${consumer.id}`,
          'success',
        )
      } catch (e: unknown) {
        this.addLog(
          `Ошибка SCRIPT дешифрования для Consumer ${consumer.id}: ${e}`,
          'error',
        )
      }
    } else if (this.transformApi === 'encodedStreams') {
      this.addLog(
        `Применение ENCODED STREAMS дешифрования к Consumer ${consumer.id}`,
        'info',
      )
      try {
        await applyDecryptionToReceiver(consumer.rtpReceiver)
        this.addLog(
          `ENCODED STREAMS дешифрование успешно применено к Consumer ${consumer.id}`,
          'success',
        )
      } catch (e: unknown) {
        this.addLog(
          `Ошибка ENCODED STREAMS дешифрования для Consumer ${consumer.id}: ${e}`,
          'error',
        )
      }
    } else {
      this.addLog(
        `Дешифрование не применено к Consumer ${consumer.id}: API не поддерживается (${this.transformApi})`,
        'warning',
      )
    }
  }

  // Удаление консюмера
  public removeConsumer(
    consumerId: ConsumerId,
    onTrackRemoved?: (trackId: string) => void,
  ): void {
    const consumer = this.consumers.get(consumerId)
    if (consumer) {
      this.addLog(
        `Удаление Consumer ${consumer.id} (Producer: ${consumer.producerId}, Kind: ${consumer.kind})`,
        'info',
      )
      consumer.close()
      this.consumers.delete(consumerId)

      // Уведомляем о необходимости удалить медиа элемент
      if (consumer.track && onTrackRemoved) {
        onTrackRemoved(consumer.track.id)
      }
    } else {
      this.addLog(
        `Попытка удалить несуществующий Consumer ${consumerId}`,
        'warning',
      )
    }
  }

  // Очистка всех ресурсов
  public cleanup(): void {
    // Закрываем все consumers
    this.addLog('Закрытие Consumers...', 'info')
    this.consumers.forEach((consumer) => {
      consumer.close()
    })
    this.consumers.clear()

    // Закрываем все producers
    this.addLog('Закрытие Producers...', 'info')
    this.producers.forEach((producer) => {
      producer.close()
    })
    this.producers.clear()

    // Закрываем транспорты
    if (this.sendTransport) {
      this.addLog('Закрытие SendTransport...', 'info')
      this.sendTransport.close()
      this.sendTransport = null
    }
    if (this.recvTransport) {
      this.addLog('Закрытие RecvTransport...', 'info')
      this.recvTransport.close()
      this.recvTransport = null
    }

    // Terminate encoded stream worker if it was initialized
    if (this.transformApi === 'encodedStreams') {
      this.addLog('Terminating encoded stream worker...', 'info')
      terminateEncodedStreamWorker()
      this.encodedStreamWorker = null
    }

    this.device = null
    this.initialized = false
    this.responseCallbacks.clear()
  }
}
