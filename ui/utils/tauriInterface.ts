import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// Пользовательский класс ошибок для операций Tauri
export class TauriError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TauriError'
  }
}

// Обертка для вызова команд Tauri с таймаутом
export const invokeWithTimeout = async <T>(
  command: string,
  args?: any,
  timeout = 30000,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TauriError(`Command ${command} timed out after ${timeout}ms`))
    }, timeout)

    invoke<T>(command, args)
      .then((result: T) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error: unknown) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

// Аутентификация
export const login = async (username: string): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('grpc_login', { username })
  } catch (error) {
    throw new TauriError(`Login failed: ${error}`)
  }
}

export const register = async (username: string): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('grpc_register', { username })
  } catch (error) {
    throw new TauriError(`Registration failed: ${error}`)
  }
}

export const logout = async (): Promise<void> => {
  try {
    await invokeWithTimeout<void>('log_out')
  } catch (error) {
    throw new TauriError(`Logout failed: ${error}`)
  }
}

// Управление сессией чата
export const startChatSession = async (): Promise<void> => {
  try {
    await invokeWithTimeout<void>('start_chat_session')
  } catch (error) {
    throw new TauriError(`Failed to start chat session: ${error}`)
  }
}

export const listenServerEvents = async (): Promise<void> => {
  try {
    await invokeWithTimeout<void>('listen_server_events')
  } catch (error) {
    throw new TauriError(`Failed to listen for server events: ${error}`)
  }
}

// Статус печати
export const sendTypingStatus = async (
  chatId: string,
  recipients: number[],
  isTyping: boolean,
): Promise<void> => {
  try {
    await invokeWithTimeout<void>('send_typing_status', {
      chatId,
      recipients,
      isTyping,
    })
  } catch (error) {
    throw new TauriError(`Failed to send typing status: ${error}`)
  }
}

export const sendGroupTypingStatus = async (
  groupName: string,
  recipients: number[],
  isTyping: boolean,
): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('send_group_typing_status', {
      groupName,
      recipients,
      isTyping,
    })
  } catch (error) {
    throw new TauriError(`Failed to send group typing status: ${error}`)
  }
}

// Запросы чата
export const sendChatRequest = async (receiverId: number): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('grpc_send_chat_request', {
      receiverId,
    })
  } catch (error) {
    throw new TauriError(`Failed to send chat request: ${error}`)
  }
}

export const sendChatAnswer = async (senderId: number): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('grpc_send_chat_answer', {
      senderId,
    })
  } catch (error) {
    throw new TauriError(`Failed to answer chat request: ${error}`)
  }
}

export const getChatRequests = async (): Promise<any[]> => {
  try {
    return await invokeWithTimeout<any[]>('get_chat_requests')
  } catch (error) {
    throw new TauriError(`Failed to get chat requests: ${error}`)
  }
}

// Получение данных
export const getUserData = async (): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('get_user_data')
  } catch (error) {
    throw new TauriError(`Failed to get user data: ${error}`)
  }
}

export const getChats = async (): Promise<any[]> => {
  try {
    return await invokeWithTimeout<any[]>('get_chats')
  } catch (error) {
    throw new TauriError(`Failed to get chats: ${error}`)
  }
}

export const getMessages = async (chatId: string): Promise<any[]> => {
  try {
    return await invokeWithTimeout<any[]>('get_messages', { chatId })
  } catch (error) {
    throw new TauriError(`Failed to get messages: ${error}`)
  }
}

// Сообщения
export const sendMessage = async (
  chatId: string,
  receiverId: number,
  text: string,
  file?: string | null,
  replyMessageId?: string | null,
  expires?: number | null,
  editMessageId?: string | null,
): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('send_message', {
      chatId,
      receiverId,
      text,
      file,
      reply_message_id: replyMessageId,
      expires,
      edit_message_id: editMessageId,
    })
  } catch (error) {
    throw new TauriError(`Failed to send message: ${error}`)
  }
}

export const deleteMessage = async (
  chatId: string,
  receiverId: number,
  messageId: number,
): Promise<void> => {
  try {
    await invokeWithTimeout<void>('delete_message', {
      chatId,
      receiverId,
      messageId,
    })
  } catch (error) {
    throw new TauriError(`Failed to delete message: ${error}`)
  }
}

// Группы
export const createGroup = async (groupName: string): Promise<any> => {
  try {
    console.log('createGroup', groupName)
    return await invokeWithTimeout<any>('create_group', { groupName })
  } catch (error) {
    throw new TauriError(`Failed to create group: ${error}`)
  }
}

