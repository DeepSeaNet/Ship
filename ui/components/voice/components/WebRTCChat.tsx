import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  FiMic,
  FiMicOff,
  FiCamera,
  FiCameraOff,
  FiPhone,
  FiInfo,
  FiClipboard,
  FiUsers,
  FiMonitor,
} from 'react-icons/fi'

// Импорт компонентов
import LogDisplay from './LogDisplay'
import LocalMedia from './LocalMedia'
import RemoteMedia from './RemoteMedia'
import { useTheme } from '../../ThemeProvider'

// Импорт сервисов
import { MediasoupService } from '../services/MediasoupService'
import { WebRTCConnectionManager } from '../services/WebRTCConnectionManager'
import { MediaManager } from '../services/MediaManager'
import { MediaDeviceDetector } from '../services/MediaDeviceDetector'
import { WorkerManager } from '../services/WorkerManager'
import { AdvancedMicrophoneOptions } from '../services/MicrophoneController'

// Импорт типов
import {
  LogEntry,
  LogEntryType,
  MediaTrackInfo,
  ServerConsumed,
} from '../types/mediasoup'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import ScreenShareDisplay from './ScreenShareDisplay'
import { Button } from '@heroui/react'
import { AppData } from '../types/mediasoup'

interface WebRTCChatProps {
  // Добавляем sessionId в качестве пропса
  sessionId?: string
  userId?: string // ID пользователя
  userName?: string // Имя пользователя
  useAdvancedMicrophone?: boolean // Использовать продвинутый контроллер микрофона
  microphoneOptions?: AdvancedMicrophoneOptions // Настройки микрофона
}

