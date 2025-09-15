import { addToast } from '@heroui/react'
import React, { useState, Fragment } from 'react'
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { User } from '@/hooks/Contacts'
import { Chat } from '@/hooks/Chat'
import { Message } from '@/hooks/Message'
import { FiSearch, FiUser, FiUserPlus, FiX } from 'react-icons/fi'

type InviteUserModalProps = {
  isOpen: boolean
  onClose: () => void
  onInvite: (userId: number) => void
  contacts: Record<number, User>
  chats: Chat[]
  groups: Chat[]
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  setGroups: React.Dispatch<React.SetStateAction<Chat[]>>
  messages: Record<string, Message[]>
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
}

export const InviteUserModal = ({
  isOpen,
  onClose,
  onInvite,
  contacts,
}: InviteUserModalProps) => {
  const [userId, setUserId] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // Use the chat hook to get contacts

  // Filter contacts based on search term
  const filteredContacts = Object.values(contacts).filter(
    (contact) =>
      contact.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.user_id?.toString().includes(searchTerm),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId) {
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
      await onInvite(userId)

      setUserId(0)
      setSearchTerm('')
      onClose()
    } catch (error) {
      console.error('Ошибка при приглашении пользователя:', error)
      addToast({
        title: 'Ошибка',
        description: `Не удалось пригласить пользователя: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectContact = (contactId: number) => {
    setUserId(contactId)
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
                    <FiUserPlus className="mr-2" />
                    Пригласить пользователя
                  </DialogTitle>
                  <button
                    type="button"
                    className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={onClose}
                  >
                    <FiX className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      ID пользователя
                    </label>
                    <input
                      type="number"
                      value={userId}
                      onChange={(e) => setUserId(Number(e.target.value))}
                      placeholder="Введите ID пользователя"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-rgb))] dark:bg-slate-700 dark:text-white"
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
                          className="w-full pl-10 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-rgb))] dark:bg-slate-700 dark:text-white mb-2"
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
                                userId === contact.user_id
                                  ? 'bg-[rgb(var(--primary-rgb))]/10 dark:bg-[rgb(var(--primary-rgb))]/20'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[rgb(var(--primary-rgb))] to-[rgb(var(--accent-rgb))] flex items-center justify-center text-white">
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

                  <div className="flex justify-end mt-6">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors mr-2"
                      onClick={onClose}
                    >
                      Отмена
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex justify-center rounded-lg border border-transparent bg-gradient-to-r from-[rgb(var(--primary-rgb))] to-[rgb(var(--accent-rgb))] px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-rgb))] transition-all hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <span className="animate-spin h-4 w-4 mr-2 border-b-2 border-white rounded-full"></span>
                          Приглашение...
                        </>
                      ) : (
                        'Пригласить'
                      )}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
