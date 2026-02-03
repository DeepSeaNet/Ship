import { MediasoupService } from './MediasoupService'
import { Producer } from 'mediasoup-client/types'
import { LoggerFunction } from '../types/mediasoup'
import {
  AdvancedMicrophoneController,
  initializeAdvancedMicrophone,
  AdvancedMicrophoneOptions,
} from './MicrophoneController'

export interface MediaManagerOptions {
  mediasoupService: MediasoupService
  addLog: LoggerFunction
  useAdvancedMicrophoneController?: boolean
  microphoneOptions?: AdvancedMicrophoneOptions
}

export class MediaManager {
  private mediasoupService: MediasoupService
  private localVideoStream: MediaStream | null = null
  private localAudioStream: MediaStream | null = null
  private screenShareStream: MediaStream | null = null
  private screenShareProducerId: string | null = null
  private videoActive = false
  private audioActive = false
  private audioPaused = false
  private screenShareActive = false
  private addLog: LoggerFunction
  private microphoneController: AdvancedMicrophoneController | null = null
  private microphoneOptions: AdvancedMicrophoneOptions

  constructor(options: MediaManagerOptions) {
    this.mediasoupService = options.mediasoupService
    this.addLog = options.addLog
    this.microphoneOptions = options.microphoneOptions ?? {
      vadThreshold: 0.015,
      vadMinSpeechDuration: 150,
      vadMinSilenceDuration: 300,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      replaceSilenceWithPackets: true,
    }
  }

  /**
   * Получить локальный видео поток
   */
  public getLocalVideoStream(): MediaStream | null {
    return this.localVideoStream
  }

  /**
   * Получить локальный аудио поток
   */
  public getLocalAudioStream(): MediaStream | null {
    return this.localAudioStream
  }

  /**
   * Получить поток демонстрации экрана
   */
  public getScreenShareStream(): MediaStream | null {
    return this.screenShareStream
  }

  /**
   * Получить контроллер микрофона
   */
  public getMicrophoneController(): AdvancedMicrophoneController | null {
    return this.microphoneController
  }

  /**
   * Проверка, запущена ли камера
   */
  public isVideoActive(): boolean {
    //let check if producer appdData sourceType is camera
    const videoProducer = this.mediasoupService.getProducers().get('video')
    if (!videoProducer) return false
    return videoProducer.appData.sourceType === 'camera'
  }

  /**
   * Проверка, запущен ли микрофон
   */
  public isAudioActive(): boolean {
    // Проверяем наличие producer'а и активен ли он
    const audioProducer = this.mediasoupService.getProducers().get('audio')
    if (!audioProducer) return false

    // Если есть контроллер микрофона, проверяем его состояние
    if (this.microphoneController) {
      return this.microphoneController.isActive()
    }

    // В противном случае проверяем просто наличие producer'а
    return !audioProducer.paused
  }

  /**
   * Запустить камеру и создать видео producer
   */
  public async startVideo(): Promise<Producer | null> {
    if (!this.mediasoupService.getSendTransport()) {
      this.addLog(
        'Невозможно запустить камеру: SendTransport не инициализирован',
        'error',
      )
      return null
    }

    if (this.isVideoActive()) {
      this.addLog('Камера уже запущена', 'warning')
      return this.mediasoupService.getProducers().get('video') || null
    }

    try {
      this.addLog('Запуск камеры...', 'info')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
      })

      if (!stream || !stream.getVideoTracks().length) {
        this.addLog(
          'Не удалось получить видеопоток или нет видеотреков',
          'error',
        )
        return null
      }

      this.addLog(
        `Получен поток камеры: ${stream.id}, треков: ${stream.getVideoTracks().length}`,
        'success',
      )

      // Создаем отдельный поток только для видео
      const videoTrack = stream.getVideoTracks()[0]
      const videoOnlyStream = new MediaStream([videoTrack])
      this.localVideoStream = videoOnlyStream

      this.addLog(
        `Создание Producer для видео трека ${videoTrack.id}...`,
        'info',
      )
      const videoProducer = await this.mediasoupService.createProducer(
        videoTrack,
        'camera',
      )

      if (!videoProducer) {
        this.addLog('Не удалось создать видео Producer', 'error')
        this.stopVideoTracks()
        return null
      }

      // Логируем информацию о треке и потоке
      this.addLog(
        `Видео Producer создан: id=${videoProducer.id}, трек=${videoTrack.id}, активен=${videoTrack.enabled}`,
        'success',
      )
      this.addLog(
        `Локальный видеопоток: ${this.localVideoStream.id}, треков: ${this.localVideoStream.getTracks().length}`,
        'info',
      )

