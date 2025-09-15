import React, { useRef, useEffect, useState } from 'react'
import { useTheme } from '../../ThemeProvider'
import { motion } from 'framer-motion'
import { FiMic, FiMicOff, FiCamera, FiCameraOff, FiUser } from 'react-icons/fi'

interface LocalMediaProps {
  videoStream: MediaStream | null
  audioStream: MediaStream | null
  isVideoActive: boolean
  isAudioActive: boolean
  userId?: string // Добавляем ID пользователя
  userName?: string // Добавляем имя пользователя
}

const LocalMedia: React.FC<LocalMediaProps> = ({
  videoStream,
  audioStream,
  isVideoActive,
  isAudioActive,
  userId = 'you', // По умолчанию "you"
  userName = 'Вы', // По умолчанию "Вы"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const { currentTheme } = useTheme() // Получаем текущую тему
  const colors = currentTheme.colors

  // Обновляем видео элемент при изменении потока
  useEffect(() => {
    if (videoRef.current && videoStream) {
      console.log('Установка видеопотока в элемент video:', videoStream.id)

      try {
        videoRef.current.srcObject = videoStream

        // Сбрасываем ошибку, если она была
        setVideoError(null)
      } catch (error) {
        console.error('Ошибка при установке видеопотока:', error)
        setVideoError(`Ошибка отображения: ${error}`)
      }
    } else if (videoRef.current && !videoStream) {
      console.log('Сброс видеопотока в элементе video')
      videoRef.current.srcObject = null
      setVideoReady(false)
    }
  }, [videoStream])

  // Обновляем аудио элемент при изменении потока
  useEffect(() => {
    if (audioRef.current && audioStream) {
      try {
        audioRef.current.srcObject = audioStream
      } catch (error) {
        console.error('Ошибка при установке аудиопотока:', error)
      }
    }
  }, [audioStream])

  // Обработчики событий для видео
  const handleVideoPlay = () => {
    console.log('Видео начало воспроизводиться')
    setVideoReady(true)
  }

  const handleVideoError = (
    e: React.SyntheticEvent<HTMLVideoElement, Event>,
  ) => {
    const target = e.target as HTMLVideoElement
    const error = target.error
    console.error('Ошибка видео:', error?.message || 'Неизвестная ошибка')
    setVideoError(error?.message || 'Неизвестная ошибка')
    setVideoReady(false)
  }

  // Генерация градиента для аватара на основе ID пользователя
  const generateGradient = () => {
    const hash = userId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const hue1 = hash % 360
    const hue2 = (hue1 + 40) % 360
    return `linear-gradient(135deg, hsl(${hue1}, 80%, 50%), hsl(${hue2}, 80%, 60%))`
  }

  return (
    <div className="local-media w-full h-full flex flex-col relative overflow-hidden rounded-lg">
      {/* Видео контейнер */}
      <div
        className="video-container relative flex-grow w-full overflow-hidden"
        style={{
          backgroundColor: currentTheme.isDark ? colors.backgroundAlt : '#111',
        }}
      >
        {/* Метка "Вы" в верхнем левом углу */}
        <div className="absolute top-2 left-2 z-20 bg-black/40 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
          {userName} (Вы)
        </div>

        {/* Фактическое видео */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isVideoActive && videoStream && videoReady ? 'opacity-100' : 'opacity-0'}`}
          onPlay={handleVideoPlay}
          onError={handleVideoError}
        />

        {/* Плейсхолдер, когда нет видео */}
        {(!isVideoActive || !videoStream || !videoReady || videoError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center mb-2"
              style={{
                background: generateGradient(),
              }}
            >
              <FiUser className="text-white text-3xl md:text-4xl" />
            </div>
            {videoError ? (
              <p className="text-white text-sm bg-red-500/80 px-3 py-1 rounded-md mt-2">
                {videoError}
              </p>
            ) : (
              <p className="text-white text-sm bg-black/30 px-3 py-1 rounded">
                {isVideoActive ? 'Инициализация камеры...' : 'Камера выключена'}
              </p>
            )}
          </div>
        )}

        {/* Аудио элемент (скрыт) */}
        <audio ref={audioRef} autoPlay muted className="hidden" />

        {/* Статусы микрофона и камеры */}
        <div className="absolute bottom-2 right-2 flex space-x-2 z-20">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"
            title={isAudioActive ? 'Микрофон включен' : 'Микрофон выключен'}
          >
            {isAudioActive ? (
              <FiMic className="text-green-400 h-4 w-4" />
            ) : (
              <FiMicOff className="text-red-400 h-4 w-4" />
            )}
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.1 }}
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"
            title={
              isVideoActive && videoStream
                ? 'Камера включена'
                : 'Камера выключена'
            }
          >
            {isVideoActive && videoStream ? (
              <FiCamera className="text-green-400 h-4 w-4" />
            ) : (
              <FiCameraOff className="text-red-400 h-4 w-4" />
            )}
          </motion.div>
        </div>
      </div>

      {/* Информационная панель с именем пользователя */}
      <div
        className="user-info-panel w-full p-3 flex items-center justify-between"
        style={{
          backgroundColor: colors.backgroundAlt,
          color: colors.foreground,
          borderTop: `1px solid ${colors.primary}`,
        }}
      >
        <div className="flex items-center">
          <div
            className="h-8 w-8 rounded-full mr-3 flex items-center justify-center text-xs font-semibold"
            style={{ background: generateGradient() }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{userName}</div>
            <div className="text-xs opacity-70">
              ID: {userId.substring(0, 8)}
            </div>
          </div>
        </div>
        <div
          className="text-xs px-3 py-1 rounded-full"
          style={{
            backgroundColor: colors.primary,
            color: 'white',
          }}
        >
          Вы
        </div>
      </div>
    </div>
  )
}

export default LocalMedia
