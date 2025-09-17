import { useState, useRef, useEffect, useCallback } from 'react'
import {
  FiSend,
  FiPaperclip,
  FiEdit,
  FiX,
  FiCornerUpLeft,
} from 'react-icons/fi'
import { useSettingsStore } from '../stores/settingsStore'
import { AttachmentFile } from '../types/chat'
import { open } from '@tauri-apps/plugin-dialog'
import { Message } from '@/hooks/Message'
import { Alert, Button, Textarea } from '@heroui/react'
import { Group } from '@/hooks/Group'
import { Chat } from '@/hooks/Chat'
import { invoke } from '@tauri-apps/api/core'

interface InputBarProps {
  currentChatMessages: Message[]
  inputValue: string
  setInputValue: React.Dispatch<React.SetStateAction<string>>
  replyingTo: string | null
  setReplyingTo: React.Dispatch<React.SetStateAction<string | null>>
  editingMessage: string | null
  setEditingMessage: React.Dispatch<React.SetStateAction<string | null>>
  handleSendMessage: () => Promise<void>
  attachment: AttachmentFile | null
  setAttachment: React.Dispatch<React.SetStateAction<AttachmentFile | null>>
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  canSendMessages?: boolean
  isMobile?: boolean
  selectedChat?: Chat | Group | null | undefined
}

