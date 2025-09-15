'use client'

import { useState, Fragment, useEffect } from 'react'
import { useTheme } from '../ThemeProvider'
import { motion } from 'framer-motion'
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
} from '@headlessui/react'
import {
  FiSettings,
  FiHardDrive,
  FiX,
  FiLogOut,
  FiTrash2,
  FiMoon,
  FiSun,
  FiChevronRight,
  FiShield,
  FiBell,
  FiGlobe,
  FiMonitor,
  FiFileText,
  FiKey,
  FiArrowLeft,
  FiUser,
} from 'react-icons/fi'
import { useSettingsStore } from '../../stores/settingsStore'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'react-hot-toast'
import { AppearanceSettings } from '@/types/settings'
import AccountSettings from './AccountSettings'

// Modal для подтверждения действий
interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onCancel}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 shadow-xl transition-all">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {message}
                  </p>
                </div>
                <div className="flex border-t border-slate-200 dark:border-slate-700">
                  <button
                    className="flex-1 p-4 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={onCancel}
                  >
                    Отмена
                  </button>
                  <button
                    className="flex-1 p-4 bg-primary text-white hover:bg-primary-dark"
                    onClick={onConfirm}
                  >
                    Подтвердить
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

interface SettingsProps {
  closeSettings: () => void
  isMobile?: boolean
}

