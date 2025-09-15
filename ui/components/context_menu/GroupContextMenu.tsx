import React from 'react'
import { FiPlus, FiInfo, FiUser, FiTrash2, FiMic } from 'react-icons/fi'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  cn,
} from '@heroui/react'
import ReactDOM from 'react-dom'

export interface GroupAction {
  type:
    | 'create_group'
    | 'info'
    | 'add_user'
    | 'delete'
    | 'create_chat'
    | 'create_voice'
  groupId?: string
}

interface GroupContextMenuProps {
  position: { id: string; x: number; y: number } | null
  onAction: (action: GroupAction) => void
  permissions?: {
    canManageMembers: boolean
    canManage: boolean
  }
}

export default function GroupContextMenu({
  position,
  onAction,
  permissions,
}: GroupContextMenuProps) {
  if (!position) return null

  const { canManageMembers = false, canManage = false } = permissions || {}

  const iconClasses = 'text-lg'
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
      isOpen={!!position}
      placement="bottom"
      offset={4}
      shouldCloseOnBlur
    >
      <DropdownTrigger>{customTrigger}</DropdownTrigger>
      <DropdownMenu aria-label="Group context menu actions" variant="faded">
        <DropdownItem
          key="create_group"
          variant="flat"
          color="primary"
          startContent={
            <FiPlus
              className={cn(iconClasses, 'text-green-500 dark:text-green-400')}
            />
          }
          onPress={() => onAction({ type: 'create_group' })}
        >
          Создать группу
        </DropdownItem>

        <DropdownItem
          key="info"
          variant="flat"
          color="primary"
          startContent={
            <FiInfo
              className={cn(iconClasses, 'text-blue-500 dark:text-blue-400')}
            />
          }
          onPress={() => onAction({ type: 'info', groupId: position.id })}
        >
          Информация
        </DropdownItem>

        <DropdownItem
          key="create_voice"
          variant="flat"
          color="primary"
          startContent={
            <FiMic
              className={cn(
                iconClasses,
                'text-purple-500 dark:text-purple-400',
              )}
            />
          }
          onPress={() =>
            onAction({ type: 'create_voice', groupId: position.id })
          }
        >
          Создать голосовой чат
        </DropdownItem>

        {canManageMembers ? (
          <DropdownItem
            key="add_user"
            variant="flat"
            color="primary"
            startContent={
              <FiUser
                className={cn(
                  iconClasses,
                  'text-indigo-500 dark:text-indigo-400',
                )}
              />
            }
            onPress={() => onAction({ type: 'add_user', groupId: position.id })}
          >
            Добавить пользователя
          </DropdownItem>
        ) : null}

        {canManage ? (
          <DropdownItem
            key="delete"
            variant="flat"
            color="primary"
            startContent={
              <FiTrash2 className={cn(iconClasses, 'text-red-500')} />
            }
            onPress={() => onAction({ type: 'delete', groupId: position.id })}
          >
            Удалить
          </DropdownItem>
        ) : null}
      </DropdownMenu>
    </Dropdown>,
    document.body,
  )
}
