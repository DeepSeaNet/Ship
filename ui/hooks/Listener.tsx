import { SetStateAction, useCallback, useRef, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Chat } from './Chat'
import { Group } from './Group'
import { Message } from './Message'
import { createMediaUrl, getMimeType } from '@/utils/mimeUtils'
import { addToast } from '@heroui/react'
import { User } from './Contacts'
interface ListenerProps {
  isListening: boolean
  setIsListening: React.Dispatch<SetStateAction<boolean>>
  selectedChat: Chat | Group | null
  setCurrentChatMessages: React.Dispatch<SetStateAction<Message[]>>
  setMessages: React.Dispatch<SetStateAction<Record<string, Message[]>>>
  setChats: React.Dispatch<SetStateAction<Chat[]>>
  setGroups: React.Dispatch<SetStateAction<Group[]>>
  setSelectedChat: React.Dispatch<SetStateAction<Chat | Group | null>>
  setContacts: React.Dispatch<SetStateAction<Record<number, User>>>
  setTypingStatuses: React.Dispatch<SetStateAction<TypingStatus[]>>
}

export const Listener = ({
  isListening,
  setIsListening,
  selectedChat,
  setCurrentChatMessages,
  setMessages,
  setChats,
  setGroups,
  setSelectedChat,
  setContacts,
  setTypingStatuses,
}: ListenerProps) => {
  const isListeningRef = useRef(isListening)
  const selectedChatRef = useRef(selectedChat)
  const listenerRef = useRef<(() => void) | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)

  // Initialize userAccountId from localStorage after component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('userId')
      setUserAccountId(userId)
    }
  }, [])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  // Handler functions for different event types
  const handleMessageSent = useCallback(
    (data: any) => {
      const currentSelectedChat = selectedChatRef.current

      setMessages((prev) => {
        const chatMessages = [...(prev[data.chat_id] || [])]
        const messageIndex = chatMessages.findIndex(
          (m) =>
            m.message_id === data.message_id ||
            (!m.is_sent && m.chat_id === data.chat_id.toString()),
        )

        if (messageIndex !== -1) {
          chatMessages[messageIndex] = {
            ...chatMessages[messageIndex],
            message_id: data.message_id.toString(),
            is_sent: true,
            media_name: data.media_name,
            reply_to: data.reply_message_id,
            expires: data.expires ? parseInt(data.expires) : undefined,
            text: data.text || chatMessages[messageIndex].text,
            edited: !!data.edit_date,
          }

          // Update media if provided
          if (data.media_data && data.media_size > 0) {
            const uint8Array = new Uint8Array(data.media_data)
            const blob = new Blob([uint8Array], {
              type: getMimeType(data.media_name || ''),
            })
            chatMessages[messageIndex].media = URL.createObjectURL(blob)
          }
        }

        return {
          ...prev,
          [data.chat_id]: chatMessages,
        }
      })

      // Update current chat messages if this is the active chat
      if (currentSelectedChat?.chat_id === data.chat_id) {
        setCurrentChatMessages((prev) => {
          const updatedMessages = [...prev]
          const messageIndex = updatedMessages.findIndex(
            (m) =>
              m.message_id === data.message_id ||
              (!m.is_sent && m.chat_id === data.chat_id),
          )

          if (messageIndex !== -1) {
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              message_id: data.message_id.toString(),
              is_sent: true,
              media_name: data.media_name,
              reply_to: data.reply_message_id,
              expires: data.expires ? parseInt(data.expires) : undefined,
              text: data.text || updatedMessages[messageIndex].text,
              edited: !!data.edit_date,
              is_file: false,
            }

            // Update media if provided
            if (data.media_data && data.media_size > 0) {
              const uint8Array = new Uint8Array(data.media_data)
              const blob = new Blob([uint8Array], {
                type: getMimeType(data.media_name || ''),
              })
              updatedMessages[messageIndex].media = URL.createObjectURL(blob)
            }
          }
          console.log(updatedMessages)
          return updatedMessages
        })
      }
    },
    [setMessages, setCurrentChatMessages],
  )

  const handleNewChat = useCallback(
    (data: any) => {
      const newChat: Chat = {
        chat_id: data.chat_id,
        name: data.name,
        participants: data.participants || [],
        unread_count: data.unread_count || 0,
        created_at: data.date,
      }

      setChats((prev) => {
        // Avoid duplicates
        if (!prev.some((c) => c.chat_id === newChat.chat_id)) {
          return [...prev, newChat]
        }
        return prev
      })

      // Notify user
      addToast({
        title: 'Новый чат',
        description: `Создан новый чат: ${newChat.name}`,
        color: 'success',
        variant: 'flat',
      })
    },
    [setChats],
  )

  const handleNewMessage = useCallback(
    (data: any) => {
      const currentSelectedChat = selectedChatRef.current
      const chatId = data.chat_id.toString()

      if (data.is_edit) {
        // Handle message edit
        setMessages((prev) => {
          const chatMessages = [...(prev[chatId] || [])]
          const messageIndex = chatMessages.findIndex(
            (m) => m.message_id === data.message_id,
          )

          if (messageIndex !== -1) {
            chatMessages[messageIndex] = {
              ...chatMessages[messageIndex],
              text: data.text,
              edited: true,
              timestamp: new Date(
                parseInt(data.timestamp) * 1000,
              ).toISOString(),
            }
          }

          return {
            ...prev,
            [chatId]: chatMessages,
          }
        })

        // Update current chat messages if this is the active chat
        if (currentSelectedChat?.chat_id === chatId) {
          setCurrentChatMessages((prev) => {
            const updatedMessages = [...prev]
            const messageIndex = updatedMessages.findIndex(
              (m) => m.message_id === data.message_id,
            )

            if (messageIndex !== -1) {
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                text: data.text,
                edited: true,
                timestamp: new Date(
                  parseInt(data.timestamp) * 1000,
                ).toISOString(),
              }
            }
            return updatedMessages
          })
        }
      } else {
        // Handle new message
        const newMessage: Message = {
          message_id: data.message_id?.toString(),
          chat_id: chatId,
          sender_id:
            data.sender_id.toString() === userAccountId
              ? 0
              : data.sender_id.toString(),
          text: data.text,
          timestamp: data.timestamp
            ? new Date(parseInt(data.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          is_read: false,
          is_sent: true,
          sender_name: data.sender_name,
          media_name: data.media_name,
          media: data.media
            ? (() => {
                // Convert array buffer to blob URL if media is present
                const uint8Array = new Uint8Array(data.media)
                const blob = new Blob([uint8Array], {
                  type: getMimeType(data.media_name || ''),
                })
                return URL.createObjectURL(blob)
              })()
            : undefined,
          reply_to: data.reply_message_id,
          edited: !!data.edit_date,
          expires: data.expires ? parseInt(data.expires) : undefined,
          is_file: data.is_file,
        }

        // Add to messages cache
        setMessages((prev) => {
          const updatedMessages = [...(prev[chatId] || []), newMessage].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          )
          return {
            ...prev,
            [chatId]: updatedMessages,
          }
        })

        // Update current chat messages if this is the active chat
        if (currentSelectedChat?.chat_id === chatId) {
          setCurrentChatMessages((prev) =>
            [...prev, newMessage].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
            ),
          )
        } else {
          // Increment unread count for non-active chats
          setChats((prev) =>
            prev.map((chat) =>
              chat.chat_id === chatId
                ? { ...chat, unread_count: (chat.unread_count || 0) + 1 }
                : chat,
            ),
          )

          // Show notification for new message
          if (data.sender_id.toString() !== userAccountId) {
            addToast({
              title: data.sender_name || `User ${data.sender_id}`,
              description:
                data.text.length > 50
                  ? `${data.text.substring(0, 50)}...`
                  : data.text,
              color: 'primary',
              variant: 'flat',
            })
          }
        }
      }
    },
    [userAccountId, setMessages, setCurrentChatMessages, setChats],
  )

  const handleNewGroupMessage = useCallback(
    (data: any) => {
      const currentSelectedChat = selectedChatRef.current

      if (data.is_edit) {
        // Handle group message edit
        setMessages((prev) => {
          const groupMessages = [...(prev[data.group_id] || [])]
          const messageIndex = groupMessages.findIndex(
            (m) => m.message_id === data.message_id,
          )

          if (messageIndex !== -1) {
            groupMessages[messageIndex] = {
              ...groupMessages[messageIndex],
              text: data.text,
              edited: true,
              timestamp: new Date(
                parseInt(data.timestamp) * 1000,
              ).toISOString(),
            }
          }

          return {
            ...prev,
            [data.group_id]: groupMessages,
          }
        })

        // Update groups list - find group by group_id and update last_message if it was the last message
        setGroups((prev) => {
          const updatedGroups = prev.map((group) => {
            if (
              group.chat_id === data.group_id &&
              group.last_message?.message_id === data.message_id
            ) {
              return {
                ...group,
                last_message: {
                  message_id: data.message_id,
                  chat_id: data.group_id,
                  sender_id: data.sender_id,
                  text: data.text,
                  timestamp: Date.now().toString(), // Current timestamp as string
                  is_read: false,
                  is_sent: true,
                  sender_name: data.sender_name,
                  media_name: data.media_name,
                  media: data.media,
                  reply_to: data.reply_message_id,
                  edited: !!data.edit_date,
                  expires: data.expires ? parseInt(data.expires) : undefined,
                  is_file:
                    data.is_file ||
                    (data.media_name &&
                      !/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(data.media_name)),
                },
              }
            }
            return group
          })

          // Resort groups by last message timestamp
          updatedGroups.sort((a, b) => {
            const a_ts = Number(
              new Date(a.last_message?.timestamp || a.date || 0).getTime(),
            )
            const b_ts = Number(
              new Date(b.last_message?.timestamp || b.date || 0).getTime(),
            )
            return b_ts - a_ts // Sort by descending (newest first)
          })

          return updatedGroups
        })

        // Update current chat messages if this is the active group
        if (currentSelectedChat?.chat_id === data.group_id) {
          setCurrentChatMessages((prev) => {
            const updatedMessages = [...prev]
            const messageIndex = updatedMessages.findIndex(
              (m) => m.message_id === data.message_id,
            )

            if (messageIndex !== -1) {
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                text: data.text,
                edited: true,
                timestamp: new Date(
                  parseInt(data.timestamp) * 1000,
                ).toISOString(),
              }
            }
            return updatedMessages
          })
        }
      } else {
        // Handle new group message
        const isFile =
          data.is_file ||
          (data.media_name &&
            !/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(data.media_name))

        const newGroupMessage: Message = {
          message_id: data.message_id?.toString(),
          chat_id: data.group_id,
          sender_id:
            data.sender_id.toString() === userAccountId
              ? 0
              : data.sender_id.toString(),
          text: data.text,
          timestamp: data.timestamp
            ? new Date(parseInt(data.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          is_read: false,
          is_sent: true,
          sender_name: data.sender_name,
          media_name: data.media_name,
          media: data.media
            ? (() => {
                // Convert array buffer to blob URL if media is present
                try {
                  const uint8Array = new Uint8Array(data.media)
                  if (uint8Array.length > 0) {
                    const blob = new Blob([uint8Array], {
                      type: getMimeType(data.media_name || ''),
                    })
                    return URL.createObjectURL(blob)
                  }
                  return undefined
                } catch (error) {
                  console.error('Error creating blob URL:', error)
                  return undefined
                }
              })()
            : undefined,
          reply_to: data.reply_message_id,
          edited: !!data.edit_date,
          expires: data.expires ? parseInt(data.expires) : undefined,
          is_file: isFile,
        }

        // Add to messages cache
        setMessages((prev) => {
          const updatedMessages = [
            ...(prev[data.group_id] || []),
            newGroupMessage,
          ].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          )
          return {
            ...prev,
            [data.group_id]: updatedMessages,
          }
        })

        // Update groups list - find group by group_id and update last_message
        setGroups((prev) => {
          const updatedGroups = prev.map((group) => {
            if (group.chat_id === data.group_id) {
              return {
                ...group,
                last_message: newGroupMessage,
                unread_count:
                  currentSelectedChat?.chat_id === data.group_id
                    ? group.unread_count
                    : (group.unread_count || 0) + 1,
              }
            }
            return group
          })

          // Resort groups by last message timestamp
          updatedGroups.sort((a, b) => {
            const a_ts = Number(
              new Date(a.last_message?.timestamp || a.date || 0).getTime(),
            )
            const b_ts = Number(
              new Date(b.last_message?.timestamp || b.date || 0).getTime(),
            )
            return b_ts - a_ts // Sort by descending (newest first)
          })

          return updatedGroups
        })

        // Update current chat messages if this is the active chat
        if (currentSelectedChat?.chat_id === data.group_id) {
          setCurrentChatMessages((prev) =>
            [...prev, newGroupMessage].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
            ),
          )
        } else {
          // Show notification for new message
          if (data.sender_id.toString() !== userAccountId) {
            addToast({
              title: `${data.sender_name || `User ${data.sender_id}`} в ${data.group_name}`,
              description:
                data.text.length > 50
                  ? `${data.text.substring(0, 50)}...`
                  : data.text,
              color: 'primary',
              variant: 'flat',
            })
          }
        }
      }
    },
    [userAccountId, setMessages, setCurrentChatMessages, setGroups, addToast],
  )

  const handleGroupMessageSent = useCallback(
    (data: any) => {
      setMessages((prev) => {
        const prevMessages = prev[data.group_name] || []

        // Find message by message_id
        const messageIndex = prevMessages.findIndex(
          (m) => m.message_id === data.message_id,
        )

        if (messageIndex !== -1) {
          // Check if this is a file based on media_name extension
          const isFile =
            data.is_file ||
            (data.media_name &&
              !/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(data.media_name))

          // Create media URL if media is present
          let mediaUrl = prevMessages[messageIndex].media
          if (data.media && data.media.length > 0) {
            try {
              const uint8Array = new Uint8Array(data.media)
              const blob = new Blob([uint8Array], {
                type: getMimeType(data.media_name),
              })
              mediaUrl = URL.createObjectURL(blob)
            } catch (error) {
              console.error('Error creating blob URL:', error)
            }
          }

          // Update existing message
          prevMessages[messageIndex] = {
            ...prevMessages[messageIndex],
            is_sent: true,
            text: data.text || prevMessages[messageIndex].text,
            media_name: data.media_name,
            media: mediaUrl,
            reply_to: data.reply_message_id,
            expires: data.expires ? parseInt(data.expires) : undefined,
            edited: !!data.edit_date,
            is_file: isFile,
          }
        }

        return {
          ...prev,
          [data.group_name]: prevMessages,
        }
      })

      // Update groups list - find group by group_id and update last_message
      setGroups((prev) => {
        const updatedGroups = prev.map((group) => {
          if (group.chat_id === data.group_name) {
            return {
              ...group,
              last_message: {
                message_id: data.message_id,
                chat_id: data.group_id,
                sender_id: data.sender_id,
                text: data.text,
                timestamp: Date.now().toString(), // Current timestamp as string
                is_read: false,
                is_sent: true,
                sender_name: data.sender_name,
                media_name: data.media_name,
                media: data.media,
                reply_to: data.reply_message_id,
                edited: !!data.edit_date,
                expires: data.expires ? parseInt(data.expires) : undefined,
                is_file:
                  data.is_file ||
                  (data.media_name &&
                    !/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(data.media_name)),
              },
            }
          }
          return group
        })

        // Resort groups by last message timestamp
        updatedGroups.sort((a, b) => {
          const a_ts = Number(a.last_message?.timestamp || a.date || 0)
          const b_ts = Number(b.last_message?.timestamp || b.date || 0)
          return b_ts - a_ts // Sort by descending (newest first)
        })

        return updatedGroups
      })

      // Also update currentChatMessages if this is the active chat
      if (selectedChatRef.current?.chat_id === data.group_name) {
        setCurrentChatMessages((prev) => {
          console.log(data)
          const messageIndex = prev.findIndex(
            (m) => m.message_id === data.message_id,
          )

          if (messageIndex !== -1) {
            // Check if this is a file based on media_name extension
            const isFile =
              data.is_file ||
              (data.media_name &&
                !/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(data.media_name))

            // Create media URL if media is present
            let mediaUrl = prev[messageIndex].media
            if (data.media_data && data.media_data.length > 0) {
              try {
                const uint8Array = new Uint8Array(data.media_data)
                const blob = new Blob([uint8Array], {
                  type: getMimeType(data.media_name),
                })
                mediaUrl = URL.createObjectURL(blob)
              } catch (error) {
                console.error('Error creating blob URL:', error)
              }
            }

            const updatedMessages = [...prev]
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              is_sent: true,
              text: data.text || updatedMessages[messageIndex].text,
              media_name: data.media_name,
              media: mediaUrl,
              reply_to: data.reply_message_id,
              expires: data.expires ? parseInt(data.expires) : undefined,
              edited: !!data.edit_date,
              is_file: isFile,
            }
            return updatedMessages
          }
          return prev
        })
      }
    },
    [setMessages, setCurrentChatMessages, setGroups],
  )

  const handleCreateGroup = useCallback(
    (data: any) => {
      console.log('Group created:', data)
      const group: Group = {
        chat_id: data.group_id,
        name: data.group_name,
        participants: data.members,
        members: data.members,
        unread_count: 0,
        group_config: data.group_config,
        user_permissions: data.users_permisions,
        default_permissions: data.default_permissions,
        admins: data.admins,
        owner_id: data.owner_id,
        description: data.description,
        date: data.date,
      }
      setGroups((prev) => [...prev, group])
    },
    [setGroups],
  )

  const handleJoinGroup = useCallback(
    (data: any) => {
      console.log('Joined group:', data)
      setGroups((prev) => {
        // Check if group already exists
        if (prev.some((g) => g.chat_id === data.group_id)) {
          return prev.map((g) =>
            g.chat_id === data.group_id
              ? {
                  ...g,
                  participants: data.members,
                }
              : g,
          )
        } else {
          return [
            ...prev,
            {
              chat_id: data.group_id,
              name: data.group_name,
              participants: data.members,
              last_message: data.last_message,
              unread_count: 0,
              description: data.description,
              avatar: data.avatar,
              created_at: data.date,
              date: data.date,
              owner_id: data.owner_id,
              admins: data.admins,
              members: data.members,
              group_config: data.group_config || null, // используем fallback для отсутствующих полей
              user_permissions: data.user_permissions,
              users_permisions: data.users_permisions,
              default_permissions: data.default_permissions,
              loaded: true,
            },
          ]
        }
      })
    },
    [setGroups],
  )

  const handleGroupNewMember = useCallback(
    (data: any) => {
      console.log('Group new member:', data)

      setGroups((prev) => {
        const updatedGroups = prev.map((g) =>
          g.chat_id === data.group_id
            ? {
                ...g,
                participants: [...g.participants, data.member_id],
                group_config: data.group_config,
                users_permisions: data.users_permisions,
              }
            : g,
        )

        // If this is the currently selected chat, update it too
        if (selectedChatRef.current?.chat_id === data.group_id) {
          // Update the selected chat with the new configuration
          if (setSelectedChat && typeof setSelectedChat === 'function') {
            const updatedSelectedChat = updatedGroups.find(
              (g) => g.chat_id === data.group_id,
            )
            if (updatedSelectedChat) {
              setSelectedChat(updatedSelectedChat)
            }
          }
        }

        return updatedGroups
      })
    },
    [selectedChat, setSelectedChat, setGroups],
  )

  const handleGroupConfigUpdated = useCallback(
    (data: any) => {
      console.log('Group config updated:', data)
      // Update the groups array with new configuration data
      setGroups((prev) => {
        const updatedGroups = prev.map((g) =>
          g.chat_id === data.group_id
            ? {
                ...g,
                name: data.group_name,
                description: data.description,
                participants: data.members,
                avatar: data.avatar,
                created_at: data.created_at,
                owner_id: data.owner_id,
                admins: data.admins,
                members: data.members,
                group_config: data.group_config,
                user_permissions: data.user_permissions,
                users_permissions: data.users_permissions,
                default_permissions: data.default_permissions,
              }
            : g,
        )

        // If this is the currently selected chat, update it too
        if (selectedChatRef.current?.chat_id === data.group_id) {
          // Update the selected chat with the new configuration
          if (setSelectedChat && typeof setSelectedChat === 'function') {
            const updatedSelectedChat = updatedGroups.find(
              (g) => g.chat_id === data.group_id,
            )
            if (updatedSelectedChat) {
              setSelectedChat(updatedSelectedChat)
            }
          }
        }

        return updatedGroups
      })
    },
    [setGroups, setSelectedChat],
  )

  const handleUserStatusChanged = useCallback((data: any) => {
    setContacts((prev) => ({
      ...prev,
      [data.user_id]: {
        ...prev[data.user_id],
        is_online: data.is_online,
        last_seen: data.last_seen.toString(),
      },
    }))
  }, [])

  const handleUserTypingStatusChanged = useCallback(
    (data: any) => {
      const { chat_id, user_id, status } = data

      const newStatus: TypingStatus = {
        chatId: chat_id,
        userId: user_id,
        isTyping: status === 'TYPING',
        timestamp: Date.now(),
      }

      setTypingStatuses((prev) => {
        const exists = prev.find(
          (c) => c.chatId === chat_id && c.userId === user_id,
        )
        if (exists) {
          // Update existing
          return prev.map((c) =>
            c.chatId === chat_id && c.userId === user_id
              ? {
                  ...c,
                  isTyping: newStatus.isTyping,
                  timestamp: newStatus.timestamp,
                }
              : c,
          )
        } else {
          // Add new
          return [...prev, newStatus]
        }
      })

      console.log('User typing status changed:', data)
    },
    [setTypingStatuses],
  )

  const setupMessageListener = useCallback(async () => {
    console.log('Setting up message listener')
    try {
      if (isListeningRef.current) {
        console.log('Already listening for messages')
        return
      }

      // Если есть предыдущий слушатель, отписываемся от него
      if (listenerRef.current) {
        console.log('Cleaning up previous listener')
        listenerRef.current()
        listenerRef.current = null
      }

      setIsListening(true)
      isListeningRef.current = true

      if (true) {
        await listen('server-event', (event) => {
          const { type, data } = event.payload as any
          console.log('Received server event:', type, data)

          switch (type) {
            case 'message_sent':
              handleMessageSent(data)
              break

            case 'new_chat':
              handleNewChat(data)
              break

            case 'new_message':
              handleNewMessage(data)
              break

            case 'new_group_message':
              handleNewGroupMessage(data)
              break

            case 'group_message_sent':
              handleGroupMessageSent(data)
              break

            case 'create_group':
              handleCreateGroup(data)
              break

            case 'join_group':
              handleJoinGroup(data)
              break

            case 'group_update':
              handleGroupNewMember(data)
              break

            case 'group_config_updated':
              handleGroupConfigUpdated(data)
              break

            case 'user_status_changed':
              handleUserStatusChanged(data)
              break
            case 'user_typing_status_changed':
              handleUserTypingStatusChanged(data)
              break
          }
        })
      }
    } catch (error) {
      console.error('Failed to set up server events:', error)
      addToast({
        title: 'Ошибка',
        description: `Failed to set up server events: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    }
  }, [
    userAccountId,
    setCurrentChatMessages,
    setIsListening,
    setMessages,
    setGroups,
    handleMessageSent,
    handleNewChat,
    handleNewMessage,
    handleNewGroupMessage,
    handleGroupMessageSent,
    handleCreateGroup,
    handleJoinGroup,
    handleGroupNewMember,
    handleGroupConfigUpdated,
    handleUserStatusChanged,
    setContacts,
  ])

  return {
    setupMessageListener,
  }
}