export const getGroups = async (): Promise<any[]> => {
  try {
    return await invokeWithTimeout<any[]>('get_groups')
  } catch (error) {
    throw new TauriError(`Failed to get groups: ${error}`)
  }
}

export const inviteToGroup = async (
  clientId: number,
  groupName: string,
): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('invite_to_group', {
      clientId,
      groupName,
    })
  } catch (error) {
    throw new TauriError(`Failed to invite to group: ${error}`)
  }
}

export const removeFromGroup = async (
  userName: string,
  groupName: string,
): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('remove_from_group', {
      userName,
      groupName,
    })
  } catch (error) {
    throw new TauriError(`Failed to remove from group: ${error}`)
  }
}

export const sendGroupMessage = async (
  groupName: string,
  text: string,
  file?: string | null,
  replyMessageId?: string | null,
  editMessageId?: string | null,
  expires?: number | null,
): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('send_group_message', {
      groupName,
      text,
      file,
      reply_message_id: replyMessageId,
      edit_message_id: editMessageId,
      expires,
    })
  } catch (error) {
    throw new TauriError(`Failed to send group message: ${error}`)
  }
}

export const getGroupMessages = async (groupName: string): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('get_group_messages', { groupName })
  } catch (error) {
    throw new TauriError(`Failed to get group messages: ${error}`)
  }
}

export const deleteGroupMessage = async (
  groupName: string,
  messageId: number,
): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('delete_group_message', {
      groupName,
      messageId,
    })
  } catch (error) {
    throw new TauriError(`Failed to delete group message: ${error}`)
  }
}

// Медиа
export const fetchMediaData = async (mediaId: string): Promise<Uint8Array> => {
  try {
    return await invokeWithTimeout<Uint8Array>('fetch_media_data', { mediaId })
  } catch (error) {
    throw new TauriError(`Failed to fetch media data: ${error}`)
  }
}

export const downloadMediaFromDb = async (
  mediaId: string,
  fileName: string,
): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('download_media_from_db', {
      mediaId,
      fileName,
    })
  } catch (error) {
    throw new TauriError(`Failed to download media from database: ${error}`)
  }
}

export const getGroupMedia = async (
  mediaId: string,
  groupName?: string,
): Promise<Uint8Array> => {
  try {
    return await invokeWithTimeout<Uint8Array>('get_group_media', {
      mediaId,
      groupName,
    })
  } catch (error) {
    throw new TauriError(`Failed to get group media: ${error}`)
  }
}

export const getAllGroupMedia = async (groupName: string): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('get_all_group_media', { groupName })
  } catch (error) {
    throw new TauriError(`Failed to get all group media: ${error}`)
  }
}

// Кэш
export const clearMediaCache = async (): Promise<void> => {
  try {
    await invokeWithTimeout<void>('clear_media_cache')
  } catch (error) {
    throw new TauriError(`Failed to clear media cache: ${error}`)
  }
}

export const getMediaCacheSize = async (): Promise<number> => {
  try {
    return await invokeWithTimeout<number>('get_media_cache_size')
  } catch (error) {
    throw new TauriError(`Failed to get media cache size: ${error}`)
  }
}

export const clearGroupMediaCache = async (): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('clear_group_media_cache')
  } catch (error) {
    throw new TauriError(`Failed to clear group media cache: ${error}`)
  }
}

export const getGroupMediaCacheSize = async (): Promise<any> => {
  try {
    return await invokeWithTimeout<any>('get_group_media_cache_size')
  } catch (error) {
    throw new TauriError(`Failed to get group media cache size: ${error}`)
  }
}

// Аккаунты
export const getAccountList = async (): Promise<any[]> => {
  try {
    return await invokeWithTimeout<any[]>('get_account_list')
  } catch (error) {
    throw new TauriError(`Failed to get account list: ${error}`)
  }
}

export const deleteAccount = async (username: string): Promise<string> => {
  try {
    return await invokeWithTimeout<string>('delete_account', { username })
  } catch (error) {
    throw new TauriError(`Failed to delete account: ${error}`)
  }
}

// Слушатель событий сервера
export const subscribeToServerEvents = async (
  callback: (event: any) => void,
): Promise<() => void> => {
  const unsubscribe = await listen('server-event', (event: any) => {
    callback(event.payload)
  })

  return unsubscribe
}
