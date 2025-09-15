'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { HeroUIProvider } from '@heroui/react'
import { ToastProvider } from '@heroui/react'

const inter = Inter({ subsets: ['latin'] })
/*
export const metadata: Metadata = {
  title: 'SHIP - Secure Hidden Internet Protocol',
  description: 'Безопасный мессенджер с шифрованием на основе SHIP протокола',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
}
*/

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} overflow-hidden fixed inset-0 overscroll-none`}
      >
        <HeroUIProvider>
          <ThemeProvider>
            <ToastProvider placement={'top-right'} />
            {children}
          </ThemeProvider>
        </HeroUIProvider>
      </body>
    </html>
  )
}
