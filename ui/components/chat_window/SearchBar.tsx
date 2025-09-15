import { useState, useRef, useEffect, useCallback } from 'react'
import {
  FiSearch,
  FiX,
  FiChevronUp,
  FiChevronDown,
  FiFilter,
} from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import { Message } from '@/hooks/Message'
import {
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from '@heroui/react'

interface ParsedQuery {
  mainQuery: string
  from?: string
  has?: string
  before?: string
  during?: string
  after?: string
}

const parseSearchQuery = (query: string): ParsedQuery => {
  const parsed: ParsedQuery = { mainQuery: '' }
  const parts = query
    .split(/ +(?=(?:(?:[^"]*"){2})*[^"]*$)/g)
    .map((part) => part.replace(/"/g, ''))
  const mainQueryParts: string[] = []

  for (const part of parts) {
    if (part.includes(':')) {
      const [key, ...valueParts] = part.split(':')
      const value = valueParts.join(':')

      if (value) {
        switch (key.toLowerCase()) {
          case 'from':
            parsed.from = value
            continue
          case 'has':
            parsed.has = value
            continue
          case 'before':
            parsed.before = value
            continue
          case 'during':
            parsed.during = value
            continue
          case 'after':
            parsed.after = value
            continue
        }
      }
    }
    mainQueryParts.push(part)
  }

  parsed.mainQuery = mainQueryParts.join(' ').toLowerCase().trim()
  return parsed
}

interface SearchBarProps {
  isSearchOpen: boolean
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  currentChatMessages: Message[]
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
}

export default function SearchBar({
  isSearchOpen,
  setIsSearchOpen,
  currentChatMessages,
  messagesContainerRef,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<
    { messageId: string; index: number }[]
  >([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleFilterSelect = (key: string) => {
    setSearchQuery((prev) => {
      const trimmedPrev = prev.trim()
      const newQuery = trimmedPrev ? `${trimmedPrev} ${key}` : key
      return newQuery
    })
    searchInputRef.current?.focus()
  }

  // Мемоизируем функцию поиска сообщения по ID
  const findMessageById = useCallback(
    (messageId: string) => {
      return currentChatMessages.find((msg) => msg.message_id === messageId)
    },
    [currentChatMessages],
  )

  // Функция для прокрутки к найденному результату
  const scrollToSearchResult = useCallback(
    (messageId: string) => {
      const messageElement = document.getElementById(`message-${messageId}`)
      if (messageElement && messagesContainerRef.current) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Добавляем анимацию подсветки
        messageElement.classList.add('search-highlighted')
        setTimeout(() => {
          messageElement.classList.remove('search-highlighted')
        }, 1500)
      }
    },
    [messagesContainerRef],
  )

  // Переключение состояния поиска
  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      const newState = !prev
      if (newState) {
        // Добавляем небольшую задержку, чтобы убедиться, что поисковая панель отрендерена
        setTimeout(() => {
          searchInputRef.current?.focus()
        }, 100)
      } else {
        setSearchQuery('')
        setSearchResults([])
        setCurrentSearchIndex(0)
      }
      return newState
    })
  }, [setIsSearchOpen])

  // Выполнение поиска
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const { mainQuery, from, has, before, after, during } =
      parseSearchQuery(searchQuery)

    const results = currentChatMessages
      .filter((message) => {
        // Фильтр 'from'
        if (from) {
          const fromLower = from.toLowerCase()
          const senderName = message.sender_name?.toLowerCase() || ''
          const senderId = message.sender_id.toString()
          if (
            !senderName.includes(fromLower) &&
            !senderId.includes(fromLower)
          ) {
            return false
          }
        }

        // Фильтр 'has'
        if (has) {
          const hasLower = has.toLowerCase()
          if (hasLower === 'link') {
            const linkRegex = /https?:\/\/[^\s/$.?#].[^\s]*/i
            if (!linkRegex.test(message.text)) return false
          } else if (hasLower === 'file') {
            if (!message.is_file) return false
          }
        }

        // Фильтры по дате
        if (before || after || during) {
          const messageDate = new Date(message.timestamp)
          // Игнорируем фильтр, если дата сообщения невалидна
          if (isNaN(messageDate.getTime())) return true

          if (before) {
            const beforeDate = new Date(before)
            if (!isNaN(beforeDate.getTime())) {
              beforeDate.setHours(0, 0, 0, 0)
              if (messageDate >= beforeDate) return false
            }
          }

          if (after) {
            const afterDate = new Date(after)
            if (!isNaN(afterDate.getTime())) {
              afterDate.setHours(23, 59, 59, 999)
              if (messageDate <= afterDate) return false
            }
          }

          if (during) {
            const duringDate = new Date(during)
            if (!isNaN(duringDate.getTime())) {
              const messageDay = messageDate.toISOString().split('T')[0]
              const duringDay = duringDate.toISOString().split('T')[0]
              if (messageDay !== duringDay) return false
            }
          }
        }

        return true // Пройдено
      })
      .map((message, index) => {
        // Если нет основного запроса, все отфильтрованные сообщения являются результатами
        if (!mainQuery) {
          return { messageId: message.message_id, index }
        }

        // Поиск в тексте сообщения
        const textMatch = message.text.toLowerCase().includes(mainQuery)

        // Поиск в имени отправителя
        const senderNameMatch = message.sender_name
          ? message.sender_name.toLowerCase().includes(mainQuery)
          : message.sender_id.toString().includes(mainQuery)

        // Поиск в тексте ответа
        let replyMatch = false
        if (message.reply_to) {
          const replyMessage = findMessageById(message.reply_to)
          if (replyMessage) {
            replyMatch = replyMessage.text.toLowerCase().includes(mainQuery)
          }
        }

        if (textMatch || senderNameMatch || replyMatch) {
          return { messageId: message.message_id, index }
        }
        return null
      })
      .filter(
        (result): result is { messageId: string; index: number } =>
          result !== null,
      )

    setSearchResults(results)
    setCurrentSearchIndex(results.length > 0 ? 0 : -1)

    // Прокрутка к первому результату, если они есть
    if (results.length > 0) {
      scrollToSearchResult(results[0].messageId)
    }
  }, [searchQuery, currentChatMessages, findMessageById, scrollToSearchResult])

  // Переход к следующему результату поиска
  const handleNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return

    const newIndex = (currentSearchIndex + 1) % searchResults.length
    setCurrentSearchIndex(newIndex)
    scrollToSearchResult(searchResults[newIndex].messageId)
  }, [searchResults, currentSearchIndex, scrollToSearchResult])

  // Переход к предыдущему результату поиска
  const handlePrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return

    const newIndex =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length
    setCurrentSearchIndex(newIndex)
    scrollToSearchResult(searchResults[newIndex].messageId)
  }, [searchResults, currentSearchIndex, scrollToSearchResult])

  // Обновление результатов поиска при изменении поискового запроса
  useEffect(() => {
    // Поиск только если есть запрос и поиск открыт
    if (searchQuery && isSearchOpen) {
      handleSearch()
    }
  }, [searchQuery, isSearchOpen, handleSearch])

  // Добавление глобальных стилей для анимации подсветки результатов поиска
  useEffect(() => {
    // Добавление глобального стиля для подсветки поиска
    const style = document.createElement('style')
    style.innerHTML = `
      .search-highlighted {
        animation: highlight-pulse 1.5s ease-in-out;
      }
      
      @keyframes highlight-pulse {
        0%, 100% {
          background-color: transparent;
        }
        50% {
          background-color: rgba(0, 99, 175, 0.2);
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Обработка горячих клавиш для поиска
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F или Cmd+F для открытия поиска
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        handleToggleSearch()
        return
      }
      if (e.key === 'Escape' && isSearchOpen) {
        e.preventDefault()
        handleToggleSearch()
      }

      // F3 или Enter для перехода к следующему результату
      if (
        (e.key === 'F3' ||
          (isSearchOpen && e.key === 'Enter' && !e.shiftKey)) &&
        searchResults.length > 0
      ) {
        e.preventDefault()
        handleNextSearchResult()
      }

      // Shift+F3 или Shift+Enter для перехода к предыдущему результату
      if (
        (e.key === 'F3' && e.shiftKey) ||
        (isSearchOpen && e.key === 'Enter' && e.shiftKey)
      ) {
        e.preventDefault()
        handlePrevSearchResult()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    isSearchOpen,
    searchResults,
    currentSearchIndex,
    handleNextSearchResult,
    handlePrevSearchResult,
    handleToggleSearch,
  ])

  return (
    <AnimatePresence mode="wait">
      {isSearchOpen && (
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: -10,
            scale: 0.98,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 1,
          }}
          className="absolute top-0 left-0 right-0 px-4 py-2 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-600 flex items-center gap-2 z-30 shadow-sm"
        >
          <div className="flex-1 flex items-center gap-1">
            <Input
              startContent={
                <FiSearch className="text-slate-500 dark:text-slate-400 transition-colors duration-200" />
              }
              ref={searchInputRef}
              type="text"
              variant="bordered"
              color="primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  // Если поиск уже выполнен, переходим к следующему результату, иначе выполняем поиск
                  if (searchResults.length > 0 || searchQuery === '') {
                    handleNextSearchResult()
                  } else {
                    handleSearch()
                  }
                }
                if (e.key === 'Enter' && e.shiftKey) handlePrevSearchResult()
                if (e.key === 'Escape') handleToggleSearch()
              }}
              placeholder="Поиск... from:user has:link after:YYYY-MM-DD"
            />
            <Dropdown>
              <DropdownTrigger>
                <Button
                  isIconOnly
                  variant="light"
                  className="p-1 rounded-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors duration-200"
                >
                  <FiFilter size={16} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Фильтры поиска"
                onAction={(key) => handleFilterSelect(key as string)}
              >
                <DropdownItem key="from:" description="Поиск по автору">
                  from:
                </DropdownItem>
                <DropdownItem
                  key="has:link"
                  description="Сообщения, содержащие ссылки"
                >
                  has:link
                </DropdownItem>
                <DropdownItem
                  key="has:file"
                  description="Сообщения, содержащие файлы"
                >
                  has:file
                </DropdownItem>
                <DropdownItem
                  key="after:"
                  description="Отправленные после ГГГГ-ММ-ДД"
                >
                  after:
                </DropdownItem>
                <DropdownItem
                  key="before:"
                  description="Отправленные до ГГГГ-ММ-ДД"
                >
                  before:
                </DropdownItem>
                <DropdownItem
                  key="during:"
                  description="Отправленные в день ГГГГ-ММ-ДД"
                >
                  during:
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSearchQuery('')}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors duration-200"
              >
                <FiX size={16} />
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-500 dark:text-slate-400 min-w-12 text-center"
            >
              {searchResults.length > 0
                ? `${currentSearchIndex + 1}/${searchResults.length}`
                : searchQuery
                  ? 'Не найдено'
                  : ''}
            </motion.span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrevSearchResult}
              disabled={searchResults.length === 0}
              className={`p-1 rounded-full transition-colors duration-200 ${
                searchResults.length === 0
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
              title="Предыдущий результат (Shift+Enter)"
            >
              <FiChevronUp size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNextSearchResult}
              disabled={searchResults.length === 0}
              className={`p-1 rounded-full transition-colors duration-200 ${
                searchResults.length === 0
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
              title="Следующий результат (Enter)"
            >
              <FiChevronDown size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToggleSearch}
              className="p-1 rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors duration-200"
              title="Закрыть поиск (Esc)"
            >
              <FiX size={18} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
