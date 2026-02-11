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
import type { VoiceKeysPayload } from '../crypto/groupCryptoManager'

export interface WorkerManagerOptions {
  sessionId: string
  addLog: LoggerFunction
}

export class WorkerManager {
  private sessionId: string
  private addLog: LoggerFunction

  // Unified worker for WebRTC Encoded Transforms
  private encodedStreamWorker: Worker | null = null

  // Key refresh interval
  private keyRefreshInterval: ReturnType<typeof setInterval> | null = null
  private static KEY_REFRESH_MS = 5000 // Refresh keys every 5 seconds

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
   * Initializes the unified worker (SubtleCrypto mode — no per-frame bridge needed).
   */
  public initializeEncodedStreamWorker(): void {
    this.addLog('Initializing encoded stream worker (SubtleCrypto mode)...', 'info')

    try {
      // 1. Get or create the worker instance
      this.encodedStreamWorker = getEncodedStreamWorker()

      // 2. Initialize worker (no MessagePort needed — crypto is in-worker)
      this.encodedStreamWorker.postMessage({ type: 'init' })

      // 3. Sync codec mapping
      this.updateCodecMapping()

      // 4. Fetch key material from Rust and send to worker
      this.fetchAndSyncKeys()

      // 5. Start periodic key refresh (for epoch changes)
      this.startKeyRefresh()

      this.addLog('Worker initialized (SubtleCrypto mode)', 'success')
    } catch (error) {
      this.addLog(
        `Failed to initialize worker: ${error}`,
        'error',
      )
    }
  }

  /**
   * Fetches key material from Rust via Tauri and sends it to the Worker.
   */
  public async fetchAndSyncKeys(): Promise<void> {
    if (!this.encodedStreamWorker) return

    try {
      const keys: VoiceKeysPayload = await invoke('get_voice_keys')

      this.encodedStreamWorker.postMessage({
        type: 'updateKeys',
        keys,
      })

      this.addLog('Key material synced to worker', 'info')
    } catch (error: unknown) {
      // This is expected if no voice session is active yet
      const msg = error instanceof Error ? error.message : String(error)
      if (!msg.includes('No active voice session')) {
        this.addLog(`Key sync error: ${msg}`, 'error')
      }
    }
  }

  /**
   * Starts periodic key refresh to pick up epoch changes.
   */
  private startKeyRefresh(): void {
    this.stopKeyRefresh()
    this.keyRefreshInterval = setInterval(() => {
      this.fetchAndSyncKeys()
    }, WorkerManager.KEY_REFRESH_MS)
  }

  /**
   * Stops periodic key refresh.
   */
  private stopKeyRefresh(): void {
    if (this.keyRefreshInterval) {
      clearInterval(this.keyRefreshInterval)
      this.keyRefreshInterval = null
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
   * Clean up worker resources
   */
  public cleanup(): void {
    this.addLog('Cleaning up worker resources...', 'info')

    this.stopKeyRefresh()

    if (this.encodedStreamWorker) {
      terminateEncodedStreamWorker()
      this.encodedStreamWorker = null
    }

    this.addLog('Worker cleanup completed', 'info')
  }
}