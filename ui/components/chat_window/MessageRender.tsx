'use client'

import { useState, useEffect, HTMLAttributes, memo } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import mermaid from 'mermaid'
import 'katex/dist/katex.min.css'
import { Image, Snippet } from '@heroui/react'
import React from 'react'
import { Message } from '@/hooks/Message'
import { AppearanceSettings } from '@/types/settings'
import { User } from '@/hooks/Contacts'
import { getContainerColor } from './Color'

// Инициализация конфигурации mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
})

// Компонент для рендеринга Mermaid диаграмм
export const MermaidRenderer = ({ content }: { content: string }) => {
  const [svgContent, setSvgContent] = useState<string>('')

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        mermaid.initialize({
          startOnLoad: true,
        })

        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, content)
        setSvgContent(svg)
      } catch (error) {
        console.error('Ошибка при рендеринге Mermaid диаграммы:', error)
        setSvgContent('')
      }
    }

    renderDiagram()
  }, [content])

  if (!svgContent) {
    return <div className="text-red-500">Ошибка диаграммы</div>
  }

  return (
    <div
      className="my-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

// Мемоизированный компонент для предотвращения ненужных ре-рендеров
export const ChatMessage = memo(
  ({
    message,
    getUserTextColor,
    handleContextMenu,
    handleImageClick,
    findMessageById,
    appearanceSettings,
    showSenderName = true,
    contacts = [],
  }: {
    message: Message
    getUserColor: (name: string) => string
    getUserTextColor: (name: string) => string
    handleContextMenu: (e: React.MouseEvent, id: string) => void
    handleImageClick: (mediaUrl: string) => void
    findMessageById: (messageId: string) => Message | undefined
    appearanceSettings: AppearanceSettings
    showSenderName?: boolean
    contacts?: Record<number, User>
  }) => {
    const replyToMessage = message.reply_to
      ? findMessageById(message.reply_to)
      : undefined

    // Найти имя контакта, если доступно
    const getSenderName = () => {
      if (message.sender_id === 0) return 'Вы'
      if (message.sender_name) return message.sender_name

      // Попытаться найти контакт по ID пользователя
      const contact = contacts[message.sender_id]
      if (contact) return contact.username

      // Если контакт не найден, использовать короткий идентификатор
      return `User ${message.sender_id}`
    }

    // Получить начальную букву для аватара
    const getSenderInitial = () => {
      if (message.sender_id === 0) return 'Y'
      if (message.sender_name)
        return message.sender_name.charAt(0).toUpperCase()

      const contact = contacts[message.sender_id]
      if (contact) return contact.username.charAt(0).toUpperCase()

      // Если имя недоступно, использовать первый символ ID сообщения
      return message.sender_id.toString().charAt(0).toUpperCase()
    }

    // Функция для прокрутки к оригинальному сообщению
    const scrollToOriginalMessage = (messageId: string | undefined) => {
      if (!messageId) return

      const originalMessage = document.getElementById(`message-${messageId}`)
      if (originalMessage) {
        originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Добавляем подсветку для выделения оригинального сообщения на короткое время
        originalMessage.classList.add('bg-primary/10')
        setTimeout(() => {
          originalMessage.classList.remove('bg-primary/10')
        }, 1500)
      }
    }

    const mediaUrl = message.media
    return (
      <div id={`message-${message.message_id}`} className="group">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`will-change-transform flex ${message.sender_id === 0 ? 'justify-end' : 'justify-start'} items-end space-x-2`}
        >
          {message.sender_id !== 0 && (
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-r shadow-sm"
              style={{
                backgroundImage: `linear-gradient(to right, ${getContainerColor(getSenderName())})`,
              }}
            >
              <span className="text-xs font-medium text-white">
                {getSenderInitial()}
              </span>
            </div>
          )}
          <div
            className={`relative max-w-[85%] ${message.sender_id === 0 ? 'order-1' : 'order-2'}`}
            onContextMenu={(e) => {
              e.preventDefault()
              handleContextMenu(e, message.message_id)
            }}
          >
            {message.sender_id !== 0 && showSenderName && (
              <div
                className="text-xs font-semibold mb-1"
                style={{ color: getUserTextColor(getSenderName()) }}
              >
                {getSenderName()}
              </div>
            )}
            <div
              className={`
            px-3 py-2 rounded-2xl shadow-sm relative min-w-[100px] ${message.edited ? 'min-w-[140px]' : ''}
            ${
              message.sender_id === 0
                ? 'bg-gradient-to-r from-primary to-accent text-white rounded-br-none'
                : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-none'
            }
          `}
            >
              {message.reply_to && replyToMessage && (
                <div
                  className="mb-2 border-l-2 border-l-primary pl-2 pt-1 pb-1.5 pr-2 rounded-lg bg-black/5 dark:bg-white/5 text-sm relative overflow-hidden cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={() => scrollToOriginalMessage(message.reply_to)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-primary dark:text-primary-400">
                      {replyToMessage.sender_id === 0
                        ? 'Вы'
                        : replyToMessage.sender_name ||
                          replyToMessage.sender_id}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5 text-primary dark:text-primary-400 opacity-70"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  </div>
                  <div className="truncate text-xs text-slate-700 dark:text-slate-300">
                    {replyToMessage.text}
                  </div>
                  {replyToMessage.media && !replyToMessage.is_file && (
                    <div className="absolute right-1 bottom-1 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-primary/70"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              )}
              {message.media_name && (
                <div className="mb-1.5">
                  {message.media === 'loading' ? (
                    <div className="text-sm text-gray-500">
                      Загрузка медиа...
                    </div>
                  ) : message.is_file ? (
                    // Отображение файла-вложения
                    <div className="border rounded-lg p-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                      <div className="bg-slate-200 dark:bg-slate-700 p-2 rounded">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-slate-700 dark:text-slate-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium truncate text-slate-700 dark:text-white">
                          {message.media_name || 'File'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {'Unknown size'}
                        </div>
                      </div>
                      <button
                        className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Загрузка файла с использованием media_id
                          if (mediaUrl) {
                            handleImageClick(mediaUrl)
                          } else {
                            console.error(
                              'Media ID and media are missing for file:',
                              message,
                            )
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    // Отображение изображения
                    <div
                      className="cursor-pointer"
                      onClick={() => {
                        console.log('Viewing image:', mediaUrl)
                        if (mediaUrl) {
                          handleImageClick(mediaUrl)
                        }
                      }}
                    >
                      <Image
                        isBlurred={true}
                        src={mediaUrl}
                        alt={message.media_name || 'Attachment'}
                        width={270}
                        className="rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}
              {/* Текстовое содержимое сообщения */}
              <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                {appearanceSettings.markdownEnabled ? (
                  <ReactMarkdown
                    remarkPlugins={[
                      remarkGfm,
                      ...(appearanceSettings.markdownMathEnabled
                        ? [remarkMath]
                        : []),
                    ]}
                    rehypePlugins={[
                      ...(appearanceSettings.markdownMathEnabled
                        ? [rehypeKatex]
                        : []),
                    ]}
                    components={{
                      code({
                        className,
                        children,
                        ...props
                      }: HTMLAttributes<HTMLElement>) {
                        const match = /language-(\w+)/.exec(className || '')
                        if (match && match[1] === 'mermaid') {
                          return <MermaidRenderer content={String(children)} />
                        }
                        return match ? (
                          <Snippet
                            hideCopyButton={false}
                            variant="flat"
                            color="secondary"
                            symbol={false}
                          >
                            <SyntaxHighlighter
                              {...props}
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </Snippet>
                        ) : (
                          <code {...props} className={className}>
                            {children}
                          </code>
                        )
                      },
                      a({ children, ...props }) {
                        return (
                          <a
                            className="text-primary underline"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          >
                            {children}
                          </a>
                        )
                      },
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  <div className="whitespace-pre-wrap">{message.text}</div>
                )}
              </div>

              {/* Отображение времени */}
              <div
                className={`
              text-xs text-right
              ${message.sender_id === 0 ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'} 
              flex items-center gap-0.5 justify-end mt-0.5 text-[10px]
            `}
              >
                <span>
                  {new Date(message.timestamp).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {message.edited && (
                  <span className="italic whitespace-nowrap">(изм.)</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Функция сравнения для предотвращения ненужных ре-рендеров
    return (
      prevProps.message.message_id === nextProps.message.message_id &&
      prevProps.message.text === nextProps.message.text &&
      prevProps.message.edited === nextProps.message.edited &&
      prevProps.message.media === nextProps.message.media &&
      prevProps.message.is_file === nextProps.message.is_file &&
      prevProps.appearanceSettings === nextProps.appearanceSettings &&
      prevProps.showSenderName === nextProps.showSenderName
    )
  },
)

// Установка displayName для компонента ChatMessage
ChatMessage.displayName = 'ChatMessage'

// Компонент для разделителей дат
export const DateSeparator = memo(({ date }: { date: string }) => {
  let displayText = ''
  const messageDate = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Обнуление времени для сравнения только дат
  today.setHours(0, 0, 0, 0)
  yesterday.setHours(0, 0, 0, 0)
  messageDate.setHours(0, 0, 0, 0)

  if (messageDate.getTime() === today.getTime()) {
    displayText = 'Сегодня'
  } else if (messageDate.getTime() === yesterday.getTime()) {
    displayText = 'Вчера'
  } else {
    displayText = messageDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full text-xs text-slate-600 dark:text-slate-300 font-medium">
        {displayText}
      </div>
    </div>
  )
})

// Установка displayName для компонента DateSeparator
DateSeparator.displayName = 'DateSeparator'

// Вспомогательная функция для проверки, одинаковые ли даты
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}
