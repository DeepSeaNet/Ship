// Цвета для пользователей
const USER_COLORS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
]

const USER_TEXT_COLORS = ['text-white']

export const getUserColor = (name: string) => {
  const charSum = name
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return USER_COLORS[charSum % USER_COLORS.length]
}

export const getUserTextColor = (name: string) => {
  const charSum = name
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return USER_TEXT_COLORS[charSum % USER_TEXT_COLORS.length]
}

// Цвета контейнеров для аватаров
const CONTAINER_COLORS = [
  '#4F46E5, #818CF8', // Blue gradient
  '#8B5CF6, #A78BFA', // Purple gradient
  '#10B981, #34D399', // Green gradient
  '#F59E0B, #FBBF24', // Orange gradient
  '#EC4899, #F472B6', // Pink gradient
  '#14B8A6, #2DD4BF', // Teal gradient
]

// Функция для получения цвета контейнера на основе имени
export const getContainerColor = (name: string) => {
  const charSum = name
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return (
    CONTAINER_COLORS[charSum % CONTAINER_COLORS.length] || '#4F46E5, #8B5CF6'
  )
}
