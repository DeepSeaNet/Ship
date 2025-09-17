'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  FiX,
  FiUsers,
  FiMessageSquare,
  FiSettings,
  FiPlus,
  FiAnchor,
  FiBox,
  FiCompass,
  FiMic,
} from 'react-icons/fi'
import { motion } from 'framer-motion'
import { useSettingsStore } from '../stores/settingsStore'
import { GroupDialog } from './dialog/GroupDialog'
import { CreateChatDialog } from './dialog/CreateChatDialog'
import { formatLastActive } from '../utils/dateUtils'
import AccountDropdown from './drop_down/AccountDropdown'
import GroupContextMenu, { GroupAction } from './context_menu/GroupContextMenu'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Input,
  Avatar,
  Card,
  CardHeader,
  Button,
} from '@heroui/react'
import { Chat } from '@/hooks/Chat'
import { Message } from '@/hooks/Message'
import { Group, isGroup } from '@/hooks/Group'
import { BasicWindow } from '@/hooks/Window'
import { Permissions } from '@/hooks/Group'
import { User } from '@/hooks/Contacts'

interface TypingStatus {
  userId: number
  chatId: string
  isTyping: boolean
  timestamp: number
  username?: string // Добавляем опциональное поле для никнейма
}

const TypingDots = () => {
  return (
    <span className="inline-flex items-center">
      <motion.span
        initial={{ opacity: 0.3 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.3 }}
        transition={{
          repeat: Infinity,
          repeatType: 'reverse',
          duration: 0.5,
          delay: 0,
        }}
        className="mx-0.5"
      >
        .
      </motion.span>
      <motion.span
        initial={{ opacity: 0.3 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.3 }}
        transition={{
          repeat: Infinity,
          repeatType: 'reverse',
          duration: 0.5,
          delay: 0.2,
        }}
        className="mx-0.5"
      >
        .
      </motion.span>
      <motion.span
        initial={{ opacity: 0.3 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.3 }}
        transition={{
          repeat: Infinity,
          repeatType: 'reverse',
          duration: 0.5,
          delay: 0.4,
        }}
        className="mx-0.5"
      >
        .
      </motion.span>
    </span>
  )
}

// Цвета контейнеров для чатов - используем тему Tailwind
const CONTAINER_COLORS = [
  'container-blue', // Синий
  'container-orange', // Оранжевый
  'container-green', // Зеленый
  'container-red', // Красный
  'container-purple', // Фиолетовый
  'container-yellow', // Желтый
  'container-teal', // Бирюзовый
  'container-pink', // Розовый
]

// Получение цвета контейнера на основе имени
const getContainerColor = (name: string) => {
  const charSum = name
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const colorIndex = charSum % CONTAINER_COLORS.length
  return `from-${CONTAINER_COLORS[colorIndex].replace('container-', '')}-500 to-${CONTAINER_COLORS[colorIndex].replace('container-', '')}-600`
}

// Функция для ограничения длины описания
const truncateDescription = (
  description: string | undefined,
  maxLength = 25,
) => {
  if (!description) return ''
  return description.length > maxLength
    ? `${description.substring(0, maxLength)}...`
    : description
}

// Функция для сокращения никнейма
const truncateUsername = (username: string, maxLength = 15) => {
  if (!username) return ''
  return username.length > maxLength
    ? `${username.substring(0, maxLength)}...`
    : username
}

interface LeftSidebarProps {
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | null>>
  selectedChat: Chat | Group | null
  closeMobileMenu: () => void
  openSettings: () => void
  isMobile?: boolean
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
  isListening: boolean
  setIsListening: React.Dispatch<React.SetStateAction<boolean>>
  typingStatuses?: TypingStatus[]
  currentUser?: { user_id: string; username: string } | null
  chats: Chat[]
  groups: Group[]
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  setGroups: React.Dispatch<React.SetStateAction<Chat[]>>
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  onOpenVoiceChannel?: (groupId?: string, groupName?: string) => void
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  setIsAuthenticated: (status: boolean) => void
  contacts: Record<number, User>
  setContacts: React.Dispatch<React.SetStateAction<Record<number, User>>>
}

