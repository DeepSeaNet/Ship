// Определение структуры темы
export interface ThemeColors {
  foreground: string
  background: string
  primary: string
  secondary: string
  accent: string
  dark: string
  light: string
  success: string
  warning: string
  danger: string
  info: string
  // Добавляем дополнительные цвета для градиентов и компонентов
  primaryLight: string
  primaryDark: string
  secondaryLight: string
  secondaryDark: string
  backgroundAlt: string
  surface: string
  [key: string]: string // Разрешаем дополнительные свойства
}

// Тип для определения темы
export interface Theme {
  id: string
  name: string
  isDark: boolean
  colors: ThemeColors
}
