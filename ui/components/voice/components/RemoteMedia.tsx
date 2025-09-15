import React, { useEffect } from 'react'
import { useTheme } from '../../ThemeProvider'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiUser,
  FiUsers,
} from 'react-icons/fi'
import { MediaTrackInfo } from '../types/mediasoup'
import ScreenShareDisplay from './ScreenShareDisplay'

interface RemoteMediaProps {
  remoteTracks: MediaTrackInfo[]
  createMediaElement: (track: MediaStreamTrack) => void
}

const RemoteMedia: React.FC<RemoteMediaProps> = ({
  remoteTracks,
  createMediaElement,
}) => {
  const { currentTheme } = useTheme()
  const colors = currentTheme.colors

  // Используем useEffect для вызова createMediaElement для каждого трека
  useEffect(() => {
    remoteTracks.forEach((track) => {
      if (
        track.mediaStreamTrack &&
        !document.getElementById(`media-${track.id}`)
      ) {
        createMediaElement(track.mediaStreamTrack)
      }
    })
  }, [remoteTracks, createMediaElement])

  // Группируем треки по участникам
  const participantTracks = remoteTracks.reduce(
    (acc: Record<string, MediaTrackInfo[]>, track) => {
      const participantId = track.participantId || 'unknown'
      if (!acc[participantId]) {
        acc[participantId] = []
      }
      acc[participantId].push(track)
      return acc
    },
    {},
  )

  // Отдельно группируем треки демонстраций экрана
  const screenShareParticipants: Record<
    string,
    { video?: MediaTrackInfo; audio?: MediaTrackInfo }
  > = {}

  // Перебираем всех участников и выявляем треки демонстрации экрана
  Object.entries(participantTracks).forEach(([participantId, tracks]) => {
    const screenVideoTrack = tracks.find(
      (track) => track.type === 'video' && track.sourceType.includes('screen'),
    )
    const screenAudioTrack = tracks.find(
      (track) => track.type === 'audio' && track.sourceType.includes('screen'),
    )

    if (screenVideoTrack || screenAudioTrack) {
      // Создаём уникальный ID для демонстрации экрана
      const screenShareId = `screen-${participantId}`
      screenShareParticipants[screenShareId] = {
        video: screenVideoTrack,
        audio: screenAudioTrack,
      }

      // Удаляем треки демонстрации из массива треков участника
      if (screenVideoTrack) {
        participantTracks[participantId] = participantTracks[
          participantId
        ].filter((t) => t.id !== screenVideoTrack.id)
      }
      if (screenAudioTrack) {
        participantTracks[participantId] = participantTracks[
          participantId
        ].filter((t) => t.id !== screenAudioTrack.id)
      }

      // Если у участника не осталось треков, удаляем его
      if (participantTracks[participantId].length === 0) {
        delete participantTracks[participantId]
      }
    }
  })

  // Функция для генерации градиента на основе ID участника
  const generateGradient = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const hue1 = hash % 360
    const hue2 = (hue1 + 40) % 360
    return `linear-gradient(135deg, hsl(${hue1}, 80%, 50%), hsl(${hue2}, 80%, 60%))`
  }

  // Нет участников и демонстраций экрана
  if (
    Object.keys(participantTracks).length === 0 &&
    Object.keys(screenShareParticipants).length === 0
  ) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center"
        style={{
          backgroundColor: currentTheme.isDark
            ? colors.dark
            : colors.backgroundAlt,
          color: colors.foreground + '80',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center p-4"
        >
          <div className="mb-4">
            <FiUsers
              className="mx-auto h-16 w-16"
              style={{ color: colors.primary + '50' }}
            />
          </div>
          <h3 className="text-xl font-medium mb-2">Ожидание участников</h3>
          <p className="text-sm">Пока нет других подключенных пользователей.</p>
        </motion.div>
      </div>
    )
  }

  // Определяем, какой макет использовать в зависимости от количества участников
  const hasScreenShare = Object.keys(screenShareParticipants).length > 0
  const participantsCount = Object.keys(participantTracks).length

  // Автоматически выбираем подходящий макет сетки
  let gridClassName = 'grid-cols-1' // По умолчанию один столбец

  if (participantsCount > 1 || hasScreenShare) {
    gridClassName = 'grid-cols-1 sm:grid-cols-2' // 2 столбца на маленьких экранах и выше

    if (participantsCount > 4 || (participantsCount > 2 && hasScreenShare)) {
      gridClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' // 3 столбца на больших экранах
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Адаптивная сетка для демонстраций экрана и участников */}
      <div className={`grid ${gridClassName} gap-3 p-2 flex-1 overflow-y-auto`}>
        <AnimatePresence>
          {/* Отображаем демонстрации экрана в начале, занимая больше места */}
          {Object.entries(screenShareParticipants).map(
            ([screenShareId, tracks]) => (
              <motion.div
                key={screenShareId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="screen-share-tile relative w-full h-full rounded-lg overflow-hidden shadow-lg col-span-1 sm:col-span-2"
                style={{ minHeight: '240px' }}
              >
                <ScreenShareDisplay
                  videoTrack={tracks.video}
                  audioTrack={tracks.audio}
                  participantId={screenShareId}
                  participantName={`Демонстрация экрана (${screenShareId.replace('screen-', '').substring(0, 8)})`}
                />
              </motion.div>
            ),
          )}

          {/* Отображаем обычных участников */}
          {Object.entries(participantTracks).map(([participantId, tracks]) => {
            const videoTrack = tracks.find(
              (track) =>
                track.type === 'video' && track.sourceType.includes('camera'),
            )
            const audioTrack = tracks.find(
              (track) =>
                track.type === 'audio' &&
                track.sourceType.includes('microphone'),
            )
            // ID для контейнера, куда будет добавлен медиа-элемент
            const tileId = `participant-tile-${participantId}`

            return (
              <motion.div
                key={participantId}
                id={tileId} // Устанавливаем ID для плитки участника
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="participant-tile relative w-full h-full rounded-lg overflow-hidden shadow-lg flex items-center justify-center"
                style={{
                  backgroundColor: currentTheme.isDark
                    ? colors.backgroundAlt
                    : colors.surface,
                  minHeight: '200px', // Минимальная высота для плитки
                }}
              >
                {/* Видеоэлемент будет добавлен сюда через createMediaElement */}
                {!videoTrack && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-0">
                    <div
                      className="h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center mb-2"
                      style={{ background: generateGradient(participantId) }}
                    >
                      <FiUser className="text-white text-3xl md:text-4xl" />
                    </div>
                    <p className="text-white text-sm bg-black/30 px-2 py-1 rounded">
                      Камера выключена
                    </p>
                  </div>
                )}

                {/* Информация о пользователе (отображается внизу видео) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 md:p-3 z-10">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center min-w-0">
                      <div className="flex items-center">
                        <div
                          className="h-6 w-6 md:h-8 md:w-8 rounded-full mr-2 flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                          style={{
                            background: generateGradient(participantId),
                          }}
                        >
                          {participantId.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="font-medium text-white text-sm md:text-base truncate">
                            Участник
                          </div>
                          <div className="text-xs text-gray-300 truncate">
                            ID: {participantId.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-1 md:space-x-2 flex-shrink-0">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"
                        title={
                          audioTrack ? 'Микрофон включен' : 'Микрофон выключен'
                        }
                      >
                        {audioTrack ? (
                          <FiMic className="text-green-400 h-3 w-3 md:h-4 md:w-4" />
                        ) : (
                          <FiMicOff className="text-red-400 h-3 w-3 md:h-4 md:w-4" />
                        )}
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"
                        title={
                          videoTrack ? 'Камера включена' : 'Камера выключена'
                        }
                      >
                        {videoTrack ? (
                          <FiVideo className="text-green-400 h-3 w-3 md:h-4 md:w-4" />
                        ) : (
                          <FiVideoOff className="text-red-400 h-3 w-3 md:h-4 md:w-4" />
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default RemoteMedia
