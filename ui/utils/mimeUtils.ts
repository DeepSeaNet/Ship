export const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg' // Default to JPEG if extension is unknown
  }
}

export const getMimeTypeBySignature = (base64data: string): string => {
  try {
    // Удаляем заголовок data:image/... если он есть
    const cleanedBase64 = base64data.includes(',')
      ? base64data.split(',')[1]
      : base64data

    // Декодируем первые байты для анализа
    const binaryString = atob(cleanedBase64.substring(0, 24))
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Проверка сигнатур распространенных форматов файлов
    // JPEG
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg'
    }

    // PNG
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return 'image/png'
    }

    // GIF
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    ) {
      return 'image/gif'
    }

    // PDF
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return 'application/pdf'
    }

    // ZIP (также может быть docx, xlsx, pptx и другие)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return 'application/zip'
    }

    // MP3 с ID3v2
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return 'audio/mpeg'
    }

    // MP4/M4A/M4V и другие MPEG-4 контейнеры
    if (
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return 'video/mp4'
    }

    // WebP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp'
    }

    // Если формат не определен, возвращаем generic тип
    return 'application/octet-stream'
  } catch (error) {
    console.error('Error detecting mime type from base64:', error)
    return 'application/octet-stream'
  }
}

export const createMediaUrl = (media: string) => {
  if (!media) return undefined

  const binaryString = atob(media)
  const uint8Array = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))

  const blob = new Blob([uint8Array], {
    type: getMimeTypeBySignature(media || ''),
  })
  return URL.createObjectURL(blob)
}
