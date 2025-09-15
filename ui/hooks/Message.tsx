export interface Message {
  message_id: string
  chat_id: string
  sender_id: number
  text: string
  timestamp: string
  is_read: boolean
  is_sent: boolean
  sender_name?: string
  media_name?: string
  media?: string
  reply_to?: string
  edited: boolean
  expires?: number
  is_file?: boolean
}
