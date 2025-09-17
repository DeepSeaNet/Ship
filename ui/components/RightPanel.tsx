'use client'
import React, { useState, useCallback, useEffect } from 'react'
import {
  FiFile,
  FiImage,
  FiShield,
  FiBell,
  FiSearch,
  FiUserPlus,
  FiDownload,
  FiClock,
  FiInfo,
} from 'react-icons/fi'
import { motion } from 'framer-motion'
import { addToast, Avatar, Button, Divider } from '@heroui/react'
import UserContextMenu, { UserAction } from './context_menu/UserContextMenu'
import PermissionsModal from './dialog/PermissionsModal'
import { User } from '@/hooks/Contacts'
import {
  Group,
  isGroup,
  getGroupDisplayKey,
  inviteUserToGroup,
  removeUserFromGroup,
} from '@/hooks/Group'
import { Chat } from '@/hooks/Chat'
import { Message } from '@/hooks/Message'
import { Permissions } from '@/hooks/Group'
import { BasicWindow } from '@/hooks/Window'
import { getUsernameFromId } from '@/hooks/Contacts'
import { InviteUserModal } from '@/components/dialog/InviteUserModal'
import { safeLocalStorage } from '@/utils/safeLocalStorage'
import { bytesToDisplayKey } from '@/utils/bytesToNumber'
// Определяем типы для данных пользователей
type UserDetails = {
  name: string
  status: string
  title: string
  email: string
  phone: string
  timezone: string
  joined: string
  avatar?: string
  description?: string
}

interface RightPanelProps {
  selectedChat: Group | Chat | null
  closeRightPanel: () => void
  onToggleSearch?: () => void
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | Group | null>>
  chats: Chat[]
  groups: Chat[]
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  setGroups: React.Dispatch<React.SetStateAction<Chat[]>>
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
  contacts: Record<number, User>
  setContacts: React.Dispatch<React.SetStateAction<Record<number, User>>>
  isMobile: boolean
}

