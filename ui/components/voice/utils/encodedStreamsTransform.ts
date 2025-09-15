import { invoke } from '@tauri-apps/api/core'
import { getCodecType } from './codecTypes'

// Worker for handling encoded streams transformation
let encodedStreamWorker: Worker | null = null

/**
 * Initializes the worker for encoded streams transformation
 * This should be called before using the encoded streams API
 */
export const initEncodedStreamWorker = (): Worker => {
  if (encodedStreamWorker === null) {
    encodedStreamWorker = new Worker(
      new URL('../workers/encodedStreamWorker.worker.js', import.meta.url),
      { type: 'module' },
    )
    console.log('Encoded stream worker initialized')
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
 * Terminates the encoded streams worker
 */
export const terminateEncodedStreamWorker = (): void => {
  if (encodedStreamWorker) {
    encodedStreamWorker.terminate()
    encodedStreamWorker = null
    console.log('Encoded stream worker terminated')
  }
}

/**
 * Creates a transform stream for encrypting or decrypting WebRTC encoded frames
 * using the Tauri backend encryption/decryption functions.
 *
 * This is used specifically for Chrome's createEncodedStreams API.
 *
 * @param operation - Whether to 'encrypt' or 'decrypt' the data
 * @param sessionId - The session ID used as the encryption/decryption key
 * @returns TransformStream that can be used in a pipe chain
 */
export const createEncodedStreamTransform = (
  operation: 'encrypt' | 'decrypt',
  sessionId: string,
): TransformStream<
  RTCEncodedVideoFrame | RTCEncodedAudioFrame,
  RTCEncodedVideoFrame | RTCEncodedAudioFrame
> => {
  const tauriFunctionName =
    operation === 'encrypt' ? 'encrypt_voice' : 'decrypt_voice'
  const logPrefix = operation === 'encrypt' ? 'Encryption' : 'Decryption'

  return new TransformStream({
    async transform(encodedFrame, controller) {
      try {
        const dataBuffer = encodedFrame.data // ArrayBuffer
        const dataArray = Array.from(new Uint8Array(dataBuffer))

        // Determine codec type from frame metadata
        const codecType = getCodecType(encodedFrame)
        // console.log(`Transform Stream ${logPrefix}: Frame size before: ${dataArray.length}, codec: ${codecType}, isKeyFrame: ${isKeyFrame}`);

        const resultBytes: number[] = await invoke(tauriFunctionName, {
          voiceId: sessionId,
          bytes: dataArray,
          codecType: codecType,
        })

        // console.log(`Transform Stream ${logPrefix}: Frame size after: ${resultBytes.length}`);

        // Create a new ArrayBuffer for the transformed data
        const transformedBuffer = new Uint8Array(resultBytes).buffer

        // Modify the frame's data
        encodedFrame.data = transformedBuffer

        // Enqueue the modified frame
        controller.enqueue(encodedFrame)
      } catch (error: unknown) {
        console.error(`Transform Stream ${logPrefix} Error:`, error)
        // On error, propagate the error to the stream
        controller.error(error)
      }
    },
  })
}

/**
 * Applies encryption transformation to an RTCRtpSender
 *
 * @param sender - The RTCRtpSender to apply encryption to
 * @param sessionId - The session ID used as encryption key
 * @returns Promise that resolves when the transform is applied
 */
export const applyEncryptionToSender = (sender: RTCRtpSender): void => {
  try {
    const worker = getEncodedStreamWorker()
    const senderStreams = sender.createEncodedStreams()
    const readableStream = senderStreams.readable
    const writableStream = senderStreams.writable

    worker.postMessage(
      {
        operation: 'encode',
        readableStream,
        writableStream,
      },
      [readableStream, writableStream],
    )
  } catch (e: unknown) {
    console.error('Failed to apply encryption to sender:', e)
  }
}

/**
 * Applies decryption transformation to an RTCRtpReceiver
 *
 * @param receiver - The RTCRtpReceiver to apply decryption to
 * @param sessionId - The session ID used as decryption key
 * @returns Promise that resolves when the transform is applied
 */
export const applyDecryptionToReceiver = (receiver: RTCRtpReceiver): void => {
  try {
    const worker = getEncodedStreamWorker()
    const receiverStreams = receiver.createEncodedStreams()
    const readableStream = receiverStreams.readable
    const writableStream = receiverStreams.writable

    worker.postMessage(
      {
        operation: 'decode',
        readableStream,
        writableStream,
      },
      [readableStream, writableStream],
    )
  } catch (e: unknown) {
    console.error('Failed to apply decryption to receiver:', e)
  }
}
