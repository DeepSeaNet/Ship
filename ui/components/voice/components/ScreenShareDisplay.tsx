import React, { useRef, useEffect, useState } from 'react'
import { useTheme } from '../../ThemeProvider'
import { motion } from 'framer-motion'
import { FiMonitor, FiVolumeX, FiVolume2 } from 'react-icons/fi'
import { MediaTrackInfo } from '../types/mediasoup'
import { Alert } from '@heroui/react'

interface ScreenShareDisplayProps {
  videoTrack?: MediaTrackInfo | MediaStreamTrack
  audioTrack?: MediaTrackInfo | MediaStreamTrack
  participantId: string
  participantName?: string
}

const ScreenShareDisplay: React.FC<ScreenShareDisplayProps> = ({
  videoTrack,
  audioTrack,
  participantId,
  participantName = 'Демонстрация экрана',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const { currentTheme } = useTheme()
  const colors = currentTheme.colors

  // Генерация градиента для фона на основе ID участника
  const generateGradient = () => {
    const hash = participantId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const hue1 = hash % 360
    const hue2 = (hue1 + 40) % 360
    return `linear-gradient(135deg, hsl(${hue1}, 80%, 50%), hsl(${hue2}, 80%, 60%))`
  }

  // Обработчики событий для видео
  const handleVideoPlay = () => {
    console.log('Видео демонстрации экрана начало воспроизводиться')
    setVideoReady(true)
  }

  const handleVideoError = (
    e: React.SyntheticEvent<HTMLVideoElement, Event>,
  ) => {
    const target = e.target as HTMLVideoElement
    const error = target.error
    console.error(
      'Ошибка видео демонстрации:',
      error?.message || 'Неизвестная ошибка',
    )
    setVideoError(error?.message || 'Неизвестная ошибка')
    setVideoReady(false)
  }

  // Обработчик события для аудио
  const handleAudioPlay = () => {
    console.log('Аудио демонстрации экрана начало воспроизводиться')
    setAudioReady(true)
  }

  useEffect(() => {
    // Функция для получения MediaStreamTrack из разных типов входных данных
    const getMediaStreamTrack = (
      track: MediaTrackInfo | MediaStreamTrack | undefined,
    ): MediaStreamTrack | undefined => {
      if (!track) return undefined

      // Если это MediaStreamTrack, возвращаем его напрямую
      if ('kind' in track) return track

      // Если это MediaTrackInfo с mediaStreamTrack, возвращаем трек
      return track.mediaStreamTrack
    }

    // Получаем видеотрек
    const actualVideoTrack = getMediaStreamTrack(videoTrack)

    // Обновляем видео элемент при изменении трека
    if (videoRef.current && actualVideoTrack) {
      console.log(
        `Устанавливаем видеотрек ${actualVideoTrack.id} в элемент video`,
      )

      try {
        const stream = new MediaStream([actualVideoTrack])
        videoRef.current.srcObject = stream
        setVideoError(null)
      } catch (error) {
        console.error('Ошибка при установке видеотрека демонстрации:', error)
        setVideoError(`Ошибка отображения: ${error}`)
      }
    }

    // Получаем аудиотрек
    const actualAudioTrack = getMediaStreamTrack(audioTrack)

    // Обновляем аудио элемент при изменении трека
    if (audioRef.current && actualAudioTrack) {
      console.log(
        `Устанавливаем аудиотрек ${actualAudioTrack.id} в элемент audio`,
      )

      try {
        const stream = new MediaStream([actualAudioTrack])
        audioRef.current.srcObject = stream
      } catch (error) {
        console.error('Ошибка при установке аудиотрека демонстрации:', error)
      }
    }
  }, [videoTrack, audioTrack])

  // Определяем, есть ли видеотрек
  const hasVideoTrack = Boolean(videoTrack)

  // Определяем, есть ли аудиотрек
  const hasAudioTrack = Boolean(audioTrack)

  return (
    <div className="screen-share-display w-full h-full flex flex-col relative overflow-hidden rounded-lg">
      {/* Метка "Демонстрация экрана" вверху */}
      <div className="absolute top-2 left-2 z-20 flex items-center">
        <Alert
          variant="flat"
          title="Демонстрация экрана"
          icon={<FiMonitor />}
          color="primary"
          classNames={{
            base: 'py-1 px-2 text-xs leading-tight',
            title: 'text-xs',
            description: 'text-xs',
          }}
        />
      </div>

      {/* Видео контейнер */}
      <div
        className="video-container relative flex-grow w-full overflow-hidden"
        style={{ backgroundColor: currentTheme.isDark ? colors.dark : '#111' }}
      >
        {/* Фактическое видео */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-contain ${hasVideoTrack && videoReady ? 'opacity-100' : 'opacity-0'}`}
          onPlay={handleVideoPlay}
          onError={handleVideoError}
        />

        {/* Аудио элемент (скрыт) */}
        <audio
          ref={audioRef}
          autoPlay
          className="hidden"
          onPlay={handleAudioPlay}
        />

        {/* Плейсхолдер, когда нет видео */}
        {(!hasVideoTrack || !videoReady || videoError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="h-24 w-24 md:h-32 md:w-32 rounded-full flex items-center justify-center mb-4"
              style={{ background: generateGradient() }}
            >
              <FiMonitor className="text-white text-4xl md:text-5xl" />
            </div>
            {videoError ? (
              <p className="text-white text-sm bg-red-500/80 px-3 py-1 rounded-md mt-2">
                {videoError}
              </p>
            ) : (
              <p className="text-white text-sm bg-black/30 px-3 py-1 rounded">
                Ожидание демонстрации экрана...
              </p>
            )}
          </div>
        )}

        {/* Статусы */}
        <div className="absolute bottom-2 right-2 flex space-x-2 z-20">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"
            title={
              hasAudioTrack && audioReady
                ? 'Звук демонстрации включен'
                : 'Звук демонстрации выключен'
            }
          >
            {hasAudioTrack && audioReady ? (
              <FiVolume2 className="text-green-400 h-4 w-4" />
            ) : (
              <FiVolumeX className="text-red-400 h-4 w-4" />
            )}
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.1 }}
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"
            title="Демонстрация экрана"
          >
            <FiMonitor
              className={`${hasVideoTrack && videoReady ? 'text-green-400' : 'text-gray-400'} h-4 w-4`}
            />
          </motion.div>
        </div>
      </div>

      {/* Информационная панель демонстрации экрана */}
      <div
        className="screen-info-panel w-full p-3 flex items-center justify-between"
        style={{
          backgroundColor: colors.backgroundAlt,
          color: colors.foreground,
          borderTop: `1px solid ${colors.primary}`,
        }}
      >
        <div className="flex items-center">
          <div
            className="h-8 w-8 rounded-full mr-3 flex items-center justify-center"
            style={{
              background: colors.primary,
              color: 'white',
            }}
          >
            <FiMonitor className="text-lg" />
          </div>
          <div>
            <div className="font-medium">{participantName}</div>
            <div className="text-xs opacity-70">
              ID: {participantId.substring(0, 8)}
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
          В эфире
        </div>
      </div>
    </div>
  )
}

export default ScreenShareDisplay
