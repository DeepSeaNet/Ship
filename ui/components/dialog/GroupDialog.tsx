'use client'

import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { Fragment, useState, useTransition } from 'react'
import { FiUsers, FiX, FiPlus, FiArrowLeft } from 'react-icons/fi'
import { invoke } from '@tauri-apps/api/core'
import { addToast, Button } from '@heroui/react'
import { CreateGroup } from '@/types/invoke/group'

interface GroupDialogProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (group: { groupName: string }) => void
}

export function GroupDialog({
  isOpen,
  onClose,
  onGroupCreated,
}: GroupDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [usernames, setUsernames] = useState<string[]>([''])
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'name' | 'members'>('name')

  // Обработчик сброса состояния при закрытии диалога
  const handleClose = () => {
    onClose()

    setTimeout(() => {
      setGroupName('')
      setUsernames([''])
      setStep('name')
    }, 300)
  }

  // Обработчик создания группы без участников
  const handleCreateWithoutMembers = async () => {
    if (!groupName.trim()) {
      addToast({
        title: 'Ошибка',
        description: 'Название группы не может быть пустым',
        variant: 'flat',
        color: 'danger',
      })
      return
    }

    startTransition(async () => {
      try {
        // Создание группы с помощью Tauri API
        const result = await invoke<CreateGroup>('create_group', {
          groupName: groupName.trim(),
        })

        if (!result.success) {
          addToast({
            title: 'Ошибка',
            description: 'Ошибка при создании группы',
            variant: 'flat',
            color: 'danger',
          })
        }

        if (result) {
          addToast({
            title: 'Успешно',
            description: `Группа "${groupName}" создана`,
            variant: 'flat',
            color: 'success',
          })

          onGroupCreated({ groupName })
          handleClose()
        }
      } catch (error) {
        console.error('Error creating group:', error)
        addToast({
          title: 'Ошибка',
          description: String(error),
          variant: 'flat',
          color: 'danger',
        })
      }
    })
  }

  // Обработчик создания группы с участниками
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      addToast({
        title: 'Ошибка',
        description: 'Название группы не может быть пустым',
        variant: 'flat',
        color: 'danger',
      })
      return
    }

    // Фильтруем пустые имена пользователей
    const filteredUsernames = usernames.filter(
      (username) => username.trim() !== '',
    )

    try {
      startTransition(() => {
        ;(async () => {
          try {
            console.log('create_group')
            // Вызываем Tauri команду для создания группы
            const result = await invoke<CreateGroup>('create_group', {
              groupName: groupName.trim(),
            })
            if (!result.success) {
              addToast({
                title: 'Ошибка',
                description: 'Произошла ошибка создания группы',
                variant: 'flat',
                color: 'danger',
              })
            }
            // Приглашаем пользователей в группу, если они есть
            if (filteredUsernames.length > 0) {
              for (const username of filteredUsernames) {
                try {
                  await invoke('invite_to_group', {
                    clientId: parseInt(username),
                    groupName: groupName.trim(),
                  })
                } catch (inviteError) {
                  console.error(
                    `Ошибка при приглашении пользователя ${username}:`,
                    inviteError,
                  )
                  addToast({
                    title: 'Ошибка',
                    description:
                      'Необходимо добавить хотя бы одного пользователя',
                    variant: 'flat',
                    color: 'danger',
                  })
                }
              }
            }

            addToast({
              title: 'Успешно',
              description: 'Группа успешно создана',
              color: 'success',
              variant: 'flat',
              endContent: (
                <Button size="sm" variant="flat" color="success">
                  Перейти
                </Button>
              ),
            })
            onGroupCreated({ groupName })
            handleClose()
          } catch (error) {
            console.error('Ошибка при создании группы:', error)
            addToast({
              title: 'Ошибка',
              description: `Ошибка при создании группы: ${error}`,
              color: 'danger',
              variant: 'flat',
            })
          }
        })()
      })
    } catch (error) {
      console.error('Ошибка при создании группы:', error)
      addToast({
        title: 'Ошибка',
        description: `Ошибка при создании группы: ${error}`,
        color: 'danger',
        variant: 'flat',
      })
    }
  }

  // Добавляем новое поле для ввода имени пользователя
  const handleAddUserField = () => {
    setUsernames([...usernames, ''])
  }

  // Обработчик изменения имени пользователя
  const handleUsernameChange = (index: number, value: string) => {
    const newUsernames = [...usernames]
    newUsernames[index] = value
    setUsernames(newUsernames)
  }

  // Обработчик удаления поля с именем пользователя
  const handleRemoveUser = (index: number) => {
    if (usernames.length > 1) {
      const newUsernames = usernames.filter((_, i) => i !== index)
      setUsernames(newUsernames)
    }
  }

  // Обработчик перехода к следующему шагу
  const handleNextStep = () => {
    if (!groupName.trim()) {
      addToast({
        title: 'Ошибка',
        description: 'Название группы не может быть пустым',
        variant: 'flat',
        color: 'danger',
      })
      return
    }

    setStep('members')
  }

  // Класс для градиентных кнопок
  const gradientButtonClass =
    'bg-gradient-to-r from-primary to-accent hover:opacity-90'

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-5">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-slate-900 dark:text-white flex items-center"
                  >
                    {step === 'name' ? (
                      <>
                        <FiUsers className="mr-2 text-primary" />
                        Создание новой группы
                      </>
                    ) : (
                      <>
                        <Button
                          isIconOnly
                          variant="light"
                          className="mr-2"
                          onClick={() => setStep('name')}
                        >
                          <FiArrowLeft className="text-primary" />
                        </Button>
                        Добавление участников
                      </>
                    )}
                  </DialogTitle>
                  <Button isIconOnly variant="light" onClick={handleClose}>
                    <FiX />
                  </Button>
                </div>

                {step === 'name' ? (
                  // Шаг 1: Ввод названия группы
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                      Введите название для новой группы
                    </p>
                    <input
                      type="text"
                      placeholder="Название группы"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <div className="flex justify-end mt-4 space-x-2">
                      <Button
                        variant="flat"
                        onClick={handleCreateWithoutMembers}
                        isLoading={isPending}
                      >
                        Создать без участников
                      </Button>
                      <Button
                        className={gradientButtonClass}
                        onClick={handleNextStep}
                      >
                        Далее
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Шаг 2: Добавление участников
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                      {`Добавьте участников в группу "${groupName}"`}
                    </p>

                    <div className="space-y-2 mb-4">
                      {usernames.map((username, index) => (
                        <div key={index} className="flex items-center">
                          <input
                            type="text"
                            placeholder="Имя пользователя"
                            value={username}
                            onChange={(e) =>
                              handleUsernameChange(index, e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          {usernames.length > 1 && (
                            <Button
                              isIconOnly
                              variant="light"
                              color="danger"
                              className="ml-2"
                              onClick={() => handleRemoveUser(index)}
                            >
                              <FiX />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="flat"
                      startContent={<FiPlus />}
                      className="w-full mb-4"
                      onClick={handleAddUserField}
                    >
                      Добавить участника
                    </Button>

                    <div className="flex justify-end mt-4">
                      <Button
                        className={gradientButtonClass}
                        onClick={handleCreateGroup}
                        isLoading={isPending}
                      >
                        Создать группу
                      </Button>
                    </div>
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
