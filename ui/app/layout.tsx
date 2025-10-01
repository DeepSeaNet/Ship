'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { HeroUIProvider } from '@heroui/react'
import { ToastProvider } from '@heroui/react'
import Head from 'next/head'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
      </Head>
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
