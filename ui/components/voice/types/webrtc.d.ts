// Type definitions for WebRTC extensions used in Chrome
// This is for Chrome's Insertable Streams for WebRTC API

interface RTCEncodedVideoFrame {
  type: 'key' | 'delta'
  data: ArrayBuffer
  timestamp: number
  getMetadata(): RTCEncodedVideoFrameMetadata
}

interface RTCEncodedAudioFrame {
  data: ArrayBuffer
  timestamp: number
  getMetadata(): RTCEncodedAudioFrameMetadata
}

interface RTCEncodedVideoFrameMetadata {
  frameId: number
  dependencies: number[]
  width: number
  height: number
  spatialIndex: number
  temporalIndex: number
  synchronizationSource: number
  payloadType: number
  contributingSources: number[]
}

interface RTCEncodedAudioFrameMetadata {
  synchronizationSource: number
  payloadType: number
  contributingSources: number[]
}

interface RTCTransformEvent {
  transformer: RTCRtpScriptTransformer
}

interface RTCRtpScriptTransformer {
  readable: ReadableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>
  writable: WritableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>
}

// Extend RTCRtpSender and RTCRtpReceiver with Chrome's encoded streams API
interface RTCRtpSender {
  createEncodedStreams(): {
    readable: ReadableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>
    writable: WritableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>
  }
  transform?: RTCRtpScriptTransform
}

interface RTCRtpReceiver {
  createEncodedStreams(): {
    readable: ReadableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>
    writable: WritableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>
  }
  transform?: RTCRtpScriptTransform
}

// Chrome's RTCRtpScriptTransform constructor
declare class RTCRtpScriptTransform {
  constructor(worker: Worker, options?: Record<string, unknown>)
}

// Extend Window to include RTCRtpScriptTransform constructor
interface Window {
  RTCRtpScriptTransform?: typeof RTCRtpScriptTransform
  RTCTransformEvent?: typeof RTCTransformEvent
}
