'use client'

import { useState, Fragment } from 'react'
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import {
  FiX,
  FiMic,
  FiUsers,
  FiClipboard,
  FiLogIn,
  FiInfo,
  FiMinimize2,
  FiMaximize2,
  FiPhone,
} from 'react-icons/fi'
import WebRTCChat from './WebRTCChat'
import { useTheme } from '../../ThemeProvider'

// Импортируем uuid для генерации уникальных идентификаторов
import { v4 as uuidv4 } from 'uuid'
import { Button, ButtonGroup, Input } from '@heroui/react'

interface VoiceChannelModalProps {
  isOpen: boolean
  onClose: () => void
  groupId?: string
  groupName?: string
}

const VoiceChannelModal: React.FC<VoiceChannelModalProps> = ({
  isOpen,
  onClose,
  groupName,
}) => {
  const { currentTheme } = useTheme() // Получаем текущую тему
  const [channelName, setChannelName] = useState(
    groupName ? `Голосовой чат ${groupName}` : 'Новый голосовой канал',
  )
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isChannelCreated, setIsChannelCreated] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [inputSessionId, setInputSessionId] = useState('')
  const [isLinkCopied, setIsLinkCopied] = useState(false)
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [isMinimized, setIsMinimized] = useState(false)
  const [showWebRTC, setShowWebRTC] = useState(false)
  const [isValidUuid, setIsValidUuid] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const colors = currentTheme.colors

  // Функция для проверки валидности UUID
  const validateUuid = (uuid: string) => {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
    return uuidRegex.test(uuid)
  }

  // Создание канала
  const handleCreateChannel = () => {
    // Генерируем UUID v4 для идентификатора канала
    const newSessionId = uuidv4()
    setSessionId(newSessionId)
    setIsChannelCreated(true)
  }

  // Обновляем обработчик изменения inputSessionId для проверки валидности
  const handleInputSessionIdChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value
    setInputSessionId(value)
    setIsValidUuid(validateUuid(value))
  }

  // Подключение к существующему каналу
  const handleJoinChannel = () => {
    if (inputSessionId.trim() && isValidUuid) {
      setSessionId(inputSessionId)
      setIsChannelCreated(true)
    }
  }

  // Запуск WebRTC соединения
  const startConnection = () => {
    setShowWebRTC(true)
    // Разворачиваем во весь экран
    setIsFullScreen(true)
  }

  // Копирование ссылки для приглашения
  const copyInviteLink = () => {
    const baseUrl = window.location.origin
    const inviteLink = `${baseUrl}/voice?id=${sessionId}`

    navigator.clipboard.writeText(inviteLink).then(() => {
      setIsLinkCopied(true)
      setTimeout(() => setIsLinkCopied(false), 2000) // Показать сообщение на 2 секунды
    })
  }

  // Закрытие модального окна
  const handleClose = () => {
    setIsChannelCreated(false)
    setSessionId('')
    setInputSessionId('')
    setShowWebRTC(false)
    setIsMinimized(false)
    setIsFullScreen(false)
    onClose()
  }

  // Переключение минимизированного/развернутого режима
  const toggleMinimize = () => {
    const nextMinimized = !isMinimized
    setIsMinimized(nextMinimized)
    if (showWebRTC && !nextMinimized) {
      // При разворачивании из минимизированного режима
      setIsFullScreen(true)
    }
    if (nextMinimized) {
      // При сворачивании
      setIsFullScreen(false)
    }
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={isMinimized ? () => {} : handleClose}
      >
        {/* Оверлей (затемнение), который скрывается при минимизации */}
        <Transition
          as={Fragment}
          show={!isMinimized}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition>

        {/* Контейнер, который позволяет кликать "сквозь" себя, когда окно свернуто */}
        <div
          className="fixed inset-0 overflow-y-auto"
          style={isMinimized ? { pointerEvents: 'none' } : {}}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {/* 
                Единая панель, которая меняет свой вид в зависимости от isMinimized.
                Это позволяет не размонтировать WebRTCChat.
              */}
              <DialogPanel
                style={isMinimized ? { pointerEvents: 'auto' } : {}}
                className={`transform overflow-hidden rounded-xl bg-white dark:bg-slate-800 text-left align-middle shadow-xl transition-all duration-300 ease-in-out
                  ${
                    isMinimized
                      ? 'fixed top-4 left-1/2 -translate-x-1/2 flex items-center px-4 py-2 w-auto'
                      : `p-6 ${isFullScreen ? 'fixed inset-0 w-screen h-screen rounded-none' : 'w-full max-w-md'}`
                  }`}
              >
                {/* Минимизированный вид */}
                <div
                  className={`transition-all duration-300 ease-in-out ${isMinimized ? 'flex items-center opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                >
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center mr-3">
                      <FiMic className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium">{channelName}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {showWebRTC ? 'Подключено' : 'Канал создан'}
                      </p>
                    </div>
                  </div>
                  <div className="flex ml-6 space-x-2">
                    {!showWebRTC && isChannelCreated && (
                      <button
                        onClick={startConnection}
                        className="p-2 rounded-full bg-primary text-white"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <FiPhone className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={toggleMinimize}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <FiMaximize2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleClose}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Полноразмерный вид */}
                <div
                  className={`transition-all duration-300 ease-in-out ${isMinimized ? 'opacity-0 absolute pointer-events-none' : 'opacity-100 block'} h-full flex flex-col`}
                >
                  {/* Заголовок */}
                  <div
                    className="flex justify-between items-center px-6 py-4 border-b dark:border-slate-700"
                    style={{
                      borderColor: currentTheme.isDark
                        ? colors.secondary
                        : colors.secondaryLight,
                    }}
                  >
                    <div className="flex items-center">
                      <div
                        className="mr-3 p-2 rounded-full"
                        style={{
                          backgroundColor: colors.primary,
                          color: 'white',
                        }}
                      >
                        <FiMic className="text-xl" />
                      </div>
                      <DialogTitle
                        as="h2"
                        className="text-xl font-semibold dark:text-white"
                      >
                        {isChannelCreated
                          ? channelName
                          : mode === 'create'
                            ? 'Создать голосовой канал'
                            : 'Подключиться к каналу'}
                      </DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {isChannelCreated && (
                        <button
                          onClick={copyInviteLink}
                          className="flex items-center px-3 py-1 rounded-md text-sm"
                          style={{
                            backgroundColor: `${colors.primary}20`, // 20% прозрачности
                            color: colors.primary,
                          }}
                        >
                          <FiClipboard className="mr-1" />
                          {isLinkCopied ? 'Скопировано!' : 'Копировать ссылку'}
                        </button>
                      )}
                      <button
                        onClick={toggleMinimize}
                        className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <FiMinimize2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleClose}
                        className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                        aria-label="Закрыть"
                      >
                        <FiX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Содержимое модального окна */}
                  <div
                    className={`flex-1 ${isFullScreen ? 'h-[calc(100vh-130px)]' : 'p-0'}`}
                  >
                    {!isChannelCreated ? (
                      <div className="px-6 py-4 space-y-4">
                        <div className="flex mb-4 rounded-md p-1 justify-between">
                          <ButtonGroup className="w-full flex justify-between">
                            <Button
                              onPress={() => setMode('create')}
                              variant="flat"
                              size="lg"
                              className={`flex-1 py-2 px-4 rounded-md text-center ${mode === 'create' ? 'bg-primary text-white' : ''}`}
                            >
                              Создать новый
                            </Button>
                            <Button
                              onPress={() => setMode('join')}
                              variant="flat"
                              size="lg"
                              className={`flex-1 py-2 px-4 rounded-md text-center ${mode === 'join' ? 'bg-primary text-white' : ''}`}
                            >
                              Присоединиться
                            </Button>
                          </ButtonGroup>
                        </div>

                        {mode === 'create' ? (
                          <>
                            <div>
                              <Input
                                type="text"
                                label="Название канала"
                                labelPlacement="outside"
                                variant="flat"
                                size="md"
                                color="primary"
                                id="channelName"
                                value={channelName}
                                onChange={(e) => setChannelName(e.target.value)}
                                placeholder="Введите название канала"
                              />
                            </div>

                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="videoEnabled"
                                checked={isVideoEnabled}
                                onChange={(e) =>
                                  setIsVideoEnabled(e.target.checked)
                                }
                                className="h-4 w-4 focus:ring-primary border-gray-300 rounded"
                                style={{ color: colors.primary }}
                              />
                              <label
                                htmlFor="videoEnabled"
                                className="ml-2 block text-sm"
                              >
                                Включить видео
                              </label>
                            </div>

                            <div
                              className="p-3 rounded-md"
                              style={{
                                backgroundColor: currentTheme.isDark
                                  ? `${colors.warning}20`
                                  : `${colors.warning}10`,
                                color: currentTheme.isDark
                                  ? colors.warning
                                  : colors.foreground,
                              }}
                            >
                              <p className="text-sm flex items-center">
                                <FiUsers className="mr-2 flex-shrink-0" />
                                <span>
                                  После создания канала вам будет предоставлена
                                  уникальная ссылка, которой вы можете
                                  поделиться с другими участниками для
                                  присоединения к голосовому чату.
                                </span>
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <Input
                                type="text"
                                label="ID голосового канала"
                                labelPlacement="outside"
                                variant="flat"
                                color="primary"
                                id="sessionId"
                                value={inputSessionId}
                                onChange={handleInputSessionIdChange}
                                placeholder="Введите UUID канала"
                                pattern="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
                                errorMessage="Введите корректный UUID"
                              />
                            </div>

                            <div
                              className="p-3 rounded-md"
                              style={{
                                backgroundColor: currentTheme.isDark
                                  ? `${colors.info}20`
                                  : `${colors.info}10`,
                                color: currentTheme.isDark
                                  ? colors.info
                                  : colors.foreground,
                              }}
                            >
                              <p className="text-sm flex items-center">
                                <FiInfo className="mr-2 flex-shrink-0" />
                                <span>
                                  Введите ID голосового канала, который вы
                                  получили от организатора, чтобы присоединиться
                                  к разговору.
                                </span>
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    ) : showWebRTC ? (
                      <div
                        className={`voice-chat-container ${isFullScreen ? 'h-full' : 'h-[600px]'}`}
                      >
                        <WebRTCChat sessionId={sessionId} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-10 space-y-6 h-[400px]">
                        <div
                          className="h-20 w-20 rounded-full flex items-center justify-center mb-2"
                          style={{ backgroundColor: `${colors.primary}20` }}
                        >
                          <FiMic
                            className="h-10 w-10"
                            style={{ color: colors.primary }}
                          />
                        </div>
                        <h2 className="text-xl font-medium text-center">
                          Голосовой канал готов
                        </h2>
                        <p
                          className="text-center max-w-md"
                          style={{ color: colors.foreground + '99' }}
                        >
                          {
                            'Канал создан и готов к подключению. Нажмите на кнопку "Подключиться", чтобы присоединиться к разговору.'
                          }
                        </p>
                        <button
                          onClick={startConnection}
                          className="px-6 py-3 rounded-lg text-white font-medium flex items-center justify-center"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <FiPhone className="mr-2" />
                          Подключиться к каналу
                        </button>
                        <p
                          className="text-sm"
                          style={{ color: colors.foreground + '60' }}
                        >
                          ID канала: {sessionId.substring(0, 8)}...
                          {sessionId.substring(sessionId.length - 4)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Кнопки действий - только для экрана создания/подключения */}
                  {!isChannelCreated && (
                    <div
                      className="px-6 py-4 border-t flex justify-end"
                      style={{
                        borderColor: currentTheme.isDark
                          ? colors.secondary
                          : colors.secondaryLight,
                      }}
                    >
                      <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md mr-2"
                        style={{
                          borderColor: currentTheme.isDark
                            ? colors.secondary
                            : colors.secondaryLight,
                          color: colors.foreground,
                        }}
                      >
                        Отмена
                      </button>
                      {mode === 'create' ? (
                        <button
                          onClick={handleCreateChannel}
                          className="px-4 py-2 text-white rounded-md flex items-center"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <FiMic className="mr-2" />
                          Создать канал
                        </button>
                      ) : (
                        <button
                          onClick={handleJoinChannel}
                          disabled={!inputSessionId.trim() || !isValidUuid}
                          className={'px-4 py-2 rounded-md flex items-center'}
                          style={{
                            backgroundColor:
                              inputSessionId.trim() && isValidUuid
                                ? colors.primary
                                : '#9CA3AF',
                            color: 'white',
                            opacity:
                              inputSessionId.trim() && isValidUuid ? 1 : 0.7,
                            cursor:
                              inputSessionId.trim() && isValidUuid
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                        >
                          <FiLogIn className="mr-2" />
                          Присоединиться
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default VoiceChannelModal
