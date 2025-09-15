import { useCallback } from 'react'
import { Message } from './Message'
import { Group, isGroup, loadGroups, loadGroupsMessages } from './Group'
import { Chat, loadChats, loadChatMessages } from './Chat'
import { loadContacts, User } from './Contacts'
export interface BasicWindowProps {
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  selectedChat: Chat | Group | null
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | Group | null>>
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  chats: Chat[]
  groups: Group[]
  contacts: Record<number, User>
  setContacts: React.Dispatch<React.SetStateAction<Record<number, User>>>
}

export const BasicWindow = ({
  currentChatMessages,
  setCurrentChatMessages,
  messages,
  setMessages,
  selectedChat,
  setChats,
  setGroups,
  isLoading,
  setIsLoading,
  chats,
  groups,
  contacts,
  setSelectedChat,
  setContacts,
}: BasicWindowProps) => {
  const initializeChat = useCallback(async () => {
    console.log('Initializing chat')
    // Добавляем защиту от повторных вызовов
    if (isLoading) {
      console.log('Chat initialization already in progress, skipping')
      return
    }

    try {
      setIsLoading(true)
      // Загружаем чаты, группы и запросы на чат
      // Вместо вызова хуков, используем утилитарные функции
      console.log('loading contacts')
      const loadedContacts = await loadContacts(setContacts)
      console.log('Loading chats')
      await loadChats({
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
        groups,
        setGroups,
        contacts: loadedContacts,
        setContacts,
      })

      console.log('contacts', contacts)

      console.log('Loading groups')
      await loadGroups({
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
        groups,
        setGroups,
        contacts: loadedContacts,
        setContacts,
      })
    } catch (err) {
      console.error('Ошибка при инициализации чата:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [
    chats,
    groups,
    isLoading,
    setIsLoading,
    setChats,
    setGroups,
    setMessages,
    messages,
    contacts,
  ])

  const setActiveChat = useCallback(
    async (chat: Chat | Group | null) => {
      // Проверка, не выбран ли уже этот чат
      if (selectedChat?.chat_id === chat?.chat_id) {
        console.log('This chat is already active, skipping reload')
        return
      }

      console.log('Setting active chat:', chat)
      if (isGroup(chat)) {
        if (!chat.loaded) {
          const group_messages = await loadGroupsMessages(
            chat,
            messages,
            setMessages,
          )
          chat.loaded = true
          setCurrentChatMessages(group_messages)
        } else {
          const cachedMessages = messages[chat.chat_id] || []
          setCurrentChatMessages(cachedMessages)
        }
      } else {
        if (chat) {
          const chat_messages = await loadChatMessages(
            chat,
            messages,
            setMessages,
          )
          setCurrentChatMessages(chat_messages || [])
        } else {
          setCurrentChatMessages([])
        }
      }

      // Устанавливаем активный чат после загрузки сообщений
      setSelectedChat(chat)
    },
    [setCurrentChatMessages, setMessages, selectedChat, messages],
  )

  return {
    setActiveChat,
    initializeChat,
  }
}
