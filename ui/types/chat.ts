export interface AttachmentFile {
  path?: string
  name: string
  size: number
  type: string
  data?: Uint8Array
}

export interface MessageAction {
  type: 'edit' | 'reply' | 'delete'
  messageId: string
}

export interface MessageInput {
  text: string
  file?: AttachmentFile | null
  replyTo?: string | null
  editMessageId?: string | null
  expires?: number | null
}

export interface MessageContextMenuProps {
  x: number
  y: number
  messageId: string
  isSelf: boolean
  onAction: (action: MessageAction) => void
  onClose: () => void
}
