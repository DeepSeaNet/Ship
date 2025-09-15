let mainPort = null
let pendingRequests = new Map() // Map<requestId, { resolve, reject }>
let requestIdCounter = 0
// Хранилище для маппинга типов кодеков
let codecMapping = {}

// 1. Получаем порт от основного потока
self.onmessage = (event) => {
  if (event.data.type === 'init') {
    mainPort = event.ports[0]
    mainPort.onmessage = handleMainThreadMessage // Слушаем ответы
    console.log('Воркер шифрования инициализирован с портом')
  } else if (event.data.type === 'updateCodecMapping') {
    // Обновляем маппинг кодеков, когда получаем обновление от основного потока
    codecMapping = event.data.codecMapping || {}
    console.log('Воркер шифрования: обновлен маппинг кодеков', codecMapping)
  }
}

// 3. Обрабатываем ответ от основного потока
function handleMainThreadMessage(event) {
  const { id, encryptedData, error } = event.data
  const promiseFuncs = pendingRequests.get(id)
  if (promiseFuncs) {
    if (error) {
      console.error(`Шифрование не удалось для запроса ${id}:`, error)
      promiseFuncs.reject(error)
    } else {
      // console.log(`Получены зашифрованные данные для запроса ${id}`);
      // Ожидаем, что encryptedData - это Uint8Array или number[] из основного потока
      promiseFuncs.resolve(new Uint8Array(encryptedData).buffer) // Резолвим с ArrayBuffer
    }
    pendingRequests.delete(id)
  } else {
    console.warn(`Получено сообщение для неизвестного ID запроса: ${id}`)
  }
}

// 2. Функция трансформации для исходящих пакетов
async function transform(chunk, controller) {
  if (!mainPort) {
    console.error(
      'Порт воркера шифрования не инициализирован. Отбрасываем чанк.',
    )
    // Можно добавить оригинальный чанк в очередь, если порт не готов?
    // controller.enqueue(chunk);
    return // Или отбросить
  }
  const data = chunk.data // Получаем данные как Uint8Array
  const requestId = requestIdCounter++

  // Получаем информацию о кодеке и типе кадра из метаданных
  let codecType = -1 // UNKNOWN по умолчанию

  // если chunk.type === 'key' || chunk.type === 'delta', то это vp8 видео
  if (chunk.type === 'key' || chunk.type === 'delta') {
    codecType = 1
  }

  // console.log(`Воркер отправляет запрос на шифрование ${requestId}, размер: ${data.length}, кодек: ${codecType}, ключевой: ${isKeyFrame}`);

  // Создаем промис для ожидания ответа основного потока
  const promise = new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject })
  })

  // Конвертируем Uint8Array в number[] для совместимости с Tauri invoke
  const dataArray = data

  // Отправляем данные и ID запроса в основной поток для шифрования
  mainPort.postMessage({
    type: 'encrypt',
    id: requestId,
    data: dataArray, // Отправляем как number[]
    codecType: codecType,
  })

  try {
    // Ждем зашифрованные данные (в виде ArrayBuffer)
    const encryptedBuffer = await promise
    // console.log(`Воркер получил зашифрованные данные для запроса ${requestId}, новый размер: ${encryptedBuffer.byteLength}`);
    // Обновляем данные чанка и добавляем в очередь
    chunk.data = encryptedBuffer
    controller.enqueue(chunk)
  } catch (error) {
    console.error('Трансформация шифрования не удалась:', error)
    // Решаем, как обрабатывать ошибки: отбросить пакет, отправить оригинал?
    // Пока отбрасываем пакет, не добавляя в очередь
  }
}

// Регистрируем трансформацию
// Используем новый API для Chrome >= 125
// eslint-disable-next-line no-undef
if (self.RTCTransformEvent) {
  // eslint-disable-next-line no-undef
  self.onrtctransform = (event) => {
    console.log('Воркер шифрования: событие onrtctransform сработало')
    const transformer = event.transformer
    // Опции недоступны напрямую здесь в Chrome >= 125, используем передачу сообщений
    const readableStream = transformer.readable
    const writableStream = transformer.writable
    const transformStream = new TransformStream({ transform })
    readableStream
      .pipeThrough(transformStream)
      .pipeTo(writableStream)
      .catch((e) => {
        console.error('Ошибка пайпа шифрования:', e)
        // Пытаемся закрыть потоки при ошибке
        readableStream.cancel(e)
        writableStream.abort(e)
      })
  }
} else {
  console.error(
    'RTCRtpScriptTransform не поддерживается в этом контексте воркера.',
  )
}
console.log('Скрипт воркера шифрования загружен')
export default {}
