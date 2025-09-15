;`use client`
import { safeLocalStorage } from '@/utils/safeLocalStorage'
import { invoke } from '@tauri-apps/api/core'

export interface User {
  user_id: number
  username: string
  last_seen: string
  is_online: boolean
  avatar?: string
}

export interface ContactProps {
  contacts: User[]
  setContacts: (contacts: User[]) => void
}

export const loadContacts = async (
  setContacts: (contacts: Record<number, User>) => void,
) => {
  try {
    const storedUserId = Number(safeLocalStorage.getItem('userId'))
    const storedUsername = safeLocalStorage.getItem('username')
    const result = await invoke<User[]>('get_contacts')

    const subscribe_to_users: number[] = []

    // Первый проход - подготовка данных и сбор user_id
    result.forEach((contact) => {
      if (contact.avatar === 'no-image') {
        contact.avatar = undefined
      }
      if (contact.user_id == storedUserId) {
        return
      }
      subscribe_to_users.push(Number(contact.user_id))
    })

    result.push({
      user_id: storedUserId || 0,
      username: storedUsername || 'You',
      is_online: true,
      last_seen: new Date().toISOString(),
      avatar: '',
    })

    const record: Record<number, User> = {}
    result.forEach((contact) => {
      record[contact.user_id] = contact
    })

    setContacts(record)

    await invoke('subscribe_to_users', { userIds: subscribe_to_users })

    return record
  } catch (error) {
    console.error('Error loading contacts:', error)
    return {}
  }
}

export const getUsernameFromId = (
  userId: number,
  contacts: Record<number, User>,
  setContacts: React.Dispatch<React.SetStateAction<Record<number, User>>>,
) => {
  const contact = contacts[userId]
  if (contact) {
    return contact.username
  } else {
    ;async () => {
      const userInfo: User = await invoke('get_user_info', { userId: userId })
      setContacts((prev: Record<number, User>) => {
        prev[userId] = userInfo
        return prev
      })
      console.log(userInfo)
    }
    return userId.toString()
  }
}

export const getUserFromId = (
  userId: number,
  contacts: Record<number, User>,
) => {
  const contact = contacts[userId]
  if (contact) {
    return contact
  }
  const defaultUser: User = {
    username: userId.toString(),
    avatar: '',
    is_online: false,
    last_seen: new Date().toISOString(),
    user_id: userId,
  }
  return defaultUser
}
