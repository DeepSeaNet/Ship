import React, { useState, useEffect } from 'react'
import { FiUser, FiCopy, FiLogOut, FiInfo } from 'react-icons/fi'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Tooltip,
} from '@heroui/react'
import { addToast } from '@heroui/react'

interface AccountDropdownProps {
  onLogout?: () => void
}

export default function AccountDropdown({ onLogout }: AccountDropdownProps) {
  const [userData, setUserData] = useState<{
    username: string
    user_id: number
    public_address: string
  } | null>(null)

  useEffect(() => {
    const fetchAccountData = () => {
      try {
        const storedUserId = localStorage.getItem('userId')
        const storedUsername = localStorage.getItem('username')
        const storedPublicAddress = localStorage.getItem('publicAddress')
        if (storedUserId && storedUsername) {
          setUserData({
            username: storedUsername,
            user_id: parseInt(storedUserId),
            public_address: storedPublicAddress || 'N/A',
          })
        } else {
          console.error('No user data found in localStorage')
        }
      } catch (error) {
        console.error('Failed to fetch account data from localStorage:', error)
      }
    }

    fetchAccountData()
  }, [])

  const copyToClipboard = (text: string | number, label: string) => {
    navigator.clipboard
      .writeText(text.toString())
      .then(() => {
        addToast({
          title: 'Скопировано',
          description: `${label} скопирован в буфер обмена`,
          variant: 'flat',
          color: 'success',
        })
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err)
        addToast({
          title: 'Ошибка',
          description: 'Не удалось скопировать текст',
          variant: 'flat',
          color: 'danger',
        })
      })
  }

  if (!userData) {
    return (
      <Button
        isIconOnly
        size="md"
        variant="flat"
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <FiUser className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Dropdown placement="bottom-end" size="lg">
      <DropdownTrigger>
        <Button isIconOnly variant="flat" title="Аккаунт" color="primary">
          <FiUser className="h-5 w-5" />
        </Button>
      </DropdownTrigger>

      <DropdownMenu aria-label="Настройки аккаунта">
        <DropdownItem
          key="profile-header"
          isReadOnly
          className="py-3 px-4 focus:outline-none"
          textValue="Профиль пользователя"
        >
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white font-bold text-lg mr-3">
              {userData.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {userData.username}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Аккаунт пользователя
              </p>
            </div>
          </div>
        </DropdownItem>
        {/*
        <DropdownItem 
          key="username" 
          isReadOnly 
          textValue="Имя пользователя"
        >
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Имя пользователя</span>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-900 dark:text-white">{userData.username}</span>
            <Tooltip content="Скопировать" placement="left">
              <Button 
                isIconOnly 
                size="sm" 
                variant="flat" 
                onPress={() => copyToClipboard(userData.username, 'Username')}
              >
                <FiCopy className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </DropdownItem>
        */}
        <DropdownItem key="user-id" isReadOnly textValue="ID пользователя">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            ID пользователя
          </span>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {userData.user_id}
            </span>
            <Tooltip content="Скопировать" placement="left">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => copyToClipboard(userData.user_id, 'User ID')}
              >
                <FiCopy className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </DropdownItem>

        <DropdownItem
          key="public-address"
          isReadOnly
          textValue="Публичный адрес"
        >
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            Публичный адрес
          </span>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {userData.public_address}
            </span>
            <Tooltip content="Скопировать" placement="left">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() =>
                  copyToClipboard(userData.public_address, 'Public Address')
                }
              >
                <FiCopy className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </DropdownItem>

        <DropdownItem
          key="account-info"
          startContent={
            <FiInfo className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          }
        >
          О программе
        </DropdownItem>

        {onLogout ? (
          <DropdownItem
            key="logout"
            startContent={<FiLogOut className="h-4 w-4 text-red-500" />}
            onPress={onLogout}
          >
            Выйти
          </DropdownItem>
        ) : null}
      </DropdownMenu>
    </Dropdown>
  )
}
