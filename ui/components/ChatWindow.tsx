'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettingsStore } from '../stores/settingsStore'
import InputBar from './InputBar'
import ContextMenu from './context_menu/ContextMenu'
import ImageViewer from './ImageViewer'
import SearchBar from './chat_window/SearchBar'
import React from 'react'
import { Group, isGroup } from '@/hooks/Group'
import { Chat } from '@/hooks/Chat'
import { Message } from '@/hooks/Message'
import { AttachmentFile, MessageAction } from '../types/chat'
import { User } from '@/hooks/Contacts'
// Импортируем компоненты и функции из нового файла MessageRender
import {
  ChatMessage,
  DateSeparator,
  isSameDay,
} from './chat_window/MessageRender'
import { getUserColor, getUserTextColor } from './chat_window/Color'
interface ChatWindowProps {
  selectedChat: Chat | Group | null
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
  isListening: boolean
  setIsListening: React.Dispatch<React.SetStateAction<boolean>>
  onSearchToggle?: (toggleFn: () => void) => void
  currentUser?: { user_id: string; username: string } | null
  chats: Chat[]
  groups: Group[]
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  pendingIndex: Map<string, { chatId: string; message: Message }>
  setPendingIndex: React.Dispatch<
    React.SetStateAction<Map<string, { chatId: string; message: Message }>>
  >
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | Group | null>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  isMobile?: boolean
  contacts: Record<number, User>
}