const Settings: React.FC<SettingsProps> = ({
  closeSettings,
  isMobile = false,
}) => {
  const { currentTheme, toggleDarkMode, setTheme, themes } = useTheme()
  const { appearanceSettings, updateAppearanceSettings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<
    'general' | 'appearance' | 'security' | 'storage' | 'account'
  >('general')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationConfig, setConfirmationConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // Используем состояние для отображения боковой панели на мобильных устройствах
  // По умолчанию на мобильных устройствах показываем левую панель с категориями
  const [showMobileSidebar, setShowMobileSidebar] = useState(isMobile)

  useEffect(() => {
    // При изменении флага isMobile, сбрасываем состояние на показ категорий
    setShowMobileSidebar(isMobile)
  }, [isMobile])

  // Функция для переключения вкладок
  const handleTabChange = (
    tab: 'general' | 'appearance' | 'security' | 'storage' | 'account',
  ) => {
    setActiveTab(tab)
    if (isMobile) {
      setShowMobileSidebar(false)
    }
  }

  // Функция для возврата к левой панели с категориями
  const handleBackToCategories = () => {
    setShowMobileSidebar(true)
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleClearCache = () => {
    setConfirmationConfig({
      title: 'Очистить кэш',
      message:
        'Вы уверены, что хотите очистить кэш? Это действие нельзя отменить.',
      onConfirm: () => {
        // Логика очистки кэша
        setShowConfirmation(false)
      },
    })
    setShowConfirmation(true)
  }

  const handleDeleteAccount = () => {
    setConfirmationConfig({
      title: 'Удалить аккаунт',
      message:
        'Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить.',
      onConfirm: () => {
        // Логика удаления аккаунта
        setShowConfirmation(false)
      },
    })
    setShowConfirmation(true)
  }

  const handleLogout = () => {
    setConfirmationConfig({
      title: 'Выйти',
      message: 'Вы уверены, что хотите выйти из аккаунта?',
      onConfirm: () => {
        // Вызываем Tauri API для выхода
        invoke('log_out')
          .then(() => {
            // Очищаем localStorage
            localStorage.removeItem('username')
            localStorage.removeItem('userId')

            // Закрываем окно настроек
            setShowConfirmation(false)
            closeSettings()

            // Перезагружаем приложение или перенаправляем на страницу авторизации
            window.location.reload()
          })
          .catch((error) => {
            console.error('Error logging out:', error)
            toast.error(`Ошибка при выходе из аккаунта: ${error}`)
          })
      },
    })
    setShowConfirmation(true)
  }

  const updateAppearanceSetting = (
    key: keyof AppearanceSettings,
    value: boolean | number | string,
  ) => {
    updateAppearanceSettings({ [key]: value })
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div className="flex items-center">
          {/* Кнопка назад для мобильных устройств, когда показан контент */}
          {isMobile && !showMobileSidebar && (
            <button
              onClick={handleBackToCategories}
              className="p-2 mr-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-xl font-semibold">
            {isMobile && !showMobileSidebar ? (
              <>
                {activeTab === 'general' && 'Общие'}
                {activeTab === 'appearance' && 'Внешний вид'}
                {activeTab === 'security' && 'Безопасность'}
                {activeTab === 'storage' && 'Хранилище'}
                {activeTab === 'account' && 'Аккаунт'}
              </>
            ) : (
              'Настройки'
            )}
          </h2>
        </div>
        <button
          onClick={closeSettings}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Боковая панель с категориями - показываем только если не мобильное устройство или если showMobileSidebar=true */}
        {(!isMobile || showMobileSidebar) && (
          <div
            className={`
            ${isMobile ? 'w-full' : 'md:w-64'} 
            ${!isMobile && 'border-r border-slate-200 dark:border-slate-700'} 
            overflow-y-auto scrollable
          `}
          >
            <div className="w-full">
              <nav className="p-2">
                <button
                  className={`w-full p-3 rounded-lg mb-1 flex items-center ${
                    activeTab === 'general'
                      ? 'bg-slate-100 dark:bg-slate-700 text-[rgb(var(--primary-rgb))]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                  onClick={() => handleTabChange('general')}
                >
                  <FiSettings className="w-5 h-5 mr-3" />
                  Общие
                </button>
                <button
                  className={`w-full p-3 rounded-lg mb-1 flex items-center ${
                    activeTab === 'account'
                      ? 'bg-slate-100 dark:bg-slate-700 text-[rgb(var(--primary-rgb))]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                  onClick={() => handleTabChange('account')}
                >
                  <FiUser className="w-5 h-5 mr-3" />
                  Аккаунт
                </button>
                <button
                  className={`w-full p-3 rounded-lg mb-1 flex items-center ${
                    activeTab === 'appearance'
                      ? 'bg-slate-100 dark:bg-slate-700 text-[rgb(var(--primary-rgb))]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                  onClick={() => handleTabChange('appearance')}
                >
                  <FiMonitor className="w-5 h-5 mr-3" />
                  Внешний вид
                </button>
                <button
                  className={`w-full p-3 rounded-lg mb-1 flex items-center ${
                    activeTab === 'security'
                      ? 'bg-slate-100 dark:bg-slate-700 text-[rgb(var(--primary-rgb))]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                  onClick={() => handleTabChange('security')}
                >
                  <FiShield className="w-5 h-5 mr-3" />
                  Безопасность
                </button>
                <button
                  className={`w-full p-3 rounded-lg mb-1 flex items-center ${
                    activeTab === 'storage'
                      ? 'bg-slate-100 dark:bg-slate-700 text-[rgb(var(--primary-rgb))]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                  onClick={() => handleTabChange('storage')}
                >
                  <FiHardDrive className="w-5 h-5 mr-3" />
                  Хранилище
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Основной контент - показываем только если не мобильное устройство или если showMobileSidebar=false */}
        {(!isMobile || !showMobileSidebar) && (
          <div className="flex-1 overflow-y-auto scrollable">
            <div className="p-6">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">
                      Основные настройки
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center">
                          <FiGlobe className="w-5 h-5 mr-3" />
                          <div>
                            <div className="font-medium">Язык</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Русский
                            </div>
                          </div>
                        </div>
                        <FiChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center">
                          <FiBell className="w-5 h-5 mr-3" />
                          <div>
                            <div className="font-medium">Уведомления</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Включены
                            </div>
                          </div>
                        </div>
                        <FiChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-4">Аккаунт</h3>
                    <div className="space-y-4">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                      >
                        <FiLogOut className="w-5 h-5 mr-3 text-slate-600 dark:text-slate-400" />
                        <span>Выйти</span>
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="w-full flex items-center p-4 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-5 h-5 mr-3" />
                        <span>Удалить аккаунт</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Тема</h3>
                    <div className="space-y-4">
                      {/* Панель выбора тем */}
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <div className="flex flex-wrap gap-3 mb-4">
                          {Object.values(themes).map((theme) => (
                            <motion.div
                              key={theme.id}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setTheme(theme.id)}
                              className={`
                                relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer theme-transition
                                ${currentTheme.id === theme.id ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-800' : 'hover:shadow-lg'}
                                theme-preview-${theme.id}
                              `}
                              style={{
                                background: `linear-gradient(135deg, 
                                  var(--preview-backgroundAlt) 0%, 
                                  var(--preview-background) 100%)`,
                              }}
                            >
                              {/* Демонстрационные элементы для показа темы */}
                              <div className="absolute inset-0 p-1.5 flex flex-col">
                                <div
                                  className="h-3 w-1/2 rounded-sm mb-1"
                                  style={{
                                    background: 'var(--preview-primary)',
                                  }}
                                />
                                <div
                                  className="h-2 w-3/4 rounded-sm mb-1"
                                  style={{
                                    background: 'var(--preview-secondary)',
                                  }}
                                />
                                <div
                                  className="h-2 w-2/3 rounded-sm mb-auto"
                                  style={{
                                    background: 'var(--preview-accent)',
                                  }}
                                />
                                <div
                                  className="text-xs font-medium truncate px-1"
                                  style={{ color: 'var(--preview-foreground)' }}
                                >
                                  {theme.name}
                                </div>
                              </div>

                              {currentTheme.id === theme.id && (
                                <div className="absolute bottom-1 right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5 text-white"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {currentTheme.isDark ? (
                              <FiMoon className="w-5 h-5 mr-3" />
                            ) : (
                              <FiSun className="w-5 h-5 mr-3" />
                            )}
                            <div>
                              <div className="font-medium">Тёмный режим</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {currentTheme.isDark ? 'Включен' : 'Выключен'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={toggleDarkMode}
                            className="w-12 h-6 bg-slate-200 dark:bg-slate-600 rounded-full relative transition-colors"
                          >
                            <div
                              className={`absolute w-5 h-5 rounded-full bg-white shadow transition-transform transform ${
                                currentTheme.isDark
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              } top-0.5`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Текст</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FiFileText className="w-5 h-5 mr-3" />
                            <div>
                              <div className="font-medium">
                                Markdown-разметка
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {appearanceSettings.markdownEnabled
                                  ? 'Включена'
                                  : 'Выключена'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              updateAppearanceSetting(
                                'markdownEnabled',
                                !appearanceSettings.markdownEnabled,
                              )
                            }
                            className="w-12 h-6 bg-slate-200 dark:bg-slate-600 rounded-full relative transition-colors"
                          >
                            <div
                              className={`absolute w-5 h-5 rounded-full bg-white shadow transition-transform transform ${
                                appearanceSettings.markdownEnabled
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              } top-0.5`}
                            />
                          </button>
                        </div>
                      </div>

                      {appearanceSettings.markdownEnabled && (
                        <div className="ml-8 mt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              Подсветка синтаксиса кода
                            </div>
                            <button
                              onClick={() =>
                                updateAppearanceSetting(
                                  'markdownSyntaxHighlighting',
                                  !appearanceSettings.markdownSyntaxHighlighting,
                                )
                              }
                              className="w-10 h-5 bg-slate-200 dark:bg-slate-600 rounded-full relative transition-colors"
                            >
                              <div
                                className={`absolute w-4 h-4 rounded-full bg-white shadow transition-transform transform ${
                                  appearanceSettings.markdownSyntaxHighlighting
                                    ? 'translate-x-5'
                                    : 'translate-x-1'
                                } top-0.5`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              Математические формулы (LaTeX)
                            </div>
                            <button
                              onClick={() =>
                                updateAppearanceSetting(
                                  'markdownMathEnabled',
                                  !appearanceSettings.markdownMathEnabled,
                                )
                              }
                              className="w-10 h-5 bg-slate-200 dark:bg-slate-600 rounded-full relative transition-colors"
                            >
                              <div
                                className={`absolute w-4 h-4 rounded-full bg-white shadow transition-transform transform ${
                                  appearanceSettings.markdownMathEnabled
                                    ? 'translate-x-5'
                                    : 'translate-x-1'
                                } top-0.5`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              Диаграммы (Mermaid)
                            </div>
                            <button
                              onClick={() =>
                                updateAppearanceSetting(
                                  'markdownDiagramsEnabled',
                                  !appearanceSettings.markdownDiagramsEnabled,
                                )
                              }
                              className="w-10 h-5 bg-slate-200 dark:bg-slate-600 rounded-full relative transition-colors"
                            >
                              <div
                                className={`absolute w-4 h-4 rounded-full bg-white shadow transition-transform transform ${
                                  appearanceSettings.markdownDiagramsEnabled
                                    ? 'translate-x-5'
                                    : 'translate-x-1'
                                } top-0.5`}
                              />
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium">
                            Размер шрифта сообщений
                          </label>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {appearanceSettings.fontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="20"
                          value={appearanceSettings.fontSize}
                          onChange={(e) =>
                            updateAppearanceSetting(
                              'fontSize',
                              parseInt(e.target.value),
                            )
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium">
                            Размер шрифта интерфейса
                          </label>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {appearanceSettings.interfaceFontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="20"
                          value={appearanceSettings.interfaceFontSize}
                          onChange={(e) =>
                            updateAppearanceSetting(
                              'interfaceFontSize',
                              parseInt(e.target.value),
                            )
                          }
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium">
                            Межстрочный интервал
                          </label>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {appearanceSettings.lineSpacing}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="2"
                          step="0.1"
                          value={appearanceSettings.lineSpacing}
                          onChange={(e) =>
                            updateAppearanceSetting(
                              'lineSpacing',
                              parseFloat(e.target.value),
                            )
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">
                      Ширина сообщений
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          appearanceSettings.messageWidth === 'narrow'
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                        }`}
                        onClick={() =>
                          updateAppearanceSetting('messageWidth', 'narrow')
                        }
                      >
                        Узкая
                      </button>
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          appearanceSettings.messageWidth === 'normal'
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                        }`}
                        onClick={() =>
                          updateAppearanceSetting('messageWidth', 'normal')
                        }
                      >
                        Средняя
                      </button>
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          appearanceSettings.messageWidth === 'wide'
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                        }`}
                        onClick={() =>
                          updateAppearanceSetting('messageWidth', 'wide')
                        }
                      >
                        Широкая
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Безопасность</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FiShield className="w-5 h-5 mr-3" />
                            <div>
                              <div className="font-medium">
                                Двухфакторная аутентификация
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Включена
                              </div>
                            </div>
                          </div>
                          <FiChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FiKey className="w-5 h-5 mr-3" />
                            <div>
                              <div className="font-medium">Изменить пароль</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Последнее изменение: 3 месяца назад
                              </div>
                            </div>
                          </div>
                          <FiChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'account' && <AccountSettings />}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">
                      Использование хранилища
                    </h3>
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="mb-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">
                            Всего использовано
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatBytes(1024 * 1024 * 256)}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[rgb(var(--primary-rgb))] rounded-full"
                            style={{ width: '45%' }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Изображения</span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatBytes(1024 * 1024 * 156)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Видео</span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatBytes(1024 * 1024 * 64)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Документы</span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatBytes(1024 * 1024 * 32)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Другое</span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatBytes(1024 * 1024 * 4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">
                      Управление данными
                    </h3>
                    <div className="space-y-4">
                      <button
                        onClick={handleClearCache}
                        className="w-full flex items-center p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-5 h-5 mr-3 text-slate-600 dark:text-slate-400" />
                        <div>
                          <div className="font-medium">Очистить кэш</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Освободить место на устройстве
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        title={confirmationConfig.title}
        message={confirmationConfig.message}
        onConfirm={confirmationConfig.onConfirm}
        onCancel={() => setShowConfirmation(false)}
      />
    </div>
  )
}

export default Settings
