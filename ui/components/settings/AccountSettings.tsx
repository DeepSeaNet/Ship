import React, { useState, useEffect } from 'react'
import {
  FiUser,
  FiServer,
  FiKey,
  FiGlobe,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiSmartphone,
  FiDownload,
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import {
  Button,
  CardBody,
  Card,
  Snippet,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react'
import { invoke } from '@tauri-apps/api/core'
import QRCode from 'qrcode'

// Добавь этот импорт в основной файл Settings.tsx
// import AccountSettings from './AccountSettings';

interface AccountInfo {
  userId: string
  username: string
  publicAddress: string
  serverAddress: string
  serverPubKey?: string
}

const AccountSettings: React.FC = () => {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [exportedData, setExportedData] = useState<{
    cipherText: string
    keyBase64: string
  } | null>(null)

  const { isOpen, onOpen, onClose } = useDisclosure()

  useEffect(() => {
    // Получаем данные из localStorage
    const userId = localStorage.getItem('userId') || ''
    const username = localStorage.getItem('username') || ''
    const publicAddress = localStorage.getItem('publicAddress') || ''
    const serverAddress = localStorage.getItem('serverAddress') || ''
    const serverPubKey = localStorage.getItem('serverPubKey') || ''

    setAccountInfo({
      userId,
      username,
      publicAddress,
      serverAddress,
      serverPubKey: serverPubKey || undefined,
    })
  }, [])

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Скопировано в буфер обмена')
    } catch (error) {
      toast.error('Не удалось скопировать')
    }
  }

  const exportAccount = async () => {
    setIsExporting(true)
    try {
      // Вызываем Tauri команду для экспорта аккаунта
      const result = await invoke<[string, string]>('export_account')
      const [cipherText, keyBase64] = result

      setExportedData({ cipherText, keyBase64 })

      // Комбинируем данные в JSON для QR-кода
      const qrData = JSON.stringify({ cipherText, keyBase64 })

      // Генерируем QR-код из qrData
      const qrUrl = await QRCode.toDataURL(qrData, {
        // Increase width to make modules larger and easier to scan
        width: 600, // or 600 for higher reliability

        // Margin around the QR code (quiet zone)
        margin: 4, // slightly larger margin helps scanning

        // Error correction level

        // Colors
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })

      setQrCodeUrl(qrUrl)

      // Открываем модальное окно
      onOpen()
    } catch (error) {
      console.error('Ошибка экспорта аккаунта:', error)
      toast.error('Не удалось экспортировать аккаунт')
    } finally {
      setIsExporting(false)
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeUrl) return

    const link = document.createElement('a')
    link.download = `account-export-${Date.now()}.png`
    link.href = qrCodeUrl
    link.click()
  }

  const InfoField: React.FC<{
    label: string
    value: string
    icon: React.ReactNode
    fieldName: string
    canCopy?: boolean
    isSecret?: boolean
  }> = ({
    label,
    value,
    icon,
    fieldName,
    canCopy = true,
    isSecret = false,
  }) => {
    const [isVisible, setIsVisible] = useState(!isSecret)
    const displayValue =
      isSecret && !isVisible ? '•'.repeat(value.length) : value

    return (
      <Card className="bg-slate-50 dark:bg-slate-700/50">
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              <div className="flex-shrink-0 mr-3">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm mb-1">{label}</div>
                <Snippet
                  codeString={displayValue || ''}
                  hideCopyButton={!canCopy}
                  disableCopy={!canCopy}
                  variant="flat"
                  color="secondary"
                  symbol={false}
                  classNames={{
                    base: 'font-mono text-sm break-all',
                  }}
                >
                  {displayValue || 'Не указано'}
                </Snippet>
              </div>
            </div>
            {isSecret && (
              <Button
                isIconOnly
                onPress={() => setIsVisible(!isVisible)}
                title={isVisible ? 'Скрыть' : 'Показать'}
                className="ml-3"
              >
                {isVisible ? <FiEyeOff /> : <FiEye />}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    )
  }

  if (!accountInfo) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-slate-200 dark:bg-slate-600 rounded mr-3"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-1/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Информация об аккаунте</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Данные вашего аккаунта и подключения к серверу
        </p>
      </div>

      <div className="space-y-4">
        <InfoField
          label="ID пользователя"
          value={accountInfo.userId}
          icon={
            <FiUser className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          }
          fieldName="userId"
        />

        <InfoField
          label="Имя пользователя"
          value={accountInfo.username}
          icon={
            <FiUser className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          }
          fieldName="username"
        />

        <InfoField
          label="Публичный адрес"
          value={accountInfo.publicAddress}
          icon={
            <FiKey className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          }
          fieldName="publicAddress"
        />

        <InfoField
          label="Адрес сервера"
          value={accountInfo.serverAddress}
          icon={
            <FiServer className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          }
          fieldName="serverAddress"
        />

        {accountInfo.serverPubKey && (
          <InfoField
            label="Публичный ключ сервера"
            value={accountInfo.serverPubKey}
            icon={
              <FiGlobe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            }
            fieldName="serverPubKey"
            isSecret={true}
          />
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <div className="mb-4">
          <h4 className="text-md font-medium mb-2">Управление устройствами</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Добавьте новое устройство, отсканировав QR-код
          </p>
        </div>

        <Button
          color="primary"
          variant="solid"
          onPress={exportAccount}
          isLoading={isExporting}
          startContent={<FiSmartphone className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          {isExporting ? 'Подготовка...' : 'Добавить новое устройство'}
        </Button>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="md"
        backdrop="blur"
        classNames={{
          base: 'max-w-md',
          body: 'py-6',
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Добавить новое устройство</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">
              Отсканируйте QR-код на новом устройстве
            </p>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col items-center space-y-4">
              {qrCodeUrl && (
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code для добавления устройства"
                    className="w-60 h-60 object-contain"
                  />
                </div>
              )}

              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  QR-код содержит все необходимые данные
                </p>
              </div>

              {exportedData && (
                <div className="w-full space-y-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      copyToClipboard(exportedData.keyBase64, 'ключ')
                    }
                    startContent={<FiCopy className="w-3 h-3" />}
                    className="w-full"
                  >
                    Скопировать ключ
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      copyToClipboard(exportedData.cipherText, 'данные')
                    }
                    startContent={<FiCopy className="w-3 h-3" />}
                    className="w-full"
                  >
                    Скопировать зашифрованные данные
                  </Button>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={downloadQRCode}
              startContent={<FiDownload className="w-4 h-4" />}
            >
              Скачать QR-код
            </Button>
            <Button color="primary" onPress={onClose}>
              Готово
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default AccountSettings
