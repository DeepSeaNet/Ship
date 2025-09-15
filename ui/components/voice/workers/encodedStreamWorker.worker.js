// Codec mapping for determining the codec type from payload type
let codecMapping = {}
let sessionId = null
let mainPort = null
let pendingRequests = new Map() // Map<requestId, { frame, controller, resolve, reject }>
let requestIdCounter = 0

// Get codec type based on the payload type in the frame metadata
function getCodecTypeFromFrame(encodedFrame) {
  let codecType = -1 // UNKNOWN by default

  try {
    // If it's video frame with key or delta type
    if (encodedFrame.type === 'key' || encodedFrame.type === 'delta') {
      codecType = 1 // Default to VP8
    }

    // Try to get payload type from metadata
    const metadata = encodedFrame.getMetadata?.()
    if (metadata && metadata.payloadType) {
      const payloadType = metadata.payloadType

      // Use the codec mapping if available
      if (codecMapping && typeof codecMapping[payloadType] === 'number') {
        codecType = codecMapping[payloadType]
      } else {
        // Use default values if not in mapping
        // Corresponds to enum CodecType from codecTypes.ts
        const OPUS = 0,
          VP8 = 1,
          VP9 = 2,
          H264 = 3

        if (payloadType === 111) codecType = OPUS
        if (payloadType === 106) codecType = VP8
        if (payloadType === 108) codecType = VP9
        if (payloadType === 96) codecType = H264
      }
    }
  } catch (e) {
    console.error('[e2e worker] Error getting codec type:', e)
  }

  return codecType
}

// Handle messages from the main thread
function handleMainThreadMessage(event) {
  const { id, encryptedData, decryptedData, error } = event.data
  const request = pendingRequests.get(id)

  if (request) {
    if (error) {
      console.error(`[e2e worker] Operation failed for request ${id}:`, error)
      request.reject(error)
    } else {
      try {
        // Get the processed data as ArrayBuffer
        const processedData = new Uint8Array(encryptedData || decryptedData)
          .buffer

        // Update the frame data with the processed data
        request.frame.data = processedData

        // Enqueue the updated frame
        request.controller.enqueue(request.frame)

        // Resolve the promise
        request.resolve()
      } catch (e) {
        console.error(
          `[e2e worker] Error processing data for request ${id}:`,
          e,
        )
        request.reject(e)
      }
    }
    pendingRequests.delete(id)
  } else {
    console.warn(`[e2e worker] Received message for unknown request ID: ${id}`)
  }
}

// Encoder transform function
async function encodeFunction(encodedFrame, controller) {
  try {
    // For debugging
    // dump(encodedFrame, 'encode-before');

    if (!mainPort) {
      console.error(
        '[e2e worker] Main port not initialized for encryption. Passing frame through.',
      )
      controller.enqueue(encodedFrame)
      return
    }

    // Get codec type
    const codecType = getCodecTypeFromFrame(encodedFrame)

    // Create request ID
    const requestId = requestIdCounter++

    // Convert frame data to array
    const data = encodedFrame.data

    // Create promise
    const promise = new Promise((resolve, reject) => {
      pendingRequests.set(requestId, {
        frame: encodedFrame,
        controller,
        resolve,
        reject,
      })
    })

    // Send data to main thread for encryption
    mainPort.postMessage({
      type: 'encrypt',
      id: requestId,
      data: data,
      codecType: codecType,
      sessionId: sessionId,
    })

    // Wait for the encryption to complete
    await promise

    // For debugging
    // dump(encodedFrame, 'encode-after');
  } catch (error) {
    console.error('[e2e worker] Encode error:', error)
    // On error, fall back to passing through the original frame
    controller.enqueue(encodedFrame)
  }
}

// Decoder transform function
async function decodeFunction(encodedFrame, controller) {
  try {
    // For debugging
    // dump(encodedFrame, 'decode-before');

    if (!mainPort) {
      console.error(
        '[e2e worker] Main port not initialized for decryption. Passing frame through.',
      )
      controller.enqueue(encodedFrame)
      return
    }

    // Get codec type
    const codecType = getCodecTypeFromFrame(encodedFrame)

    // Create request ID
    const requestId = requestIdCounter++

    // Convert frame data to array
    const data = encodedFrame.data

    // Create promise
    const promise = new Promise((resolve, reject) => {
      pendingRequests.set(requestId, {
        frame: encodedFrame,
        controller,
        resolve,
        reject,
      })
    })

    // Send data to main thread for decryption
    mainPort.postMessage({
      type: 'decrypt',
      id: requestId,
      data: data,
      codecType: codecType,
      sessionId: sessionId,
    })

    // Wait for the decryption to complete
    await promise

    // For debugging
    // dump(encodedFrame, 'decode-after');
  } catch (error) {
    console.error('[e2e worker] Decode error:', error)
    // On error, fall back to passing through the original frame
    controller.enqueue(encodedFrame)
  }
}

// Initialize communication channel
function initializeMainPort(port) {
  mainPort = port
  mainPort.onmessage = handleMainThreadMessage
  console.log('[e2e worker] Main port initialized')
}

// Message handler
onmessage = async (event) => {
  const { type, operation } = event.data

  // Handle codec mapping update
  if (type === 'updateCodecMapping') {
    codecMapping = event.data.codecMapping || {}
    console.log('[e2e worker] Updated codec mapping:', codecMapping)
    return
  }

  // Handle session ID setting
  if (type === 'setSessionId') {
    console.log('[e2e worker] Setting session ID:', event.data.sessionId)
    sessionId = event.data.sessionId
    return
  }

  // Handle initialization
  if (type === 'init') {
    console.log('[e2e worker] Initialized')

    // If a port is provided for communication with the main thread
    if (event.ports && event.ports.length > 0) {
      initializeMainPort(event.ports[0])
    }
    return
  }

  // Handle encode/decode operations
  if (operation === 'encode') {
    console.log('[e2e worker] Setting up encoder')
    const { readableStream, writableStream } = event.data
    const transformStream = new TransformStream({
      transform: encodeFunction,
    })
    readableStream
      .pipeThrough(transformStream)
      .pipeTo(writableStream)
      .catch((error) => {
        console.error('[e2e worker] Encoder pipeline error:', error)
      })
  } else if (operation === 'decode') {
    console.log('[e2e worker] Setting up decoder')
    const { readableStream, writableStream } = event.data
    const transformStream = new TransformStream({
      transform: decodeFunction,
    })
    readableStream
      .pipeThrough(transformStream)
      .pipeTo(writableStream)
      .catch((error) => {
        console.error('[e2e worker] Decoder pipeline error:', error)
      })
  }
}

export default {}
