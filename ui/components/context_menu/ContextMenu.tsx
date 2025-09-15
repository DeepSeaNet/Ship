import { FiCornerUpLeft, FiEdit, FiTrash2 } from 'react-icons/fi'
import { MessageAction } from '../../types/chat'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  cn,
} from '@heroui/react'
import ReactDOM from 'react-dom'
import { memo } from 'react'

interface ContextMenuProps {
  position: { id: string; x: number; y: number } | null
  onAction: (action: MessageAction) => void
  hasMedia?: boolean
}

export const EditDocumentIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M15.48 3H7.52C4.07 3 2 5.06 2 8.52v7.95C2 19.94 4.07 22 7.52 22h7.95c3.46 0 5.52-2.06 5.52-5.52V8.52C21 5.06 18.93 3 15.48 3Z"
        fill="currentColor"
        opacity={0.4}
      />
      <path
        d="M21.02 2.98c-1.79-1.8-3.54-1.84-5.38 0L14.51 4.1c-.1.1-.13.24-.09.37.7 2.45 2.66 4.41 5.11 5.11.03.01.08.01.11.01.1 0 .2-.04.27-.11l1.11-1.12c.91-.91 1.36-1.78 1.36-2.67 0-.9-.45-1.79-1.36-2.71ZM17.86 10.42c-.27-.13-.53-.26-.77-.41-.2-.12-.4-.25-.59-.39-.16-.1-.34-.25-.52-.4-.02-.01-.08-.06-.16-.14-.31-.25-.64-.59-.95-.96-.02-.02-.08-.08-.13-.17-.1-.11-.25-.3-.38-.51-.11-.14-.24-.34-.36-.55-.15-.25-.28-.5-.4-.76-.13-.28-.23-.54-.32-.79L7.9 10.72c-.35.35-.69 1.01-.76 1.5l-.43 2.98c-.09.63.08 1.22.47 1.61.33.33.78.5 1.28.5.11 0 .22-.01.33-.02l2.97-.42c.49-.07 1.15-.4 1.5-.76l5.38-5.38c-.25-.08-.5-.19-.78-.31Z"
        fill="currentColor"
      />
    </svg>
  )
}

export const DeleteDocumentIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M21.07 5.23c-1.61-.16-3.22-.28-4.84-.37v-.01l-.22-1.3c-.15-.92-.37-2.3-2.71-2.3h-2.62c-2.33 0-2.55 1.32-2.71 2.29l-.21 1.28c-.93.06-1.86.12-2.79.21l-2.04.2c-.42.04-.72.41-.68.82.04.41.4.71.82.67l2.04-.2c5.24-.52 10.52-.32 15.82.21h.08c.38 0 .71-.29.75-.68a.766.766 0 0 0-.69-.82Z"
        fill="currentColor"
      />
      <path
        d="M19.23 8.14c-.24-.25-.57-.39-.91-.39H5.68c-.34 0-.68.14-.91.39-.23.25-.36.59-.34.94l.62 10.26c.11 1.52.25 3.42 3.74 3.42h6.42c3.49 0 3.63-1.89 3.74-3.42l.62-10.25c.02-.36-.11-.7-.34-.95Z"
        fill="currentColor"
        opacity={0.399}
      />
      <path
        clipRule="evenodd"
        d="M9.58 17a.75.75 0 0 1 .75-.75h3.33a.75.75 0 0 1 0 1.5h-3.33a.75.75 0 0 1-.75-.75ZM8.75 13a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

export const FullScreenIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.18C2 19.83 4.17 22 7.81 22H16.18C19.82 22 21.99 19.83 21.99 16.19V7.81C22 4.17 19.83 2 16.19 2ZM18.53 14.53L14.24 18.82C13.4 19.66 12.03 19.66 11.19 18.82L5.47 13.1C4.63 12.26 4.63 10.89 5.47 10.05L9.76 5.76C10.6 4.92 11.97 4.92 12.81 5.76L18.53 11.48C19.37 12.32 19.37 13.69 18.53 14.53Z"
        fill="currentColor"
        opacity={0.4}
      />
      <path
        d="M12.8066 5.75942L5.4707 13.0959C4.6353 13.9307 4.6353 15.3022 5.4707 16.1376C6.3061 16.973 7.6776 16.973 8.513 16.1376L15.8489 8.80113C16.6843 7.96626 16.6843 6.59429 15.8489 5.75942C15.0135 4.92506 13.642 4.92506 12.8066 5.75942Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Memoize ContextMenu component to prevent unnecessary re-renders
const ContextMenu = memo(
  ({ position, onAction, hasMedia }: ContextMenuProps) => {
    if (!position) return null

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

    if (hasMedia) {
    }

    return ReactDOM.createPortal(
      <Dropdown
        isOpen={!!position}
        placement="bottom"
        offset={4}
        shouldCloseOnBlur
      >
        <DropdownTrigger>{customTrigger}</DropdownTrigger>
        <DropdownMenu aria-label="Context menu actions" variant="faded">
          <DropdownItem
            key="reply"
            startContent={
              <FiCornerUpLeft
                className={cn(iconClasses, 'text-blue-500 dark:text-blue-400')}
              />
            }
            onPress={() => onAction({ type: 'reply', messageId: position.id })}
            shortcut="⌘⇧R"
          >
            Ответить
          </DropdownItem>
          <DropdownItem
            key="edit"
            startContent={
              <FiEdit
                className={cn(
                  iconClasses,
                  'text-indigo-500 dark:text-indigo-400',
                )}
              />
            }
            onPress={() => onAction({ type: 'edit', messageId: position.id })}
            shortcut="⌘⇧E"
          >
            Изменить
          </DropdownItem>
          <DropdownItem
            key="delete"
            startContent={
              <FiTrash2 className={cn(iconClasses, 'text-red-500')} />
            }
            onPress={() => onAction({ type: 'delete', messageId: position.id })}
            shortcut="⌘⇧D"
          >
            Удалить
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>,
      document.body,
    )
  },
  (prevProps, nextProps) => {
    // Only re-render if the position or hasMedia changed
    if (!prevProps.position && !nextProps.position) return true
    if (!prevProps.position || !nextProps.position) return false

    return (
      prevProps.position.id === nextProps.position.id &&
      prevProps.position.x === nextProps.position.x &&
      prevProps.position.y === nextProps.position.y &&
      prevProps.hasMedia === nextProps.hasMedia
    )
  },
)

ContextMenu.displayName = 'Message Context Menu'

export default ContextMenu
