import {
  getPayloadTypeMappingString,
  getPayloadTypeMapping,
} from '../utils/codecTypes'
import { LoggerFunction } from '../types/mediasoup'
import { invoke } from '@tauri-apps/api/core'
import {
  getEncodedStreamWorker,
  terminateEncodedStreamWorker,
} from '../utils/encodedStreamsTransform'

export interface WorkerManagerOptions {
  sessionId: string
  addLog: LoggerFunction
}

export class WorkerManager {
  private sessionId: string
  private encryptionWorker: Worker | null = null
  private decryptionWorker: Worker | null = null
  private encryptionPort: MessagePort | null = null
  private decryptionPort: MessagePort | null = null
  private addLog: LoggerFunction

  // Channels for encoded streams
  private encodedStreamWorker: Worker | null = null
  private encodedStreamPort: MessagePort | null = null

  constructor(options: WorkerManagerOptions) {
    this.sessionId = options.sessionId
    this.addLog = options.addLog
  }

  /**
   * Получить Worker для шифрования
   */
  public getEncryptionWorker(): Worker | null {
    return this.encryptionWorker
  }

  /**
   * Получить Worker для дешифрования
   */
  public getDecryptionWorker(): Worker | null {
    return this.decryptionWorker
  }

  /**
   * Get the encoded stream worker
   */
  public getEncodedStreamWorker(): Worker | null {
    return this.encodedStreamWorker
  }

  /**
   * Initialize encoded stream worker
   */
  public initializeEncodedStreamWorker(): void {
    this.addLog('Initializing encoded stream worker...', 'info')

    try {
      // Initialize or get the worker
      this.encodedStreamWorker = getEncodedStreamWorker()

      // Create a message channel for communication
      const channel = new MessageChannel()
      this.encodedStreamPort = channel.port1

      // Start the port
      this.encodedStreamPort.start()

      // Set up message handler for the port
      this.encodedStreamPort.onmessage =
        this.handleEncodedStreamMessages.bind(this)

      // Send initialization message with the port
      this.encodedStreamWorker.postMessage({ type: 'init' }, [channel.port2])

      // Send the session ID to the worker
      this.encodedStreamWorker.postMessage({
        type: 'setSessionId',
        sessionId: this.sessionId,
      })

      // Send codec mapping to the worker
      this.sendCodecMappingToWorker(this.encodedStreamWorker)

      this.addLog('Encoded stream worker initialized successfully', 'success')
    } catch (error) {
      this.addLog(
        `Failed to initialize encoded stream worker: ${error}`,
        'error',
      )
    }
  }

  /**
   * Handle messages from the encoded stream worker
   */
  private async handleEncodedStreamMessages(
    event: MessageEvent,
  ): Promise<void> {
    const { type, id, data, codecType, sessionId } = event.data

    if (!this.encodedStreamPort) {
      console.error('Encoded stream port not available for handling message')
      return
    }

    if (type === 'encrypt') {
      try {
        const encryptedData: Array<Uint8Array> = await invoke('encrypt_voice', {
          bytes: data,
          codecType: codecType,
        })

        this.encodedStreamPort.postMessage({ id, encryptedData })
      } catch (error: unknown) {
        this.addLog(
          `Encryption error (EncodedStream) for request ${id}: ${error}`,
          'error',
        )
        this.encodedStreamPort.postMessage({ id, error: String(error) })
      }
    } else if (type === 'decrypt') {
      try {
        const decryptedData: Array<Uint8Array> = await invoke('decrypt_voice', {
          bytes: data,
          codecType: codecType,
        })

        this.encodedStreamPort.postMessage({ id, decryptedData })
      } catch (error: unknown) {
        this.addLog(
          `Decryption error (EncodedStream) for request ${id}: ${error}`,
          'error',
        )
        this.encodedStreamPort.postMessage({ id, error: String(error) })
      }
    }
  }

