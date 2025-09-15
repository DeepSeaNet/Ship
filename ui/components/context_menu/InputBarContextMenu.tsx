import { FiBold, FiItalic, FiCode, FiLink, FiList } from 'react-icons/fi'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from '@heroui/react'
import ReactDOM from 'react-dom'

interface InputBarContextMenuProps {
  position: { x: number; y: number } | null
  onFormatAction: (action: string) => void
  menuRef?: React.RefObject<HTMLDivElement> // Сделаем опциональным, так как теперь будет использовать React Portal
}

export default function InputBarContextMenu({
  position,
  onFormatAction,
}: InputBarContextMenuProps) {
  if (!position) return null

  const handleAction = (action: string) => {
    onFormatAction(action)
  }

  // Создадим невидимый триггер в позиции контекстного меню
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
      placement="bottom-start"
      offset={-100}
      shouldCloseOnBlur
    >
      <DropdownTrigger>{customTrigger}</DropdownTrigger>
      <DropdownMenu aria-label="Formatting options" variant="faded">
        <DropdownSection showDivider title="Actions">
          <DropdownItem
            key="bold"
            startContent={<FiBold />}
            onPress={() => handleAction('bold')}
          >
            Жирный
          </DropdownItem>
          <DropdownItem
            key="italic"
            startContent={<FiItalic />}
            onPress={() => handleAction('italic')}
          >
            Курсив
          </DropdownItem>
          <DropdownItem
            key="code"
            startContent={<FiCode />}
            onPress={() => handleAction('code')}
          >
            Код
          </DropdownItem>
          <DropdownItem
            key="link"
            startContent={<FiLink />}
            onPress={() => handleAction('link')}
          >
            Ссылка
          </DropdownItem>
          <DropdownItem
            key="list"
            startContent={<FiList />}
            onPress={() => handleAction('list')}
          >
            Список
          </DropdownItem>
        </DropdownSection>
        <DropdownSection showDivider title="Дополнительное">
          <DropdownItem
            key="codeBlock"
            startContent={<span className="font-mono text-sm">{'{ }'}</span>}
            onPress={() => handleAction('codeBlock')}
          >
            Блок кода
          </DropdownItem>
          <DropdownItem
            key="math"
            startContent={<span className="font-serif">∑</span>}
            onPress={() => handleAction('math')}
          >
            Формула (инлайн)
          </DropdownItem>
          <DropdownItem
            key="mathBlock"
            startContent={<span className="font-serif">∫</span>}
            onPress={() => handleAction('mathBlock')}
          >
            Формула (блок)
          </DropdownItem>
          <DropdownItem
            key="table"
            startContent={<span className="font-mono">⊞</span>}
            onPress={() => handleAction('table')}
          >
            Таблица
          </DropdownItem>
          <DropdownItem
            key="mermaid"
            startContent={<span>📊</span>}
            onPress={() => handleAction('mermaid')}
          >
            Диаграмма
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>,
    document.body,
  )
}