const WebRTCChat: React.FC<WebRTCChatProps> = ({
  sessionId: initialSessionId,
  userId = 'local-user',
  userName = 'Вы',
  microphoneOptions = {
    vadThreshold: 0.015,
    vadMinSpeechDuration: 150,
    vadMinSilenceDuration: 300,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    replaceSilenceWithPackets: true,
  },
}) => {
  const { currentTheme } = useTheme() // Получаем текущую тему
  const colors = currentTheme.colors

  // Состояние

  const [sessionId, setSessionId] = useState(initialSessionId || 'default')
  const [connected, setConnected] = useState(false)
  const [iceSendStatus, setIceSendStatus] = useState('new')
  const [iceRecvStatus, setIceRecvStatus] = useState('new')
  const [remoteTracks, setRemoteTracks] = useState<MediaTrackInfo[]>([])
  const [isEncryptionSupported, setIsEncryptionSupported] = useState(false)
  const [transformApi, setTransformApi] = useState<
    'script' | 'encodedStreams' | 'none'
  >('none')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  // Добавляем состояние для локального потока демонстрации экрана
  const [localScreenStream, setLocalScreenStream] =
    useState<MediaStream | null>(null)

  // UI состояния
  const [participantCount, setParticipantCount] = useState(1) // По умолчанию один участник (сам пользователь)
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected')

  // Добавим отдельное состояние для отслеживания активности веб-камеры
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isAudioActive, setIsAudioActive] = useState(false)

  // Рефы для сервисов
  const mediasoupServiceRef = useRef<MediasoupService | null>(null)
  const connectionManagerRef = useRef<WebRTCConnectionManager | null>(null)
  const mediaManagerRef = useRef<MediaManager | null>(null)
  const deviceDetectorRef = useRef<MediaDeviceDetector | null>(null)
  const workerManagerRef = useRef<WorkerManager | null>(null)

  // Функция для добавления записей в лог
  const addLog = useCallback((message: string, type: LogEntryType = 'info') => {
    const newEntry: LogEntry = {
      timestamp: new Date(),
      message,
      type,
    }

    setLogs((prevLogs) => {
      const updatedLogs = [...prevLogs, newEntry].slice(-100) // Ограничиваем логи
      return updatedLogs
    })

    switch (type) {
      case 'error':
        console.error(message)
        break
      case 'warning':
        console.warn(message)
        break
      case 'success':
        console.log('%c' + message, 'color: green')
        break
      default:
        console.log(message)
    }
  }, [])

  // Функция для очистки логов
  const clearLogs = useCallback(() => {
    setLogs([])
    addLog('Журнал очищен', 'info')
  }, [addLog])

  // Создание медиа элемента для удаленного трека
  const createMediaElement = useCallback(
    (track: MediaStreamTrack) => {
      const trackInfo = remoteTracks.find((t) => t.id === track.id)
      if (!trackInfo || !trackInfo.participantId) {
        addLog(
          `Не удалось найти информацию или participantId для трека ${track.id} в createMediaElement`,
          'error',
        )
        return
      }

      const participantId = trackInfo.participantId
      const tileId = `participant-tile-${participantId}`
      const participantTile = document.getElementById(tileId)

      if (!participantTile) {
        addLog(
          `Ошибка: контейнер для участника ${participantId} (ID: ${tileId}) не найден.`,
          'error',
        )
        return
      }

      const trackId = track.id
      const domId = `media-${trackId}`

      if (document.getElementById(domId)) {
        addLog(`Медиа элемент ${domId} уже существует`, 'info')
        return // Не создаем дубликат
      }

      const element = document.createElement(
        track.kind === 'video' ? 'video' : 'audio',
      )
      element.id = domId

      if (track.kind === 'video') {
        addLog(
          `Создан видео элемент ${domId} для трека ${trackId} участника ${participantId}`,
          'success',
        )
      } else {
        addLog(
          `Создан аудио элемент ${domId} для трека ${trackId} участника ${participantId}`,
          'success',
        )
      }

      element.controls = false
      element.autoplay = true

      // Стилизуем видео элемент для полноэкранного заполнения
      if (track.kind === 'video') {
        element.className =
          'video-element w-full h-full object-cover absolute inset-0 z-0' // Добавляем классы Tailwind
      } else {
        element.style.display = 'none'
      }

      // Добавляем элемент в плитку участника
      participantTile.appendChild(element)
      addLog(`Элемент ${domId} добавлен в плитку ${tileId}`, 'success')

      // Добавляем трек в медиа поток
      const mediaStream = new MediaStream([track])
      element.srcObject = mediaStream
      addLog(`Поток установлен для элемента ${domId}`, 'success')

      // Добавляем обработчики событий для отслеживания проблем с воспроизведением
      element.onplaying = () => {
        addLog(
          `Воспроизведение началось для ${track.kind} трека ${trackId}`,
          'success',
        )
      }

      element.onpause = () => {
        addLog(
          `Воспроизведение приостановлено для ${track.kind} трека ${trackId}`,
          'info',
        )
      }

      element.onerror = (event) => {
        const mediaError = (element as HTMLMediaElement).error
        addLog(
          `Ошибка воспроизведения для ${track.kind} трека ${trackId}: ${mediaError?.message || event}`,
          'error',
        )
      }

      // Добавляем обработчик для случая, если трек закончился
      track.onended = () => {
        addLog(`Трек ${trackId} (${track.kind}) завершился`, 'warning')
        removeMediaElement(trackId)
      }
    },
    [addLog, remoteTracks],
  )

  // Удаление медиа элемента
  const removeMediaElement = useCallback(
    (trackId: string) => {
      const domId = `media-${trackId}`
      const element = document.getElementById(domId)
      if (element) {
        addLog(`Удаление медиа элемента ${domId}`, 'info')
        if (element instanceof HTMLMediaElement) {
          element.pause()
          element.srcObject = null // Очищаем источник
        }

        element.remove()

        // Обновляем счетчик участников
        setParticipantCount(() => {
          const uniqueParticipants = new Set()
          remoteTracks.forEach((t) => {
            if (t.id !== trackId && t.participantId)
              uniqueParticipants.add(t.participantId)
          })
          return uniqueParticipants.size + 1 // +1 для текущего пользователя
        })
      }
    },
    [addLog, remoteTracks],
  )

  // Обновляем код для исправления проблемы с инициализацией transformApi

  // В секции эффектов для инициализации устройств:
  useEffect(() => {
    // Инициализация детектора устройств
    const deviceDetector = new MediaDeviceDetector({
      addLog,
    })
    deviceDetectorRef.current = deviceDetector

    // Получаем и устанавливаем информацию о поддержке API трансформации
    const isEncryptionSupported = deviceDetector.isEncryptionSupported()
    const supportedTransformApi = deviceDetector.getTransformApi()

    addLog(
      `Проверка поддержки Insertable Streams API завершена. Результат: ${supportedTransformApi}`,
      'info',
    )

    setIsEncryptionSupported(isEncryptionSupported)
    setTransformApi(supportedTransformApi)

    // Загружаем список устройств
    deviceDetector.detectDevices()

    // Очистка при размонтировании
    return () => {
      deviceDetector.cleanup()
    }
  }, [addLog])

  // Заменяем автоматическое подключение, чтобы оно выполнялось только после определения transformApi
  useEffect(() => {
    // Проверяем, была ли уже выполнена проверка поддержки API
    if (transformApi !== 'none') {
      addLog(
        `Инициализация подключения с transformApi: ${transformApi}`,
        'info',
      )
      startRtc()
    }
  }, [transformApi])

  // Инициализация WebRTC соединения
  const startRtc = useCallback(async () => {
    if (connected) {
      addLog('Уже подключено.', 'warning')
      return
    }

    setConnectionStatus('connecting')
    addLog(
      `Запуск RTC соединения для сессии ${sessionId} с API трансформации: ${transformApi}`,
      'info',
    )

    // Инициализация Worker Manager
    const workerManager = new WorkerManager({
      sessionId,
      addLog,
    })
    workerManagerRef.current = workerManager

    // Если поддерживается RTCRtpScriptTransform, инициализируем воркеры
    if (transformApi === 'script') {
      addLog('Инициализация воркеров для API script', 'info')
      workerManager.initializeWorkers()
    } else if (transformApi === 'encodedStreams') {
      addLog(
        'Initializing encoded stream worker through WorkerManager...',
        'info',
      )
      workerManager.initializeEncodedStreamWorker()
    }

    // Инициализация MediasoupService
    const mediasoupService = new MediasoupService({
      sessionId,
      addLog,
      onTransportsInitialized: () => {
        // Колбэк вызывается при успешной инициализации транспортов
        addLog('Транспорты успешно инициализированы', 'success')
      },
      transformApi,
      encryptionWorker: workerManager.getEncryptionWorker(),
      decryptionWorker: workerManager.getDecryptionWorker(),
    })
    mediasoupServiceRef.current = mediasoupService

    // Инициализация MediaManager
    const mediaManager = new MediaManager({
      mediasoupService,
      addLog,
      microphoneOptions,
    })
    mediaManagerRef.current = mediaManager

    const server: string[] = await invoke('get_voice_servers')
    // Инициализация WebRTCConnectionManager
    const connectionManager = new WebRTCConnectionManager({
      sessionId,
      serverUrl: `ws://${server[0]}:3005`, // URL сервера
      addLog,
      mediasoupService,
      onProducerAdded: (
        producerId: string,
        participantId: string,
        appData: AppData,
      ) => {
        if (mediasoupService.getDevice()) {
          addLog(
            `Запрос потребления producer ${producerId} от участника ${participantId}`,
            'info',
          )
          connectionManager.sendMessage({
            action: 'Consume',
            producerId: producerId,
            rtpCapabilities: mediasoupService.getDevice()!.rtpCapabilities,
          })

          mediasoupService.setResponseCallback(
            `Consumed:${producerId}`,
            async (data: unknown) => {
              const consumedMessage = data as ServerConsumed
              await mediasoupService.createConsumer(
                consumedMessage,
                (
                  track: MediaStreamTrack,
                  consumerId: string,
                  newProducerId: string,
                ) => {
                  const trackType = track.kind === 'video' ? 'video' : 'audio'
                  addLog(
                    `Получен новый трек ${track.id} (kind: ${trackType}) от Consumer ${consumerId} для Producer ${newProducerId}`,
                    'info',
                  )

                  setRemoteTracks((prevTracks) => {
                    if (!prevTracks.some((t) => t.id === track.id)) {
                      const MediaTrackInfo: MediaTrackInfo = {
                        id: track.id,
                        type: trackType,
                        producerId: newProducerId,
                        consumerId,
                        participantId,
                        mediaStreamTrack: track,
                        sourceType: appData.sourceType,
                      }
                      console.log(MediaTrackInfo)
                      addLog(
                        `Добавление трека в состояние: ${trackType} (${track.id}), Producer: ${newProducerId}, Участник: ${participantId}`,
                        'info',
                      )
                      return [...prevTracks, MediaTrackInfo]
                    }
                    return prevTracks
                  })
                },
                connectionManager.sendMessage.bind(connectionManager),
              )
            },
          )
        }
      },
      onProducerRemoved: (producerId: string, participantId: string) => {
        addLog(
          `Producer ${producerId} от участника ${participantId} удален. Удаляем связанные consumers.`,
          'info',
        )
        const consumers = mediasoupService.getConsumers()

        Array.from(consumers.entries()).forEach(([consumerId, consumer]) => {
          if (consumer.producerId === producerId) {
            mediasoupService.removeConsumer(consumerId, (trackId: string) => {
              removeMediaElement(trackId)
              setRemoteTracks((prevTracks) =>
                prevTracks.filter((t) => t.id !== trackId),
              )
              addLog(
                `Удален медиа элемент и трек ${trackId} для producer ${producerId} участника ${participantId}`,
                'info',
              )
            })
          }
        })
      },
      onConnectionStateChange: async (isConnected: boolean) => {
        setConnected(isConnected)
        setConnectionStatus(isConnected ? 'connected' : 'disconnected')

        // Автоматически запускаем микрофон при подключении
        if (isConnected && mediaManager) {
          addLog('Автоматический запуск микрофона...', 'info')
          await mediaManager.startAudio()

          // Если используем продвинутый контроллер, настраиваем события
          if (mediaManager.getMicrophoneController()) {
            const controller = mediaManager.getMicrophoneController()
            if (controller && 'addEventListener' in controller) {
              controller.addEventListener('voiceStart', () => {
                setVoiceActive(true)
                addLog('Обнаружена голосовая активность', 'info')
              })

              controller.addEventListener('voiceEnd', () => {
                setVoiceActive(false)
                addLog('Голосовая активность прекратилась', 'info')
              })
            }
          }
        }
      },
    })
    connectionManagerRef.current = connectionManager

    // Подключаемся к серверу
    await connectionManager.connect()
  }, [
    sessionId,
    connected,
    addLog,
    transformApi,
    createMediaElement,
    removeMediaElement,
    microphoneOptions,
  ])

  // Добавляем useEffect для вызова createMediaElement при обновлении remoteTracks
  useEffect(() => {
    remoteTracks.forEach((trackInfo) => {
      if (
        trackInfo.mediaStreamTrack &&
        !document.getElementById(`media-${trackInfo.id}`)
      ) {
        addLog(
          `Вызов createMediaElement для трека ${trackInfo.id} из useEffect`,
          'info',
        )
        createMediaElement(trackInfo.mediaStreamTrack)
      }
    })
  }, [remoteTracks, createMediaElement, addLog])

  useEffect(() => {
    setIsAudioActive(mediaManagerRef.current?.isAudioActive() || false)
  }, [mediaManagerRef.current?.isAudioActive()])

  // Запуск видео
  const startCam = useCallback(async () => {
    if (!mediaManagerRef.current) {
      addLog('MediaManager не инициализирован', 'error')
      return
    }

    await mediaManagerRef.current.startVideo()
    setIsCameraActive(true)
  }, [addLog])

  // Остановка видео
  const stopCam = useCallback(() => {
    if (!mediaManagerRef.current) {
      addLog('MediaManager не инициализирован', 'error')
      return
    }

    mediaManagerRef.current.stopVideo()
    setIsCameraActive(false)
  }, [addLog])

  const toggleCamera = useCallback(() => {
    if (isCameraActive) {
      stopCam()
    } else {
      startCam()
    }
  }, [isCameraActive, startCam, stopCam])

  // Заменяем функции запуска/остановки микрофона на функцию toggle
  const toggleMic = useCallback(async () => {
    if (!mediaManagerRef.current) {
      addLog('MediaManager не инициализирован', 'error')
      return
    }

    await mediaManagerRef.current.toggleAudio()
  }, [addLog])

  // Функция для запуска демонстрации экрана
  const startScreenShare = useCallback(async () => {
    if (!mediaManagerRef.current) {
      addLog('MediaManager не инициализирован', 'error')
      return
    }

    try {
      addLog('Запуск демонстрации экрана с аудио...', 'info')

      // Используем обновленный метод startScreenShare из MediaManager
      const screenStream = await mediaManagerRef.current.startScreenShare()

      if (!screenStream) {
        addLog('Не удалось получить поток демонстрации экрана', 'error')
        return
      }

      // Сохраняем локальный поток демонстрации экрана
      setLocalScreenStream(screenStream)

      // Публикуем демонстрацию экрана
      await mediaManagerRef.current.publishScreenShare()

      setIsScreenSharing(true)
      addLog('Демонстрация экрана запущена успешно', 'success')

      // Обновляем счетчик участников (+1 для демонстрации экрана)
      setParticipantCount((prevCount) => prevCount + 1)

      // Не меняем состояние isCameraActive при запуске демонстрации экрана
    } catch (error) {
      addLog(`Ошибка при запуске демонстрации экрана: ${error}`, 'error')
    }
  }, [addLog])

  // Функция для остановки демонстрации экрана
  const stopScreenShare = useCallback(() => {
    if (!mediaManagerRef.current) {
      addLog('MediaManager не инициализирован', 'error')
      return
    }

    addLog('Остановка демонстрации экрана...', 'info')
    mediaManagerRef.current.stopScreenShare()
    setIsScreenSharing(false)
    setLocalScreenStream(null)

    // Уменьшаем счетчик участников (-1 для демонстрации экрана)
    setParticipantCount((prevCount) => Math.max(prevCount - 1, 1))

    addLog('Демонстрация экрана остановлена', 'success')
  }, [addLog])

  // Функция для переключения демонстрации экрана
  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      startScreenShare()
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  // Полная очистка всех ресурсов
  const cleanupMedia = useCallback(() => {
    addLog('Выполнение очистки медиа-ресурсов и соединения...', 'info')

    // Остановка медиа потоков
    if (mediaManagerRef.current) {
      mediaManagerRef.current.stopAllMedia()
    }

    // Закрытие соединения
    if (connectionManagerRef.current) {
      connectionManagerRef.current.closeConnection()
    }

    // Очистка воркеров
    if (workerManagerRef.current) {
      workerManagerRef.current.cleanup()
    }
    // Выходим из сессии
    invoke('leave_session')
    // Очистка состояния удаленных треков
    setRemoteTracks([])

    // Сброс состояния компонента
    setConnected(false)
    setIceSendStatus('new')
    setIceRecvStatus('new')
    setConnectionStatus('disconnected')

    addLog('Очистка ресурсов завершена', 'success')
  }, [addLog])

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      addLog(
        'Компонент WebRTCChat размонтируется, выполняется очистка...',
        'info',
      )
      cleanupMedia()
    }
  }, [cleanupMedia, addLog])

  // Обновление сопоставления типов кодеков в воркерах при необходимости
  useEffect(() => {
    if (workerManagerRef.current) {
      const timerId = setTimeout(() => {
        workerManagerRef.current?.updateCodecMapping()
      }, 100)

      return () => clearTimeout(timerId)
    }
  }, [])

  // Копирование ID сессии в буфер обмена
  const copySessionId = useCallback(() => {
    navigator.clipboard
      .writeText(sessionId)
      .then(() => {
        addLog('ID канала скопирован в буфер обмена', 'success')
      })
      .catch((err) => {
        addLog(`Ошибка копирования ID канала: ${err}`, 'error')
      })
  }, [sessionId, addLog])

  // Добавляем эффект для синхронизации состояния камеры при инициализации
  useEffect(() => {
    if (connected && mediaManagerRef.current) {
      // Синхронизируем состояние isCameraActive с текущим состоянием камеры
      setIsCameraActive(mediaManagerRef.current.isVideoActive())
    }
  }, [connected])

  // JSX Рендеринг
  return (
    <div
      className="webrtc-chat flex flex-col h-full rounded-lg overflow-hidden"
      style={{
        background: currentTheme.isDark ? colors.backgroundAlt : colors.light,
        color: colors.foreground,
      }}
    >
      {/* Заголовок и статус соединения */}
      <div
        className="border-b border-slate-200 dark:border-slate-600 p-4"
        style={{ borderColor: colors.secondary }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div
              className={`h-3 w-3 rounded-full mr-2 ${
                connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
              }`}
            ></div>
            <h2 className="text-lg font-medium">
              {connectionStatus === 'connected'
                ? 'Соединение установлено'
                : connectionStatus === 'connecting'
                  ? 'Подключение...'
                  : 'Не подключено'}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
              title="Показать/скрыть отладочную информацию"
            >
              <FiInfo size={18} />
            </button>
          </div>
        </div>

        {/* Информация о канале */}
        {showDebugInfo && (
          <div
            className="mt-3 p-3 rounded-md text-sm"
            style={{
              backgroundColor: currentTheme.isDark
                ? colors.secondary
                : colors.secondaryLight,
              color: colors.foreground,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">
                ID канала:
              </span>
              <div className="flex items-center">
                <span className="font-mono mr-2">{sessionId}</span>
                <button
                  onClick={copySessionId}
                  className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  title="Копировать ID канала"
                >
                  <FiClipboard size={14} />
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">
                Версия API:
              </span>
              <span className="font-mono">{transformApi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">
                Шифрование:
              </span>
              <span>{isEncryptionSupported ? 'Да' : 'Нет'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">
                Send ICE:
              </span>
              <span>{iceSendStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">
                Recv ICE:
              </span>
              <span>{iceRecvStatus}</span>
            </div>
          </div>
        )}
      </div>

      {/* Основной контент */}
      <div
        className="flex-1 overflow-y-auto p-0 bg-gradient-to-b"
        style={{
          background: currentTheme.isDark
            ? `linear-gradient(180deg, ${colors.backgroundAlt}, ${colors.dark})`
            : `linear-gradient(180deg, ${colors.light}, ${colors.background})`,
        }}
      >
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className="bg-white dark:bg-slate-700 rounded-lg shadow-lg p-6 max-w-md w-full text-center"
              style={{
                backgroundColor: currentTheme.isDark
                  ? colors.backgroundAlt
                  : colors.light,
                color: colors.foreground,
              }}
            >
              <div className="text-4xl mb-4">👥</div>
              {connectionStatus === 'connecting' ? (
                <>
                  <h3 className="text-xl font-bold mb-2">Подключение...</h3>
                  <p
                    className="mb-6"
                    style={{ color: colors.foreground + '80' }}
                  >
                    Выполняется подключение к голосовому каналу
                  </p>
                  <div className="flex justify-center">
                    <div
                      className="animate-spin rounded-full h-10 w-10 border-b-2"
                      style={{ borderColor: colors.primary }}
                    ></div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2">Не подключено</h3>
                  <p
                    className="mb-6"
                    style={{ color: colors.foreground + '80' }}
                  >
                    Нет соединения с голосовым каналом
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={startRtc}
                    className="px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.primary,
                      color: 'white',
                    }}
                  >
                    Подключиться
                  </motion.button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Информация об участниках */}
            <div className="mb-0 flex items-center justify-between p-4">
              <div
                className="p-2 px-4 rounded-lg shadow-sm flex items-center"
                style={{
                  backgroundColor: currentTheme.isDark
                    ? colors.backgroundAlt
                    : colors.light,
                  color: colors.foreground,
                }}
              >
                <FiUsers className="mr-2" style={{ color: colors.primary }} />
                <span>Участников: {participantCount}</span>
              </div>

              {showStats ? (
                <button
                  onClick={() => setShowStats(false)}
                  className="py-2 px-4 rounded-lg transition-colors"
                  style={{
                    backgroundColor: currentTheme.isDark
                      ? colors.secondary
                      : colors.secondaryLight,
                    color: colors.foreground,
                  }}
                >
                  Показать медиа
                </button>
              ) : (
                <button
                  onClick={() => setShowStats(true)}
                  className="py-2 px-4 rounded-lg transition-colors"
                  style={{
                    backgroundColor: currentTheme.isDark
                      ? colors.secondary
                      : colors.secondaryLight,
                    color: colors.foreground,
                  }}
                >
                  Показать статистику
                </button>
              )}
            </div>

            {showStats ? (
              <div
                className="p-4 flex-1 overflow-auto rounded-lg mx-4 mb-4"
                style={{
                  backgroundColor: currentTheme.isDark
                    ? colors.backgroundAlt
                    : colors.light,
                  color: colors.foreground,
                }}
              ></div>
            ) : (
              <div className="flex-1 p-4">
                {/* Основная сетка с адаптивным макетом для всех размеров экрана */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
                  {/* Локальное медиа - всегда видно */}
                  <div
                    className="rounded-lg shadow-sm overflow-hidden h-[300px] md:h-auto"
                    style={{
                      backgroundColor: currentTheme.isDark
                        ? colors.backgroundAlt
                        : colors.light,
                    }}
                  >
                    <LocalMedia
                      key={`local-media-${mediaManagerRef.current?.getLocalVideoStream()?.id || 'none'}-${mediaManagerRef.current?.isVideoActive()}`}
                      videoStream={
                        mediaManagerRef.current?.getLocalVideoStream() || null
                      }
                      audioStream={
                        mediaManagerRef.current?.getLocalAudioStream() || null
                      }
                      isVideoActive={
                        mediaManagerRef.current?.isVideoActive() || false
                      }
                      isAudioActive={
                        mediaManagerRef.current?.isAudioActive() || false
                      }
                      userId={userId}
                      userName={userName}
                    />
                  </div>

                  {/* Удаленное медиа */}
                  <div
                    className={`rounded-lg shadow-sm overflow-hidden h-[300px] md:h-auto ${
                      isScreenSharing
                        ? 'md:col-span-1'
                        : 'md:col-span-1 xl:col-span-2'
                    }`}
                    style={{
                      backgroundColor: currentTheme.isDark
                        ? colors.backgroundAlt
                        : colors.light,
                    }}
                  >
                    <RemoteMedia
                      remoteTracks={remoteTracks}
                      createMediaElement={createMediaElement}
                    />
                  </div>

                  {/* Отображение собственной демонстрации экрана */}
                  {isScreenSharing && localScreenStream && (
                    <div
                      className="rounded-lg shadow-md overflow-hidden h-[300px] md:h-auto"
                      style={{
                        backgroundColor: currentTheme.isDark
                          ? colors.backgroundAlt
                          : colors.light,
                      }}
                    >
                      <div className="relative w-full h-full">
                        <ScreenShareDisplay
                          videoTrack={localScreenStream.getVideoTracks()[0]}
                          audioTrack={
                            localScreenStream.getAudioTracks().length > 0
                              ? localScreenStream.getAudioTracks()[0]
                              : undefined
                          }
                          participantId={userId}
                          participantName={`${userName} (демонстрация экрана)`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Кнопки управления поверх контента */}
        {connected && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center space-x-4 z-20">
            <Button
              onPress={toggleMic}
              variant="bordered"
              color={
                !isAudioActive ? 'danger' : voiceActive ? 'success' : 'primary'
              }
              isIconOnly
              size="lg"
              title={isAudioActive ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {mediaManagerRef.current?.isAudioActive() ? (
                <FiMic size={24} />
              ) : (
                <FiMicOff size={24} />
              )}
            </Button>

            <Button
              onPress={() => toggleCamera()}
              variant="bordered"
              color="primary"
              isIconOnly
              size="lg"
              title={isCameraActive ? 'Выключить камеру' : 'Включить камеру'}
            >
              {isCameraActive ? (
                <FiCamera size={24} />
              ) : (
                <FiCameraOff size={24} />
              )}
            </Button>

            <Button
              onPress={toggleScreenShare}
              variant="bordered"
              color="primary"
              isIconOnly
              size="lg"
              title={
                isScreenSharing
                  ? 'Прекратить демонстрацию'
                  : 'Демонстрировать экран'
              }
            >
              <FiMonitor size={24} />
            </Button>

            <Button
              onPress={cleanupMedia}
              variant="bordered"
              color="danger"
              isIconOnly
              size="lg"
              title="Отключиться"
            >
              <FiPhone style={{ transform: 'rotate(135deg)' }} />
            </Button>
          </div>
        )}

        {/* Переключатель журнала */}
        {connected && (
          <div className="absolute bottom-0 left-0 right-0 text-center">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs hover:text-slate-700 dark:hover:text-slate-300 py-1"
              style={{ color: colors.foreground + '80' }}
            >
              {showLogs ? 'Скрыть журнал' : 'Показать журнал'}
            </button>
          </div>
        )}
      </div>

      {/* Панель логов (скрыта по умолчанию) */}
      {showLogs && (
        <div className="border-t" style={{ borderColor: colors.secondary }}>
          <LogDisplay
            logs={logs}
            showLogs={showLogs}
            onToggleShowLogs={() => setShowLogs(!showLogs)}
            onClearLogs={clearLogs}
          />
        </div>
      )}
    </div>
  )
}

export default WebRTCChat