export default function InputBar({
  currentChatMessages,
  inputValue,
  setInputValue,
  replyingTo,
  setReplyingTo,
  editingMessage,
  setEditingMessage,
  handleSendMessage,
  selectedChat,
  attachment,
  setAttachment,
  inputRef: externalInputRef,
  canSendMessages = true,
}: InputBarProps) {
  const { appearanceSettings } = useSettingsStore()
  const [isUploading, setIsUploading] = useState(false)
  const [formatMenuPosition, setFormatMenuPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [isTyping, setIsTyping] = useState(false)

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const internalInputRef = useRef<HTMLTextAreaElement>(null)
  const formatMenuRef = useRef<HTMLDivElement>(null)
  const textareaHeight = useRef<number>(0)

  // Use externally provided ref or fallback to internal
  const inputRef = externalInputRef || internalInputRef

  // Reset the textarea height when input changes or after sending a message
  useEffect(() => {
    if (inputValue === '' && inputRef.current) {
      inputRef.current.style.height = 'auto'
      textareaHeight.current = 0
    }
  }, [inputValue, inputRef])

  // Обработка статуса набора текста
  const handleTypingStatus = useCallback(
    (newValue: string) => {
      if (!selectedChat || !canSendMessages) return
      if (selectedChat.chat_id && selectedChat.participants.length > 0) {
        if (newValue.trim() !== '' && !isTyping) {
          // Пользователь начал печатать
          setIsTyping(true)
          invoke('send_typing_status', {
            chatId: String(selectedChat.chat_id),
            status: 'TYPING',
            subscribers: selectedChat.participants,
          }).catch(console.error)
        }

        // Сбрасываем предыдущий таймер
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }

        // Устанавливаем новый таймер для отправки статуса "stopped typing"
        typingTimeoutRef.current = setTimeout(() => {
          if (isTyping) {
            setIsTyping(false)
            invoke('send_typing_status', {
              chatId: String(selectedChat.chat_id),
              status: 'NOT_TYPING',
              subscribers: selectedChat.participants,
            }).catch(console.error)
          }
        }, 3000) // Стандартный таймаут 3 секунды
      }
    },
    [selectedChat, canSendMessages, isTyping],
  )

  // Обработка изменения текста с учетом статуса набора
  const handleInputChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue)
      handleTypingStatus(newValue)
    },
    [setInputValue, handleTypingStatus],
  )

  // Optimize click outside handler with debounce
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        formatMenuRef.current &&
        !formatMenuRef.current.contains(event.target as Node)
      ) {
        setFormatMenuPosition(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cleanup typing timeout on unmount or chat change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)

        // Отправляем статус "stopped typing" при смене чата или размонтировании компонента
        if (isTyping && selectedChat) {
          if (selectedChat.chat_id && selectedChat.participants.length > 0) {
            invoke('send_typing_status', {
              chatId: String(selectedChat.chat_id),
              status: 'NOT_TYPING',
              subscribers: selectedChat.participants,
            }).catch(console.error)
          }
        }
      }
    }
  }, [selectedChat, isTyping])

  const handleFileSelect = useCallback(async () => {
    try {
      console.log(isUploading)
      setIsUploading(true)
      const selected = await open({
        multiple: false,
      })

      if (selected) {
        // Convert to AttachmentFile type
        const file: AttachmentFile = {
          path: selected as string,
          name: (selected as string).split('\\').pop() || 'unknown',
          size: 0, // Will be set when reading file
          type: (selected as string).split('.').pop() || 'unknown',
        }
        setAttachment(file)
      }
    } catch (error) {
      console.error('File selection failed:', error)
    } finally {
      setIsUploading(false)
    }
  }, [setAttachment])

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
      if (e.key === 'Escape') {
        setReplyingTo(null)
        setEditingMessage(null)
      }

      // Горячие клавиши для форматирования Markdown
      if (appearanceSettings.markdownEnabled && e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault()
            handleFormatAction('bold')
            break
          case 'i':
            e.preventDefault()
            handleFormatAction('italic')
            break
          case 'k':
            e.preventDefault()
            handleFormatAction('link')
            break
          case 'e':
            e.preventDefault()
            handleFormatAction('code')
            break
        }
      }
    },
    [
      appearanceSettings.markdownEnabled,
      handleSendMessage,
      setReplyingTo,
      setEditingMessage,
      inputRef,
    ],
  )

  // Optimize context menu handler
  const handleInputContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!appearanceSettings.markdownEnabled) return

      // Предотвращаем стандартное контекстное меню браузера
      e.preventDefault()

      // Устанавливаем позицию меню форматирования
      setFormatMenuPosition({ x: e.clientX, y: e.clientY })
    },
    [appearanceSettings.markdownEnabled],
  )

  // Функции для вставки Markdown-разметки
  const insertMarkdown = useCallback(
    (prefix: string, suffix = '') => {
      if (!inputRef.current) return

      const { selectionStart, selectionEnd } = inputRef.current
      const selectedText = inputRef.current.value.substring(
        selectionStart,
        selectionEnd,
      )
      const beforeText = inputRef.current.value.substring(0, selectionStart)
      const afterText = inputRef.current.value.substring(selectionEnd)

      const newValue = `${beforeText}${prefix}${selectedText}${suffix}${afterText}`
      setInputValue(newValue)

      // Устанавливаем таймаут, чтобы дать React время обновить компонент
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.selectionStart = selectionStart + prefix.length
          inputRef.current.selectionEnd = selectionEnd + prefix.length
        }
      }, 0)
    },
    [setInputValue],
  )

  const handleFormatAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'bold':
          insertMarkdown('**', '**')
          break
        case 'italic':
          insertMarkdown('*', '*')
          break
        case 'code':
          insertMarkdown('`', '`')
          break
        case 'link':
          // Get selected text or use default
          const selectedText =
            inputRef.current?.value.substring(
              inputRef.current.selectionStart,
              inputRef.current.selectionEnd,
            ) || 'ссылка'

          if (selectedText) {
            insertMarkdown('[', '](https://)')
          } else {
            insertMarkdown('[ссылка](https://)')
          }
          break
        case 'codeBlock':
          insertMarkdown('```\n', '\n```')
          break
        case 'math':
          insertMarkdown('$', '$')
          break
        case 'mathBlock':
          insertMarkdown('$$\n', '\n$$')
          break
        case 'list':
          insertMarkdown('- ')
          break
        case 'orderedList':
          insertMarkdown('1. ')
          break
        case 'checkbox':
          insertMarkdown('- [ ] ')
          break
        case 'mermaid':
          insertMarkdown(
            '```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n    B-->D;\n    C-->D;\n',
            '\n```',
          )
          break
        case 'table':
          insertMarkdown(
            '| Заголовок 1 | Заголовок 2 |\n| --- | --- |\n| Ячейка 1 | Ячейка 2 |\n| Ячейка 3 | Ячейка 4 |',
          )
          break
      }
      setFormatMenuPosition(null)
    },
    [insertMarkdown],
  )

  const SendButton = () => {
    return (
      <Button
        variant="flat"
        isIconOnly
        color="primary"
        size="sm"
        className="rounded-full"
        onPress={handleSendMessage}
      >
        <FiSend className="w-5 h-5" />
      </Button>
    )
  }

  const AttachmentButton = () => {
    return (
      <Button
        variant="flat"
        isIconOnly
        color="primary"
        size="sm"
        className="rounded-full"
        onPress={handleFileSelect}
      >
        <FiPaperclip className="w-5 h-5" />
      </Button>
    )
  }
  return (
    <>
      {/* Панель ответа на сообщение */}
      {replyingTo && canSendMessages && (
        <div
          className="mx-auto px-1 py-2 max-w-8/10"
          style={{
            animation: 'slideInFromTop 0.3s ease-out',
          }}
        >
          <Alert
            color="primary"
            variant="flat"
            icon={<FiCornerUpLeft className="w-5 h-5" />}
            title="Ответ"
            description={
              currentChatMessages.find((m) => m.message_id === replyingTo)?.text
            }
            endContent={
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setReplyingTo(null)}
                aria-label="Закрыть"
                className="hover:scale-110 transition-transform duration-200"
              >
                <FiX className="w-4 h-4" />
              </Button>
            }
            classNames={{
              base: 'backdrop-blur-sm transition-all duration-300 hover:scale-105',
              description: 'truncate',
            }}
          />
        </div>
      )}

      {attachment && canSendMessages && (
        <div
          className="mx-auto px-1 py-2 max-w-8/10"
          style={{
            animation: 'slideInFromTop 0.3s ease-out 0.1s both',
          }}
        >
          <Alert
            color="success"
            variant="flat"
            icon={<FiPaperclip className="w-5 h-5" />}
            title="Файл"
            description={attachment.name}
            endContent={
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setAttachment(null)}
                aria-label="Отменить добавление файла"
                className="hover:scale-110 transition-transform duration-200"
              >
                <FiX className="w-4 h-4" />
              </Button>
            }
            classNames={{
              base: 'backdrop-blur-sm transition-all duration-300 hover:scale-105',
              description: 'truncate',
            }}
          />
        </div>
      )}

      {editingMessage && canSendMessages && (
        <div
          className="mx-auto px-1 py-2 max-w-8/10"
          style={{
            animation: 'slideInFromTop 0.3s ease-out 0.2s both',
          }}
        >
          <Alert
            color="warning"
            variant="flat"
            icon={<FiEdit className="w-5 h-5" />}
            title="Редактирование"
            description={
              currentChatMessages.find((m) => m.message_id === editingMessage)
                ?.text
            }
            endContent={
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setEditingMessage(null)}
                aria-label="Отменить редактирование"
                className="hover:scale-110 transition-transform duration-200"
              >
                <FiX className="w-4 h-4" />
              </Button>
            }
            classNames={{
              base: 'backdrop-blur-sm transition-all duration-300 hover:scale-105',
              description: 'truncate',
            }}
          />
        </div>
      )}

      {/* Основной input с улучшенным отступом и safe-area на iOS */}
      <div
        className="px-1 pb-1 md:pb-0"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))',
        }}
      >
        {' '}
        {/* Добавлено: pb-2 для мобильных */}
        <Textarea
          ref={inputRef}
          variant="faded"
          color="primary"
          size="sm"
          value={inputValue}
          onValueChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onContextMenu={handleInputContextMenu}
          placeholder={
            !canSendMessages
              ? 'У вас нет прав для отправки сообщений'
              : editingMessage
                ? 'Редактировать сообщение...'
                : 'Написать сообщение...'
          }
          style={{
            fontSize: `${appearanceSettings.fontSize}px`,
            //lineHeight: appearanceSettings.lineSpacing
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          disabled={!canSendMessages}
          endContent={<SendButton />}
          startContent={<AttachmentButton />}
        />
      </div>

      {/* Информационное сообщение, если нет прав */}
      {!canSendMessages && (
        <div className="text-center py-2 px-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/30">
          У вас нет прав для отправки сообщений в этот чат
        </div>
      )}
    </>
  )
}
