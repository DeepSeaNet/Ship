/**
 * Encoded Streams Transform utilities.
 * Manages the worker lifecycle and applies RTCRtpScriptTransform to senders/receivers.
 *
 * In the new SubtleCrypto architecture, the worker handles all crypto internally.
 * This module only manages worker creation/destruction and transform assignment.
 * Key material is synced by WorkerManager, not here.
 */

// --- State Management ---
let encodedStreamWorker: Worker | null = null

// --- Types for TypeScript ---
declare class RTCRtpScriptTransform {
  constructor(worker: Worker, options?: any, transfer?: Transferable[])
}

/**
 * Initializes the worker instance.
 */
export const initEncodedStreamWorker = (): Worker => {
  if (encodedStreamWorker === null) {
    encodedStreamWorker = new Worker(
      new URL('../worker.js', import.meta.url),
      { type: 'module' },
    )

    // Initialize the worker
    encodedStreamWorker.postMessage({ type: 'init' })

    console.log('Encoded stream worker initialized (SubtleCrypto mode)')
  }
  return encodedStreamWorker
}

/**
 * Gets the current worker instance or initializes one if not exists.
 */
export const getEncodedStreamWorker = (): Worker => {
  if (encodedStreamWorker === null) {
    return initEncodedStreamWorker()
  }
  return encodedStreamWorker
}

/**
 * Terminates the encoded streams worker.
 */
export const terminateEncodedStreamWorker = (): void => {
  if (encodedStreamWorker) {
    encodedStreamWorker.terminate()
    encodedStreamWorker = null
  }
  console.log('Encoded stream worker terminated')
}

/**
 * Applies encryption transformation to an RTCRtpSender using the Worker.
 */
export const applyEncryptionToSender = (
  sender: RTCRtpSender,
  _sessionId: string,
): void => {
  try {
    const worker = getEncodedStreamWorker()

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
 */
export const applyDecryptionToReceiver = (
  receiver: RTCRtpReceiver,
  _sessionId: string,
): void => {
  try {
    const worker = getEncodedStreamWorker()

    receiver.transform = new RTCRtpScriptTransform(worker, {
      name: 'receiverTransform',
    })

    console.log('Decryption transform applied to receiver')
  } catch (e: unknown) {
    console.error('Failed to apply decryption to receiver:', e)
  }
}