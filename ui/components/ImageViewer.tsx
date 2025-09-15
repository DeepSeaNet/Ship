import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiZoomIn, FiZoomOut, FiDownload } from 'react-icons/fi'
import { Button } from '@heroui/react'

interface ImageViewerProps {
  isOpen: boolean
  imageUrl: string
  onClose: () => void
}

export default function ImageViewer({
  isOpen,
  imageUrl,
  onClose,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1)

  // Reset scale when a new image is shown
  useEffect(() => {
    if (isOpen) {
      setScale(1)
    }
  }, [isOpen, imageUrl])

  // Close on escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleZoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.25, 0.5))
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = imageUrl.split('/').pop() || 'image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-slate-800/40 dark:bg-slate-900/40"
          onClick={onClose}
        >
          <div
            className="relative max-w-full max-h-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.img
              src={imageUrl}
              alt="Full screen view"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              style={{
                transformOrigin: 'center',
                transform: `scale(${scale})`,
                transition: 'transform 0.2s ease-out',
              }}
              drag
              dragConstraints={{
                left: -100,
                right: 100,
                top: -100,
                bottom: 100,
              }}
            />

            <div className="absolute top-4 right-4 flex items-center space-x-2">
              <Button
                isIconOnly
                variant="flat"
                radius="full"
                size="sm"
                onClick={handleZoomIn}
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
              >
                <FiZoomIn />
              </Button>
              <Button
                isIconOnly
                variant="flat"
                radius="full"
                size="sm"
                onClick={handleZoomOut}
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
              >
                <FiZoomOut />
              </Button>
              <Button
                isIconOnly
                variant="flat"
                radius="full"
                size="sm"
                onClick={handleDownload}
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
              >
                <FiDownload />
              </Button>
              <Button
                isIconOnly
                variant="flat"
                radius="full"
                size="sm"
                onClick={onClose}
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
              >
                <FiX />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
