'use client'

import { Fragment, useState } from 'react'
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
} from '@headlessui/react'
import { FiX, FiUser, FiMessageCircle, FiSearch } from 'react-icons/fi'
import { addToast, Button } from '@heroui/react'
import { User } from '@/hooks/Contacts'
import { Chat } from '../../hooks/Chat'
import { Message } from '../../hooks/Message'
import { Group } from '../../hooks/Group'

interface CreateChatDialogProps {
  isOpen: boolean
  onClose: () => void
  onChatCreated: (chatId: string) => void
  chats: Chat[]
  setChats: (chats: Chat[]) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  selectedChat: Chat | Group | null
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | Group | null>>
  currentChatMessages: Message[]
  setCurrentChatMessages: React.Dispatch<React.SetStateAction<Message[]>>
  contacts: Record<number, User>
}

export function CreateChatDialog({
  isOpen,
  onClose,
  onChatCreated,
  chats,
  setChats,
  isLoading,
  setIsLoading,
  messages,
  setMessages,
  contacts,
  selectedChat,
  setSelectedChat,
  currentChatMessages,
  setCurrentChatMessages,
}: CreateChatDialogProps) {
  const [receiverId, setReceiverId] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  // Use the chat hook to get contacts and the createChat function
  const { createChat } = Chat({
    chats: chats,
    setChats: setChats,
    isLoading: isLoading,
    setIsLoading: setIsLoading,
    messages: messages,
    setMessages: setMessages,
    selectedChat: selectedChat,
    setSelectedChat: setSelectedChat,
    currentChatMessages: currentChatMessages,
    setCurrentChatMessages: setCurrentChatMessages,
  })

  const filteredContacts = Object.values(contacts).filter(
    (contact) =>
      contact.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.user_id?.toString().includes(searchTerm),
  )

  const handleSubmit = async () => {
    if (!receiverId) {
      addToast({
        title: 'Ошибка',
        description: 'Пожалуйста, введите ID пользователя',
        color: 'danger',
        variant: 'flat',
      })
      return
    }

    setIsLoading(true)

    try {
      const chatId = await createChat(receiverId)

      addToast({
        title: 'Успешно',
        description: 'Чат успешно создан!',
        color: 'success',
        variant: 'flat',
        endContent: (
          <Button size="sm" variant="flat" color="success">
            OK
          </Button>
        ),
      })
      onChatCreated(chatId)
      onClose()
    } catch (error) {
      console.error('Error creating chat:', error)
      addToast({
        title: 'Ошибка',
        description: `Ошибка при создании чата: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectContact = (userId: number) => {
    setReceiverId(userId)
  }

  const handleClose = () => {
    setReceiverId(0)
    setSearchTerm('')
    onClose()
  }

  // Класс для градиентных кнопок
  const gradientButtonClass =
    'bg-gradient-to-r from-primary to-accent hover:opacity-90'
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-slate-900 dark:text-white flex items-center"
                  >
                    <FiMessageCircle className="mr-2 text-primary" />
                    Создать чат
                  </Dialog.Title>
                  <Button isIconOnly variant="light" onClick={handleClose}>
                    <FiX />
                  </Button>
                </div>

                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      ID пользователя
                    </label>
                    <input
                      type="number"
                      value={receiverId}
                      onChange={(e) => setReceiverId(Number(e.target.value))}
                      placeholder="Введите ID пользователя"
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {Object.keys(contacts).length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Или выберите контакт
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiSearch className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Поиск контактов..."
                          className="w-full pl-10 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-2"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg mt-2">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact) => (
                            <div
                              key={contact.user_id}
                              onClick={() =>
                                handleSelectContact(contact.user_id)
                              }
                              className={`flex items-center p-3 cursor-pointer ${
                                receiverId === contact.user_id
                                  ? 'bg-primary/10 dark:bg-primary/20'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white">
                                <FiUser />
                              </div>
                              <div className="ml-2">
                                <div className="font-medium">
                                  {contact.username}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  ID: {contact.user_id}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                            {searchTerm
                              ? 'Контакты не найдены'
                              : 'Нет доступных контактов'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end mt-6 space-x-2">
                    <Button variant="flat" onClick={handleClose}>
                      Отмена
                    </Button>

                    <Button
                      className={gradientButtonClass}
                      onClick={handleSubmit}
                      isLoading={isLoading}
                      disabled={!receiverId || isLoading}
                    >
                      {isLoading ? 'Создание...' : 'Создать чат'}
                    </Button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
