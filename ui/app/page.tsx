'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import LeftSidebar from '@/components/LeftSidebar'
import ChatWindow from '@/components/ChatWindow'
import RightPanel from '@/components/RightPanel'
import Header from '@/components/Header'
import Settings from '@/components/settings/Settings'
import Auth from '@/components/Auth'
import VoiceChannelModal from '@/components/voice/components/VoiceChannelModal'
import { invoke } from '@tauri-apps/api/core'
import { Message } from '@/hooks/Message'
import { Chat } from '@/hooks/Chat'
import { Group } from '@/hooks/Group'
import { Listener } from '@/hooks/Listener'
import { User } from '@/hooks/Contacts'
import { safeLocalStorage } from '@/utils/safeLocalStorage'
import { BasicWindow } from '@/hooks/Window'

// Connection status types
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

// Connection status indicator component
const ConnectionStatusIndicator = ({
  status,
}: {
  status: ConnectionStatus
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return { color: 'bg-green-500', text: 'Подключено', pulse: false }
      case 'connecting':
        return { color: 'bg-yellow-500', text: 'Подключение...', pulse: true }
      case 'error':
        return { color: 'bg-red-500', text: 'Ошибка подключения', pulse: false }
      case 'disconnected':
      default:
        return { color: 'bg-gray-500', text: 'Не подключено', pulse: false }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-300">
      <div
        className={`w-3 h-3 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {config.text}
      </span>
    </div>
  )
}

export default function Home() {
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isInit, setIsInit] = useState(false)
  const [isLogin, setIsLogin] = useState(false)
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true)
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true)

  // Voice chat state
  const [isVoiceChannelModalOpen, setIsVoiceChannelModalOpen] = useState(false)
  const [selectedGroupForVoice, setSelectedGroupForVoice] = useState<{
    id: string
    name: string
  } | null>(null)

  // Chat state
  const [selectedChat, setSelectedChat] = useState<Chat | Group | null>(null)
  const [currentChatMessages, setCurrentChatMessages] = useState<Message[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [groups, setGroups] = useState<Chat[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [contacts, setContacts] = useState<Record<number, User>>({})

  // Search functionality
  const [toggleSearchFunction, setToggleSearchFunction] = useState<
    (() => void) | undefined
  >(undefined)

  // Auth state - изменили логику
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected')
  const [userData, setUserData] = useState<{
    user_id: string
    username: string
  } | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [typingStatuses, setTypingStatuses] = useState<TypingStatus[]>([])
  // Define all functions used in memoized components first
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const toggleRightPanel = () => {
    setIsRightPanelOpen(!isRightPanelOpen)
  }

  const toggleLeftSidebar = () => {
    setIsLeftSidebarVisible(!isLeftSidebarVisible)
  }

  const toggleRightSidebar = () => {
    setIsRightPanelVisible(!isRightPanelVisible)
  }

  const openSettings = () => {
    setIsSettingsOpen(true)
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
  }

  // Handler to receive the search toggle function from ChatWindow
  const handleSearchToggle = useCallback((toggleFn: () => void) => {
    setToggleSearchFunction(() => toggleFn)
  }, [])

  // Обработчик открытия голосового канала
  const handleOpenVoiceChannel = useCallback(
    (groupId?: string, groupName?: string) => {
      if (groupId && groupName) {
        setSelectedGroupForVoice({ id: groupId, name: groupName })
      }
      setIsVoiceChannelModalOpen(true)
    },
    [],
  )

  // Обработчик закрытия голосового канала
  const handleCloseVoiceChannel = useCallback(() => {
    setIsVoiceChannelModalOpen(false)
    setSelectedGroupForVoice(null)
  }, [])

  // Функция для повторной попытки подключения
  const retryConnection = useCallback(async () => {
    setConnectionStatus('connecting')
    setAuthError(null)

    try {
      const savedUsername = safeLocalStorage.getItem('username')
      const savedUserId = safeLocalStorage.getItem('userId')
      if (savedUsername && savedUserId) {
        setUserData({
          user_id: savedUserId,
          username: savedUsername,
        })
        await invoke('reconnect', { username: savedUsername })
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      console.error('Connection retry error:', error)
      setConnectionStatus('error')
      setAuthError(
        error instanceof Error ? error.message : 'Ошибка подключения',
      )
    }
  }, [])

  // Memoize components to prevent unnecessary re-renders
  const memoizedLeftSidebar = useMemo(
    () => (
      <LeftSidebar
        setSelectedChat={setSelectedChat}
        selectedChat={selectedChat}
        closeMobileMenu={() => setIsMobileMenuOpen(false)}
        openSettings={openSettings}
        isMobile={isMobile}
        currentChatMessages={currentChatMessages}
        setCurrentChatMessages={setCurrentChatMessages}
        isListening={isListening}
        setIsListening={setIsListening}
        typingStatuses={typingStatuses}
        currentUser={userData}
        chats={chats}
        groups={groups}
        setChats={setChats}
        setGroups={setGroups}
        messages={messages}
        setMessages={setMessages}
        onOpenVoiceChannel={handleOpenVoiceChannel}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        setIsAuthenticated={(status: boolean) => {
          if (!status) {
            setConnectionStatus('disconnected')
            setUserData(null)
            safeLocalStorage.removeItem('username')
            safeLocalStorage.removeItem('userId')
          }
        }}
        contacts={contacts}
        setContacts={setContacts}
      />
    ),
    [
      selectedChat,
      isMobile,
      currentChatMessages,
      isListening,
      typingStatuses,
      userData,
      setSelectedChat,
      setCurrentChatMessages,
      setIsListening,
      handleOpenVoiceChannel,
      chats,
      groups,
      messages,
      contacts,
      setContacts,
      setUserData,
    ],
  )

  const memoizedChatWindow = useMemo(
    () => (
      <ChatWindow
        selectedChat={selectedChat}
        currentChatMessages={currentChatMessages}
        setCurrentChatMessages={setCurrentChatMessages}
        isListening={isListening}
        setIsListening={setIsListening}
        onSearchToggle={handleSearchToggle}
        currentUser={userData}
        chats={chats}
        groups={groups}
        setChats={setChats}
        setGroups={setGroups}
        messages={messages}
        setMessages={setMessages}
        setSelectedChat={setSelectedChat}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        isMobile={isMobile}
        contacts={contacts}
      />
    ),
    [
      selectedChat,
      currentChatMessages,
      isListening,
      handleSearchToggle,
      userData,
      chats,
      groups,
      setChats,
      setGroups,
      messages,
      setMessages,
      setSelectedChat,
      isLoading,
      setIsLoading,
    ],
  )

  const memoizedRightPanel = useMemo(
    () => (
      <RightPanel
        selectedChat={selectedChat}
        closeRightPanel={() => setIsRightPanelOpen(false)}
        onToggleSearch={toggleSearchFunction}
        setSelectedChat={setSelectedChat}
        chats={chats}
        groups={groups}
        setChats={setChats}
        setGroups={setGroups}
        messages={messages}
        setMessages={setMessages}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        currentChatMessages={currentChatMessages}
        setCurrentChatMessages={setCurrentChatMessages}
        contacts={contacts}
        setContacts={setContacts}
        isMobile={isMobile}
      />
    ),
    [
      selectedChat,
      toggleSearchFunction,
      setSelectedChat,
      chats,
      groups,
      setChats,
      setGroups,
      messages,
      setMessages,
      isLoading,
      setIsLoading,
      contacts,
      setContacts,
    ],
  )

  const { setupMessageListener } = Listener({
    isListening: isListening,
    setIsListening: setIsListening,
    selectedChat: selectedChat,
    setCurrentChatMessages: setCurrentChatMessages,
    setMessages: setMessages,
    setChats: setChats,
    setGroups: setGroups,
    setSelectedChat: setSelectedChat,
    setContacts: setContacts,
    setTypingStatuses: setTypingStatuses,
  })

  const { initializeChat } = BasicWindow({
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

  // Проверка авторизации при загрузке - теперь не блокирует приложение
  useEffect(() => {
    const checkAuth = async () => {
      setConnectionStatus('connecting')

      try {
        const savedUsername = safeLocalStorage.getItem('username')
        const savedUserId = safeLocalStorage.getItem('userId')

        if (savedUsername && savedUserId) {
          setUserData({
            user_id: savedUserId,
            username: savedUsername,
          })
          await invoke('grpc_login', {
            username: savedUsername,
            userId: Number(savedUserId),
          })
          setIsLogin(true)
          setConnectionStatus('connected')
        } else {
          setConnectionStatus('disconnected')
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setConnectionStatus('error')
        setAuthError(
          error instanceof Error ? error.message : 'Ошибка авторизации',
        )
        // Не удаляем данные сразу, дадим пользователю возможность повторить попытку
      }
    }

    checkAuth()
  }, [])

  // Определение мобильного устройства
  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile && !selectedChat) {
        setIsMobileMenuOpen(true)
      }
    }

    checkIfMobile()
    window.addEventListener('resize', checkIfMobile)

    return () => {
      window.removeEventListener('resize', checkIfMobile)
    }
  }, [selectedChat])

  useEffect(() => {
    const initMessageListener = async () => {
      try {
        if (!isListening) {
          await setupMessageListener()
          console.log('Message listener setup completed')
          setIsListening(true)
        }
      } catch (error) {
        console.error('Failed to setup message listener:', error)
      }
    }

    // Запускаем listener только если подключены
    if (connectionStatus === 'connected') {
      initMessageListener()
    }

    if (!isInit) {
      if (isLogin) {
        initializeChat()
        setIsInit(true)
      }
    }
  }, [
    connectionStatus,
    setupMessageListener,
    setIsInit,
    isInit,
    isListening,
    setIsListening,
    setIsLogin,
    isLogin,
  ])

  useEffect(() => {
    if (isMobile && selectedChat) {
      setIsMobileMenuOpen(false)
    }
  }, [selectedChat, isMobile])

  const handleAuthSuccess = (userData: {
    user_id: string
    username: string
  }) => {
    safeLocalStorage.setItem('userId', userData.user_id)
    safeLocalStorage.setItem('username', userData.username)
    setUserData(userData)
    setConnectionStatus('connected')
    setAuthError(null)
    initializeChat()
  }

  // Auth modal - показываем только если нет сохраненных данных
  const showAuthModal = !userData && connectionStatus !== 'connecting'

  return (
    <main className="h-[100dvh] w-screen flex flex-col overflow-hidden overscroll-none">
      <Header
        toggleMobileMenu={toggleMobileMenu}
        toggleRightPanel={toggleRightPanel}
        toggleLeftSidebar={toggleLeftSidebar}
        toggleRightSidebar={toggleRightSidebar}
        isLeftSidebarVisible={isLeftSidebarVisible}
        isRightPanelVisible={isRightPanelVisible}
        selectedChat={selectedChat}
        isMobile={isMobile}
        contacts={contacts}
        messages={messages}
      />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          className={`
          ${isMobileMenuOpen ? 'translate-x-0 w-full' : '-translate-x-full'}
          md:translate-x-0 md:w-auto
          ${isLeftSidebarVisible ? 'md:sidebar-expand' : 'md:sidebar-collapse'}
          flex-shrink-0
          fixed md:relative z-20
          h-[calc(100dvh-3rem)] md:h-auto
          top-12 md:top-0
          transition-all-medium bg-slate-50 dark:bg-slate-800
        `}
        >
          {memoizedLeftSidebar}
        </div>
        <div
          className={`flex-1 flex flex-col overflow-hidden min-h-0 ${isMobile && isMobileMenuOpen ? 'invisible' : 'visible'} pt-12 md:pt-0 h-[calc(100dvh-3rem)] md:h-auto`}
        >
          {memoizedChatWindow}
        </div>
        <div
          className={`
          ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0
          ${isRightPanelVisible ? 'md:sidebar-expand' : 'md:sidebar-collapse'}
          flex-shrink-0
          fixed md:relative right-0 z-30 
          h-[calc(100dvh-3rem)] md:h-auto
          top-12 md:top-0
          w-[320px] md:max-w-[320px]
          transition-all-medium bg-slate-50 dark:bg-slate-800
          overflow-hidden
        `}
        >
          {memoizedRightPanel}
        </div>
      </div>

      {/* Overlay for mobile */}
      <div
        className={`${isMobileMenuOpen || isRightPanelOpen || !isLeftSidebarVisible ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          fixed inset-0 bg-black z-10 md:hidden transition-opacity duration-300`}
        onClick={() => {
          setIsMobileMenuOpen(false)
          setIsRightPanelOpen(false)
        }}
      />

      {/* Settings modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-5xl h-[80vh]">
            <Settings closeSettings={closeSettings} isMobile={isMobile} />
          </div>
        </div>
      )}

      {/* Auth modal - показываем только при необходимости */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <Auth onAuthSuccess={handleAuthSuccess} />
        </div>
      )}

      {/* Voice chat modal */}
      <VoiceChannelModal
        isOpen={isVoiceChannelModalOpen}
        onClose={handleCloseVoiceChannel}
        groupId={selectedGroupForVoice?.id}
        groupName={selectedGroupForVoice?.name}
      />

      {/* Connection status indicator */}
      {!isMobile && <ConnectionStatusIndicator status={connectionStatus} />}

      {/* Error notification with retry button */}
      {connectionStatus === 'error' && (
        <div className="fixed bottom-16 left-4 z-50 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-sm shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Ошибка подключения
              </p>
              {authError && (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {authError}
                </p>
              )}
              <button
                onClick={retryConnection}
                className="mt-2 text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md transition-colors duration-200"
              >
                Повторить попытку
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