  /**
   * Инициализация Worker'ов
   */
  public initializeWorkers(): void {
    this.addLog('Инициализация воркеров для RTCRtpScriptTransform...', 'info')

    // --- Encryption Worker ---
    const encWorker = new Worker(
      new URL('../workers/encryptionWorker.worker.js', import.meta.url),
      { type: 'module' },
    )
    const encChannel = new MessageChannel()
    this.encryptionWorker = encWorker
    this.encryptionPort = encChannel.port1

    encWorker.postMessage({ type: 'init' }, [encChannel.port2])
    this.addLog('Порт для шифрования отправлен воркеру', 'info')

    // Отправляем текущее сопоставление кодеков в воркер шифрования
    this.sendCodecMappingToWorker(encWorker)

    encChannel.port1.onmessage = async (event) => {
      const { type, id, data, codecType } = event.data
      if (type === 'encrypt') {
        try {
          const encryptedData: Array<Uint8Array> = await invoke(
            'encrypt_voice',
            {
              bytes: data,
              codecType: codecType,
            },
          )
          this.encryptionPort?.postMessage({ id, encryptedData })
        } catch (error: unknown) {
          this.addLog(
            `Ошибка шифрования (Worker) для запроса ${id}: ${error}`,
            'error',
          )
          this.encryptionPort?.postMessage({ id, error: String(error) })
        }
      }
    }
    encChannel.port1.start()

    // --- Decryption Worker ---
    const decWorker = new Worker(
      new URL('../workers/decryptionWorker.worker.js', import.meta.url),
      { type: 'module' },
    )
    const decChannel = new MessageChannel()
    this.decryptionWorker = decWorker
    this.decryptionPort = decChannel.port1

    decWorker.postMessage({ type: 'init' }, [decChannel.port2])
    this.addLog('Порт для дешифрования отправлен воркеру', 'info')

    // Отправляем текущее сопоставление кодеков в воркер дешифрования
    this.sendCodecMappingToWorker(decWorker)

    decChannel.port1.onmessage = async (event) => {
      const { type, id, data, codecType } = event.data
      if (type === 'decrypt') {
        try {
          const decryptedData: Array<Uint8Array> = await invoke(
            'decrypt_voice',
            {
              bytes: data,
              codecType: codecType,
            },
          )
          this.decryptionPort?.postMessage({ id, decryptedData })
        } catch (error: unknown) {
          this.addLog(
            `Ошибка дешифрования (Worker) для запроса ${id}: ${error}`,
            'error',
          )
          this.decryptionPort?.postMessage({ id, error: String(error) })
        }
      }
    }
    decChannel.port1.start()
  }

  /**
   * Обновить данные сопоставления кодеков
   */
  public updateCodecMapping(): void {
    if (this.encryptionWorker) {
      this.sendCodecMappingToWorker(this.encryptionWorker)
    }
    if (this.decryptionWorker) {
      this.sendCodecMappingToWorker(this.decryptionWorker)
    }
    if (this.encodedStreamWorker) {
      this.sendCodecMappingToWorker(this.encodedStreamWorker)
    }
  }

  /**
   * Отправить сопоставление типов кодеков в воркер
   */
  private sendCodecMappingToWorker(worker: Worker | null): void {
    if (!worker) return

    try {
      const mapping = getPayloadTypeMapping()
      worker.postMessage({
        type: 'updateCodecMapping',
        codecMapping: mapping,
      })
      this.addLog(
        `Отправлено сопоставление кодеков в воркер: ${getPayloadTypeMappingString()}`,
        'info',
      )
    } catch (error) {
      this.addLog(
        `Ошибка отправки сопоставления кодеков в воркер: ${error}`,
        'error',
      )
    }
  }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    this.addLog('Очистка воркеров и портов...', 'info')

    if (this.encryptionPort) {
      this.encryptionPort.close()
      this.encryptionPort = null
    }

    if (this.decryptionPort) {
      this.decryptionPort.close()
      this.decryptionPort = null
    }

    if (this.encryptionWorker) {
      this.encryptionWorker.terminate()
      this.encryptionWorker = null
    }

    if (this.decryptionWorker) {
      this.decryptionWorker.terminate()
      this.decryptionWorker = null
    }

    if (this.encodedStreamPort) {
      this.encodedStreamPort.close()
      this.encodedStreamPort = null
    }

    if (this.encodedStreamWorker) {
      terminateEncodedStreamWorker()
      this.encodedStreamWorker = null
    }

    this.addLog('Очистка воркеров завершена', 'info')
  }
}
