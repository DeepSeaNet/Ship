'use client'

import { useState } from 'react'
import { useTheme } from './ThemeProvider'
import { generateThemeFromPrimaryColor } from '../utils/themeManager'
import { motion } from 'framer-motion'

export default function ThemeSelector() {
  const { currentTheme, setTheme, themes } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState('#3498db')
  const [customThemeName, setCustomThemeName] = useState('Моя тема')
  const [customThemeDark, setCustomThemeDark] = useState(false)

  // Получаем доступные темы
  const availableThemes = Object.values(themes)

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId)
    setIsOpen(false)
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
  }

  const handleCreateCustomTheme = () => {
    const id = `custom-${Date.now()}`
    generateThemeFromPrimaryColor(
      id,
      customThemeName || 'Пользовательская тема',
      customColor,
      customThemeDark,
    )
    setTheme(id)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <motion.button
        onClick={handleToggle}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-600"
          style={{
            background: `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.accent})`,
          }}
        />
        <span className="text-sm font-medium hidden md:block">
          {currentTheme.name}
        </span>
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden z-50 border border-slate-200 dark:border-slate-700"
        >
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-medium">Выберите тему</h3>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            <div className="space-y-2">
              {availableThemes.map((theme) => (
                <div
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`
                    flex items-center gap-3 p-2 rounded cursor-pointer transition-colors
                    ${
                      currentTheme.id === theme.id
                        ? 'bg-slate-100 dark:bg-slate-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }
                  `}
                >
                  <div
                    className={`
                      w-8 h-8 rounded-full border-2 ${
                        theme.isDark ? 'border-slate-600' : 'border-white'
                      } theme-preview-${theme.id}
                    `}
                    style={{
                      background:
                        'linear-gradient(to right, var(--preview-primary), var(--preview-accent))',
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{theme.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {theme.isDark ? 'Темная' : 'Светлая'}
                    </div>
                  </div>
                  {currentTheme.id === theme.id && (
                    <div className="text-primary">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <h3 className="font-medium mb-2">Создать свою тему</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  Название
                </label>
                <input
                  type="text"
                  value={customThemeName}
                  onChange={(e) => setCustomThemeName(e.target.value)}
                  className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Название темы"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  Основной цвет
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-9 w-9 rounded border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="flex-1 p-2 text-sm rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="dark-mode"
                  checked={customThemeDark}
                  onChange={() => setCustomThemeDark((prev) => !prev)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="dark-mode" className="text-sm">
                  Темный режим
                </label>
              </div>

              <button
                onClick={handleCreateCustomTheme}
                className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
              >
                Создать тему
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
