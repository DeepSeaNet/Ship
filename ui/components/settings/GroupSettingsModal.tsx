import React, { useState, useEffect, Fragment, useCallback } from 'react'
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import {
  FiX,
  FiUpload,
  FiSettings,
  FiEdit,
  FiInfo,
  FiShield,
  FiUsers,
  FiLock,
  FiGlobe,
  FiLink,
  FiMessageSquare,
  FiImage,
  FiSmile,
  FiMic,
  FiVideo,
  FiCheck,
  FiTrash2,
  FiClock,
  FiUserPlus,
  FiArrowLeft,
  FiFile,
  FiDownload,
} from 'react-icons/fi'
import { addToast, Button, Input, Textarea, Switch } from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import PermissionsModal from '../dialog/PermissionsModal'
import { Image } from '@heroui/react'
import {
  Permissions,
  removeUserFromGroup,
  updateGroupConfig,
} from '@/hooks/Group'
import { Group } from '@/hooks/Group'
import { getUserFromId, User } from '@/hooks/Contacts'
import { Message } from '@/hooks/Message'

// Добавляем тип для медиа-элементов
type MediaItem = {
  media_id: string
  filename: string
  timestamp: number
  size?: number
  url?: string // Ссылка на файл из message.media
}

interface GroupSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group
  isMobile?: boolean
  contacts: Record<number, User>
  messages?: Record<string, Message[]> // Добавляем messages в пропсы
}

export interface GroupSettings {
  visibility: string
  join_mode: string
  description: string
  max_members: number
  slow_mode_delay: number
  allow_stickers: boolean
  allow_gifs: boolean
  allow_voice_messages: boolean
  allow_video_messages: boolean
  allow_links: boolean
  allow_messages: boolean
}