// Обновляем тип для медиа-элементов, чтобы включить ссылку на файл
type MediaItem = {
  media_id: string
  filename: string
  timestamp: number
  size?: number
  url?: string // Добавляем поле для хранения ссылки на файл
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedChat,
  closeRightPanel,
  onToggleSearch,
  setSelectedChat,
  chats,
  groups,
  setChats,
  setGroups,
  messages,
  setMessages,
  isLoading,
  setIsLoading,
  currentChatMessages,
  setCurrentChatMessages,
  contacts,
  setContacts,
  isMobile,
}) => {
  const { checkPermission } = Group({
    groups,
    setGroups,
    isLoading,
    setIsLoading,
    messages,
    setMessages,
    selectedChat,
    setSelectedChat,
    currentChatMessages,
    setCurrentChatMessages,
  })

  // 1. All useState hooks
  const [activeTab, setActiveTab] = useState<'info' | 'shared' | 'security'>(
    'info',
  )
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [userContextMenu, setUserContextMenu] = useState<{
    userId: number
    groupName?: string
    userName?: string
    x: number
    y: number
  } | null>(null)
  // Add contacts state
  // Добавляем состояние для хранения display key группы
  const [groupDisplayKey, setGroupDisplayKey] = useState<string>('')
  const [isLoadingDisplayKey, setIsLoadingDisplayKey] = useState(false)

  const { setActiveChat } = BasicWindow({
    currentChatMessages: currentChatMessages,
    setCurrentChatMessages: setCurrentChatMessages,
    messages: messages,
    setMessages: setMessages,
    selectedChat: selectedChat,
    setChats: setChats,
    setGroups: setGroups,
    isLoading: isLoading,
    setIsLoading: setIsLoading,
    chats: chats,
    groups: groups,
    setSelectedChat: setSelectedChat,
    contacts: contacts,
    setContacts: setContacts,
  })

  // Add state for media items
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)

  const [chatDetails, setChatDetails] = useState<Chat | UserDetails | null>(
    null,
  )
  // Add state for showing all members
  const [showAllMembers, setShowAllMembers] = useState(false)

  // 2. Derived state
  const chatInfo = selectedChat
  const isGroupChatSelected = isGroup(selectedChat)
  const isUserChatSelected = !isGroup(selectedChat)

  // Получаем текущий user ID из localStorage и определяем права
  const currentUserId = Number(safeLocalStorage.getItem('userId'))

  // Используем наш type guard для безопасного вызова checkPermission
  const canManageMembers = isGroup(selectedChat)
    ? checkPermission(selectedChat, 'manage_members')
    : false

  const isCreator = isGroup(selectedChat)
    ? selectedChat?.owner_id
      ? Number(selectedChat.owner_id) === Number(currentUserId)
      : false
    : false
  const isAdmin = isGroup(selectedChat)
    ? selectedChat?.admins?.includes(Number(currentUserId)) || false
    : false

  // 3. All useCallback hooks
  const handleUserContextMenu = (
    e: React.MouseEvent,
    userId: number,
    userName: string,
  ) => {
    e.preventDefault()
    setUserContextMenu({
      userId,
      groupName: selectedChat?.chat_id,
      userName,
      x: e.clientX,
      y: e.clientY,
    })
  }

  const handleUserLongPress = (
    e: React.TouchEvent,
    userId: number,
    userName: string,
  ) => {
    e.preventDefault()
    const touch = e.touches[0]
    setUserContextMenu({
      userId,
      groupName: selectedChat?.chat_id,
      userName,
      x: touch.clientX,
      y: touch.clientY,
    })
  }

  // Добавляем новые состояния для модального окна управления разрешениями
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{
    id: string | number
    name: string
    permissions?: Permissions
  } | null>(null)

  const { createChat } = Chat({
    chats: chats,
    setChats: setChats,
    isLoading: isLoading,
    setIsLoading: setIsLoading,
    messages: messages,
    setMessages: setMessages,
    selectedChat: selectedChat,
    setSelectedChat: setSelectedChat,
    currentChatMessages: currentChatMessages,
    setCurrentChatMessages: setCurrentChatMessages,
  })

  const handleUserAction = async (action: UserAction) => {
    // Skip handling if this is the dummy action (userId === 0)
    if (action.userId === 0) {
      console.log('Ignoring dummy close action')
      return
    }

    // Close the menu immediately to provide feedback
    setUserContextMenu(null)

    try {
      console.log('User action received:', action)

      switch (action.type) {
        case 'create_chat':
          if (action.userId && action.userId !== 0) {
            console.log('Opening/creating chat with user:', action.userId)

            try {
              // Get the proper username for display in toasts
              const username = getUsernameFromId(
                action.userId,
                contacts,
                setContacts,
              )

              // Look for a direct chat with this user
              console.log('Chats:', chats)
              const existingChat = chats.find((chat: Chat) =>
                chat.participants?.some(
                  (p: number) => Number(p) === Number(action.userId),
                ),
              )

              if (existingChat) {
                // Open existing chat - actually set it as the selected chat
                console.log('Found existing chat:', existingChat)
                // Check if we have the setSelectedChat function
                if (setSelectedChat) {
                  setSelectedChat(existingChat)
                  setActiveChat(existingChat)
                  // Close right panel on mobile to show the chat
                  if (window.innerWidth < 768) {
                    closeRightPanel()
                  }

                  addToast({
                    title: 'Открытие чата',
                    description: `Открытие существующего чата с ${username}`,
                    color: 'success',
                  })
                } else {
                  console.error(
                    'Cannot set selected chat - setSelectedChat function not provided',
                  )
                  addToast({
                    title: 'Ошибка',
                    description:
                      'Не удалось открыть существующий чат - внутренняя ошибка',
                    color: 'danger',
                  })
                }
              } else {
                // Create new chat
                console.log('Creating new chat with user:', action.userId)
                const chatId = await createChat(Number(action.userId))

                // Now find the newly created chat and select it
                const newChat = Array.isArray(chats)
                  ? chats.find((chat: Chat) =>
                      chat.participants?.some(
                        (p: number) => Number(p) === Number(action.userId),
                      ),
                    )
                  : null

                if (newChat && setSelectedChat) {
                  setSelectedChat(newChat)

                  // Close right panel on mobile to show the chat
                  if (window.innerWidth < 768) {
                    closeRightPanel()
                  }
                }
              }
            } catch (error) {
              console.error('Error checking/creating chat:', error)
              addToast({
                title: 'Ошибка',
                description: `Не удалось открыть чат: ${error}`,
                color: 'danger',
                variant: 'flat',
              })
            }
          }
          break

        case 'manage_permissions':
          if (action.userId && action.groupName) {
            console.log(
              'Managing permissions for user:',
              action.userId,
              'in group:',
              action.groupName,
            )

            // Получаем текущие разрешения пользователя из группы
            let currentPermissions: Permissions | undefined

            if (
              selectedChat &&
              isGroup(selectedChat) &&
              selectedChat.users_permissions
            ) {
              // Попытка получить разрешения из кэша группы
              currentPermissions =
                selectedChat.users_permissions[Number(action.userId)]
            }

            if (
              !currentPermissions &&
              selectedChat &&
              isGroup(selectedChat) &&
              selectedChat.group_config
            ) {
              // Попытка получить разрешения из конфигурации группы
              currentPermissions =
                selectedChat.group_config.permissions[Number(action.userId)]
            }

            // Используем default_permissions как запасной вариант
            if (
              !currentPermissions &&
              selectedChat &&
              isGroup(selectedChat) &&
              selectedChat.default_permissions
            ) {
              currentPermissions = selectedChat.default_permissions
            }

            // Или используем пустые разрешения по умолчанию
            if (!currentPermissions) {
              currentPermissions = {
                manage_members: false,
                send_messages: true,
                delete_messages: false,
                rename_group: false,
                manage_permissions: false,
                pin_messages: false,
                manage_admins: false,
              }
            }

            // Установить пользователя и открыть модальное окно
            setSelectedUser({
              id: action.userId,
              name:
                action.userName ||
                getUsernameFromId(action.userId, contacts, setContacts),
              permissions: currentPermissions,
            })

            setIsPermissionsModalOpen(true)
          } else {
            console.error(
              'Missing required parameters for manage_permissions:',
              { userId: action.userId, groupName: action.groupName },
            )

            addToast({
              title: 'Ошибка',
              description:
                'Отсутствуют необходимые данные для управления правами',
              color: 'danger',
              variant: 'flat',
            })
          }
          break

        case 'remove_from_group':
          if (action.groupName && action.userName) {
            console.log(
              '⚠️ Removing user from group:',
              action.userName,
              'Group:',
              action.groupName,
            )

            try {
              // Use the local removeUserFromGroup function
              const result = await removeUserFromGroup(
                action.groupName,
                action.userId,
              )
              console.log('Remove result:', result)

              if (result) {
                addToast({
                  title: 'Успешно',
                  description: `Пользователь ${action.userName} удален из группы ${action.groupName}`,
                  color: 'success',
                  variant: 'flat',
                })
              }
            } catch (removeError) {
              console.error('Error in removeUserFromGroup:', removeError)
              addToast({
                title: 'Ошибка удаления',
                description: `Не удалось удалить пользователя: ${removeError}`,
                color: 'danger',
                variant: 'flat',
              })
            }
          } else {
            console.error(
              'Missing required parameters for remove_from_group:',
              { groupName: action.groupName, userName: action.userName },
            )

            addToast({
              title: 'Ошибка',
              description:
                'Отсутствуют необходимые данные для удаления пользователя',
              color: 'danger',
              variant: 'flat',
            })
          }
          break

        case 'edit_contact':
          console.log('Editing contact:', action.userName)
          addToast({
            title: 'Редактирование контакта',
            description: 'Функция в разработке',
            color: 'primary',
          })
          break

        case 'block_user':
          console.log('Blocking user:', action.userName)
          addToast({
            title: 'Блокировка пользователя',
            description: 'Функция в разработке',
            color: 'primary',
          })
          break
      }
    } catch (error) {
      console.error('Error handling user action:', error)
      addToast({
        title: 'Ошибка',
        description: `Не удалось выполнить действие: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    }
  }

  const renderChatHeader = useCallback(() => {
    if (!chatInfo) return null
    return (
      <>
        {chatInfo.avatar ? (
          <div className="h-25 w-25 rounded-lg shadow-lg relative overflow-hidden mb-3">
            <Avatar
              src={chatInfo.avatar}
              alt={`Аватар группы ${chatInfo.name}`}
              isBordered
              radius="lg"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-20 w-20 rounded-lg bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-3xl mb-3 shadow-lg">
            {chatInfo.name.charAt(0)}
          </div>
        )}
        <h2 className="text-xl font-bold mb-1">{chatInfo.name}</h2>
      </>
    )
  }, [chatInfo])

  const renderUserHeader = useCallback(() => {
    if (!chatInfo) return null
    return (
      <>
        {chatInfo.avatar ? (
          <div className="h-20 w-20 rounded-lg shadow-lg relative overflow-hidden mb-3">
            <Avatar
              src={chatInfo.avatar}
              alt={`Аватар пользователя ${chatInfo.name}`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-20 w-20 rounded-lg bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-3xl mb-3 shadow-lg">
            {chatInfo.name.charAt(0)}
          </div>
        )}
        <h2 className="text-xl font-bold mb-1">{chatInfo.name}</h2>
        <div
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs 
          ${
            !isGroup(chatInfo) && chatInfo.online === true
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-100'
              : 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-100'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full mr-1 
            ${!isGroup(chatInfo) && chatInfo.online === true ? 'bg-green-500' : 'bg-slate-500'}`}
          ></span>
          {!isGroup(chatInfo) && chatInfo.online === true}
        </div>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {!isGroup(chatInfo) && chatInfo.name}
        </p>
      </>
    )
  }, [chatInfo])

  const renderHeader = useCallback(() => {
    return (
      <div className="flex justify-between items-center mb-4">
        {onToggleSearch && (
          <Button
            color="primary"
            variant="bordered"
            size="sm"
            onPress={onToggleSearch}
            className="flex items-center gap-1 rounded-full"
            title="Найти в сообщениях (Ctrl+F)"
          >
            <FiSearch className="mr-1" /> Поиск
          </Button>
        )}
      </div>
    )
  }, [closeRightPanel, onToggleSearch])

  // Добавляем новое состояние для хранения информации о развёрнутом/свёрнутом описании
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isDescriptionLong, setIsDescriptionLong] = useState(false)

  // Обновляем состояние длины описания при изменении выбранного чата
  useEffect(() => {
    if (selectedChat && isGroup(selectedChat)) {
      const chatDescription =
        selectedChat.description || selectedChat.group_config?.description || ''
      if (chatDescription && chatDescription.length > 150) {
        setIsDescriptionLong(true)
      } else {
        setIsDescriptionLong(false)
        setIsDescriptionExpanded(false) // Сбрасываем состояние, если описание короткое
      }
    }
  }, [selectedChat])

  const renderChatInfo = useCallback(() => {
    if (!selectedChat || !isGroup(selectedChat)) return null

    // Получаем ID создателя группы
    const creatorId = selectedChat.owner_id ? selectedChat.owner_id : null

    // Получаем описание чата
    const chatDescription =
      selectedChat.description || selectedChat.group_config?.description || ''

    // Форматируем описание с учетом переносов строк
    const formatDescription = (text: string) => {
      // Если описание длинное и не развернуто, показываем только первые 150 символов
      let formattedText = text

      if (isDescriptionLong && !isDescriptionExpanded) {
        formattedText = text.substring(0, 150) + '...'
      }

      // Автоматически разбиваем текст на строки по 40-50 символов,
      // учитывая уже существующие переносы строк
      const autoLineBreak = (inputText: string) => {
        // Сначала сохраняем эмодзи, чтобы они не ломались при разбивке текста
        const emojiRegex =
          /([\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g
        const emojiPlaceholder = '___EMOJI_PLACEHOLDER___'
        const emojis: string[] = []

        // Сохраняем эмодзи и заменяем их плейсхолдерами
        const textWithoutEmojis = inputText.replace(emojiRegex, (match) => {
          emojis.push(match)
          return emojiPlaceholder
        })

        // Сначала обрабатываем URL, чтобы не разбивать их
        const urlRegex = /(https?:\/\/[^\s]+)/g
        const urlPlaceholder = '___URL_PLACEHOLDER___'
        const urls: string[] = []

        // Сохраняем URL и заменяем их плейсхолдерами
        const textWithoutUrlsAndEmojis = textWithoutEmojis.replace(
          urlRegex,
          (match) => {
            urls.push(match)
            return urlPlaceholder
          },
        )

        const lines = textWithoutUrlsAndEmojis.split('\n')
        let maxLineLength = 35 // Уменьшаем максимальную длину строки для лучшего отображения в правой панели

        // Для мобильных устройств с еще меньшей шириной
        if (window.innerWidth < 640) {
          maxLineLength = 28
        }

        const processedLines = lines
          .map((line) => {
            if (line.length <= maxLineLength) return line

            // Разбиваем длинную строку
            const chunks = []
            let currentIndex = 0

            // Ищем последний пробел перед maxLineLength
            while (currentIndex < line.length) {
              // Проверяем, не осталось ли меньше символов, чем maxLineLength
              if (currentIndex + maxLineLength >= line.length) {
                chunks.push(line.substring(currentIndex))
                break
              }

              const substringToCheck = line.substring(
                currentIndex,
                currentIndex + maxLineLength,
              )

              // Пропускаем разбивку, если в строке есть плейсхолдер URL
              if (substringToCheck.includes(urlPlaceholder)) {
                const placeholderPos = substringToCheck.indexOf(urlPlaceholder)

                if (placeholderPos === 0) {
                  // URL в начале строки
                  chunks.push(urlPlaceholder)
                  currentIndex += urlPlaceholder.length
                } else {
                  // URL в середине строки, разбиваем перед ним
                  chunks.push(
                    line.substring(currentIndex, currentIndex + placeholderPos),
                  )
                  currentIndex += placeholderPos
                }
                continue
              }

              // Сначала ищем знаки пунктуации, затем пробелы
              const punctuationMarks = [
                '.',
                ',',
                ';',
                ':',
                '!',
                '?',
                ')',
                ']',
                '}',
              ]
              let breakPoint = -1

              // Ищем знаки пунктуации с конца подстроки
              for (const mark of punctuationMarks) {
                const markIndex = substringToCheck.lastIndexOf(mark)
                if (markIndex !== -1 && markIndex < maxLineLength - 1) {
                  breakPoint = markIndex + 1 // +1 чтобы включить знак пунктуации
                  break
                }
              }

              // Если не нашли знаков пунктуации, ищем пробел
              if (breakPoint === -1) {
                const lastSpaceIndex = substringToCheck.lastIndexOf(' ')
                if (
                  lastSpaceIndex !== -1 &&
                  lastSpaceIndex < maxLineLength - 1
                ) {
                  breakPoint = lastSpaceIndex
                }
              }

              if (breakPoint !== -1) {
                // Если нашли место для разрыва
                chunks.push(
                  line.substring(currentIndex, currentIndex + breakPoint),
                )
                currentIndex += breakPoint + 1 // +1 чтобы пропустить разделитель
              } else {
                // Если подходящего места нет, принудительно разбиваем по длине
                // Для русского текста это важно при длинных словах

                // Проверяем, есть ли непрерывные длинные слова без пробелов и разбиваем их мягко
                const longWord = line.substring(
                  currentIndex,
                  Math.min(currentIndex + maxLineLength * 2, line.length),
                )

                if (
                  longWord.length > maxLineLength &&
                  !longWord.includes(' ')
                ) {
                  // Это очень длинное слово без пробелов - мягко разбиваем
                  chunks.push(
                    line.substring(currentIndex, currentIndex + maxLineLength) +
                      '-',
                  )
                } else {
                  // Обычный случай - разбиваем по длине
                  chunks.push(
                    line.substring(currentIndex, currentIndex + maxLineLength),
                  )
                }

                currentIndex += maxLineLength
              }
            }

            return chunks.join('\n')
          })
          .join('\n')

        // Восстанавливаем URL
        let urlIndex = 0
        const processedText = processedLines.replace(
          new RegExp(urlPlaceholder, 'g'),
          () => urls[urlIndex++] || '',
        )

        // Восстанавливаем эмодзи
        let emojiIndex = 0
        return processedText.replace(
          new RegExp(emojiPlaceholder, 'g'),
          () => emojis[emojiIndex++] || '',
        )
      }

      // Применяем автоматические переносы
      formattedText = autoLineBreak(formattedText)

      // Заменяем \n на <br /> для HTML-отображения
      // И также обрабатываем URL для визуального выделения
      const urlRegex = /(https?:\/\/[^\s]+)/g

      const formattedParts = formattedText
        .split('\n')
        .map((line, lineIndex) => {
          // Разбиваем строку на части - обычный текст и URL
          const parts = line.split(urlRegex)
          const matches = line.match(urlRegex) || []

          // Собираем фрагменты строки с обработанными URL
          const lineElements: React.ReactNode[] = []
          parts.forEach((part, partIndex) => {
            if (partIndex > 0 && matches[partIndex - 1]) {
              // Это URL
              lineElements.push(
                <span
                  key={`url-${lineIndex}-${partIndex}`}
                  className="text-primary hover:underline cursor-pointer"
                  onClick={() => {
                    // Можно добавить открытие URL в новой вкладке, если нужно
                    window.open(matches[partIndex - 1], '_blank')
                  }}
                >
                  {matches[partIndex - 1]}
                </span>,
              )
            }

            if (part) {
              lineElements.push(
                <React.Fragment key={`text-${lineIndex}-${partIndex}`}>
                  {part}
                </React.Fragment>,
              )
            }
          })

          return (
            <React.Fragment key={`line-${lineIndex}`}>
              {lineElements}
              {lineIndex < formattedText.split('\n').length - 1 && <br />}
            </React.Fragment>
          )
        })

      return <>{formattedParts}</>
    }

    return (
      <div className="space-y-4">
        {/* Chat description */}
        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="font-medium mb-2">О чате</h3>
          <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed text-sm max-w-full">
            {chatDescription
              ? formatDescription(chatDescription)
              : 'Описание отсутствует'}

            {isDescriptionLong && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-primary hover:text-primary/80 text-sm font-medium mt-3 block"
              >
                {isDescriptionExpanded ? 'Свернуть' : 'Показать полностью'}
              </button>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="font-medium mb-2">
            Участники ({selectedChat.participants?.length || 0})
          </h3>
          <div className="space-y-2">
            {selectedChat.participants &&
            selectedChat.participants.length > 0 ? (
              selectedChat.participants
                .slice(0, showAllMembers ? selectedChat.participants.length : 3)
                .map((participant_user_id: number) => {
                  // Extract userId and resolve username from contacts
                  const participant = contacts[participant_user_id]
                  const username =
                    getUsernameFromId(
                      participant_user_id,
                      contacts,
                      setContacts,
                    ) || participant_user_id.toString()
                  const isOnline = participant?.is_online || false

                  // Определяем роль пользователя
                  const isCreator =
                    selectedChat.owner_id &&
                    Number(selectedChat.owner_id) === participant_user_id
                  const isAdmin =
                    selectedChat.admins?.includes(participant_user_id)

                  return (
                    <div
                      key={participant_user_id}
                      className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      onContextMenu={(e) =>
                        handleUserContextMenu(e, participant_user_id, username)
                      }
                      onTouchStart={(e) =>
                        handleUserLongPress(e, participant_user_id, username)
                      }
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {participant?.avatar ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden">
                              <img
                                src={participant.avatar}
                                alt={`Аватар ${username}`}
                                className="w-full h-full object-cover"
                                onError={() => {
                                  // Создаем и добавляем букву имени
                                  const textNode =
                                    document.createElement('span')
                                  textNode.innerText = username
                                    .charAt(0)
                                    .toUpperCase()
                                  textNode.className =
                                    'text-lg font-medium text-slate-600 dark:text-slate-300'
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                              <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                                {username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          {isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            {username}
                            {isCreator && (
                              <span className="inline-flex items-center justify-center bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md ml-1">
                                Создатель
                              </span>
                            )}
                            {isAdmin && !isCreator && (
                              <span className="inline-flex items-center justify-center bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md ml-1">
                                Админ
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                            {isOnline ? 'В сети' : 'Не в сети'}
                            {(isCreator || isAdmin) && (
                              <div className="flex items-center ml-2">
                                <FiShield
                                  className={`h-3.5 w-3.5 mr-1 ${isCreator ? 'text-amber-500' : 'text-blue-500'}`}
                                />
                                {!isMobile && (
                                  <span className="text-xs">
                                    {isCreator
                                      ? 'Полные права'
                                      : 'Расширенные права'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                Список участников еще в реализации
              </p>
            )}
            {selectedChat.participants &&
              selectedChat.participants.length > 3 && (
                <button
                  className="text-[rgb(var(--primary-rgb))] hover:text-[rgb(var(--primary-rgb))]/80 text-sm font-medium mt-1"
                  onClick={() => setShowAllMembers(!showAllMembers)}
                >
                  {showAllMembers
                    ? 'Показать меньше'
                    : 'Показать всех участников'}
                </button>
              )}
          </div>
        </div>

        {/* Creation date */}
        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="font-medium mb-2">Создан</h3>
          <p className="text-slate-600 dark:text-slate-400">
            {selectedChat.date
              ? new Date(selectedChat.date * 1000).toLocaleString('ru-RU')
              : selectedChat.created_at
                ? new Date(selectedChat.created_at).toLocaleString('ru-RU')
                : 'Дата создания еще в реализации'}
          </p>
          {creatorId && (
            <div className="flex items-center mt-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm">
                Создатель:
              </span>
              <span className="ml-2 text-sm font-medium">
                {getUsernameFromId(creatorId, contacts, setContacts)}
              </span>
            </div>
          )}
        </div>

        {canManageMembers && (
          <Button
            color="primary"
            variant="flat"
            fullWidth
            className="mt-2"
            onClick={() => setIsInviteModalOpen(true)}
            startContent={<FiUserPlus />}
          >
            Добавить участника
          </Button>
        )}

        <InviteUserModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onInvite={(userId) => {
            inviteUserToGroup(selectedChat.name, userId, contacts, setContacts)
          }}
          chats={chats}
          groups={groups}
          setChats={setChats}
          setGroups={setGroups}
          messages={messages}
          setMessages={setMessages}
          contacts={contacts}
        />
      </div>
    )
  }, [
    selectedChat,
    showAllMembers,
    handleUserContextMenu,
    handleUserLongPress,
    getUsernameFromId,
    isInviteModalOpen,
    canManageMembers,
    isAdmin,
    isCreator,
    checkPermission,
    isDescriptionExpanded,
    isDescriptionLong,
    contacts,
    setContacts,
    getUsernameFromId,
  ])

  const renderUserInfo = useCallback(() => {
    if (!selectedChat || !isGroup(selectedChat)) return null

    // Get the participant details
    const participantId =
      selectedChat.participants[0] ||
      (typeof selectedChat.participants?.[0] === 'string'
        ? selectedChat.participants[0]
        : 0)

    const contact = contacts[participantId]
    const username = contact?.username || selectedChat.name
    // Define userStatus as a boolean rather than string to avoid type comparison issues
    const isOnline = false // Hardcoded since is_online is not available

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="font-medium mb-2 flex items-center">
            <FiInfo className="mr-2" /> О пользователе
          </h3>
          <div className="text-slate-600 dark:text-slate-400">
            <div className="flex items-center mt-2">
              {selectedChat.avatar ? (
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                  <Avatar
                    src={selectedChat.avatar}
                    alt={`Аватар ${username}`}
                    className="w-full h-full object-cover"
                    onError={() => {
                      // Создаем и добавляем букву имени
                      const textNode = document.createElement('span')
                      textNode.innerText = username.charAt(0).toUpperCase()
                      textNode.className =
                        'text-lg font-medium text-slate-600 dark:text-slate-300'
                    }}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mr-3">
                  <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {username}
                </div>
                <div
                  className={`flex items-center text-sm ${
                    isOnline
                      ? 'text-green-500'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full mr-1 ${
                      isOnline ? 'bg-green-500' : 'bg-slate-500'
                    }`}
                  ></span>
                  {isOnline ? 'В сети' : 'Не в сети'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="font-medium mb-2 flex items-center">
            <FiClock className="mr-2" /> Информация о чате
          </h3>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                ID пользователя:
              </span>
              <span className="ml-2">{participantId}</span>
            </div>
            {selectedChat.created_at && (
              <div className="text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Чат создан:
                </span>
                <span className="ml-2">
                  {new Date(
                    parseInt(selectedChat.created_at) * 1000,
                  ).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="font-medium mb-2">Действия</h3>
          <div className="flex flex-col gap-2">
            <button
              className="wave-button py-2 px-4 w-full"
              onClick={(e) => {
                e.preventDefault()
                handleUserContextMenu(
                  e as React.MouseEvent,
                  participantId || 0,
                  username,
                )
              }}
            >
              Действия с пользователем
            </button>
          </div>
        </div>
      </div>
    )
  }, [selectedChat, contacts, handleUserContextMenu])

  // Обновляем функцию загрузки медиафайлов
  const loadMediaItems = useCallback(async () => {
    if (!selectedChat) return

    setIsLoadingMedia(true)
    try {
      // Получаем сообщения для текущего чата
      const chatId = selectedChat.chat_id || selectedChat.name
      const chatMessages = messages[chatId] || []

      // Фильтруем сообщения с медиафайлами
      const mediaMessages = chatMessages.filter(
        (msg) => msg.media || msg.media_name,
      )

      // Преобразуем сообщения в MediaItem
      const items: MediaItem[] = mediaMessages.map((msg) => ({
        media_id: msg.message_id,
        filename: msg.media_name || 'Безымянный файл',
        timestamp: parseInt(msg.timestamp) || Date.now() / 1000,
        url: msg.media, // Сохраняем ссылку на файл из message.media
        // Пытаемся определить размер файла (может быть недоступно)
        size: undefined,
      }))

      setMediaItems(items)
    } catch (error) {
      console.error('Ошибка при загрузке медиафайлов:', error)
    } finally {
      setIsLoadingMedia(false)
    }
  }, [selectedChat, messages])

  // Add function to load chat details for 1-to-1 chats
  const loadChatDetails = useCallback(async () => {
    if (!selectedChat || isGroup(selectedChat)) return

    try {
      // Get the participant ID
      const participantId =
        selectedChat.participants[0] ||
        (typeof selectedChat.participants[0] === 'string'
          ? selectedChat.participants[0]
          : null)

      if (!participantId) return

      // Find the contact in contacts list
      const contact = contacts[participantId]

      if (contact) {
        // Create user details object with available information
        const userDetails: UserDetails = {
          name: contact.username || selectedChat.name,
          status: 'offline', // Hardcoded since is_online is not available
          title: `User ID: ${contact.user_id}`,
          email: 'Not available',
          phone: 'Not available',
          timezone: 'Not available',
          joined: selectedChat.created_at || 'Unknown',
          //avatar: contact.avatar || selectedChat.avatar,
          //description: contact.description || selectedChat.description || ''
        }

        setChatDetails(userDetails)
      } else {
        // If no contact found, use the chat object itself since we removed ChatDetails type
        setChatDetails(selectedChat)
      }
    } catch (error) {
      console.error('Failed to load chat details:', error)
    }
  }, [selectedChat, contacts])

  // Load media and chat details when selected chat changes
  useEffect(() => {
    loadMediaItems()
    loadChatDetails()
  }, [selectedChat, loadMediaItems, loadChatDetails])

  // Helper function to format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'

    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  // Add an effect to close the right panel on mobile when a chat is selected
  useEffect(() => {
    // If on mobile and chat selection changed, close the right panel
    if (window.innerWidth < 768 && selectedChat) {
      closeRightPanel()
    }
  }, [selectedChat, closeRightPanel])

  // Обновляем функцию отображения файлов для использования url
  const renderSharedFiles = useCallback(() => {
    // Считаем медиа по типам
    const fileCount = mediaItems.filter(
      (item) =>
        item.filename &&
        !item.filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
    ).length

    const imageCount = mediaItems.filter((item) =>
      item.filename?.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
    ).length

    const linkCount = 0 // Пока не реализовано

    // Получаем файлы (не-изображения)
    const files = mediaItems
      .filter(
        (item) =>
          item.filename &&
          !item.filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
      )
      .slice(0, 5)

    // Получаем изображения
    const images = mediaItems
      .filter((item) => item.filename?.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i))
      .slice(0, 6)

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Файлы ({fileCount})</h3>
            {fileCount > 0 && (
              <button className="text-primary text-sm">Все файлы</button>
            )}
          </div>
          <div className="space-y-2">
            {files.length > 0 ? (
              files.map((file) => (
                <div
                  key={file.media_id}
                  className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <div className="h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mr-3">
                    <FiFile className="text-primary" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="font-medium truncate">{file.filename}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {file.size
                        ? formatFileSize(file.size)
                        : 'Неизвестный размер'}{' '}
                      • {formatTimestamp(file.timestamp)}
                    </div>
                  </div>
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.filename}
                      className="ml-2 p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                      <FiDownload size={18} />
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                {isLoadingMedia ? 'Загрузка файлов...' : 'Нет доступных файлов'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Изображения ({imageCount})</h3>
            {imageCount > 0 && (
              <button className="text-primary text-sm">Все изображения</button>
            )}
          </div>
          {isLoadingMedia ? (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">
              Загрузка изображений...
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.length > 0 ? (
                images.map((image) => (
                  <div
                    key={image.media_id}
                    className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative"
                  >
                    {image.url ? (
                      <>
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // В случае ошибки загрузки показываем иконку изображения
                            ;(e.target as HTMLImageElement).style.display =
                              'none'
                            const parent = (e.target as HTMLImageElement)
                              .parentNode
                            if (parent) {
                              const icon = document.createElement('div')
                              icon.className =
                                'h-full w-full flex items-center justify-center'
                              icon.innerHTML =
                                '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'
                              parent.appendChild(icon)
                            }
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={image.filename}
                            className="text-white h-6 w-6"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FiDownload className="h-6 w-6" />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <FiImage className="text-primary h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                      {image.size ? formatFileSize(image.size) : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-4 text-slate-500 dark:text-slate-400">
                  Нет доступных изображений
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Ссылки ({linkCount})</h3>
            {linkCount > 0 && (
              <button className="text-primary text-sm">Все ссылки</button>
            )}
          </div>
          <div className="text-center py-4 text-slate-500 dark:text-slate-400">
            Функция в разработке
          </div>
        </div>
      </div>
    )
  }, [mediaItems, isLoadingMedia, formatFileSize, formatTimestamp])

  // Добавляем эффект для загрузки display key при выборе вкладки безопасности
  useEffect(() => {
    const loadGroupDisplayKey = async () => {
      if (activeTab === 'security' && isGroup(selectedChat)) {
        setIsLoadingDisplayKey(true)
        try {
          const key_bytes = await getGroupDisplayKey(selectedChat.chat_id)
          const key = bytesToDisplayKey(key_bytes)
          setGroupDisplayKey(key)
        } catch (error) {
          console.error('Ошибка при загрузке ключа группы:', error)
          setGroupDisplayKey('Ошибка загрузки ключа')
        } finally {
          setIsLoadingDisplayKey(false)
        }
      }
    }

    loadGroupDisplayKey()
  }, [activeTab, selectedChat])

  // 5. Early return after all hooks
  if (!chatInfo) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm"></div>
    )
  }

  // 6. Main render
  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-800 relative overflow-hidden max-w-full z-40">
      {/* Фоновая перекрывающая панель для полного устранения эффекта "пленки" на мобильных устройствах */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-slate-800 z-0 md:hidden"></div>

      {/* Header with close and search buttons */}
      <div className="sticky top-0 z-10 px-4 pt-4 bg-slate-50 dark:bg-slate-800 md:bg-slate-50/95 md:dark:bg-slate-800/95 md:backdrop-blur-sm">
        {renderHeader()}

        {/* Заголовок чата или пользователя */}
        <div className="flex flex-col items-center p-6 border-b border-slate-200 dark:border-slate-700">
          {isGroupChatSelected && chatInfo ? (
            renderChatHeader()
          ) : isUserChatSelected && !isGroup(chatInfo) ? (
            renderUserHeader()
          ) : (
            <p className="text-slate-600 dark:text-slate-400">
              Информация о чате не найдена
            </p>
          )}
        </div>

        {/* Вкладки - адаптивные для мобильных устройств */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            className={`flex-1 py-3 font-medium relative text-sm md:text-base ${
              activeTab === 'info'
                ? 'text-primary'
                : 'text-slate-600 dark:text-slate-400'
            }`}
            onClick={() => setActiveTab('info')}
          >
            Информация
            {activeTab === 'info' && (
              <motion.div
                layoutId="rightPanelTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
              />
            )}
          </button>
          <button
            className={`flex-1 py-3 font-medium relative text-sm md:text-base ${
              activeTab === 'shared'
                ? 'text-primary'
                : 'text-slate-600 dark:text-slate-400'
            }`}
            onClick={() => setActiveTab('shared')}
          >
            Файлы
            {activeTab === 'shared' && (
              <motion.div
                layoutId="rightPanelTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
              />
            )}
          </button>
          <button
            className={`flex-1 py-3 font-medium relative text-sm md:text-base ${
              activeTab === 'security'
                ? 'text-primary'
                : 'text-slate-600 dark:text-slate-400'
            }`}
            onClick={() => setActiveTab('security')}
          >
            Безопасность
            {activeTab === 'security' && (
              <motion.div
                layoutId="rightPanelTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
              />
            )}
          </button>
        </div>
      </div>

      {/* Содержимое вкладки - с классом scrollable для скролла внутри контейнера */}
      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent relative z-10">
        {activeTab === 'info' &&
          (isGroupChatSelected
            ? renderChatInfo()
            : isUserChatSelected
              ? renderUserInfo()
              : null)}
        {activeTab === 'shared' && renderSharedFiles()}
        {activeTab === 'security' && (
          <div className="bg-white dark:bg-slate-800 md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="font-medium mb-4">Безопасность</h3>
            <div className="space-y-4">
              <div className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                <div className="flex items-center flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium mb-3">Ключ безопасности</div>
                    {isLoadingDisplayKey ? (
                      <div className="text-slate-400 mt-1">
                        Загрузка ключа...
                      </div>
                    ) : groupDisplayKey ? (
                      <div
                        className="mt-2 p-3 
                        bg-slate-100 dark:bg-slate-700/30 
                        rounded-lg font-mono 
                        text-slate-700 dark:text-slate-300 
                        text-sm border border-slate-200 dark:border-transparent"
                      >
                        {groupDisplayKey
                          .match(/\d{1,5}/g)
                          ?.reduce((rows: string[][], chunk, i) => {
                            const rowIndex = Math.floor(i / 3)
                            if (!rows[rowIndex]) rows[rowIndex] = []
                            rows[rowIndex].push(chunk.padStart(5, '0'))
                            return rows
                          }, [])
                          .map((row, rowIndex, arr) => (
                            <div key={rowIndex}>
                              <div className="grid grid-cols-3 gap-x-6 text-center">
                                {row.map((chunk, i) => (
                                  <div key={i}>{chunk}</div>
                                ))}
                              </div>
                              {rowIndex < arr.length - 1 && (
                                <Divider className="my-2 bg-slate-300 dark:bg-slate-600/50" />
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 mt-1">Ключ не найден</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center mr-3 flex-shrink-0">
                    <FiBell className="text-amber-500" />
                  </div>
                  <div>
                    <div className="font-medium text-lg">Уведомления</div>
                    <div className="text-slate-400 text-sm">
                      Показывать содержание сообщений
                    </div>
                  </div>
                </div>
                <div className="h-6 w-12 bg-slate-700 rounded-full relative flex-shrink-0 ml-2">
                  <div className="h-5 w-5 bg-white rounded-full absolute top-0.5 right-0.5 transition-all shadow-md"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно управления разрешениями */}
      {selectedUser && selectedChat && (
        <PermissionsModal
          isOpen={isPermissionsModalOpen}
          onClose={() => {
            setIsPermissionsModalOpen(false)
            setSelectedUser(null)
          }}
          userId={selectedUser.id}
          userName={selectedUser.name}
          groupId={selectedChat.chat_id}
          currentPermissions={selectedUser.permissions}
        />
      )}

      {/* Mobile-optimized invite modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={(userId) =>
          inviteUserToGroup(
            selectedChat?.chat_id || '',
            userId,
            contacts,
            setContacts,
          )
        }
        chats={chats}
        groups={groups}
        setChats={setChats}
        setGroups={setGroups}
        messages={messages}
        setMessages={setMessages}
        contacts={contacts}
      />

      {/* User context menu */}
      <UserContextMenu
        position={userContextMenu}
        onAction={handleUserAction}
        isGroupChat={isGroup(selectedChat)}
        permissions={{
          canManageMembers,
          canManagePermissions:
            isCreator ||
            isAdmin ||
            (isGroup(selectedChat) &&
              checkPermission(selectedChat, 'manage_permissions')),
        }}
        isCreator={isCreator}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </div>
  )
}

export default RightPanel
