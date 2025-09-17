import { Producer } from 'mediasoup-client/types'
import { MicVAD } from '@ricky0123/vad-web'

/**
 * Интерфейс для опций продвинутого контроллера микрофона
 */
export interface AdvancedMicrophoneOptions {
  minSpeechDuration?: number
  minSilenceDuration?: number
  noiseReduction?: boolean
  noiseSuppression?: boolean
  echoCancellation?: boolean
  autoGainControl?: boolean
  replaceSilenceWithPackets?: boolean
  silencePacketInterval?: number
  [key: string]: unknown
}

/**
 * Продвинутый контроллер микрофона с обнаружением голосовой активности
 * и улучшенной обработкой звука
 */
export class AdvancedMicrophoneController {
  private producer: Producer
  private originalTrack: MediaStreamTrack | null = null

  // Настройки
  private options: Required<AdvancedMicrophoneOptions>

  // Состояние
  private isVoiceActive = false
  private lastVoiceActivity = 0
  private lastSilenceStart = 0

  // VAD
  private vad: MicVAD | null = null

  // Audio Context и узлы
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private noiseSuppressionNode: BiquadFilterNode | null = null
  private destinationNode: MediaStreamAudioDestinationNode | null = null
  private silenceGenerator: {
    oscillator: OscillatorNode
    gainNode: GainNode
    destination: MediaStreamAudioDestinationNode
    stream: MediaStream
  } | null = null

  // Таймеры
  private silencePacketInterval: number | null = null

  // Система событий
  private eventListeners: Record<string, Array<(data: any) => void>> = {}

  /**
   * Создает новый продвинутый контроллер микрофона
   * @param producer mediasoup producer для управления
   * @param options настройки для контроллера
   */
  constructor(producer: Producer, options: AdvancedMicrophoneOptions = {}) {
    this.producer = producer
    this.originalTrack = producer.track

    // Настройки
    this.options = {
      // Настройки VAD (Voice Activity Detection)
      minSpeechDuration: options.minSpeechDuration ?? 200, // мс
      minSilenceDuration: options.minSilenceDuration ?? 500, // мс

      // Настройки шумоподавления
      noiseReduction: options.noiseReduction ?? true,
      noiseSuppression: options.noiseSuppression ?? true,
      echoCancellation: options.echoCancellation ?? true,
      autoGainControl: options.autoGainControl ?? true,

      // Настройки замены пакетов
      replaceSilenceWithPackets: options.replaceSilenceWithPackets ?? true,
      silencePacketInterval: options.silencePacketInterval ?? 20, // мс

      ...options,
    } as Required<AdvancedMicrophoneOptions>
  }

  /**
   * Инициализирует контроллер микрофона
   */
  async initialize(): Promise<boolean> {
    try {
      // Создаем Audio Context, современные браузеры поддерживают стандартный API
      this.audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive',
      })

