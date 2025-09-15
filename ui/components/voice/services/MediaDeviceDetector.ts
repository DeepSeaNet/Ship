import { LoggerFunction } from '../types/mediasoup'

export interface DeviceInfo {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput' | 'videoinput'
}

export interface MediaDeviceDetectorOptions {
  addLog: LoggerFunction
  onDeviceListChanged?: (devices: DeviceInfo[]) => void
}

export class MediaDeviceDetector {
  private devices: DeviceInfo[] = []
  private addLog: LoggerFunction
  private onDeviceListChanged?: (devices: DeviceInfo[]) => void
  private isTransformSupported: boolean = false
  private transformApi: 'script' | 'encodedStreams' | 'none' = 'none'

  constructor(options: MediaDeviceDetectorOptions) {
    this.addLog = options.addLog
    this.onDeviceListChanged = options.onDeviceListChanged

    // Проверяем поддержку API шифрования
    this.detectTransformSupport()

    // Прослушиваем события подключения/отключения устройств
    navigator.mediaDevices.addEventListener(
      'devicechange',
      this.handleDeviceChange.bind(this),
    )
  }

  /**
   * Получить список устройств
   */
  public async detectDevices(): Promise<DeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      this.devices = devices
        .filter((device) =>
          ['audioinput', 'audiooutput', 'videoinput'].includes(device.kind),
        )
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} (без названия)`,
          kind: device.kind as 'audioinput' | 'audiooutput' | 'videoinput',
        }))

      this.addLog(`Обнаружено устройств: ${this.devices.length}`, 'info')

      if (this.onDeviceListChanged) {
        this.onDeviceListChanged(this.devices)
      }

      return this.devices
    } catch (error) {
      this.addLog(`Ошибка обнаружения устройств: ${error}`, 'error')
      return []
    }
  }

  /**
   * Получить API для трансформации потоков
   */
  public getTransformApi(): 'script' | 'encodedStreams' | 'none' {
    return this.transformApi
  }

  /**
   * Проверить поддержку шифрования
   */
  public isEncryptionSupported(): boolean {
    return this.isTransformSupported
  }

  /**
   * Проверка поддержки API трансформации
   */
  private detectTransformSupport(): void {
    this.addLog('Проверка поддержки Insertable Streams API...', 'info')

    const scriptTransformSupported =
      typeof RTCRtpScriptTransform !== 'undefined'
    const encodedStreamsSenderSupported =
      typeof RTCRtpSender !== 'undefined' &&
      typeof (
        RTCRtpSender.prototype as RTCRtpSender & {
          createEncodedStreams?: () => unknown
        }
      ).createEncodedStreams === 'function'

    const encodedStreamsReceiverSupported =
      typeof RTCRtpReceiver !== 'undefined' &&
      typeof (
        RTCRtpReceiver.prototype as RTCRtpReceiver & {
          createEncodedStreams?: () => unknown
        }
      ).createEncodedStreams === 'function'

    const encodedStreamsSupported =
      encodedStreamsSenderSupported && encodedStreamsReceiverSupported

    this.addLog(
      `Проверка поддержки: RTCRtpScriptTransform=${scriptTransformSupported}, createEncodedStreams=${encodedStreamsSupported}`,
      'info',
    )

    if (encodedStreamsSupported) {
      this.transformApi = 'encodedStreams'
    } else if (scriptTransformSupported) {
      this.transformApi = 'script'
    } else {
      this.transformApi = 'none'
    }

    this.isTransformSupported = this.transformApi !== 'none'
    this.addLog(
      `Выбранный API для трансформации: ${this.transformApi}`,
      this.isTransformSupported ? 'success' : 'warning',
    )
  }

  /**
   * Обработчик изменения списка устройств
   */
  private async handleDeviceChange(): Promise<void> {
    this.addLog('Обнаружено изменение списка устройств', 'info')
    await this.detectDevices()
  }

  /**
   * Освободить ресурсы
   */
  public cleanup(): void {
    navigator.mediaDevices.removeEventListener(
      'devicechange',
      this.handleDeviceChange.bind(this),
    )
  }
}
