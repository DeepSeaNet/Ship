/**
 * Утилита для управления темами приложения
 * Предоставляет простой API для регистрации и использования пользовательских тем
 */

import { Theme, ThemeColors } from '@/types/theme'

// Глобальный реестр тем
const themeRegistry: Record<string, Theme> = {}

// Регистрирует новую тему в реестре
export function registerTheme(theme: Theme): void {
  if (themeRegistry[theme.id]) {
    console.warn(
      `Тема с ID "${theme.id}" уже зарегистрирована. Переопределение...`,
    )
  }

  // Проверка обязательных полей
  const requiredColors: Array<keyof ThemeColors> = [
    'foreground',
    'background',
    'primary',
    'secondary',
    'accent',
    'dark',
    'light',
  ]

  const missingColors = requiredColors.filter((color) => !theme.colors[color])

  if (missingColors.length) {
    console.error(
      `Тема "${theme.id}" не содержит обязательные цвета: ${missingColors.join(', ')}`,
    )
    return
  }

  // Добавляем тему в реестр
  themeRegistry[theme.id] = theme

  // Создаем CSS переменные для новой темы (используется для предпросмотра в селекторе тем)
  const styleId = `theme-preview-${theme.id}`
  let styleElement = document.getElementById(styleId)

  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = styleId
    document.head.appendChild(styleElement)
  }

  let cssVars = `.theme-preview-${theme.id} {\n`

  Object.entries(theme.colors).forEach(([key, value]) => {
    cssVars += `  --preview-${key}: ${value};\n`
  })

  cssVars += '}\n'
  styleElement.textContent = cssVars

  console.log(`Тема "${theme.name}" (${theme.id}) успешно зарегистрирована`)
}

// Возвращает список всех зарегистрированных тем
export function getAvailableThemes(): Theme[] {
  return Object.values(themeRegistry)
}

// Возвращает тему по ID
export function getThemeById(themeId: string): Theme | undefined {
  return themeRegistry[themeId]
}

/**
 * Создает новую тему на основе базовой с переопределением некоторых цветов
 * Полезно для быстрого создания вариаций существующих тем
 */
export function createThemeVariant(
  baseThemeId: string,
  newThemeId: string,
  newThemeName: string,
  colorOverrides: Partial<ThemeColors>,
): Theme | null {
  const baseTheme = themeRegistry[baseThemeId]

  if (!baseTheme) {
    console.error(`Базовая тема "${baseThemeId}" не найдена`)
    return null
  }

  // Используем явное приведение типов для устранения ошибки с undefined
  const mergedColors: ThemeColors = {
    ...baseTheme.colors,
    ...(colorOverrides as ThemeColors),
  }

  const newTheme: Theme = {
    id: newThemeId,
    name: newThemeName,
    isDark: baseTheme.isDark,
    colors: mergedColors,
  }

  registerTheme(newTheme)
  return newTheme
}

/**
 * Функция для генерации темы на основе одного основного цвета
 * Автоматически создает палитру согласованных цветов
 */
export function generateThemeFromPrimaryColor(
  id: string,
  name: string,
  primaryColor: string,
  isDark: boolean = false,
  accentColor?: string, // Добавляем опциональный параметр для акцентного цвета
): Theme {
  // Используем CSS переменные для вычисления цветов
  const tempEl = document.createElement('div')
  document.body.appendChild(tempEl)

  // Устанавливаем первичный цвет
  tempEl.style.color = primaryColor
  const computedPrimary = getComputedStyle(tempEl).color

  // Вычисляем акцентный цвет, если не передан
  let computedAccent
  if (accentColor) {
    tempEl.style.color = accentColor
    computedAccent = getComputedStyle(tempEl).color
  } else {
    // Если акцентный цвет не передан, генерируем его из цветового круга (сдвиг на 120 градусов в HSL)
    if (computedPrimary.startsWith('rgb')) {
      // Извлекаем RGB компоненты
      const rgbMatch = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(
        computedPrimary,
      )
      if (rgbMatch) {
        const [_, r, g, b] = rgbMatch.map(Number)

        // Для простоты используем цвет-комплимент (его желтоватый вариант для светлых тем, оранжевый для темных)
        computedAccent = isDark
          ? 'rgb(255, 159, 28)' // Более теплый оранжевый для темной темы
          : 'rgb(255, 140, 0)' // Более насыщенный оранжевый для светлой темы
      } else {
        computedAccent = isDark ? '#FF9F1C' : '#FF8C00'
      }
    } else {
      computedAccent = isDark ? '#FF9F1C' : '#FF8C00'
    }
  }

  // Определяем цвета на основе основного цвета
  const colors: ThemeColors = isDark
    ? {
        // Темная тема
        foreground: '#FFFFFF',
        background: '#121212',
        backgroundAlt: '#1E1E1E',
        primary: computedPrimary,
        primaryLight: `color-mix(in srgb, ${computedPrimary} 80%, white 20%)`,
        primaryDark: `color-mix(in srgb, ${computedPrimary} 80%, black 20%)`,
        secondary: `color-mix(in srgb, ${computedPrimary} 30%, #2D2D2D 70%)`,
        secondaryLight: `color-mix(in srgb, ${computedPrimary} 20%, #3D3D3D 80%)`,
        secondaryDark: `color-mix(in srgb, ${computedPrimary} 20%, #1D1D1D 80%)`,
        accent: computedAccent,
        dark: '#121212',
        light: '#F5F5F5',
        success: '#4CAF50',
        warning: '#FFC107',
        danger: '#F44336',
        info: '#2196F3',
        surface: '#2D2D2D',
      }
    : {
        // Светлая тема
        foreground: '#000000',
        background: '#F5F5F5',
        backgroundAlt: '#FFFFFF',
        primary: computedPrimary,
        primaryLight: `color-mix(in srgb, ${computedPrimary} 80%, white 20%)`,
        primaryDark: `color-mix(in srgb, ${computedPrimary} 80%, black 20%)`,
        secondary: `color-mix(in srgb, ${computedPrimary} 20%, #F0F0F0 80%)`,
        secondaryLight: `color-mix(in srgb, ${computedPrimary} 10%, #FFFFFF 90%)`,
        secondaryDark: `color-mix(in srgb, ${computedPrimary} 30%, #E0E0E0 70%)`,
        accent: computedAccent,
        dark: '#212121',
        light: '#FFFFFF',
        success: '#4CAF50',
        warning: '#FF9800',
        danger: '#F44336',
        info: '#2196F3',
        surface: '#FFFFFF',
      }

  // Удаляем временный элемент
  document.body.removeChild(tempEl)

  // Создаем тему и регистрируем ее
  const theme: Theme = { id, name, isDark, colors }
  registerTheme(theme)

  return theme
}