const defaultSettings: GroupSettings = {
  visibility: 'private',
  join_mode: 'invite_only',
  description: '',
  max_members: 100,
  slow_mode_delay: 0,
  allow_stickers: true,
  allow_gifs: true,
  allow_voice_messages: true,
  allow_video_messages: true,
  allow_links: true,
  allow_messages: true,
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  group,
  isMobile = false,
  contacts,
  messages = {}, // Добавляем значение по умолчанию
}) => {
  const [settings, setSettings] = useState<GroupSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    group.avatar || null,
  )
  const [tempDescription, setTempDescription] = useState(group.description)
  const [tempName, setTempName] = useState(group.name)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{
    id: number
    name: string
    permissions?: Permissions
  } | null>(null)
  const [avatarFilePath, setAvatarFilePath] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(true)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  // Fetch group settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempDescription(group.description)
      setTempName(group.name)
      setAvatarPreview(group.avatar || null)
      fetchGroupSettings()

      // Сбросить показ меню при каждом открытии модального окна
      if (isMobile) {
        setShowMenu(true)
      }
    }
  }, [isOpen, group, isMobile])

  const fetchGroupSettings = async () => {
    setIsLoading(true)
    try {
      // In a real app, you would fetch the current settings from the backend
      // For now, we'll just use the default settings and add the description
      setSettings({
        ...defaultSettings,
        description: group.description || '',
      })
    } catch (error) {
      console.error('Ошибка при загрузке настроек группы:', error)
      addToast({
        title: 'Ошибка',
        description: `Не удалось загрузить настройки группы: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const userPermissions = group.user_permissions || group.default_permissions
  const handleUploadAvatar = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
          },
        ],
      })

      if (selected === null) {
        return
      }

      if (typeof selected === 'string') {
        const fileData = await readFile(selected)

        // Check file size (limit to 5MB)
        if (fileData.length > 5 * 1024 * 1024) {
          addToast({
            title: 'Ошибка',
            description: 'Размер файла не должен превышать 5MB',
            color: 'danger',
            variant: 'flat',
          })
          return
        }

        // Create blob URL for preview
        const blob = new Blob([fileData], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        setAvatarPreview(url)

        // Save the file path for later use when saving settings
        setAvatarFilePath(selected)

        addToast({
          title: 'Успешно',
          description: 'Аватар будет обновлен после сохранения настроек',
          color: 'success',
        })
      }
    } catch (error) {
      console.error('Ошибка при загрузке аватара:', error)
      addToast({
        title: 'Ошибка',
        description: `Не удалось загрузить аватар: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    await updateGroupConfig(
      group,
      settings,
      tempName,
      tempDescription,
      avatarFilePath,
    )
    setIsSaving(false)
  }

  const handleUserClick = (userId: number, userName: string) => {
    const permissions = group.users_permissions?.[Number(userId)]
    console.log(group)
    console.log(permissions)
    setSelectedUser({
      id: userId,
      name: userName,
      permissions,
    })
    setIsPermissionsModalOpen(true)
  }

  const handleRemoveUser = async (userId: number) => {
    await removeUserFromGroup(group.chat_id, userId)
  }

  const canChangeDescription = userPermissions?.rename_group
  const canChangeName = userPermissions?.rename_group

  // Функция для переключения на контент с сокрытием меню категорий
  const handleTabClick = (tab: string) => {
    setActiveTab(tab)
    if (isMobile) {
      setShowMenu(false)
    }
  }

  // Функция для возврата к меню категорий
  const handleBackToMenu = () => {
    setShowMenu(true)
  }
  const participants = group.participants.map((participant_id) => {
    const participant = getUserFromId(participant_id, contacts)
    return participant
  })

  // Добавляем функцию для загрузки медиа-файлов
  const loadMediaItems = useCallback(async () => {
    if (!group) return

    setIsLoadingMedia(true)
    try {
      // Получаем сообщения для текущего чата
      const chatId = group.chat_id || group.name
      const chatMessages = messages[chatId] || []

      // Фильтруем сообщения с медиафайлами
      const mediaMessages = chatMessages.filter(
        (msg) => msg.media || msg.media_name,
      )

      // Преобразуем сообщения в MediaItem
      const items: MediaItem[] = mediaMessages.map((msg) => ({
        media_id: msg.message_id,
        filename: msg.media_name || 'Безымянный файл',
        timestamp: parseInt(msg.timestamp) || Date.now() / 1000,
        url: msg.media, // Сохраняем ссылку на файл из message.media
        size: undefined,
      }))

      setMediaItems(items)
    } catch (error) {
      console.error('Ошибка при загрузке медиафайлов:', error)
    } finally {
      setIsLoadingMedia(false)
    }
  }, [group, messages])

  // Добавляем функцию для форматирования размера файла
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Неизвестный размер'

    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  // Добавляем функцию для форматирования временной метки
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  // Загружаем медиа-файлы при открытии вкладки "Медиа"
  useEffect(() => {
    if (isOpen && activeTab === 'media') {
      loadMediaItems()
    }
  }, [isOpen, activeTab, loadMediaItems])

  // Обновляем раздел "Media"
  const renderMediaContent = () => {
    // Считаем медиа по типам
    const fileCount = mediaItems.filter(
      (item) =>
        item.filename &&
        !item.filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
    ).length

    const imageCount = mediaItems.filter(
      (item) =>
        item.filename?.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
    ).length

    // Получаем файлы (не-изображения)
    const files = mediaItems
      .filter(
        (item) =>
          item.filename &&
          !item.filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
      )
      .slice(0, 5)

    // Получаем изображения
    const images = mediaItems
      .filter(
        (item) =>
          item.filename?.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i),
      )
      .slice(0, 6)

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
          Управление медиа
        </h3>

        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          {isLoadingMedia ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin h-8 w-8 border-b-2 border-[rgb(var(--primary-rgb))] rounded-full"></div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h4 className="text-md font-medium text-slate-900 dark:text-white mb-3">
                  Файлы ({fileCount})
                </h4>
                <div className="space-y-2">
                  {files.length > 0 ? (
                    files.map((file) => (
                      <div
                        key={file.media_id}
                        className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                      >
                        <div className="h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mr-3">
                          <FiFile className="text-primary" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-medium truncate">
                            {file.filename}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {file.size
                              ? formatFileSize(file.size)
                              : 'Неизвестный размер'}{' '}
                            • {formatTimestamp(file.timestamp)}
                          </div>
                        </div>
                        {file.url && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={file.filename}
                            className="ml-2 p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                          >
                            <FiDownload size={18} />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                      Нет доступных файлов
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-md font-medium text-slate-900 dark:text-white mb-3">
                  Изображения ({imageCount})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {images.length > 0 ? (
                    images.map((image) => (
                      <div
                        key={image.media_id}
                        className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative"
                      >
                        {image.url ? (
                          <>
                            <img
                              src={image.url}
                              alt={image.filename}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                // В случае ошибки загрузки показываем иконку изображения
                                ;(e.target as HTMLImageElement).style.display =
                                  'none'
                                const parent = (e.target as HTMLImageElement)
                                  .parentNode
                                if (parent) {
                                  const icon = document.createElement('div')
                                  icon.className =
                                    'h-full w-full flex items-center justify-center'
                                  icon.innerHTML =
                                    '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'
                                  parent.appendChild(icon)
                                }
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
                              <a
                                href={image.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={image.filename}
                                className="text-white h-6 w-6"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FiDownload className="h-6 w-6" />
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <FiImage className="text-primary h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                          {image.size ? formatFileSize(image.size) : ''}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-4 text-slate-500 dark:text-slate-400">
                      Нет доступных изображений
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Очистить кэш медиафайлов
                  </div>
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    startContent={<FiTrash2 />}
                  >
                    Очистить
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                <DialogPanel className="w-full max-w-3xl transform overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-xl transition-all">
                  <div className="flex flex-col h-[600px]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <DialogTitle
                        as="h3"
                        className="text-lg font-medium leading-6 text-slate-900 dark:text-white flex items-center"
                      >
                        {isMobile && !showMenu ? (
                          <button
                            className="mr-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={handleBackToMenu}
                          >
                            <FiArrowLeft className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                          </button>
                        ) : (
                          <FiSettings className="mr-2 text-[rgb(var(--primary-rgb))]" />
                        )}
                        {isMobile && !showMenu ? (
                          <span>
                            {activeTab === 'general' && 'Общие настройки'}
                            {activeTab === 'members' && 'Участники'}
                            {activeTab === 'permissions' && 'Права доступа'}
                            {activeTab === 'media' && 'Медиа'}
                          </span>
                        ) : (
                          'Настройки группы'
                        )}
                      </DialogTitle>
                      <button
                        type="button"
                        className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={onClose}
                      >
                        <FiX className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      </button>
                    </div>

                    {/* Body with tabs - специальная логика для мобильного режима */}
                    <div className="flex flex-1 overflow-hidden">
                      {/* Tab navigation - отображается всегда для desktop и только когда showMenu=true для mobile */}
                      {(!isMobile || (isMobile && showMenu)) && (
                        <div
                          className={`${isMobile ? 'w-full' : 'w-48'} ${!isMobile && 'border-r border-slate-200 dark:border-slate-700'} p-4 overflow-y-auto`}
                        >
                          <nav className="space-y-1">
                            <button
                              onClick={() => handleTabClick('general')}
                              className={`w-full text-left px-3 py-2 rounded-lg flex items-center text-sm font-medium ${
                                activeTab === 'general'
                                  ? 'bg-[rgb(var(--primary-rgb))]/10 text-[rgb(var(--primary-rgb))]'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              } transition-colors`}
                            >
                              <FiInfo className="mr-2 h-5 w-5" />
                              Общие
                            </button>
                            <button
                              onClick={() => handleTabClick('members')}
                              className={`w-full text-left px-3 py-2 rounded-lg flex items-center text-sm font-medium ${
                                activeTab === 'members'
                                  ? 'bg-[rgb(var(--primary-rgb))]/10 text-[rgb(var(--primary-rgb))]'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              } transition-colors`}
                            >
                              <FiUsers className="mr-2 h-5 w-5" />
                              Участники
                            </button>
                            <button
                              onClick={() => handleTabClick('permissions')}
                              className={`w-full text-left px-3 py-2 rounded-lg flex items-center text-sm font-medium ${
                                activeTab === 'permissions'
                                  ? 'bg-[rgb(var(--primary-rgb))]/10 text-[rgb(var(--primary-rgb))]'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              } transition-colors`}
                            >
                              <FiShield className="mr-2 h-5 w-5" />
                              Права доступа
                            </button>
                            <button
                              onClick={() => handleTabClick('media')}
                              className={`w-full text-left px-3 py-2 rounded-lg flex items-center text-sm font-medium ${
                                activeTab === 'media'
                                  ? 'bg-[rgb(var(--primary-rgb))]/10 text-[rgb(var(--primary-rgb))]'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              } transition-colors`}
                            >
                              <FiImage className="mr-2 h-5 w-5" />
                              Медиа
                            </button>
                          </nav>
                        </div>
                      )}

                      {/* Tab content - отображается всегда для desktop и только когда showMenu=false для mobile */}
                      {(!isMobile || (isMobile && !showMenu)) && (
                        <div className="flex-1 p-6 overflow-y-auto">
                          {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="animate-spin h-8 w-8 border-b-2 border-[rgb(var(--primary-rgb))] rounded-full"></div>
                            </div>
                          ) : (
                            <>
                              {/* General Settings */}
                              {activeTab === 'general' && (
                                <div className="space-y-6">
                                  <div className="flex items-start gap-6">
                                    <div className="flex-shrink-0">
                                      <div
                                        className="relative h-24 w-24 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center group cursor-pointer border-2 border-slate-300 dark:border-slate-600 hover:border-[rgb(var(--primary-rgb))]"
                                        onClick={handleUploadAvatar}
                                      >
                                        {avatarPreview ? (
                                          <Image
                                            src={avatarPreview}
                                            alt="Group avatar"
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-4xl font-semibold text-slate-400 dark:text-slate-500">
                                            {tempName.charAt(0).toUpperCase()}
                                          </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <FiUpload className="h-8 w-8 text-white" />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                      <div>
                                        <Input
                                          label="Название группы"
                                          color="primary"
                                          type="group_name"
                                          variant="flat"
                                          value={tempName}
                                          onChange={(e) =>
                                            setTempName(e.target.value)
                                          }
                                          fullWidth
                                          placeholder="Введите название группы"
                                          isDisabled={!canChangeName}
                                          startContent={
                                            <FiEdit className="text-slate-400" />
                                          }
                                        />
                                      </div>

                                      <div>
                                        <Textarea
                                          label="Описание группы"
                                          color="primary"
                                          type="group_description"
                                          variant="flat"
                                          value={tempDescription || ''}
                                          onChange={(e) =>
                                            setTempDescription(e.target.value)
                                          }
                                          placeholder="Введите описание группы"
                                          minRows={3}
                                          maxRows={5}
                                          isDisabled={!canChangeDescription}
                                          fullWidth
                                        />
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                          Описание группы будет видно всем
                                          участникам
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Видимость группы
                                      </label>
                                      <div className="flex space-x-3">
                                        <Button
                                          onPress={() =>
                                            setSettings({
                                              ...settings,
                                              visibility: 'private',
                                            })
                                          }
                                          variant={
                                            settings.visibility === 'private'
                                              ? 'solid'
                                              : 'light'
                                          }
                                          color={
                                            settings.visibility === 'private'
                                              ? 'primary'
                                              : 'default'
                                          }
                                          startContent={<FiLock />}
                                        >
                                          Приватная
                                        </Button>
                                        <Button
                                          onPress={() =>
                                            setSettings({
                                              ...settings,
                                              visibility: 'public',
                                            })
                                          }
                                          variant={
                                            settings.visibility === 'public'
                                              ? 'solid'
                                              : 'light'
                                          }
                                          color={
                                            settings.visibility === 'public'
                                              ? 'primary'
                                              : 'default'
                                          }
                                          startContent={<FiGlobe />}
                                        >
                                          Публичная
                                        </Button>
                                      </div>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {settings.visibility === 'private'
                                          ? 'Приватная группа видна только участникам'
                                          : 'Публичная группа может быть найдена в поиске'}
                                      </p>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Режим присоединения
                                      </label>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          onPress={() =>
                                            setSettings({
                                              ...settings,
                                              join_mode: 'invite_only',
                                            })
                                          }
                                          variant={
                                            settings.join_mode === 'invite_only'
                                              ? 'solid'
                                              : 'light'
                                          }
                                          color={
                                            settings.join_mode === 'invite_only'
                                              ? 'primary'
                                              : 'default'
                                          }
                                          size="sm"
                                          startContent={<FiUserPlus />}
                                        >
                                          Только по приглашению
                                        </Button>
                                        <Button
                                          onPress={() =>
                                            setSettings({
                                              ...settings,
                                              join_mode: 'link_only',
                                            })
                                          }
                                          variant={
                                            settings.join_mode === 'link_only'
                                              ? 'solid'
                                              : 'light'
                                          }
                                          color={
                                            settings.join_mode === 'link_only'
                                              ? 'primary'
                                              : 'default'
                                          }
                                          size="sm"
                                          startContent={<FiLink />}
                                        >
                                          По ссылке
                                        </Button>
                                        <Button
                                          onPress={() =>
                                            setSettings({
                                              ...settings,
                                              join_mode: 'open',
                                            })
                                          }
                                          variant={
                                            settings.join_mode === 'open'
                                              ? 'solid'
                                              : 'light'
                                          }
                                          color={
                                            settings.join_mode === 'open'
                                              ? 'primary'
                                              : 'default'
                                          }
                                          size="sm"
                                          startContent={<FiGlobe />}
                                        >
                                          Открытая
                                        </Button>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Максимальное количество участников
                                      </label>
                                      <Input
                                        type="number"
                                        value={settings.max_members.toString()}
                                        color="primary"
                                        variant="flat"
                                        onChange={(e) =>
                                          setSettings({
                                            ...settings,
                                            max_members:
                                              parseInt(e.target.value) || 100,
                                          })
                                        }
                                        min="1"
                                        max="500"
                                        startContent={
                                          <FiUsers className="text-slate-400" />
                                        }
                                        className="w-full max-w-xs"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Режим медленных сообщений (секунды)
                                      </label>
                                      <Input
                                        type="number"
                                        value={settings.slow_mode_delay.toString()}
                                        onChange={(e) =>
                                          setSettings({
                                            ...settings,
                                            slow_mode_delay:
                                              parseInt(e.target.value) || 0,
                                          })
                                        }
                                        min="0"
                                        max="3600"
                                        color="primary"
                                        variant="flat"
                                        startContent={
                                          <FiClock className="text-slate-400" />
                                        }
                                        className="w-full max-w-xs"
                                      />
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        0 = режим медленных сообщений отключен
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Members */}
                              {activeTab === 'members' && (
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                                      Участники группы (
                                      {group.participants.length})
                                    </h3>
                                    <Button
                                      color="primary"
                                      size="sm"
                                      startContent={<FiUserPlus />}
                                    >
                                      Пригласить
                                    </Button>
                                  </div>

                                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="max-h-96 overflow-y-auto">
                                      <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {participants.length > 0 ? (
                                          participants.map(
                                            (participant, index) => (
                                              <div
                                                key={index}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                              >
                                                <div className="flex items-center">
                                                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mr-3">
                                                    <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                                                      {participant.username
                                                        ? participant.username
                                                            .charAt(0)
                                                            .toUpperCase()
                                                        : '?'}
                                                    </span>
                                                  </div>
                                                  <div>
                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                      {participant.username}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                      ID: {participant.user_id}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                  <Button
                                                    size="sm"
                                                    variant="light"
                                                    color="primary"
                                                    isIconOnly
                                                    onPress={() =>
                                                      handleUserClick(
                                                        participant.user_id,
                                                        participant.username,
                                                      )
                                                    }
                                                  >
                                                    <FiShield className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    isIconOnly
                                                    onPress={() =>
                                                      handleRemoveUser(
                                                        participant.user_id,
                                                      )
                                                    }
                                                  >
                                                    <FiTrash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                            <FiUsers className="h-12 w-12 text-slate-400 mb-2" />
                                            <p className="text-slate-500 dark:text-slate-400">
                                              В этой группе пока нет участников
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Permissions */}
                              {activeTab === 'permissions' && (
                                <div className="space-y-6">
                                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                                    Разрешения по умолчанию
                                  </h3>

                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between py-2">
                                      <div className="flex items-center">
                                        {!isMobile && (
                                          <FiMessageSquare className="h-5 w-5 text-blue-500 mr-3" />
                                        )}
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-white">
                                            Отправка сообщений
                                          </div>
                                          <div className="text-sm text-slate-500 dark:text-slate-400">
                                            Разрешить участникам отправлять
                                            сообщения
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        isSelected={settings.allow_messages}
                                        onValueChange={(value) =>
                                          setSettings({
                                            ...settings,
                                            allow_messages: value,
                                          })
                                        }
                                        color="primary"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between py-2">
                                      <div className="flex items-center">
                                        {!isMobile && (
                                          <FiSmile className="h-5 w-5 text-yellow-500 mr-3" />
                                        )}
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-white">
                                            Стикеры
                                          </div>
                                          <div className="text-sm text-slate-500 dark:text-slate-400">
                                            Разрешить использование стикеров
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        isSelected={settings.allow_stickers}
                                        onValueChange={(value) =>
                                          setSettings({
                                            ...settings,
                                            allow_stickers: value,
                                          })
                                        }
                                        color="primary"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between py-2">
                                      <div className="flex items-center">
                                        {!isMobile && (
                                          <FiImage className="h-5 w-5 text-green-500 mr-3" />
                                        )}
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-white">
                                            GIF-анимации
                                          </div>
                                          <div className="text-sm text-slate-500 dark:text-slate-400">
                                            Разрешить использование GIF-анимаций
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        isSelected={settings.allow_gifs}
                                        onValueChange={(value) =>
                                          setSettings({
                                            ...settings,
                                            allow_gifs: value,
                                          })
                                        }
                                        color="primary"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between py-2">
                                      <div className="flex items-center">
                                        {!isMobile && (
                                          <FiMic className="h-5 w-5 text-indigo-500 mr-3" />
                                        )}
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-white">
                                            Голосовые сообщения
                                          </div>
                                          <div className="text-sm text-slate-500 dark:text-slate-400">
                                            Разрешить отправку голосовых
                                            сообщений
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        isSelected={
                                          settings.allow_voice_messages
                                        }
                                        onValueChange={(value) =>
                                          setSettings({
                                            ...settings,
                                            allow_voice_messages: value,
                                          })
                                        }
                                        color="primary"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between py-2">
                                      <div className="flex items-center">
                                        {!isMobile && (
                                          <FiVideo className="h-5 w-5 text-red-500 mr-3" />
                                        )}
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-white">
                                            Видео сообщения
                                          </div>
                                          <div className="text-sm text-slate-500 dark:text-slate-400">
                                            Разрешить отправку видеосообщений
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        isSelected={
                                          settings.allow_video_messages
                                        }
                                        onValueChange={(value) =>
                                          setSettings({
                                            ...settings,
                                            allow_video_messages: value,
                                          })
                                        }
                                        color="primary"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between py-2">
                                      <div className="flex items-center">
                                        {!isMobile && (
                                          <FiLink className="h-5 w-5 text-purple-500 mr-3" />
                                        )}
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-white">
                                            Ссылки
                                          </div>
                                          <div className="text-sm text-slate-500 dark:text-slate-400">
                                            Разрешить отправку ссылок
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        isSelected={settings.allow_links}
                                        onValueChange={(value) =>
                                          setSettings({
                                            ...settings,
                                            allow_links: value,
                                          })
                                        }
                                        color="primary"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Media */}
                              {activeTab === 'media' && renderMediaContent()}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer with actions */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                      <Button
                        variant="light"
                        onClick={onClose}
                        className="mr-2"
                      >
                        Отмена
                      </Button>
                      {/* Кнопка сохранения только если не на меню выбора категорий в мобильном режиме */}
                      {(!isMobile || (isMobile && !showMenu)) && (
                        <Button
                          color="primary"
                          onPress={handleSaveSettings}
                          isLoading={isSaving}
                          startContent={!isSaving && <FiCheck />}
                        >
                          {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {selectedUser && (
        <PermissionsModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          groupId={group.chat_id}
          currentPermissions={selectedUser.permissions}
        />
      )}
    </>
  )
}

export default GroupSettingsModal
