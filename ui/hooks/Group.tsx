import { useCallback } from 'react'
import { User } from './Contacts'
import { Message } from './Message'
import { Chat } from '@/hooks/Chat'
import { invoke } from '@tauri-apps/api/core'
import { createMediaUrl } from '../utils/mimeUtils'
import { addToast, Button } from '@heroui/react'
import { BasicWindowProps } from './Window'
import { GroupSettings } from '@/components/settings/GroupSettingsModal'
import { safeLocalStorage } from '@/utils/safeLocalStorage'
export interface Permissions {
  manage_members: boolean
  send_messages: boolean
  delete_messages: boolean
  rename_group: boolean
  manage_permissions: boolean
  pin_messages: boolean
  manage_admins: boolean
}

export interface GroupConfig {
  id: number
  name: string
  created_at: string
  updated_at: string
  visibility: 'Public' | 'Private'
  join_mode: 'InviteOnly' | 'LinkOnly' | 'Open'
  invite_link?: string
  max_members?: number
  creator_id: number
  members: number[]
  admins: number[]
  permissions: Record<number, Permissions>
  default_permissions: Permissions
  banned: number[]
  muted: Record<number, string>
  description?: string
  avatar?: string
  banner?: string
  pinned_message_id?: number
  slow_mode_delay?: number
}

export interface Group {
  chat_id: string
  name: string
  participants: number[]
  last_message?: Message
  unread_count: number
  description?: string
  avatar?: string
  created_at?: string
  date?: number
  owner_id?: number
  admins?: number[]
  members?: number[]
  group_config?: GroupConfig
  user_permissions?: Permissions
  users_permissions?: Record<number, Permissions>
  default_permissions?: Permissions
  loaded?: boolean
}

export function isGroup(chat: Chat | Group | null): chat is Group {
  return chat !== null && 'admins' in chat
}

interface GroupProps {
  groups: Group[]
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  selectedChat: Chat | Group | null
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | Group | null>>
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
}

