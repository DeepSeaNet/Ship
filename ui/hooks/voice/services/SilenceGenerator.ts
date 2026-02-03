/**
 * Класс для генерации потока тишины
 * Используется для замены аудио трека в микрофоне
 */
export class SilenceGenerator {
  private context: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gain: GainNode | null = null
  private destination: MediaStreamAudioDestinationNode | null = null

  /**
   * Создает поток с тишиной
   * Использует AudioContext для создания осциллятора с нулевой амплитудой
   */
  createSilenceStream(): MediaStream {
    // Создаем аудио контекст
    this.context = new AudioContext()

    // Создаем осциллятор с очень низкой частотой
    this.oscillator = this.context.createOscillator()
    this.oscillator.frequency.value = 0

    // Создаем усилитель и устанавливаем громкость в почти ноль
    this.gain = this.context.createGain()
    this.gain.gain.value = 0.0001 // Почти полная тишина, но не 0, чтобы поток не прерывался

    // Создаем назначение для MediaStream
    this.destination = this.context.createMediaStreamDestination()

    // Соединяем компоненты
    this.oscillator.connect(this.gain)
    this.gain.connect(this.destination)

    // Запускаем осциллятор
    this.oscillator.start()

    return this.destination.stream
  }

  /**
   * Останавливает генерацию тишины и освобождает ресурсы
   */
  stop() {
    // Останавливаем и очищаем ресурсы
    this.oscillator?.stop()
    this.oscillator?.disconnect()
    this.gain?.disconnect()
    this.context?.close()

    this.oscillator = null
    this.gain = null
    this.destination = null
    this.context = null
  }
}

export default SilenceGenerator
