/**
 * Mapping of codec payload types to internal codec identifiers
 */
export enum CodecType {
  UNKNOWN = -1,
  OPUS = 0,
  VP8 = 1,
  VP9 = 2,
  H264 = 3,
  H265 = 4,
  RED = 5,
  ULPFEC = 6,
}

/**
 * Хранит динамически сгенерированные сопоставления payload types с кодеками
 */
let dynamicMapping: Record<number, CodecType> = {}

/**
 * Значения по умолчанию, используются если не удалось определить динамически
 */
export const DEFAULT_PAYLOAD_TYPE_MAPPING: Record<number, CodecType> = {
  111: CodecType.OPUS, // Opus audio codec
  96: CodecType.VP8, // VP8 video codec
  98: CodecType.VP9, // VP9 video codec
  97: CodecType.H264, // H264 video codec
}

/**
 * Возвращает текущее mapping или default если оно пустое
 */
export const getPayloadTypeMapping = (): Record<number, CodecType> => {
  if (Object.keys(dynamicMapping).length === 0) {
    return DEFAULT_PAYLOAD_TYPE_MAPPING
  }
  return dynamicMapping
}

/**
 * Парсит SDP для извлечения соответствия между payload type и кодеками
 * @param sdp - SDP строка для анализа
 */
export function parseSdpForCodecMapping(sdp: string): void {
  if (!sdp) return

  const newMapping: Record<number, CodecType> = {}

  // Регулярное выражение для извлечения строк rtpmap
  const rtpmapRegex = /a=rtpmap:(\d+) ([^/]+)/g
  let match

  while ((match = rtpmapRegex.exec(sdp)) !== null) {
    const payloadType = parseInt(match[1], 10)
    const codecName = match[2].toUpperCase()

    // Определяем тип кодека по имени
    let codecType = CodecType.UNKNOWN

    if (codecName.includes('OPUS')) {
      codecType = CodecType.OPUS
    } else if (codecName === 'VP8') {
      codecType = CodecType.VP8
    } else if (codecName === 'VP9') {
      codecType = CodecType.VP9
    } else if (codecName === 'H264') {
      codecType = CodecType.H264
    } else if (codecName === 'H265') {
      codecType = CodecType.H265
    } else if (codecName === 'RED') {
      codecType = CodecType.RED
    } else if (codecName === 'ULPFEC') {
      codecType = CodecType.ULPFEC
    } else if (codecName !== 'RTX') {
      // Пропускаем RTX, так как это не основной кодек
      console.log(`Неизвестный кодек: ${codecName} с PT=${payloadType}`)
    }

    // Сохраняем в mapping только основные кодеки (не RTX)
    if (codecType !== CodecType.UNKNOWN && codecName !== 'RTX') {
      newMapping[payloadType] = codecType
    }
  }

  // Обновляем глобальный mapping только если нашли хотя бы один кодек
  if (Object.keys(newMapping).length > 0) {
    console.log('Обновлено соответствие payload type с кодеками:', newMapping)
    dynamicMapping = newMapping
  }
}

/**
 * Возвращает тип кодека для указанного payload type
 * @param payloadType - Номер payload type для поиска
 * @returns Тип кодека или UNKNOWN если не найден
 */
export function getCodecTypeByPayloadType(payloadType: number): CodecType {
  const mapping = getPayloadTypeMapping()
  return mapping[payloadType] ?? CodecType.UNKNOWN
}

/**
 * Determines codec type from RTCEncodedFrame metadata
 */
export function getCodecType(
  frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame,
): CodecType {
  if (!frame.getMetadata) {
    return CodecType.UNKNOWN
  }

  const metadata = frame.getMetadata()
  if (!metadata || typeof metadata.payloadType !== 'number') {
    return CodecType.UNKNOWN
  }

  return getCodecTypeByPayloadType(metadata.payloadType)
}

/**
 * Checks if a VP8 frame is a key frame by examining the P flag
 * in the VP8 payload descriptor
 *
 * @param data - The frame data
 * @returns true if it's a key frame (P=0), false otherwise
 */
export function isVp8KeyFrame(data: Uint8Array): boolean {
  if (data.length === 0) {
    return false
  }

  // The P flag is the last bit of the first byte
  // P=0 means it's a key frame
  return (data[0] & 0x01) === 0
}

/**
 * Возвращает строку с текущим mapping для отображения в журнале
 */
export function getPayloadTypeMappingString(): string {
  const mapping = getPayloadTypeMapping()
  return Object.entries(mapping)
    .map(([pt, codec]) => {
      const codecName = getCodecNameByType(codec)
      return `PT=${pt} → ${codecName}`
    })
    .join(', ')
}

/**
 * Получает текстовое название кодека по его типу
 */
function getCodecNameByType(codecType: CodecType): string {
  switch (codecType) {
    case CodecType.OPUS:
      return 'OPUS'
    case CodecType.VP8:
      return 'VP8'
    case CodecType.VP9:
      return 'VP9'
    case CodecType.H264:
      return 'H264'
    case CodecType.H265:
      return 'H265'
    case CodecType.RED:
      return 'RED'
    case CodecType.ULPFEC:
      return 'ULPFEC'
    default:
      return 'UNKNOWN'
  }
}