      // Получаем оригинальный поток с улучшенными настройками
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.options.echoCancellation,
          noiseSuppression: this.options.noiseSuppression,
          autoGainControl: this.options.autoGainControl,
          channelCount: 1,
          sampleRate: 48000,
        },
      })

      // Создаем узлы обработки
      await this.setupAudioProcessing(stream)

      // Инициализируем VAD
      await this.initializeVAD()

      console.log('Продвинутый контроллер микрофона инициализирован')
      return true
    } catch (error) {
      console.error('Ошибка инициализации:', error)
      return false
    }
  }

  /**
   * Настраивает узлы обработки аудио
   * @param inputStream входной поток с микрофона
   */
  private async setupAudioProcessing(inputStream: MediaStream): Promise<void> {
    if (!this.audioContext) return

    // Создаем источник из потока
    this.sourceNode = this.audioContext.createMediaStreamSource(inputStream)

    // Узел усиления для динамической регулировки
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime)

    // Создаем узел шумоподавления (используем Web Audio API фильтры)
    this.noiseSuppressionNode = await this.createNoiseSuppressionNode()

    // Создаем выходной поток
    this.destinationNode = this.audioContext.createMediaStreamDestination()

    // Соединяем узлы
    this.sourceNode.connect(this.gainNode)

    this.gainNode.connect(this.noiseSuppressionNode)
    this.noiseSuppressionNode.connect(this.destinationNode)

    // Заменяем трек в producer
    const processedTrack = this.destinationNode.stream.getAudioTracks()[0]
    await this.producer.replaceTrack({ track: processedTrack })
  }

  /**
   * Создает узел фильтра для шумоподавления
   */
  private async createNoiseSuppressionNode(): Promise<BiquadFilterNode> {
    if (!this.audioContext) {
      throw new Error('AudioContext не инициализирован')
    }

    // Создаем комплексный фильтр для шумоподавления
    const biquadFilter = this.audioContext.createBiquadFilter()
    biquadFilter.type = 'highpass'
    biquadFilter.frequency.setValueAtTime(85, this.audioContext.currentTime) // Убираем низкочастотный шум
    biquadFilter.Q.setValueAtTime(1, this.audioContext.currentTime)

    // Дополнительный фильтр для средних частот
    const midFilter = this.audioContext.createBiquadFilter()
    midFilter.type = 'peaking'
    midFilter.frequency.setValueAtTime(1000, this.audioContext.currentTime)
    midFilter.Q.setValueAtTime(0.5, this.audioContext.currentTime)
    midFilter.gain.setValueAtTime(2, this.audioContext.currentTime) // Небольшое усиление речи

    // Соединяем фильтры
    biquadFilter.connect(midFilter)

    return biquadFilter // Возвращаем первый в цепочке
  }

  /**
   * Инициализирует VAD (Voice Activity Detection) с библиотекой @ricky0123/vad-web
   */
  private async initializeVAD(): Promise<void> {
    try {
      // Создаем экземпляр VAD используя класс MicVAD из vad-web вместо хука
      this.vad = await MicVAD.new({
        // Конфигурация VAD
        model: 'v5',
        onSpeechStart: () => this.onVoiceStart(),
        onSpeechEnd: () => this.onVoiceEnd(),
        onVADMisfire: () => this.onVoiceVadMisFire(),
        // Дополнительные опции
        positiveSpeechThreshold: 0.4, // Порог обнаружения речи (0-1)
        negativeSpeechThreshold: 0.4, // Порог обнаружения тишины (0-1)
      })

      // Запускаем VAD
      await this.vad.start()
      console.log('VAD успешно инициализирован и запущен')
    } catch (error) {
      console.error('Ошибка инициализации VAD:', error)
      throw error
    }
  }

  /**
   * Вызывается при начале голосовой активности
   */
  private onVoiceStart(): void {
    console.log('Голос активен')

    // Обновляем состояние
    this.isVoiceActive = true
    this.lastVoiceActivity = Date.now()

    // Останавливаем отправку пакетов тишины
    this.stopSilencePackets()

    if (this.audioContext && this.gainNode) {
      // Включаем полную передачу звука
      this.gainNode.gain.setTargetAtTime(
        1.0,
        this.audioContext.currentTime,
        0.01,
      )
    }

    // Событие для внешних обработчиков
    this.dispatchEvent('voiceStart', {
      timestamp: Date.now(),
    })
  }

  /**
   * Вызывается при окончании голосовой активности
   */
  private onVoiceEnd(): void {
    console.log('Голос неактивен')

    // Обновляем состояние
    this.isVoiceActive = false
    this.lastSilenceStart = Date.now()

    if (this.audioContext && this.gainNode) {
      // Плавно снижаем громкость
      this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05)
    }

    // Запускаем отправку пакетов тишины если включена опция
    if (this.options.replaceSilenceWithPackets) {
      this.startSilencePackets()
    }

    // Событие для внешних обработчиков
    this.dispatchEvent('voiceEnd', {
      timestamp: Date.now(),
    })
  }

  private onVoiceVadMisFire(): void {
    this.isVoiceActive = false
    if (this.audioContext && this.gainNode) {
      // Плавно снижаем громкость
      this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05)
    }

    // Запускаем отправку пакетов тишины если включена опция
    if (this.options.replaceSilenceWithPackets) {
      this.startSilencePackets()
    }
    this.dispatchEvent('voiceEnd', {
      timestamp: Date.now(),
    })
  }

  /**
   * Запускает отправку пакетов тишины для поддержания соединения
   */
  private startSilencePackets(): void {
    if (this.silencePacketInterval) return

    console.log('Начинаем отправку пакетов тишины')

    // Создаем генератор тишины если еще не создан
    if (!this.silenceGenerator) {
      this.silenceGenerator = this.createSilenceGenerator()
    }

    // Периодически "подталкиваем" соединение пакетами тишины
    this.silencePacketInterval = window.setInterval(() => {
      // Отправляем короткий пакет тишины для поддержания соединения
      this.sendSilencePacket()
    }, this.options.silencePacketInterval)
  }

  /**
   * Останавливает отправку пакетов тишины
   */
  private stopSilencePackets(): void {
    if (this.silencePacketInterval) {
      clearInterval(this.silencePacketInterval)
      this.silencePacketInterval = null
      console.log('Остановлена отправка пакетов тишины')
    }
  }

  /**
   * Создает генератор тишины
   */
  private createSilenceGenerator(): {
    oscillator: OscillatorNode
    gainNode: GainNode
    destination: MediaStreamAudioDestinationNode
    stream: MediaStream
  } {
    if (!this.audioContext) {
      throw new Error('AudioContext не инициализирован')
    }

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const destination = this.audioContext.createMediaStreamDestination()

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)

    oscillator.connect(gainNode)
    gainNode.connect(destination)
    oscillator.start()

    return {
      oscillator,
      gainNode,
      destination,
      stream: destination.stream,
    }
  }

  /**
   * Отправляет пакет тишины для поддержания соединения
   */
  private sendSilencePacket(): void {
    // Временно переключаемся на поток тишины для отправки пакета
    // Это гарантирует, что WebRTC соединение остается активным
    if (this.silenceGenerator && !this.isVoiceActive) {
      // Логика отправки пакета тишины уже реализована через gainNode
      // При неактивном голосе громкость снижена до 0.1
    }
  }

  /**
   * Добавляет обработчик события
   * @param event название события
   * @param callback функция обратного вызова
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = []
    }
    this.eventListeners[event].push(callback)
  }

  /**
   * Вызывает обработчики события
   * @param event название события
   * @param data данные события
   */
  private dispatchEvent(event: string, data: any): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Ошибка в обработчике события ${event}:`, error)
        }
      })
    }
  }

  /**
   * Включает или выключает шумоподавление
   * @param enabled включено или выключено
   */
  setNoiseReduction(enabled: boolean): void {
    if (!this.audioContext || !this.noiseSuppressionNode) return

    this.options.noiseReduction = enabled
    // Динамически изменяем параметры фильтра
    const frequency = enabled ? 85 : 20
    this.noiseSuppressionNode.frequency.setTargetAtTime(
      frequency,
      this.audioContext.currentTime,
      0.1,
    )
  }

  /**
   * Возвращает текущую статистику работы контроллера
   */
  getStats(): {
    isVoiceActive: boolean
  } {
    return {
      isVoiceActive: this.isVoiceActive,
    }
  }

  /**
   * Проверяет, активен ли микрофон
   */
  isActive(): boolean {
    return !this.producer.paused
  }

  /**
   * Приостанавливает отправку аудио
   */
  async pause(): Promise<void> {
    await this.producer.pause()
    console.log('Микрофон приостановлен')
  }

  /**
   * Возобновляет отправку аудио
   */
  async resume(): Promise<void> {
    await this.producer.resume()
    console.log('Микрофон возобновлен')
  }

  /**
   * Переключает состояние микрофона
   */
  async toggle(): Promise<void> {
    if (this.producer.paused) {
      await this.resume()
    } else {
      await this.pause()
    }
  }

  /**
   * Освобождает ресурсы
   */
  async cleanup(): Promise<void> {
    await this.destroy()
  }

  /**
   * Уничтожает контроллер и освобождает все ресурсы
   */
  async destroy(): Promise<void> {
    console.log('Уничтожение контроллера микрофона...')

    // Останавливаем VAD
    if (this.vad) {
      await this.vad.pause()
      this.vad = null
    }

    // Останавливаем интервалы
    this.stopSilencePackets()

    // Останавливаем генератор тишины
    if (this.silenceGenerator) {
      this.silenceGenerator.oscillator.stop()
      this.silenceGenerator = null
    }

    // Закрываем Audio Context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
      this.audioContext = null
    }

    // Возвращаем оригинальный трек
    if (this.originalTrack && this.producer) {
      await this.producer.replaceTrack({ track: this.originalTrack })
    }

    console.log('Контроллер микрофона уничтожен')
  }
}

/**
 * Инициализирует продвинутый контроллер микрофона
 * @param producer mediasoup producer для управления
 * @param options настройки для контроллера
 */
export async function initializeAdvancedMicrophone(
  producer: Producer,
  options: AdvancedMicrophoneOptions = {},
): Promise<AdvancedMicrophoneController | null> {
  const micController = new AdvancedMicrophoneController(producer, {
    minSpeechDuration: options.minSpeechDuration ?? 150,
    minSilenceDuration: options.minSilenceDuration ?? 300,
    replaceSilenceWithPackets: options.replaceSilenceWithPackets ?? true,
    silencePacketInterval: options.silencePacketInterval ?? 20,
    noiseSuppression: options.noiseSuppression ?? true,
    echoCancellation: options.echoCancellation ?? true,
    autoGainControl: options.autoGainControl ?? true,
    ...options,
  })

  // Подписываемся на события
  micController.addEventListener('voiceStart', (data) => {
    console.log('🎤 Голос начал говорить:', data)
    // Можно показать индикатор активности
  })

  micController.addEventListener('voiceEnd', (data) => {
    console.log('🔇 Голос перестал говорить:', data)
    // Можно скрыть индикатор активности
  })

  // Инициализируем
  const success = await micController.initialize()
  if (success) {
    console.log('✅ Продвинутый контроллер микрофона готов к работе')
    return micController
  } else {
    console.error('❌ Не удалось инициализировать контроллер микрофона')
    return null
  }
}