export default function LeftSidebar({
  setSelectedChat,
  selectedChat,
  closeMobileMenu,
  openSettings,
  isMobile = false,
  currentChatMessages,
  setCurrentChatMessages,
  chats,
  groups,
  setChats,
  setGroups,
  messages,
  setMessages,
  onOpenVoiceChannel,
  isLoading,
  setIsLoading,
  setIsAuthenticated,
  contacts,
  setContacts,
  typingStatuses = [],
  currentUser,
}: LeftSidebarProps) {
  const { appearanceSettings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats')
  const [searchTerm, setSearchTerm] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false)
  const [contextMenuGroup, setContextMenuGroup] = useState<Chat | null>(null)
  const isInitializedRef = useRef(false)

  const { checkPermission } = Group({
    groups: groups,
    setGroups: setGroups,
    isLoading: isLoading,
    setIsLoading: setIsLoading,
    messages: messages,
    setMessages: setMessages,
    selectedChat: selectedChat,
    setSelectedChat: setSelectedChat,
    currentChatMessages: currentChatMessages,
    setCurrentChatMessages: setCurrentChatMessages,
  })

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

  // Функция для получения статуса печати для конкретного чата
  const getTypingStatusForChat = useCallback(
    (chatId: string) => {
      if (!typingStatuses || !currentUser) return []

      // Фильтруем активные статусы печати для данного чата (исключая текущего пользователя)
      const activeTypingUsers = typingStatuses.filter(
        (status) =>
          status.chatId === chatId &&
          status.isTyping &&
          status.userId !== Number(currentUser.user_id) &&
          // Проверяем, что статус не устарел (например, за последние 5 секунд)
          Date.now() - status.timestamp < 5000,
      )

      return activeTypingUsers.length > 0 ? activeTypingUsers : []
    },
    [typingStatuses, currentUser],
  )

  // Функция для получения никнейма пользователя
  const getUsernameById = useCallback(
    (userId: number) => {
      const contact = contacts[userId]
      return contact?.username || `Пользователь ${userId}`
    },
    [contacts],
  )

  // Функция для получения текста статуса печати
  const getTypingText = useCallback(
    (typingUsers: TypingStatus[]) => {
      if (!typingUsers || typingUsers.length === 0) return null

      if (typingUsers.length === 1) {
        const username =
          typingUsers[0].username || getUsernameById(typingUsers[0].userId)
        return `${truncateUsername(username)} печатает`
      } else if (typingUsers.length === 2) {
        const user1 =
          typingUsers[0].username || getUsernameById(typingUsers[0].userId)
        const user2 =
          typingUsers[1].username || getUsernameById(typingUsers[1].userId)
        return `${truncateUsername(user1)} и ${truncateUsername(user2)} печатают`
      } else {
        return `${typingUsers.length} пользователей печатают`
      }
    },
    [getUsernameById],
  )

  const handleSelectChat = (chat: Chat | Group) => {
    setSelectedChat(chat)
    setActiveChat(chat)
    closeMobileMenu()
  }

  const handleContextMenu = (
    e: React.MouseEvent<HTMLDivElement>,
    id: string,
  ) => {
    e.preventDefault()
    setContextMenu({ id, x: e.clientX, y: e.clientY })

    // Находим группу для контекстного меню
    const group = groups.find((g) => g.chat_id === id)
    setContextMenuGroup(group || null)
  }

  // Закрыть контекстное меню при клике вне его
  const handleClickOutside = () => setContextMenu(null)

  // Эффект для обработки клика вне контекстного меню
  useEffect(() => {
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Optimize the filtering of chats and groups with useMemo
  const filteredChats = useMemo(
    () =>
      chats.filter(
        (chat) =>
          chat.name &&
          chat.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [chats, searchTerm],
  )

  const filteredGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.name &&
          group.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [groups, searchTerm],
  )

  // Функция для проверки разрешений
  const canPerformAction = useCallback(
    (actionType: keyof Permissions) => {
      if (!selectedChat || !isGroup(selectedChat)) return false
      return checkPermission(selectedChat, actionType)
    },
    [selectedChat, checkPermission],
  )

  // Модифицируем обработчик действий с группами
  const handleGroupAction = (action: GroupAction) => {
    setContextMenu(null)

    switch (action.type) {
      case 'create_group':
        setIsGroupDialogOpen(true)
        break
      case 'create_chat':
        setIsChatDialogOpen(true)
        break
      case 'info':
        console.log('Group info', action.groupId)
        break
      case 'add_user':
        if (canPerformAction('manage_members')) {
          console.log('Add user to group', action.groupId)
        } else {
          alert('У вас нет разрешения на добавление пользователей в группу')
        }
        break
      case 'delete':
        if (canPerformAction('manage_permissions')) {
          console.log('Delete group', action.groupId)
        } else {
          alert('У вас нет разрешения на удаление группы')
        }
        break
      case 'create_voice':
        const group = groups.find((g) => g.chat_id === action.groupId)
        if (group && onOpenVoiceChannel) {
          onOpenVoiceChannel(group.chat_id, group.name)
        }
        break
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    setIsAuthenticated(false)
  }

  // Получить разрешения для контекстного меню
  const getMenuPermissions = useCallback(() => {
    if (!contextMenuGroup) {
      return {
        canManageMembers: false,
        canManage: false,
      }
    }

    return {
      canManageMembers: checkPermission(contextMenuGroup, 'manage_members'),
      canManage: checkPermission(contextMenuGroup, 'manage_permissions'),
    }
  }, [contextMenuGroup, checkPermission])

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-slate-800 md:bg-white/80 md:dark:bg-slate-800/80 md:backdrop-blur-sm border-r border-slate-200 dark:border-slate-700 transition-colors ${isMobile ? 'w-full' : 'w-80'}`}
      style={{ fontSize: `${appearanceSettings.interfaceFontSize}px` }}
    >
      {/* Mobile close button - только для десктопа в мобильном виде */}
      {!isMobile && (
        <div className="md:hidden flex justify-end p-2">
          <button
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={closeMobileMenu}
            aria-label="Закрыть меню"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Search and Actions */}
      <div className="px-4 py-3">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Input
              variant="flat"
              color="primary"
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <AccountDropdown onLogout={handleLogout} />

          <Button
            variant="flat"
            color="primary"
            onPress={openSettings}
            isIconOnly
          >
            <FiSettings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          className={`flex-1 py-3 font-medium relative ${activeTab === 'chats' ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}
          onClick={() => setActiveTab('chats')}
        >
          <span className="flex justify-center items-center">
            <FiBox className="mr-2" />
            Чаты
          </span>
          {activeTab === 'chats' && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              initial={false}
            />
          )}
        </button>

        <div className="flex-1 relative">
          <button
            className={`flex-1 w-full py-3 font-medium relative ${activeTab === 'contacts' ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}
            onClick={() => setActiveTab('contacts')}
          >
            <span className="flex justify-center items-center">
              <FiCompass className="mr-2" />
              Группы
            </span>
            {activeTab === 'contacts' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
              />
            )}
          </button>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <FiPlus className="h-4 w-4" />
              </button>
            </DropdownTrigger>

            <DropdownMenu
              aria-label="Управление группами и чатами"
              itemClasses={{
                base: 'data-[hover=true]:bg-slate-100 dark:data-[hover=true]:bg-slate-700 transition-colors duration-150',
              }}
            >
              <DropdownItem
                key="create-group"
                variant="flat"
                color="primary"
                startContent={<FiUsers className="h-4 w-4 text-green-500" />}
                onPress={() => handleGroupAction({ type: 'create_group' })}
              >
                Создать группу
              </DropdownItem>
              <DropdownItem
                key="create-chat"
                variant="flat"
                color="primary"
                startContent={
                  <FiMessageSquare className="h-4 w-4 text-blue-500" />
                }
                onPress={() => handleGroupAction({ type: 'create_chat' })}
              >
                Создать чат
              </DropdownItem>
              <DropdownItem
                key="create-voice"
                variant="flat"
                color="primary"
                startContent={<FiMic className="h-4 w-4 text-blue-500" />}
                onPress={() => onOpenVoiceChannel && onOpenVoiceChannel()}
              >
                Создать голосовой чат
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* Chat/Groups List */}
      <div className="flex-1 overflow-y-auto scrollable pb-20 md:pb-6">
        {isLoading ? (
          <div className="flex justify-center items-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : activeTab === 'chats' ? (
          <div className="py-2">
            {filteredChats.length === 0 ? (
              <div className="text-center p-4 text-slate-500 dark:text-slate-400">
                {searchTerm ? 'Чаты не найдены' : 'У вас пока нет чатов'}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const typingUsers = getTypingStatusForChat(chat.chat_id)
                const typingText = getTypingText(typingUsers)

                return (
                  <Card
                    key={chat.chat_id}
                    isPressable
                    isHoverable
                    radius="none"
                    className={`w-full my-1 transition-colors ${
                      selectedChat?.chat_id === chat.chat_id
                        ? 'bg-slate-100 dark:bg-slate-700/70'
                        : 'bg-[var(--heroui-background)]'
                    }`}
                    onClick={() => handleSelectChat(chat)}
                    onContextMenu={(e) => handleContextMenu(e, chat.chat_id)}
                  >
                    <div className="flex items-center p-3">
                      <div
                        className="container-gradient h-10 w-10 rounded-full flex items-center justify-center text-white font-bold relative"
                        style={{ background: getContainerColor(chat.name) }}
                      >
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3 flex-grow min-w-0">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium truncate dark:text-white">
                            {chat.name}
                          </h3>
                          {chat.last_message && !typingUsers && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap ml-1">
                              {formatLastActive(chat.last_message.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          {typingUsers && typingText ? (
                            <p className="text-sm text-blue-500 dark:text-blue-400 truncate italic">
                              {typingText}
                              <TypingDots />
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                              {chat.last_message?.text || 'Нет сообщений'}
                            </p>
                          )}
                          {chat.unread_count > 0 && (
                            <span className="ml-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        ) : (
          <div className="py-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center p-4 text-slate-500 dark:text-slate-400">
                {searchTerm ? 'Группы не найдены' : 'У вас пока нет групп'}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isAdmin = group.group_config?.admins?.includes(
                  Number(group.owner_id),
                )
                const typingUsers = getTypingStatusForChat(group.chat_id)
                const typingText = getTypingText(typingUsers)

                return (
                  <Card
                    key={group.chat_id}
                    radius="none"
                    isPressable
                    isHoverable
                    className={`w-full my-1 transition-all  ${
                      selectedChat === group
                        ? 'bg-slate-100 dark:bg-slate-700/70'
                        : 'bg-[var(--heroui-background)]'
                    }`}
                    onClick={() => handleSelectChat(group)}
                    onContextMenu={(e) => handleContextMenu(e, group.chat_id)}
                  >
                    <div className="flex items-center max-h-16">
                      <CardHeader>
                        {group.avatar ? (
                          <div className="h-10 w-10 shadow-md relative overflow-hidden">
                            <Avatar
                              src={group.avatar}
                              alt={`Аватар группы ${group.name}`}
                              className="w-full h-full object-cover"
                              radius="lg"
                            />
                          </div>
                        ) : (
                          <div
                            className={`h-10 w-10 rounded-lg bg-gradient-to-br ${getContainerColor(group.name)} flex items-center justify-center text-white shadow-md relative`}
                          >
                            <FiUsers className="h-5 w-5" />
                            {isAdmin && (
                              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full h-4 w-4 flex items-center justify-center">
                                <span className="text-xs text-white font-bold">
                                  A
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-col gap-1 items-start justify-center ml-3">
                          <h4 className="text-sm font-semibold leading-none ">
                            {group.name}
                          </h4>
                          {typingUsers && typingText ? (
                            <h5 className="text-xs tracking-tight text-blue-500 dark:text-blue-400 italic">
                              {typingText}
                              <TypingDots />
                            </h5>
                          ) : (
                            <h5 className="text-xs tracking-tight text-slate-400 dark:text-slate-500">
                              {truncateDescription(
                                group.last_message?.text,
                              ) || <>&nbsp;</>}
                            </h5>
                          )}
                        </div>
                      </CardHeader>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Диалог создания группы */}
      <GroupDialog
        isOpen={isGroupDialogOpen}
        onClose={() => setIsGroupDialogOpen(false)}
        onGroupCreated={() => {}}
      />

      {/* Диалог создания чата */}
      <CreateChatDialog
        isOpen={isChatDialogOpen}
        onClose={() => setIsChatDialogOpen(false)}
        onChatCreated={() => {}}
        chats={chats}
        setChats={setChats}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        messages={messages}
        setMessages={setMessages}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        currentChatMessages={currentChatMessages}
        setCurrentChatMessages={setCurrentChatMessages}
        contacts={contacts}
      />

      {/* Контекстное меню групп */}
      <GroupContextMenu
        position={contextMenu}
        onAction={handleGroupAction}
        permissions={getMenuPermissions()}
      />
    </div>
  )
}