export default function ChatWindow({
  selectedChat,
  currentChatMessages,
  setCurrentChatMessages,
  onSearchToggle,
  chats,
  groups,
  setChats,
  pendingIndex,
  setPendingIndex,
  messages,
  setMessages,
  setSelectedChat,
  isLoading,
  setIsLoading,
  isMobile = false,
  contacts,
}: ChatWindowProps) {
  const { appearanceSettings } = useSettingsStore()
  const { sendGroupMessage, checkPermission } = Group({
    messages,
    setMessages,
    setPendingIndex,
    selectedChat,
    currentChatMessages,
    setCurrentChatMessages,
  })

  const { sendMessage } = Chat({
    chats,
    setChats,
    isLoading,
    setIsLoading,
    messages,
    setMessages,
    selectedChat,
    setSelectedChat,
    currentChatMessages,
    setCurrentChatMessages,
  })
  const [inputValue, setInputValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')

  // Состояние поиска
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Состояние для отслеживания количества отображаемых сообщений
  const [visibleMessageCount, setVisibleMessageCount] = useState(100)
  // Флаг для отслеживания процесса загрузки дополнительных сообщений
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)
  // Сохраняем предыдущую высоту скролла для восстановления позиции
  const prevScrollHeightRef = useRef<number>(0)
  // Сохраняем предыдущий scrollTop для корректного восстановления позиции
  const prevScrollTopRef = useRef<number>(0)
  // rAF-троттлинг
  const isScrollTickingRef = useRef<boolean>(false)

  // Optimize scrollToBottom function: управляем напрямую scrollTop, без scrollIntoView
  const scrollToBottomNow = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [])

  const scheduleScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    requestAnimationFrame(() => {
      // Повторяем в rAF для стабильности после layout
      container.scrollTop = container.scrollHeight
    })
  }, [])

  // Обработчик прокрутки с rAF-троттлингом
  const handleScrollThrottled = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const read = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const scrolledToBottom =
        Math.abs(scrollHeight - clientHeight - scrollTop) < 50

      if (scrolledToBottom !== autoScroll) {
        setAutoScroll(scrolledToBottom)
      }

      // Проверяем верх для подгрузки
      if (
        scrollTop < 50 &&
        !isLoadingMoreMessages &&
        currentChatMessages.length > visibleMessageCount
      ) {
        // Сохраняем текущие значения перед увеличением видимых сообщений
        prevScrollHeightRef.current = scrollHeight
        prevScrollTopRef.current = scrollTop

        setIsLoadingMoreMessages(true)
        setVisibleMessageCount((prev) =>
          Math.min(prev + 100, currentChatMessages.length),
        )
      }

      isScrollTickingRef.current = false
    }

    if (!isScrollTickingRef.current) {
      isScrollTickingRef.current = true
      requestAnimationFrame(read)
    }
  }, [
    autoScroll,
    currentChatMessages.length,
    visibleMessageCount,
    isLoadingMoreMessages,
  ])

  // Подписываемся на нативный scroll с passive: true (для плавности)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const onScroll = () => handleScrollThrottled()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () =>
      container.removeEventListener('scroll', onScroll as EventListener)
  }, [handleScrollThrottled])

  // Восстанавливаем позицию скролла после загрузки дополнительных сообщений
  useEffect(() => {
    if (isLoadingMoreMessages && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      // Выполняем после того, как DOM обновился
      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight
        const heightDelta = newScrollHeight - prevScrollHeightRef.current
        const prevTop = prevScrollTopRef.current || 0
        container.scrollTop = prevTop + heightDelta
        setIsLoadingMoreMessages(false)
      })
    }
  }, [visibleMessageCount, isLoadingMoreMessages])

  // Сбрасываем счетчик видимых сообщений при смене чата
  useEffect(() => {
    setVisibleMessageCount(100)
  }, [selectedChat])

  // Memoize finding message by ID to prevent recalculation on every render
  const findMessageByIdMemo = useCallback(
    (messageId: string) => {
      return currentChatMessages.find((msg) => msg.message_id === messageId)
    },
    [currentChatMessages],
  )

  useEffect(() => {
    // Reset states, search and scroll when changing chats
    setEditingMessage(null)
    setReplyingTo(null)
    setContextMenu(null)
    setAutoScroll(true)
    // Мгновенно в самый низ нового чата
    scrollToBottomNow()

    // Close search panel
    setIsSearchOpen(false)
  }, [selectedChat, scrollToBottomNow])

  // Прокрутка вниз при добавлении новых сообщений, только если мы у низа
  // Используем useLayoutEffect, чтобы избежать артефактов после покраски
  useLayoutEffect(() => {
    if (autoScroll) {
      scheduleScrollToBottom()
    }
  }, [currentChatMessages.length, autoScroll, scheduleScrollToBottom])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu && !(event.target as Element).closest('.context-menu')) {
        setContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  // Expose the search toggle function through the prop
  useEffect(() => {
    if (onSearchToggle) {
      // Передаем стабильную функцию, которая управляет состоянием поиска напрямую
      onSearchToggle(() => {
        setIsSearchOpen((prev) => !prev)
      })
    }
  }, [onSearchToggle]) // Держим только onSearchToggle в зависимостях

  const handleMessageAction = async (action: MessageAction) => {
    setContextMenu(null)

    switch (action.type) {
      case 'edit':
        const messageToEdit = currentChatMessages.find(
          (m) => m.message_id === action.messageId,
        )
        if (messageToEdit) {
          setInputValue(messageToEdit.text)
          setEditingMessage(action.messageId)
        }
        break

      case 'reply':
        setReplyingTo(action.messageId)
        break

      case 'delete':
        console.log('delete')
        break
    }
  }

  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Handle send message with input bar height reset
  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !attachment) || !selectedChat) return

    try {
      const messageText = inputValue.trim()
      const filePath = attachment?.path || null

      // If editing message
      if (editingMessage) {
        if (isGroup(selectedChat)) {
          await sendGroupMessage(
            selectedChat.chat_id,
            selectedChat.name,
            messageText,
            filePath,
            null, // No reply when editing
            editingMessage,
          )
        } else {
          await sendMessage(
            selectedChat.chat_id,
            messageText,
            filePath,
            null, // No reply when editing
            editingMessage,
          )
        }
      }
      // Else sending a new message
      else {
        if (isGroup(selectedChat)) {
          await sendGroupMessage(
            selectedChat.chat_id,
            selectedChat.name,
            messageText,
            filePath,
            replyingTo,
          )
        } else {
          await sendMessage(
            selectedChat.chat_id,
            messageText,
            filePath,
            replyingTo,
          )
        }
      }

      // After message is sent, clear input and reset height
      setInputValue('')
      setAttachment(null)
      setReplyingTo(null) // Make sure to reset reply state
      setEditingMessage(null)

      // Reset input height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
      }

      // Scroll to bottom после отправки без плавности
      scheduleScrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  // Handle context menu with useCallback
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    setContextMenu({ id, x: e.clientX, y: e.clientY })
  }, [])

  // Handle image click with useCallback
  const handleImageClick = useCallback((mediaUrl: string) => {
    setSelectedImageUrl(mediaUrl)
    setImageViewerOpen(true)
  }, [])

  // Virtual list optimization with date separators
  const renderMessages = useMemo(() => {
    if (!currentChatMessages.length) return null

    let lastMessageDate: Date | null = null
    const messagesWithSeparators: React.ReactNode[] = []

    // Используем динамическое количество сообщений вместо фиксированного лимита
    const messagesToShow =
      currentChatMessages.length > visibleMessageCount
        ? currentChatMessages.slice(-visibleMessageCount)
        : currentChatMessages

    // Добавляем индикатор загрузки, если есть еще сообщения для загрузки
    if (currentChatMessages.length > visibleMessageCount) {
      messagesWithSeparators.push(
        <div
          key="load-more"
          className="text-center py-2 text-sm text-slate-500 dark:text-slate-400"
        >
          Прокрутите вверх для загрузки предыдущих сообщений
        </div>,
      )
    }

    messagesToShow.forEach((message, index) => {
      const messageDate = new Date(message.timestamp)

      // Add date separator if needed
      if (!lastMessageDate || !isSameDay(messageDate, lastMessageDate)) {
        messagesWithSeparators.push(
          <DateSeparator
            key={`date-${message.timestamp}`}
            date={message.timestamp}
          />,
        )
      }

      // Check if we should show sender name (hide if same sender in a sequence)
      const showSenderName =
        index === 0 ||
        messagesToShow[index - 1].sender_id !== message.sender_id ||
        !isSameDay(new Date(messagesToShow[index - 1].timestamp), messageDate)

      // Add the message
      messagesWithSeparators.push(
        <ChatMessage
          key={
            message.message_id ||
            `${message.sender_id}-${message.timestamp}-${index}`
          }
          message={message}
          getUserColor={getUserColor}
          getUserTextColor={getUserTextColor}
          handleContextMenu={handleContextMenu}
          handleImageClick={handleImageClick}
          findMessageById={findMessageByIdMemo}
          isPending={pendingIndex.has(message.message_id)}
          appearanceSettings={appearanceSettings}
          showSenderName={showSenderName}
          contacts={contacts}
        />,
      )

      lastMessageDate = messageDate
    })

    return messagesWithSeparators
  }, [
    currentChatMessages,
    handleContextMenu,
    handleImageClick,
    findMessageByIdMemo,
    appearanceSettings,
    contacts,
    visibleMessageCount,
  ])

  // Проверяем, может ли пользователь отправлять сообщения
  const canSendMessages = useMemo(() => {
    if (!selectedChat || !isGroup(selectedChat)) return true // Для личных чатов всегда можно отправлять сообщения
    return checkPermission(selectedChat, 'send_messages')
  }, [selectedChat, checkPermission])
  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-2xl">
            📦
          </div>
          <h2 className="text-xl font-semibold mb-2">
            Добро пожаловать в SHIP
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Выберите чат, чтобы начать общение
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col bg-chat-background dark:bg-chat_background backdrop-blur-sm h-full overflow-hidden min-h-0">
      {/* Компонент поиска */}
      <SearchBar
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        currentChatMessages={currentChatMessages}
        messagesContainerRef={messagesContainerRef}
      />

      {/* Область сообщений - правильное позиционирование для мобильных */}
      <motion.div
        ref={messagesContainerRef}
        /* onScroll удалён — используем нативный passive listener */
        className="flex-1 overflow-y-auto px-4 pt-2 pb-1 scrollable min-h-0"
        /* layoutScroll может провоцировать лишние перерасчёты — оставим отключённым */
      >
        <div className="w-full max-w-[min(100%,800px)] lg:max-w-[min(100%,1000px)] xl:max-w-[min(100%,2160px)] mx-auto space-y-3">
          <AnimatePresence initial={false} mode="sync">
            {renderMessages}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </motion.div>

      {/* Context Menu */}
      <ContextMenu
        position={contextMenu}
        onAction={handleMessageAction}
        hasMedia={
          contextMenu
            ? !!currentChatMessages.find((m) => m.message_id === contextMenu.id)
                ?.media &&
              currentChatMessages.find((m) => m.message_id === contextMenu.id)
                ?.media !== 'loading'
            : false
        }
      />

      {/* Input Bar */}
      {canSendMessages ? (
        <div className="flex-shrink-0">
          <InputBar
            currentChatMessages={currentChatMessages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            editingMessage={editingMessage}
            setEditingMessage={setEditingMessage}
            handleSendMessage={handleSendMessage}
            selectedChat={selectedChat}
            attachment={attachment}
            setAttachment={setAttachment}
            inputRef={inputRef}
            isMobile={isMobile}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-700/50 p-3 text-center text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
          У вас нет прав для отправки сообщений в этот чат
        </div>
      )}

      <ImageViewer
        isOpen={imageViewerOpen}
        imageUrl={selectedImageUrl}
        onClose={() => setImageViewerOpen(false)}
      />
    </div>
  )
}
