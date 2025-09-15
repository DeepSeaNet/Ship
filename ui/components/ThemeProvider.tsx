'use client'

import {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from 'react'
import { Theme } from '@/types/theme'
import { THEMES } from '@/themes/themes'

// Интерфейс контекста темы
interface ThemeContextType {
  currentTheme: Theme
  setTheme: (themeId: string) => void
  toggleDarkMode: () => void
  themes: Record<string, Theme>
  addTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Создаем стейт с доступными темами
  const [themes, setThemes] = useState<Record<string, Theme>>(THEMES)

  // Стейт для текущей темы
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES.light)

  // Загружаем тему из хранилища при инициализации
  useEffect(() => {
    const storedThemeId = localStorage.getItem('themeId') || 'light'

    // Если тема есть в нашем наборе, используем её
    if (themes[storedThemeId]) {
      setCurrentTheme(themes[storedThemeId])
    }
    // Иначе используем системные предпочтения
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setCurrentTheme(themes.dark)
    }
  }, [themes])

  // Применяем тему при её изменении
  useEffect(() => {
    // Добавляем/удаляем класс dark для tailwind
    if (currentTheme.isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Устанавливаем CSS переменные
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--theme-${key}`, value)
    })

    // Устанавливаем дата-атрибут с ID темы для возможного CSS таргетинга
    document.documentElement.setAttribute('data-theme', currentTheme.id)

    // Сохраняем в localStorage
    localStorage.setItem('themeId', currentTheme.id)
  }, [currentTheme])

  // Функция для установки темы по ID
  const setTheme = (themeId: string) => {
    if (themes[themeId]) {
      setCurrentTheme(themes[themeId])
    } else {
      console.error(`Theme with id "${themeId}" not found`)
    }
  }

  // Переключение между светлым и темным режимом
  const toggleDarkMode = () => {
    const currentIsDark = currentTheme.isDark

    // Находим первую тему противоположного типа
    const oppositeTheme = Object.values(themes).find(
      (theme) => theme.isDark !== currentIsDark,
    )
    if (oppositeTheme) {
      setCurrentTheme(oppositeTheme)
    }
  }

  // Добавление новой темы
  const addTheme = (theme: Theme) => {
    setThemes((prevThemes) => ({
      ...prevThemes,
      [theme.id]: theme,
    }))
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        toggleDarkMode,
        themes,
        addTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
