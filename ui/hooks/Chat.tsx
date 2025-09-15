import { addToast } from '@heroui/react'
import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'
import { Message } from './Message'
import { createMediaUrl } from '@/utils/mimeUtils'
import { Group } from './Group'
import { BasicWindowProps } from './Window'

export interface Chat {
  chat_id: string
  name: string
  participants: number[]
  last_message?: Message
  unread_count: number
  avatar?: string
  created_at?: string
  date?: number
  online?: boolean
  loaded?: boolean
}

interface ChatProps {
  chats: Chat[]
  setChats: (chats: Chat[]) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  selectedChat: Chat | Group | null
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | Group | null>>
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
}

export const Chat = ({
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
}: ChatProps) => {
  const loadChats = useCallback(async () => {
    setIsLoading(true)

    try {
      const result = await invoke<Chat[]>('get_chats').catch((error) => {
        console.error('Error loading chats:', error)
        addToast({
          title: 'Ошибка',
          description: `Failed to load chats: ${error}`,
          color: 'danger',
          variant: 'flat',
        })
        return [] as Chat[]
      })
      setChats(result)
    } catch (err) {
      console.error('Ошибка при загрузке чатов:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setChats, setIsLoading])

  const createChat = useCallback(
    async (receiverId: number) => {
      try {
        // First check if chat already exists
        await loadChats()

        // If no existing chat, create a new one
        console.log('Creating new chat with user:', receiverId)
        const chatId = await invoke<string>('create_chat', {
          receiverId,
        })

        // Refresh the chats list after creating a new chat
        await loadChats()
        return chatId
      } catch (error) {
        console.error('Error creating/opening chat:', error)
        throw error
      }
    },
    [loadChats, chats],
  )

  const sendMessage = useCallback(
    async (
      chatId: string,
      text: string,
      file?: string | null,
      replyMessageId?: string | null,
      editMessageId?: string | null,
      expires?: number | null,
    ) => {
      if (!chatId || !text.trim()) return false

      try {
        const messageId = await invoke<string>('send_message', {
          chatId,
          text: text.trim(),
          receiver_id: parseInt(chatId), // Добавляем receiver_id
          file,
          replyMessageId,
          editMessageId,
          expires: expires ? Math.floor(expires) : null,
        }).catch((error) => {
          console.error('Error sending message:', error)
          addToast({
            title: 'Ошибка',
            description: `Failed to send message: ${error}`,
            color: 'danger',
            variant: 'flat',
          })
          return ''
        })

        // Создаем временное сообщение, которое будет отображаться до получения обновления
        const tempMessage: Message = {
          message_id: messageId,
          chat_id: chatId,
          sender_id: 0,
          text: text.trim(),
          timestamp: new Date().toISOString(),
          is_read: false,
          is_sent: false,
          media_name: file ? file.split('/').pop() : undefined,
          media: file ? 'loading' : undefined, // Заглушка для медиа
          reply_to: replyMessageId || undefined,
          edited: editMessageId ? true : false,
          expires: expires ? Math.floor(expires) : undefined,
          is_file: file ? true : undefined,
        }

        // Добавляем сообщение локально
        setMessages((prev) => {
          const updatedMessages = [...(prev[chatId] || []), tempMessage]
          return {
            ...prev,
            [chatId]: updatedMessages,
          }
        })

        if (selectedChat?.chat_id === chatId) {
          setCurrentChatMessages((prev) => {
            const currentMessages = Array.isArray(prev) ? [...prev] : []

            // Если есть editMessageId, редактируем существующее сообщение
            if (editMessageId) {
              const messageIndex = currentMessages.findIndex(
                (m) => m.message_id === editMessageId,
              )
              if (messageIndex !== -1) {
                currentMessages[messageIndex] = {
                  ...currentMessages[messageIndex], // Сохраняем старые поля
                  text: text.trim(), // Обновляем текст
                  edited: true, // Помечаем как отредактированное
                  timestamp: new Date().toISOString(), // Обновляем время, если нужно
                  media_name: file
                    ? file.split('/').pop()
                    : currentMessages[messageIndex].media_name,
                  media: file ? 'loading' : currentMessages[messageIndex].media,
                  reply_to:
                    replyMessageId || currentMessages[messageIndex].reply_to,
                  expires: expires
                    ? Math.floor(expires)
                    : currentMessages[messageIndex].expires,
                  is_file: file ? true : currentMessages[messageIndex].is_file,
                }
              }
              return currentMessages
            } else {
              // Если editMessageId нет, добавляем новое сообщение
              return [...currentMessages, tempMessage]
            }
          })
        }

        return true
      } catch (err) {
        console.error('Ошибка при отправке сообщения:', err)
        addToast({
          title: 'Ошибка',
          description: `Не удалось отправить сообщение: ${err}`,
          color: 'danger',
          variant: 'flat',
        })
        return false
      }
    },
    [selectedChat?.chat_id],
  )

  return {
    loadChats,
    createChat,
    sendMessage,
  }
}

export const loadChats = async (props: BasicWindowProps) => {
  const { setChats, setMessages } = props
  try {
    // Здесь выполняем вызов API для загрузки чатов
    const loadedChats = await invoke('get_chats').catch((error) => {
      console.error('Error loading chats:', error)
      addToast({
        title: 'Ошибка',
        description: `Failed to load chats: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
      return [] as Chat[]
    })
    if (loadedChats) {
      setChats(loadedChats as Chat[])
    }
    return loadedChats
  } catch (err) {
    console.error('Ошибка при загрузке чатов:', err)
    throw err
  }
}

export const loadChatMessages = async (
  chat: Chat | Group,
  messages: Record<string, Message[]>,
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>,
) => {
  if (!chat.chat_id) {
    console.log('No chat_id provided')
    throw new Error('No chat_id provided')
  }
  const userAccountId = localStorage.getItem('userId')
  console.log('Loading messages for chat:', chat.chat_id)

  try {
    const response = await invoke<any>('get_messages', {
      chatId: chat.chat_id,
    }).catch((error) => {
      console.error('Error loading messages:', error)
      throw error
    })

    if (response && response.messages) {
      const formattedMessages: Message[] = response.messages.map((msg: any) => {
        const mediaUrl = createMediaUrl(msg.media_data)
        const isFile = !!msg.is_file

        const message: Message = {
          message_id: msg.message_id?.toString() || '',
          chat_id: msg.chat_id?.toString() || chat.chat_id,
          sender_id:
            msg.sender_id?.toString() === userAccountId
              ? 'self'
              : msg.sender_id?.toString() || '',
          text: msg.text || msg.content || '',
          timestamp: msg.timestamp
            ? new Date(msg.timestamp * 1000).toISOString()
            : new Date().toISOString(),
          is_read: true,
          is_sent: true,
          media_name: msg.media_name,
          media: mediaUrl,
          reply_to: msg.reply_message_id || undefined,
          edited: msg.edit_date !== null,
          expires: msg.expires,
          is_file: isFile,
        }
        return message
      })
      const currentTempMessages =
        messages[chat.chat_id]?.filter((m: Message) => !m.is_sent) || []

      const mergedMessages = [
        ...formattedMessages,
        ...currentTempMessages.filter(
          (tempMsg: Message) =>
            !formattedMessages.some((m) => m.message_id === tempMsg.message_id),
        ),
      ].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )

      setMessages((prev) => ({
        ...prev,
        [chat.chat_id]: mergedMessages,
      }))
      return mergedMessages
    }
  } catch (error) {
    console.error('Error loading messages:', error)
    throw error
  }
}