export const Group = ({
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
}: GroupProps) => {
  const checkPermission = useCallback(
    (chat: Group | null, permissionKey: keyof Permissions): boolean => {
      if (!chat) return false
      const currentUserId = safeLocalStorage.getItem('userId')
      if (!currentUserId) return false

      const userId = parseInt(currentUserId)

      if (chat.owner_id && Number(chat.owner_id) === userId) {
        return true
      }

      if (chat.admins?.includes(userId)) {
        return true
      }

      if (chat.user_permissions) {
        return !!chat.user_permissions[permissionKey]
      }

      if (chat.users_permissions && userId in chat.users_permissions) {
        return !!chat.users_permissions[userId][permissionKey]
      }

      if (
        chat.group_config?.permissions &&
        userId in chat.group_config.permissions
      ) {
        return !!chat.group_config.permissions[userId][permissionKey]
      }

      if (chat.default_permissions) {
        return !!chat.default_permissions[permissionKey]
      }

      return false
    },
    [],
  )

  const sendGroupMessage = useCallback(
    async (
      groupId: string,
      groupName: string,
      text: string,
      file?: string | null,
      replyMessageId?: string | null,
      editMessageId?: string | null,
      expires?: number | null,
    ) => {
      if (!groupName || !text.trim()) return false

      console.log('Sending group message:', {
        groupName,
        text,
        file,
        replyMessageId,
        editMessageId,
        expires,
      })

      try {
        const messageId = await invoke<string>('send_group_message', {
          groupId,
          text: text.trim(),
          file,
          replyMessageId,
          editMessageId,
          expires,
        })

        // Check if the file is an image or another file type
        const isImageFile = file
          ? /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file)
          : false

        // Создаем временное сообщение, которое будет отображаться до получения обновления
        const tempMessage: Message = {
          message_id: messageId,
          chat_id: groupId,
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
          is_file: file ? !isImageFile : undefined, // Mark as file if it's not an image
        }
        // Добавляем сообщение локально
        setMessages((prev) => {
          // Проверяем, что prev[groupId] является массивом, перед использованием спред-оператора
          const existingMessages = Array.isArray(prev[groupId])
            ? prev[groupId]
            : []
          const updatedMessages = [...existingMessages, tempMessage]
          return {
            ...prev,
            [groupId]: updatedMessages,
          }
        })
        if (selectedChat?.chat_id === groupId) {
          setCurrentChatMessages((prev) => {
            // Убедимся, что prev является массивом
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
        console.error('Ошибка при отправке группового сообщения:', err)
        addToast({
          title: 'Ошибка',
          description: `Не удалось отправить групповое сообщение: ${err}`,
          color: 'danger',
          variant: 'flat',
        })
        return false
      }
    },
    [selectedChat, messages, currentChatMessages],
  )

  return {
    checkPermission,
    sendGroupMessage,
  }
}

export const loadGroups = async (props: BasicWindowProps) => {
  const { setGroups } = props
  try {
    // Здесь выполняем вызов API для загрузки групп
    const loadedGroups = await invoke<any[]>('get_groups')

    const formattedGroups = loadedGroups.map((group: any) => {
      const mediaUrl = createMediaUrl(group.avatar)
      const formattedGroup: Group = {
        chat_id: group.group_id,
        name: group.group_name,
        participants: group.members,
        last_message: group.last_message,
        unread_count: 0,
        description: group.description,
        avatar: mediaUrl,
        created_at: group.date,
        date: group.date,
        owner_id: group.owner_id,
        admins: group.admins,
        members: group.members,
        group_config: group.group_config || null, // используем fallback для отсутствующих полей
        user_permissions: group.user_permissions,
        users_permissions: group.users_permissions,
        default_permissions: group.default_permissions,
        loaded: false,
      }
      return formattedGroup
    }) as Group[]

    // Сортировка групп по времени последнего сообщения или дате создания
    formattedGroups.sort((a, b) => {
      // Получаем timestamp последнего сообщения для группы a
      const a_ts = Number(a.last_message?.timestamp || a.date || 0) // fallback to creation date

      // Получаем timestamp последнего сообщения для группы b
      const b_ts = Number(b.last_message?.timestamp || b.date || 0) // fallback to creation date

      // Сортировка по убыванию (новые сообщения/группы сверху)
      return b_ts - a_ts
    })

    if (loadedGroups) {
      setGroups(formattedGroups)
    }
    return formattedGroups
  } catch (err) {
    console.error('Ошибка при загрузке групп:', err)
    throw err
  }
}

export const loadGroupsMessages = async (
  group: Group,
  messages: Record<string, Message[]>,
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>,
) => {
  const userAccountId = safeLocalStorage.getItem('userId')
  const response = await invoke<any>('get_group_messages', {
    groupId: group.chat_id,
  })
  const formattedMessages: Message[] = response.messages.map((msg: any) => {
    const mediaUrl = createMediaUrl(msg.media_data)
    const isFile = !!msg.is_file // Explicitly check if it's a file
    return {
      message_id: msg.message_id?.toString() || '',
      chat_id: msg.chat_id?.toString() || group.chat_id,
      sender_id:
        msg.sender_id?.toString() === userAccountId ? 0 : msg.sender_id || 0,
      text: msg.text || msg.content || '',
      timestamp: msg.timestamp
        ? new Date(msg.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      is_read: true,
      is_sent: true,
      media_name: msg.media_name,
      media: mediaUrl, // сохраняем URL медиа здесь (или blob или data URL)
      reply_to: msg.reply_message_id || undefined,
      edited: msg.edit_date !== null,
      expires: msg.expires,
      is_file: isFile, // Use the is_file flag from the server
      media_id: msg.media_id, // Store the media_id for both files and images
      media_data: msg.media_data, // Сохраняем base64 данные отдельно
    }
  })

  const currentTempMessages =
    messages[group.chat_id]?.filter((m: Message) => !m.is_sent) || []

  const mergedMessages = [
    ...formattedMessages,
    ...currentTempMessages.filter(
      (tempMsg: Message) =>
        !formattedMessages.some((m) => m.message_id === tempMsg.message_id),
    ),
  ].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  setMessages((prev) => ({
    ...prev,
    [group.chat_id]: mergedMessages,
  }))

  return mergedMessages
}

export const getGroupDisplayKey = async (groupId: string) => {
  const response = await invoke<Uint8Array>('get_group_display_key', {
    groupId,
  })
  return response
}

export const inviteUserToGroup = async (
  groupId: string,
  userId: string | number,
  contacts: Record<number, User>,
  setContacts: React.Dispatch<React.SetStateAction<Record<number, User>>>,
) => {
  if (!groupId || !userId) return false

  try {
    // Convert userId to number if it's a string
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId

    await invoke('invite_to_group', {
      clientId: numericId,
      groupName: groupId,
    })

    //check if user in contacts
    const contact = contacts[numericId]
    if (!contact) {
      const contact = (await invoke('get_user_info', {
        userId: numericId,
      })) as User
      setContacts({
        ...contacts,
        [numericId]: contact,
      })
    }

    addToast({
      title: 'Успешно',
      description: 'Пользователь успешно приглашен в группу',
      color: 'success',
      variant: 'flat',
      endContent: (
        <Button size="sm" variant="flat" color="success">
          OK
        </Button>
      ),
    })
    return true
  } catch (err) {
    console.error('Ошибка при приглашении пользователя:', err)
    addToast({
      title: 'Ошибка',
      description: `Не удалось пригласить пользователя: ${err}`,
      color: 'danger',
      variant: 'flat',
    })
    return false
  }
}

export const removeUserFromGroup = async (groupId: string, userId: number) => {
  if (!groupId || !userId) return false

  try {
    const result = await invoke('remove_from_group', {
      userId,
      groupId,
    })

    if (!result) {
      addToast({
        title: 'Ошибка',
        description: 'Произошла ошибка при удалении пользователя',
        color: 'danger',
        variant: 'flat',
        endContent: (
          <Button size="sm" variant="flat" color="success">
            OK
          </Button>
        ),
      })
    }

    addToast({
      title: 'Успешно',
      description: 'Пользователь успешно удален из группы',
      color: 'success',
      variant: 'flat',
      endContent: (
        <Button size="sm" variant="flat" color="success">
          OK
        </Button>
      ),
    })
    return true
  } catch (err) {
    console.error('Ошибка при удалении пользователя:', err)
    addToast({
      title: 'Ошибка',
      description: `Не удалось удалить пользователя: ${err}`,
      color: 'danger',
      variant: 'flat',
    })
    return false
  }
}

export const updateGroupConfig = async (
  group: Group,
  settings: GroupSettings,
  tempName: string,
  tempDescription: string | undefined,
  avatarFilePath: string | null,
) => {
  try {
    await invoke('update_group_config', {
      groupId: group.chat_id,
      groupName: tempName,
      visibility: settings.visibility,
      joinMode: settings.join_mode,
      description: tempDescription,
      maxMembers: settings.max_members,
      slowModeDelay: settings.slow_mode_delay,
      allowStickers: settings.allow_stickers,
      allowGifs: settings.allow_gifs,
      allowVoiceMessages: settings.allow_voice_messages,
      allowVideoMessages: settings.allow_video_messages,
      allowMessages: settings.allow_messages,
      allowLinks: settings.allow_links,
      avatar: avatarFilePath, // Pass the avatar file path if it has been selected
    })
    addToast({
      title: 'Успешно',
      description: 'Конфигурация группы успешно обновлена',
      color: 'success',
      variant: 'flat',
    })
    return true
  } catch (err) {
    console.error('Ошибка при обновлении конфигурации группы:', err)
    addToast({
      title: 'Ошибка',
      description: `Не удалось обновить конфигурацию группы: ${err}`,
      color: 'danger',
      variant: 'flat',
    })
    return false
  }
}
