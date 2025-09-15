import React, { useState, useEffect } from 'react'
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import {
  FiX,
  FiShield,
  FiUserPlus,
  FiMessageSquare,
  FiTrash2,
  FiEdit,
  FiMapPin,
  FiUsers,
  FiUser,
} from 'react-icons/fi'
import { addToast } from '@heroui/react'
import { invoke } from '@tauri-apps/api/core'
import { Fragment } from 'react'
import { Permissions } from '@/hooks/Group'

interface Permission {
  key: string
  label: string
  description: string
  icon: React.ReactNode
}

interface PermissionsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string | number
  userName: string
  groupId: string
  currentPermissions?: Permissions
}

const defaultPermissions: Permissions = {
  manage_members: false,
  send_messages: true,
  delete_messages: false,
  rename_group: false,
  manage_permissions: false,
  pin_messages: false,
  manage_admins: false,
}

const permissionsList: Permission[] = [
  {
    key: 'send_messages',
    label: 'Отправка сообщений',
    description: 'Пользователь может отправлять сообщения в группу',
    icon: <FiMessageSquare className="h-5 w-5 text-blue-500" />,
  },
  {
    key: 'manage_members',
    label: 'Управление участниками',
    description: 'Пользователь может приглашать новых участников в группу',
    icon: <FiUserPlus className="h-5 w-5 text-green-500" />,
  },
  {
    key: 'delete_messages',
    label: 'Удаление сообщений',
    description: 'Пользователь может удалять сообщения в группе',
    icon: <FiTrash2 className="h-5 w-5 text-red-500" />,
  },
  {
    key: 'rename_group',
    label: 'Изменение группы',
    description: 'Пользователь может менять название и описание группы',
    icon: <FiEdit className="h-5 w-5 text-indigo-500" />,
  },
  {
    key: 'pin_messages',
    label: 'Закрепление сообщений',
    description: 'Пользователь может закреплять важные сообщения',
    icon: <FiMapPin className="h-5 w-5 text-yellow-500" />,
  },
  {
    key: 'manage_permissions',
    label: 'Управление правами',
    description: 'Пользователь может изменять права других участников',
    icon: <FiShield className="h-5 w-5 text-purple-500" />,
  },
  {
    key: 'manage_admins',
    label: 'Назначение администраторов',
    description: 'Пользователь может назначать новых администраторов',
    icon: <FiUsers className="h-5 w-5 text-cyan-500" />,
  },
]

const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  groupId,
  currentPermissions = defaultPermissions,
}) => {
  const [permissions, setPermissions] =
    useState<Permissions>(currentPermissions)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Reset permissions when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setPermissions(currentPermissions)
      console.log(currentPermissions)
      // Determine role based on permissions
      if (currentPermissions.manage_admins) {
        setSelectedRole('admin')
      } else if (currentPermissions.manage_members) {
        setSelectedRole('moderator')
      } else if (currentPermissions.send_messages) {
        setSelectedRole('member')
      } else {
        setSelectedRole('reader')
      }
    }
  }, [isOpen, currentPermissions])

  const handleRoleChange = (role: string) => {
    setSelectedRole(role)

    // Update permissions based on selected role
    switch (role) {
      case 'admin':
        setPermissions({
          manage_members: true,
          send_messages: true,
          delete_messages: true,
          rename_group: true,
          manage_permissions: true,
          pin_messages: true,
          manage_admins: true,
        })
        break
      case 'moderator':
        setPermissions({
          manage_members: true,
          send_messages: true,
          delete_messages: true,
          rename_group: false,
          manage_permissions: true,
          pin_messages: true,
          manage_admins: false,
        })
        break
      case 'member':
        setPermissions({
          manage_members: false,
          send_messages: true,
          delete_messages: false,
          rename_group: false,
          manage_permissions: false,
          pin_messages: false,
          manage_admins: false,
        })
        break
      case 'reader':
        setPermissions({
          manage_members: false,
          send_messages: false,
          delete_messages: false,
          rename_group: false,
          manage_permissions: false,
          pin_messages: false,
          manage_admins: false,
        })
        break
    }
  }

  const handleTogglePermission = (key: keyof Permissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))

    // Clear selected role when custom permissions are set
    setSelectedRole(null)
  }

  const handleSave = async () => {
    setIsLoading(true)

    try {
      // Determine if using role-based or custom permissions
      if (selectedRole) {
        // Use role-based permissions
        await invoke('update_member_permissions', {
          groupId,
          memberId: Number(userId),
          permissions: {}, // Empty permissions object when using roles
          role: selectedRole,
        })
      } else {
        // Use custom permissions
        await invoke('update_member_permissions', {
          groupId,
          memberId: Number(userId),
          permissions, // Send permissions object
          role: null,
        })
      }

      addToast({
        title: 'Права обновлены',
        description: `Права пользователя ${userName} успешно обновлены`,
        color: 'success',
      })

      onClose()
    } catch (error) {
      console.error('Ошибка при обновлении прав:', error)
      addToast({
        title: 'Ошибка',
        description: `Не удалось обновить права: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-slate-900 dark:text-white flex items-center"
                  >
                    <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center text-white shadow-md mr-3">
                      <FiUser className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium">{userName}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Настройка разрешений для пользователя
                      </p>
                    </div>
                  </DialogTitle>
                  <button
                    type="button"
                    className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={onClose}
                  >
                    <FiX className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {userName}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        ID: {userId}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Роль пользователя
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['admin', 'moderator', 'member', 'reader'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleChange(role)}
                        className={`p-3 rounded-lg border ${
                          selectedRole === role
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 dark:border-slate-700 hover:border-primary'
                        }`}
                      >
                        <div className="font-medium">
                          {role === 'admin' && 'Администратор'}
                          {role === 'moderator' && 'Модератор'}
                          {role === 'member' && 'Участник'}
                          {role === 'reader' && 'Читатель'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {role === 'admin' && 'Полный доступ'}
                          {role === 'moderator' && 'Модерация'}
                          {role === 'member' && 'Чтение'}
                          {role === 'reader' && 'Чтение'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Индивидуальные разрешения
                    </label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedRole
                        ? 'Настроено через роль'
                        : 'Индивидуальные настройки'}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                    {permissionsList.map((permission) => {
                      const key = permission.key as keyof Permissions
                      const isEnabled = permissions[key]

                      return (
                        <div
                          key={permission.key}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg"
                        >
                          <div className="flex items-center">
                            <div className="h-8 w-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mr-3">
                              {permission.icon}
                            </div>
                            <div>
                              <div className="font-medium">
                                {permission.label}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {permission.description}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`h-5 w-10 ${isEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'} rounded-full relative transition-colors cursor-pointer`}
                            onClick={() => handleTogglePermission(key)}
                          >
                            <div
                              className={`absolute w-4 h-4 rounded-full bg-white shadow transition-transform transform ${
                                isEnabled ? 'translate-x-5' : 'translate-x-1'
                              } top-0.5`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors mr-2"
                    onClick={onClose}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    onClick={handleSave}
                  >
                    {isLoading ? 'Сохранение...' : 'Сохранить'}
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

export default PermissionsModal