      return videoProducer
    } catch (error) {
      this.addLog(`Ошибка запуска камеры: ${error}`, 'error')
      this.stopVideoTracks()
      return null
    }
  }

  /**
   * Остановить камеру и закрыть видео producer
   */
  public stopVideo(): void {
    const videoProducer = this.mediasoupService.getProducers().get('video')
    if (videoProducer) {
      this.addLog(`Остановка видео Producer ${videoProducer.id}...`, 'info')
      videoProducer.close()
      this.mediasoupService.getProducers().delete('video')
    }

    this.stopVideoTracks()
  }

  /**
   * Остановить видео треки
   */
  private stopVideoTracks(): void {
    if (this.localVideoStream) {
      this.addLog(
        `Остановка локального видео потока ${this.localVideoStream.id}`,
        'info',
      )

      // Лучше явно перечислить треки, чтобы быть уверенным в их закрытии
      const tracks = this.localVideoStream.getTracks()
      this.addLog(`Остановка ${tracks.length} треков`, 'info')

      tracks.forEach((track) => {
        this.addLog(`Остановка трека ${track.id} (тип: ${track.kind})`, 'info')
        track.stop()
      })

      this.localVideoStream = null
    } else {
      this.addLog('Нет активного видеопотока для остановки', 'info')
    }
  }

  /**
   * Создать контроллер микрофона
   * @param producer аудио producer
   */
  private async createMicrophoneController(producer: Producer): Promise<void> {
    this.addLog('Инициализация контроллера микрофона...', 'info')
    try {
      const advancedController = await initializeAdvancedMicrophone(
        producer,
        this.microphoneOptions,
      )
      if (advancedController) {
        this.microphoneController = advancedController
        this.addLog('Контроллер микрофона успешно инициализирован', 'success')
      }
    } catch (error) {
      this.addLog(`Ошибка инициализации контроллера: ${error}`, 'error')
    }
  }

  /**
   * Запустить микрофон и создать аудио producer
   */
  public async startAudio(): Promise<Producer | null> {
    if (!this.mediasoupService.getSendTransport()) {
      this.addLog(
        'Невозможно запустить микрофон: SendTransport не инициализирован',
        'error',
      )
      return null
    }

    if (this.isAudioActive() && this.microphoneController) {
      this.addLog('Микрофон уже запущен', 'warning')
      return this.mediasoupService.getProducers().get('audio') || null
    }

    try {
      this.addLog('Запуск микрофона...', 'info')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      if (!stream || !stream.getAudioTracks().length) {
        this.addLog(
          'Не удалось получить аудиопоток или нет аудиотреков',
          'error',
        )
        return null
      }

      this.addLog(
        `Получен поток микрофона: ${stream.id}, треков: ${stream.getAudioTracks().length}`,
        'success',
      )

      // Создаем отдельный поток только для аудио
      const audioTrack = stream.getAudioTracks()[0]
      const audioOnlyStream = new MediaStream([audioTrack])
      this.localAudioStream = audioOnlyStream

      this.addLog(
        `Создание Producer для аудио трека ${audioTrack.id}...`,
        'info',
      )
      const audioProducer = await this.mediasoupService.createProducer(
        audioTrack,
        'microphone',
      )

      if (!audioProducer) {
        this.addLog('Не удалось создать аудио Producer', 'error')
        this.stopAudioTracks()
        return null
      }

      // Создаем контроллер микрофона
      await this.createMicrophoneController(audioProducer)

      // Логируем информацию о треке и потоке
      this.addLog(
        `Аудио Producer создан: id=${audioProducer.id}, трек=${audioTrack.id}, активен=${audioTrack.enabled}`,
        'success',
      )
      this.audioActive = true
      return audioProducer
    } catch (error) {
      this.addLog(`Ошибка запуска микрофона: ${error}`, 'error')
      this.stopAudioTracks()
      return null
    }
  }

  /**
   * Остановить микрофон и закрыть аудио producer
   */
  public stopAudio(): void {
    // Очищаем контроллер микрофона, если он есть
    if (this.microphoneController) {
      this.addLog('Очистка контроллера микрофона', 'info')
      this.microphoneController.cleanup()
      this.microphoneController = null
    }

    const audioProducer = this.mediasoupService.getProducers().get('audio')
    if (audioProducer) {
      this.addLog(`Остановка аудио Producer ${audioProducer.id}...`, 'info')
      audioProducer.close()
      this.mediasoupService.getProducers().delete('audio')
    }

    this.stopAudioTracks()
  }

  /**
   * Приостановить передачу аудио
   */
  public async pauseAudio(): Promise<void> {
    if (!this.microphoneController) {
      this.addLog('Контроллер микрофона не инициализирован', 'warning')
      return
    }

    this.addLog('Приостановка передачи аудио...', 'info')
    await this.microphoneController.pause()
  }

  /**
   * Возобновить передачу аудио
   */
  public async resumeAudio(): Promise<void> {
    if (!this.microphoneController) {
      this.addLog('Контроллер микрофона не инициализирован', 'warning')
      return
    }

    this.addLog('Возобновление передачи аудио...', 'info')
    await this.microphoneController.resume()
  }

  /**
   * Переключить состояние микрофона (вкл/выкл)
   */
  public async toggleAudio(): Promise<void> {
    if (this.audioPaused && this.audioActive) {
      await this.resumeAudio()
      this.audioPaused = false
    } else if (!this.audioPaused && this.audioActive) {
      await this.pauseAudio()
      this.audioPaused = true
    } else {
      await this.startAudio()
    }
  }

  /**
   * Запустить демонстрацию экрана и создать поток демонстрации экрана
   */
  public async startScreenShare(): Promise<MediaStream | null> {
    if (!this.mediasoupService.getSendTransport()) {
      this.addLog(
        'Невозможно запустить демонстрацию экрана: SendTransport не инициализирован',
        'error',
      )
      return null
    }

    try {
      this.addLog('Запуск демонстрации экрана с аудио...', 'info')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 },
        },
        audio: true, // Запрашиваем звук экрана
      })

      if (!stream || !stream.getVideoTracks().length) {
        this.addLog(
          'Не удалось получить поток демонстрации экрана или нет видеотреков',
          'error',
        )
        return null
      }

      this.addLog(
        `Получен поток демонстрации экрана: ${stream.id}, видеотреков: ${stream.getVideoTracks().length}, аудиотреков: ${stream.getAudioTracks().length}`,
        'success',
      )

      this.screenShareStream = stream
      this.screenShareActive = true

      // Добавляем обработчик для отслеживания остановки демонстрации
      stream.getVideoTracks()[0].onended = () => {
        this.addLog(
          'Видеотрек демонстрации экрана завершен, останавливаем демонстрацию',
          'info',
        )
        this.stopScreenShare()
      }

      return stream
    } catch (error) {
      this.addLog(`Ошибка запуска демонстрации экрана: ${error}`, 'error')
      this.screenShareActive = false
      return null
    }
  }

  /**
   * Опубликовать демонстрацию экрана
   */
  public async publishScreenShare(): Promise<void> {
    if (!this.screenShareStream) {
      this.addLog('Поток демонстрации экрана не инициализирован', 'error')
      return
    }

    try {
      // Публикуем видеотрек
      const videoTrack = this.screenShareStream.getVideoTracks()[0]
      if (videoTrack) {
        this.addLog('Публикация видео демонстрации экрана...', 'info')
        const videoProducerId = await this.mediasoupService.createProducer(
          videoTrack,
          'screen-video',
        )
        this.screenShareProducerId = videoProducerId?.toString() ?? ''
        this.addLog(
          `Видео демонстрации экрана опубликовано, producerId: ${videoProducerId}`,
          'success',
        )
      }

      // Публикуем аудиотрек, если он есть
      const audioTracks = this.screenShareStream.getAudioTracks()
      if (audioTracks.length > 0) {
        this.addLog('Публикация аудио демонстрации экрана...', 'info')
        const audioProducerId = await this.mediasoupService.createProducer(
          audioTracks[0],
          'screen-audio',
        )
        this.addLog(
          `Аудио демонстрации экрана опубликовано, producerId: ${audioProducerId}`,
          'success',
        )
      } else {
        this.addLog('Аудиотрек для демонстрации экрана отсутствует', 'warning')
      }

      this.addLog('Демонстрация экрана опубликована успешно', 'success')
    } catch (error) {
      this.addLog(
        `Ошибка при публикации демонстрации экрана: ${error}`,
        'error',
      )
      this.screenShareActive = false
      this.stopScreenShare()
      throw error
    }
  }

  /**
   * Остановить демонстрацию экрана и закрыть поток демонстрации экрана
   */
  public stopScreenShare(): void {
    if (this.screenShareStream) {
      this.addLog(
        `Остановка демонстрации экрана ${this.screenShareStream.id}`,
        'info',
      )

      // Останавливаем все треки
      const tracks = this.screenShareStream.getTracks()
      this.addLog(
        `Остановка ${tracks.length} треков демонстрации экрана`,
        'info',
      )

      tracks.forEach((track) => {
        this.addLog(
          `Остановка трека ${track.id} (тип: ${track.kind}) демонстрации экрана`,
          'info',
        )
        track.stop()
      })

      // Очищаем поток и статус
      this.screenShareStream = null
      this.screenShareActive = false
      this.screenShareProducerId = null

      this.addLog('Демонстрация экрана остановлена', 'success')
    } else {
      this.addLog(
        'Нет активного потока демонстрации экрана для остановки',
        'info',
      )
    }
  }

  /**
   * Установить поток демонстрации экрана
   */
  public setScreenShareStream(stream: MediaStream): void {
    this.screenShareStream = stream
  }
  private stopAudioTracks(): void {
    if (this.localAudioStream) {
      this.addLog(
        `Остановка локального аудио потока ${this.localAudioStream.id}`,
        'info',
      )

      // Лучше явно перечислить треки, чтобы быть уверенным в их закрытии
      const tracks = this.localAudioStream.getTracks()
      this.addLog(`Остановка ${tracks.length} треков`, 'info')

      tracks.forEach((track) => {
        this.addLog(`Остановка трека ${track.id} (тип: ${track.kind})`, 'info')
        track.stop()
      })

      this.localAudioStream = null
    } else {
      this.addLog('Нет активного аудиопотока для остановки', 'info')
    }
  }
  /**
   * Остановить все медиа треки и продюсеры
   */
  public stopAllMedia(): void {
    this.stopVideo()
    this.stopAudio()
    this.stopScreenShare()
  }
}
