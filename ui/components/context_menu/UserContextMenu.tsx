import React, { useEffect, useState, useRef } from 'react'
import {
  FiMessageSquare,
  FiUserMinus,
  FiEdit,
  FiUserX,
  FiShield,
} from 'react-icons/fi'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  cn,
} from '@heroui/react'
import ReactDOM from 'react-dom'

export interface UserAction {
  type:
    | 'create_chat'
    | 'remove_from_group'
    | 'edit_contact'
    | 'block_user'
    | 'manage_permissions'
  userId: number
  groupName?: string // For group-related actions
  userName?: string // User name for display purposes
}

interface UserContextMenuProps {
  position: {
    userId: number
    groupName?: string
    userName?: string
    x: number
    y: number
  } | null
  onAction: (action: UserAction) => void
  isGroupChat?: boolean // Determines whether to show group-specific options
  permissions?: {
    canManageMembers?: boolean
    canManage?: boolean
    canManagePermissions?: boolean
  }
  isCreator?: boolean
  isAdmin?: boolean
  currentUserId?: number | null
}

export default function UserContextMenu({
  position,
  onAction,
  isGroupChat = false,
  permissions = {},
  isCreator = false,
  isAdmin = false,
  currentUserId = null,
}: UserContextMenuProps) {
  // Add internal open state to control menu visibility
  const [isOpen, setIsOpen] = useState(false)
  // Add a ref to track if a real action was selected
  const actionSelectedRef = useRef(false)

  // Update internal state when position changes
  useEffect(() => {
    if (position) {
      setIsOpen(true)
      // Reset action selected flag when menu opens
      actionSelectedRef.current = false
    }
  }, [position])

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && !(e.target as Element).closest('.user-context-menu')) {
        setIsOpen(false)
        // Only send the dummy action if no real action was selected
        if (!actionSelectedRef.current) {
          console.log('Menu closed by clicking outside')
          // Don't send any action, just close the menu
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onAction])

  if (!position) return null

  const iconClasses = 'text-lg'

  const handleAction = (action: UserAction) => {
    // Mark that a real action was selected
    actionSelectedRef.current = true
    console.log('Real action selected:', action.type)
    // Close menu and trigger action
    setIsOpen(false)
    onAction(action)
  }

  // Извлекаем разрешения
  const { canManageMembers = false, canManagePermissions = false } = permissions

  // Проверяем, может ли пользователь удалять других участников
  const canRemoveUser = canManageMembers || isCreator

  // Проверяем, может ли пользователь управлять разрешениями
  const canManageUserPermissions = canManagePermissions || isCreator || isAdmin

  // Проверяем, открыто ли меню для текущего пользователя
  const isSelfMenu = position.userId === currentUserId

  // Custom trigger element that's invisible but positioned at the right spot
  const customTrigger = (
    <div
      className="fixed w-0 h-0 p-0 m-0 border-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    />
  )

  return ReactDOM.createPortal(
    <Dropdown
      isOpen={isOpen}
      placement="bottom"
      offset={4}
      shouldCloseOnBlur
      className="user-context-menu"
    >
      <DropdownTrigger>{customTrigger}</DropdownTrigger>
      <DropdownMenu
        aria-label="User context menu actions"
        variant="flat"
        onClose={() => {
          setIsOpen(false)
          // Only send the dummy action if no real action was selected
          if (!actionSelectedRef.current) {
            console.log('Menu closed by onClose event')
            // Don't send any action, just close the menu
          }
        }}
      >
        <DropdownItem
          key="create_chat"
          startContent={
            <FiMessageSquare
              className={cn(iconClasses, 'text-blue-500 dark:text-blue-400')}
            />
          }
          onPress={() =>
            handleAction({
              type: 'create_chat',
              userId: position.userId,
              userName: position.userName,
            })
          }
        >
          Открыть чат
        </DropdownItem>

        <DropdownItem
          key="edit_contact"
          startContent={
            <FiEdit
              className={cn(
                iconClasses,
                'text-indigo-500 dark:text-indigo-400',
              )}
            />
          }
          onPress={() =>
            handleAction({
              type: 'edit_contact',
              userId: position.userId,
              userName: position.userName,
            })
          }
        >
          Изменить контакт
        </DropdownItem>

        {isGroupChat && canManageUserPermissions ? ( //&& !isSelfMenu
          <DropdownItem
            key="manage_permissions"
            startContent={
              <FiShield
                className={cn(
                  iconClasses,
                  'text-green-500 dark:text-green-400',
                )}
              />
            }
            onPress={() =>
              handleAction({
                type: 'manage_permissions',
                userId: position.userId,
                groupName: position.groupName,
                userName: position.userName,
              })
            }
          >
            Управление правами
          </DropdownItem>
        ) : null}

        {isGroupChat && canRemoveUser && !isSelfMenu ? (
          <DropdownItem
            key="remove_from_group"
            startContent={
              <FiUserMinus
                className={cn(
                  iconClasses,
                  'text-amber-500 dark:text-amber-400',
                )}
              />
            }
            onPress={() =>
              handleAction({
                type: 'remove_from_group',
                userId: position.userId,
                groupName: position.groupName,
                userName: position.userName,
              })
            }
          >
            Удалить из группы
          </DropdownItem>
        ) : null}

        <DropdownItem
          key="block_user"
          startContent={<FiUserX className={cn(iconClasses, 'text-red-500')} />}
          onPress={() =>
            handleAction({
              type: 'block_user',
              userId: position.userId,
              userName: position.userName,
            })
          }
        >
          Заблокировать
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>,
    document.body,
  )
}
