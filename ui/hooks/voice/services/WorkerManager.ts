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
  private addLog: LoggerFunction

  // Unified channel for WebRTC Encoded Transforms
  private encodedStreamWorker: Worker | null = null
  private encodedStreamPort: MessagePort | null = null

  constructor(options: WorkerManagerOptions) {
    this.sessionId = options.sessionId
    this.addLog = options.addLog
  }

  /**
   * Get the unified encoded stream worker instance
   */
  public getEncodedStreamWorker(): Worker | null {
    return this.encodedStreamWorker
  }

  /**
   * Initializes the unified worker and sets up the message bridge to Tauri
   */
  public initializeEncodedStreamWorker(): void {
    this.addLog('Initializing unified encoded stream worker...', 'info')

    try {
      // 1. Get or create the worker instance
      this.encodedStreamWorker = getEncodedStreamWorker()

      // 2. Setup bidirectional communication channel
      const channel = new MessageChannel()
      this.encodedStreamPort = channel.port1

      // 3. Setup the bridge handler
      this.encodedStreamPort.onmessage = this.handleBridgeMessages.bind(this)
      this.encodedStreamPort.start()

      // 4. Initialize worker state
      this.encodedStreamWorker.postMessage({ type: 'init' }, [channel.port2])

      this.encodedStreamWorker.postMessage({
        type: 'setSessionId',
        sessionId: this.sessionId,
      })

      this.updateCodecMapping()

      this.addLog('Unified worker initialized successfully', 'success')
    } catch (error) {
      this.addLog(
        `Failed to initialize unified worker: ${error}`,
        'error',
      )
    }
  }

  /**
   * Bridge: Receives transform requests from the Worker, 
   * invokes Tauri/Rust logic, and returns processed buffers.
   */
  private async handleBridgeMessages(event: MessageEvent): Promise<void> {
    const { type, id, data, codecType } = event.data

    if (!this.encodedStreamPort) return

    // Map internal types to Tauri commands
    const tauriCommand = type === 'encrypt' ? 'encrypt_voice' : 'decrypt_voice'

    try {
      // Convert buffer to format expected by Tauri (usually number[])
      const bytesArg = Array.from(new Uint8Array(data))

      const resultBytes: number[] = await invoke(tauriCommand, {
        voiceId: this.sessionId,
        bytes: bytesArg,
        codecType: codecType,
      })

      const processedBuffer = new Uint8Array(resultBytes).buffer

      // Return the result to the Worker
      this.encodedStreamPort.postMessage({
        id,
        processedData: processedBuffer
      }, [processedBuffer])

    } catch (error: unknown) {
      this.addLog(
        `Worker Bridge Error [${type}] for request ${id}: ${error}`,
        'error'
      )
      this.encodedStreamPort.postMessage({ id, error: String(error) })
    }
  }

  /**
   * Synchronize codec payload type mappings with the Worker
   */
  public updateCodecMapping(): void {
    if (!this.encodedStreamWorker) return

    try {
      const mapping = getPayloadTypeMapping()
      this.encodedStreamWorker.postMessage({
        type: 'updateCodecMapping',
        codecMapping: mapping,
      })
      this.addLog(
        `Codec mapping synced with worker: ${getPayloadTypeMappingString()}`,
        'info',
      )
    } catch (error) {
      this.addLog(
        `Error syncing codec mapping: ${error}`,
        'error',
      )
    }
  }

  /**
   * Clean up worker resources and close communication ports
   */
  public cleanup(): void {
    this.addLog('Cleaning up worker resources...', 'info')

    if (this.encodedStreamPort) {
      this.encodedStreamPort.close()
      this.encodedStreamPort = null
    }

    if (this.encodedStreamWorker) {
      terminateEncodedStreamWorker()
      this.encodedStreamWorker = null
    }

    this.addLog('Worker cleanup completed', 'info')
  }
}