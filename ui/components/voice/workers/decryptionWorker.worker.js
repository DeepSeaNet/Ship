let mainPort = null
let pendingRequests = new Map()
let requestIdCounter = 0
// Хранилище для маппинга типов кодеков
let codecMapping = {}

self.onmessage = (event) => {
  if (event.data.type === 'init') {
    mainPort = event.ports[0]
    mainPort.onmessage = handleMainThreadMessage
    console.log('Воркер дешифрования инициализирован с портом')
  } else if (event.data.type === 'updateCodecMapping') {
    // Обновляем маппинг кодеков, когда получаем обновление от основного потока
    codecMapping = event.data.codecMapping || {}
    console.log('Воркер дешифрования: обновлен маппинг кодеков', codecMapping)
  }
}

function handleMainThreadMessage(event) {
  const { id, decryptedData, error } = event.data
  const promiseFuncs = pendingRequests.get(id)
  if (promiseFuncs) {
    if (error) {
      console.error(`Дешифрование не удалось для запроса ${id}:`, error)
      promiseFuncs.reject(error)
    } else {
      // console.log(`Получены дешифрованные данные для запроса ${id}`);
      promiseFuncs.resolve(new Uint8Array(decryptedData).buffer) // Резолвим с ArrayBuffer
    }
    pendingRequests.delete(id)
  } else {
    console.warn(`Получено сообщение для неизвестного ID запроса: ${id}`)
  }
}

async function transform(chunk, controller) {
  if (!mainPort) {
    console.error(
      'Порт воркера дешифрования не инициализирован. Отбрасываем чанк.',
    )
    // controller.enqueue(chunk); // Пропустить без дешифрования, если порт не готов
    return
  }
  const data = chunk.data
  const requestId = requestIdCounter++

  // Получаем информацию о кодеке и типе кадра из метаданных
  let codecType = -1 // UNKNOWN по умолчанию

  // Проверяем наличие getMetadata
  if (chunk.type === 'key' || chunk.type === 'delta') {
    codecType = 1
  }

  // console.log(`Воркер отправляет запрос на дешифрование ${requestId}, размер: ${data.length}, кодек: ${codecType}, ключевой: ${isKeyFrame}`);

  const promise = new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject })
  })

  // Конвертируем Uint8Array в number[] для Tauri
  const dataArray = data

  mainPort.postMessage({
    type: 'decrypt',
    id: requestId,
    data: dataArray, // Отправляем как number[]
    codecType: codecType,
  })

  try {
    const decryptedBuffer = await promise
    // console.log(`Воркер получил дешифрованные данные для запроса ${requestId}, новый размер: ${decryptedBuffer.byteLength}`);
    chunk.data = decryptedBuffer
    controller.enqueue(chunk)
  } catch (error) {
    console.error('Трансформация дешифрования не удалась:', error)
    // controller.enqueue(chunk); // Пропустить зашифрованный при ошибке? Или отбросить. Пока отбрасываем.
  }
}

// Регистрируем трансформацию
// eslint-disable-next-line no-undef
if (self.RTCTransformEvent) {
  // eslint-disable-next-line no-undef
  self.onrtctransform = (event) => {
    console.log('Воркер дешифрования: событие onrtctransform сработало')
    const transformer = event.transformer
    const readableStream = transformer.readable
    const writableStream = transformer.writable
    const transformStream = new TransformStream({ transform })
    readableStream
      .pipeThrough(transformStream)
      .pipeTo(writableStream)
      .catch((e) => {
        console.error('Ошибка пайпа дешифрования:', e)
        readableStream.cancel(e)
        writableStream.abort(e)
      })
  }
} else {
  console.error(
    'RTCRtpScriptTransform не поддерживается в этом контексте воркера.',
  )
}
console.log('Скрипт воркера дешифрования загружен')
export default {}
