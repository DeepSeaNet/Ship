'use client'
import { useState, useEffect, memo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FiAnchor,
  FiUser,
  FiLock,
  FiMail,
  FiArrowRight,
  FiPlusCircle,
  FiCamera,
} from 'react-icons/fi'
import {
  Button,
  Form,
  Input,
  Modal,
  ModalContent,
  ModalFooter,
  Selection,
  ModalHeader,
  ModalBody,
  Textarea,
  useDisclosure,
} from '@heroui/react'
import { Listbox, ListboxItem, Avatar } from '@heroui/react'
import { login, register, Account, import_account } from '@/hooks/Auth'
import { invoke } from '@tauri-apps/api/core'
import Webcam from 'react-webcam'
import jsQR from 'jsqr'

// UsernameSelector component (remains unchanged)
const UsernameSelector = memo(
  ({
    accounts,
    loadingAccounts,
    username,
    setUsername,
    onAccountChoiceOpen,
  }: {
    accounts: Account[]
    loadingAccounts: boolean
    username: string
    setUsername: (username: string) => void
    onAccountChoiceOpen: () => void
  }) => {
    const handleSelectionChange = (keys: Selection) => {
      const selectedKey = Array.from(keys)[0]
      if (selectedKey) {
        if (selectedKey === 'new') {
          onAccountChoiceOpen()
          return
        }
        const account = accounts.find(
          (acc: Account) => acc.user_id.toString() === selectedKey,
        )
        setUsername(account?.username || '')
      } else {
        setUsername('')
      }
    }

    if (loadingAccounts) {
      return (
        <div className="relative">
          <div className="w-full border-2 border-primary-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <FiUser className="text-slate-400" />
              <span className="text-slate-400">Загрузка аккаунтов...</span>
            </div>
          </div>
        </div>
      )
    }

    const selectedAccount = accounts.find(
      (acc: Account) => acc.username === username,
    )
    const selectedKeys = selectedAccount
      ? new Set([selectedAccount.user_id.toString()])
      : new Set<string>()

    return (
      <div className="relative">
        <label className="block text-sm font-medium text-foreground mb-2">
          Имя пользователя
        </label>
        <div className="w-full border-2 border-primary-200 rounded-lg">
          <Listbox
            aria-label="Выберите аккаунт"
            selectionMode="single"
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            className="max-h-48 overflow-y-auto"
          >
            <>
              {accounts.map((account) => (
                <ListboxItem
                  key={account.user_id}
                  textValue={account.username}
                  className="py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={account.server_address}
                      name={account.username}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-small font-medium">
                        {account.username}
                      </span>
                      <span className="text-tiny text-default-600">
                        {account.public_address}@
                        {account.server_address
                          .replace(/^https?:\/\//, '')
                          .replace(/:\d+$/, '')}
                      </span>
                    </div>
                  </div>
                </ListboxItem>
              ))}
              <ListboxItem key="new" textValue="New account">
                <div className="flex items-center gap-3">
                  <FiPlusCircle />
                  <div className="flex flex-col">
                    <span className="text-small font-medium">New account</span>
                  </div>
                </div>
              </ListboxItem>
            </>
          </Listbox>
        </div>
      </div>
    )
  },
)

UsernameSelector.displayName = 'UsernameSelector'

// Auth component (Corrected and Improved)
export default function Auth({
  onAuthSuccess,
}: {
  onAuthSuccess: (userData: { user_id: string; username: string }) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [importData, setImportData] = useState('')
  const [importKey, setImportKey] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  // New state for QR code location and video dimensions
  const [qrCodeLocation, setQrCodeLocation] = useState<any>(null)
  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  })

  // Refs for webcam, canvas, and scanning interval
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const {
    isOpen: isAccountChoiceOpen,
    onOpen: onAccountChoiceOpen,
    onOpenChange: onAccountChoiceOpenChange,
    onClose: onAccountChoiceClose,
  } = useDisclosure()
  const {
    isOpen: isImportFormOpen,
    onOpen: onImportFormOpen,
    onOpenChange: onImportFormOpenChange,
    onClose: onImportFormClose,
  } = useDisclosure()

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true)
        const accountList = (await invoke('get_account_list')) as Account[]
        setAccounts(accountList)
      } catch (err) {
        console.error('Failed to load accounts:', err)
      } finally {
        setLoadingAccounts(false)
      }
    }
    loadAccounts()
  }, [])

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
    }
  }, [])

  // The core QR scanning logic
  const capture = () => {
    const video = webcamRef.current?.video as HTMLVideoElement
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.filter = 'grayscale(100%) contrast(120%) brightness(110%)'
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.filter = 'none'

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert', // Faster if you know QR orientation
    })
    console.log('code', code)
    if (code) {
      try {
        const data = JSON.parse(code.data)
        if (data.cipherText && data.keyBase64) {
          setImportData(data.cipherText)
          setImportKey(data.keyBase64)
          stopScanning()
        }
      } catch (e) {
        console.error('Invalid QR data:', e)
      }
    }
  }

  const startScanning = () => {
    setIsScanning(true)
    // Start scanning every 300ms
    scanIntervalRef.current = setInterval(capture, 100)
  }

  const stopScanning = () => {
    setIsScanning(false)
    setQrCodeLocation(null) // Clear the bounding box
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isRegister) {
        const result = await register(username, email, password)
        if (result) {
          const loginResult = await login(username)
          const userData = {
            user_id: loginResult.user_id.toString(),
            username: username.trim(),
            public_address: loginResult.public_address,
            server_address: loginResult.server_address,
            server_pub_key: loginResult.server_pub_key,
          }
          localStorage.setItem('userId', userData.user_id)
          localStorage.setItem('username', userData.username)
          localStorage.setItem('publicAddress', userData.public_address)
          localStorage.setItem('serverAddress', userData.server_address)
          localStorage.setItem('serverPubKey', userData.server_pub_key)
          onAuthSuccess(userData)
        }
      } else {
        if (username === '') {
          setError('Выберите аккаунт')
          setIsLoading(false)
          return
        }
        const loginResult = await login(username)
        if (loginResult) {
          const userData = {
            user_id: loginResult.user_id.toString(),
            username: username.trim(),
            public_address: loginResult.public_address,
            server_address: loginResult.server_address,
            server_pub_key: loginResult.server_pub_key,
          }
          localStorage.setItem('userId', userData.user_id)
          localStorage.setItem('username', userData.username)
          localStorage.setItem('publicAddress', userData.public_address)
          localStorage.setItem('serverAddress', userData.server_address)
          localStorage.setItem('serverPubKey', userData.server_pub_key)
          onAuthSuccess(userData)
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      let message = 'Произошла ошибка'
      const errorString = String(err)
      if (errorString.includes('username already exists')) {
        message = 'Имя пользователя уже занято'
      } else if (typeof err === 'string') {
        message = err
      }
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportAccount = async () => {
    try {
      const user_id = await import_account(importData, importKey)
      console.log('Imported user_id: ', user_id)
      onImportFormOpenChange()
      setImportData('')
      setImportKey('')
      const accountList = (await invoke('get_account_list')) as Account[]
      setAccounts(accountList)
    } catch (error) {
      console.error('Import failed:', error)
    }
  }

  return (
    <>
      {/* ... The main Auth form JSX remains the same ... */}
      <div className="min-h-[100svh] flex items-center justify-center relative bg-slate-50 dark:bg-slate-900">
        {/* ... Animated background ... */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 m-4">
            <div className="flex flex-col items-center mb-8">
              <div className="container-gradient rounded-2xl h-16 w-16 flex items-center justify-center text-white mb-4 relative overflow-hidden">
                <FiAnchor className="h-8 w-8" />
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/20 animate-wave"></div>
              </div>
              <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {isRegister ? 'Создать аккаунт' : 'Добро пожаловать'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-center">
                {isRegister
                  ? 'Зарегистрируйтесь для доступа к SHIP'
                  : 'Войдите в свой аккаунт SHIP'}
              </p>
            </div>

            <Form
              onSubmit={handleAuth}
              className="w-full justify-center items-center space-y-4"
            >
              <div className="flex flex-col gap-4 max-w-md">
                <div className="relative">
                  {!isRegister && (
                    <UsernameSelector
                      accounts={accounts}
                      loadingAccounts={loadingAccounts}
                      username={username}
                      setUsername={setUsername}
                      onAccountChoiceOpen={onAccountChoiceOpen}
                    />
                  )}
                </div>

                {isRegister && (
                  <>
                    <Input
                      variant="bordered"
                      color="primary"
                      name="name"
                      type="name"
                      label="Имя пользователя"
                      labelPlacement="outside"
                      placeholder="Имя пользователя"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      startContent={<FiUser className="text-slate-400" />}
                      size="lg"
                      autoCorrect="off"
                      isRequired
                    />
                    <Input
                      variant="bordered"
                      color="primary"
                      name="email"
                      type="email"
                      placeholder="Email"
                      label="Email"
                      labelPlacement="outside"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      isRequired
                      size="lg"
                      startContent={<FiMail className="text-slate-400" />}
                    />
                  </>
                )}

                <Input
                  variant="bordered"
                  color="primary"
                  name="password"
                  type="password"
                  placeholder="Пароль"
                  label="Пароль"
                  labelPlacement="outside"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isRequired
                  size="lg"
                  startContent={<FiLock className="text-slate-400" />}
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                variant="flat"
                size="lg"
                color="primary"
                className="w-full"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isRegister ? 'Зарегистрироваться' : 'Войти'}
                      <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </Button>
            </Form>

            <div className="mt-6 text-center">
              {isRegister && (
                <button
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-primary hover:underline font-medium"
                >
                  {isRegister
                    ? 'Уже есть аккаунт? Войти'
                    : 'Нет аккаунта? Зарегистрироваться'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Account Choice Modal (Unchanged) */}
      <Modal
        isOpen={isAccountChoiceOpen}
        onOpenChange={onAccountChoiceOpenChange}
        placement="center"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <h3>Создать или импортировать аккаунт?</h3>
          </ModalHeader>
          <ModalBody>
            <p>Выберите действие:</p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={() => {
                setIsRegister(true)
                onAccountChoiceClose()
              }}
            >
              Создать новый
            </Button>
            <Button
              variant="flat"
              onPress={() => {
                onImportFormOpen()
                onAccountChoiceClose()
              }}
            >
              Импортировать
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import Modal (Updated with Visual Indicator) */}
      <Modal
        isOpen={isImportFormOpen}
        onOpenChange={(open) => {
          onImportFormOpenChange()
          if (!open) {
            stopScanning() // Ensure scanning stops when modal is closed
          }
        }}
        placement="center"
        backdrop="blur"
        size="lg"
      >
        <ModalContent>
          <ModalHeader>
            <h3>Импорт аккаунта</h3>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {isScanning && (
                <div className="relative w-full aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/png"
                    className="w-full h-full object-cover"
                    videoConstraints={{
                      facingMode: 'environment',
                      width: { ideal: 1920 },
                      height: { ideal: 1080 },
                    }}
                    onUserMedia={(stream) => {
                      const track = stream.getVideoTracks()[0]
                      const settings = track.getSettings()
                      if (settings.width && settings.height) {
                        setVideoDimensions({
                          width: settings.width,
                          height: settings.height,
                        })
                      }
                    }}
                  />
                  {/* Hidden canvas for processing video frames */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* SVG overlay for drawing the bounding box */}
                  {qrCodeLocation && (
                    <svg
                      className="absolute top-0 left-0 w-full h-full"
                      viewBox={`0 0 ${videoDimensions.width} ${videoDimensions.height}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ pointerEvents: 'none' }}
                    >
                      <path
                        d={`M${qrCodeLocation.topLeftCorner.x},${qrCodeLocation.topLeftCorner.y} L${qrCodeLocation.topRightCorner.x},${qrCodeLocation.topRightCorner.y} L${qrCodeLocation.bottomRightCorner.x},${qrCodeLocation.bottomRightCorner.y} L${qrCodeLocation.bottomLeftCorner.x},${qrCodeLocation.bottomLeftCorner.y} Z`}
                        fill="rgba(74, 222, 128, 0.3)"
                        stroke="rgb(34, 197, 94)"
                        strokeWidth="4"
                      />
                    </svg>
                  )}

                  <Button
                    variant="flat"
                    color="danger"
                    onPress={stopScanning}
                    className="absolute top-2 right-2 z-10"
                  >
                    Остановить
                  </Button>
                </div>
              )}
              <Textarea
                placeholder="Вставьте данные аккаунта (до 4000+ символов)"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                minRows={6}
              />
              <Input
                placeholder="Ключ"
                value={importKey}
                onChange={(e) => setImportKey(e.target.value)}
                type="password"
              />
              {!isScanning && (
                <Button
                  variant="flat"
                  color="primary"
                  onPress={startScanning}
                  startContent={<FiCamera />}
                >
                  Отсканировать QR-код
                </Button>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={onImportFormClose}>
              Отмена
            </Button>
            <Button
              color="primary"
              onPress={handleImportAccount}
              isDisabled={!importData.trim() || !importKey.trim()}
            >
              Импортировать
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
