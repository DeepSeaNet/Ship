'use client'

import {
  FiMenu,
  FiInfo,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiArrowLeft,
  FiSettings,
  FiAnchor,
} from 'react-icons/fi'
import { Chat } from '@/hooks/Chat'
import { useEffect, useState } from 'react'
import GroupSettingsModal from './settings/GroupSettingsModal'
import { Group } from '@/hooks/Group'
import { isGroup } from '@/hooks/Group'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { User } from '@/hooks/Contacts'
import { Message } from '@/hooks/Message'
import { Avatar } from '@heroui/react'
interface HeaderProps {
  toggleMobileMenu: () => void
  toggleRightPanel: () => void
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  isLeftSidebarVisible: boolean
  isRightPanelVisible: boolean
  selectedChat: Group | Chat | null
  isMobile?: boolean
  contacts: Record<number, User>
  messages: Record<string, Message[]>
}

export default function Header({
  toggleMobileMenu,
  toggleRightPanel,
  toggleLeftSidebar,
  toggleRightSidebar,
  isLeftSidebarVisible,
  isRightPanelVisible,
  selectedChat,
  isMobile = false,
  contacts,
  messages,
}: HeaderProps) {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const openSettingsModal = () => {
    if (selectedChat) {
      setIsSettingsModalOpen(true)
    }
  }

  useEffect(() => {
    const updateWindowTitle = async () => {
      try {
        const window = getCurrentWindow()

        if (selectedChat) {
          // Use chat name for window title
          await window.setTitle(`SHIP - ${selectedChat.name}`)
        } else {
          // Default title when no chat is selected
          await window.setTitle('SHIP - Secure Hidden Internet Protocol')
        }
      } catch (error) {
        console.error('Failed to update window title:', error)
      }
    }

    updateWindowTitle()
  }, [selectedChat])

  return (
    <>
      <header className="h-12 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 bg-white dark:bg-slate-800 transition-colors fixed md:relative top-0 left-0 right-0 z-50 md:z-auto">
        {' '}
        {/* Добавлено: relative z-40 */}
        <div className="flex-1 flex items-center">
          {/* Кнопка назад на мобильных устройствах когда выбран чат */}
          {isMobile && selectedChat ? (
            <button
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mr-2"
              onClick={toggleMobileMenu}
              aria-label="Вернуться к чатам"
            >
              <FiArrowLeft className="h-6 w-6" />
            </button>
          ) : (
            /* Стандартная кнопка меню для мобильных */
            <button
              className={`${isMobile ? '' : 'md:hidden'} p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mr-2`}
              onClick={toggleMobileMenu}
              aria-label="Переключить меню"
            >
              <FiMenu className="h-5 w-5" />
            </button>
          )}

          {/* Desktop left sidebar toggle */}
          <button
            className="hidden md:flex p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mr-2"
            onClick={toggleLeftSidebar}
            aria-label={
              isLeftSidebarVisible
                ? 'Скрыть боковую панель'
                : 'Показать боковую панель'
            }
            title={
              isLeftSidebarVisible
                ? 'Скрыть боковую панель'
                : 'Показать боковую панель'
            }
          >
            {isLeftSidebarVisible ? (
              <FiChevronLeft className="h-5 w-5" />
            ) : (
              <FiChevronRight className="h-5 w-5" />
            )}
          </button>

          {/* App logo/title */}

          <div className="flex items-center">
            <Avatar
              src={selectedChat?.avatar}
              size="sm"
              isBordered
              radius="sm"
              fallback={
                <div className="container-gradient rounded-lg h-10 w-10 flex items-center justify-center text-white font-bold relative overflow-hidden">
                  <FiAnchor className="h-4 w-4" />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/20 animate-wave"></div>
                </div>
              }
            />
          </div>
        </div>
        {/* Center section - chat title для мобильных или поиск для десктопа */}
        <div
          className={`${isMobile && selectedChat ? 'flex' : 'hidden'} md:flex flex-1 justify-center`}
        >
          {selectedChat ? (
            <div className="font-medium text-lg animate-fade-in flex items-center truncate max-w-[200px]">
              <div className="h-2 w-2 rounded-full bg-green-500 mr-2 flex-shrink-0"></div>
              <span className="truncate">{selectedChat.name}</span>
            </div>
          ) : null}
        </div>
        {/* Right actions */}
        <div className="flex-1 flex justify-end items-center space-x-2">
          {/* Settings button - показываем только если выбран чат */}
          {selectedChat && (
            <button
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              onClick={openSettingsModal}
              aria-label="Настройки группы"
              title="Настройки группы"
            >
              <FiSettings className="h-5 w-5" />
            </button>
          )}

          {/* Desktop right panel toggle */}
          <button
            className="hidden md:flex p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={toggleRightSidebar}
            aria-label={
              isRightPanelVisible
                ? 'Скрыть боковую панель'
                : 'Показать боковую панель'
            }
            title={
              isRightPanelVisible
                ? 'Скрыть информационную панель'
                : 'Показать информационную панель'
            }
          >
            {isRightPanelVisible ? (
              <FiChevronRight className="h-5 w-5" />
            ) : (
              <FiChevronLeft className="h-5 w-5" />
            )}
          </button>

          {/* Info panel toggle (mobile) - показываем только если выбран чат */}
          {(isMobile && selectedChat) || !isMobile ? (
            <button
              className={`${isMobile ? '' : 'md:hidden'} p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}
              onClick={toggleRightPanel}
              aria-label="Открыть информационную панель"
            >
              <FiInfo className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </header>

      {/* Модальное окно настроек группы */}
      {selectedChat && isGroup(selectedChat) && (
        <GroupSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          group={selectedChat}
          isMobile={isMobile}
          contacts={contacts}
          messages={messages}
        />
      )}
    </>
  )
}
