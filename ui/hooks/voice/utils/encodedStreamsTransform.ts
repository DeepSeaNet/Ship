import { invoke } from '@tauri-apps/api/core'

// --- State Management ---
let encodedStreamWorker: Worker | null = null
let messageChannel: MessageChannel | null = null
let activeSessionId: string | null = null

// --- Types for TypeScript ---
// RTCRtpScriptTransform is not yet in all default TS DOM definitions
declare class RTCRtpScriptTransform {
  constructor(worker: Worker, options?: any, transfer?: Transferable[])
}

/**
 * Handles messages coming FROM the Worker, invokes Tauri, and replies TO the Worker.
 */
const handleWorkerMessage = async (event: MessageEvent) => {
  const { type, id, data, codecType } = event.data

  // If we don't have a session ID yet, we can't encrypt/decrypt
  if (!activeSessionId) {
    messageChannel?.port2.postMessage({
      id,
      error: 'Session ID not set in main thread',
    })
    return
  }

  try {
    // Map worker operation types to your Tauri command names
    const tauriCommand =
      type === 'encrypt' ? 'encrypt_voice' : 'decrypt_voice'

    // Convert raw buffer to format expected by Tauri (usually number[] or Uint8Array)
    // Using Array.from matches your previous implementation pattern
    const resultBytes: number[] = await invoke(tauriCommand, {
      voiceId: activeSessionId,
      bytes: data,
      codecType: codecType,
    })

    // Send the result back to the Worker
    // We convert back to ArrayBuffer for zero-copy transfer efficiency where possible
    const resultBuffer = new Uint8Array(resultBytes).buffer

    messageChannel?.port2.postMessage(
      {
        id,
        processedData: resultBuffer,
        error: null,
      },
      [resultBuffer], // Transfer the buffer ownership to worker
    )
  } catch (error: unknown) {
    console.error(`Bridge Error [${type}]:`, error)
    messageChannel?.port2.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Initializes the worker and the communication bridge.
 */
export const initEncodedStreamWorker = (): Worker => {
  if (encodedStreamWorker === null) {
    // 1. Create the Worker
    encodedStreamWorker = new Worker(
      new URL('../workers/encodedStreamWorker.worker.js', import.meta.url),
      { type: 'module' },
    )

    // 2. Create the MessageChannel for bidirectional communication
    messageChannel = new MessageChannel()

    // 3. Initialize the Worker with Port 1
    encodedStreamWorker.postMessage({ type: 'init' }, [
      messageChannel.port1,
    ])

    // 4. Listen on Port 2 for requests (The Bridge)
    messageChannel.port2.onmessage = handleWorkerMessage

    console.log('Encoded stream worker and bridge initialized')
  }
  return encodedStreamWorker
}

/**
 * Gets the current worker instance or initializes one if not exists
 */
export const getEncodedStreamWorker = (): Worker => {
  if (encodedStreamWorker === null) {
    return initEncodedStreamWorker()
  }
  return encodedStreamWorker
}

/**
 * Terminates the encoded streams worker and closes the bridge
 */
export const terminateEncodedStreamWorker = (): void => {
  if (encodedStreamWorker) {
    encodedStreamWorker.terminate()
    encodedStreamWorker = null
  }
  if (messageChannel) {
    messageChannel.port2.close()
    messageChannel = null
  }
  activeSessionId = null
  console.log('Encoded stream worker terminated')
}

/**
 * Applies encryption transformation to an RTCRtpSender using the Worker.
 *
 * @param sender - The RTCRtpSender to apply encryption to
 * @param sessionId - The session ID used as encryption key
 */
export const applyEncryptionToSender = (
  sender: RTCRtpSender,
  sessionId: string,
): void => {
  try {
    const worker = getEncodedStreamWorker()
    activeSessionId = sessionId // Update state for the bridge

    // The 'name' property tells the worker to use the 'encrypt' pipeline
    sender.transform = new RTCRtpScriptTransform(worker, {
      name: 'senderTransform',
    })

    console.log('Encryption transform applied to sender')
  } catch (e: unknown) {
    console.error('Failed to apply encryption to sender:', e)
  }
}

/**
 * Applies decryption transformation to an RTCRtpReceiver using the Worker.
 *
 * @param receiver - The RTCRtpReceiver to apply decryption to
 * @param sessionId - The session ID used as decryption key
 */
export const applyDecryptionToReceiver = (
  receiver: RTCRtpReceiver,
  sessionId: string,
): void => {
  try {
    const worker = getEncodedStreamWorker()
    activeSessionId = sessionId // Update state for the bridge

    // The 'name' property tells the worker to use the 'decrypt' pipeline
    receiver.transform = new RTCRtpScriptTransform(worker, {
      name: 'receiverTransform',
    })

    console.log('Decryption transform applied to receiver')
  } catch (e: unknown) {
    console.error('Failed to apply decryption to receiver:', e)
  }
}