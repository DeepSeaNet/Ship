/**
 * Форматирует timestamp для отображения времени последней активности
 * в зависимости от того, как давно произошло событие
 */
export function formatLastActive(timestamp: string | number): string {
  // Преобразуем числовой timestamp в дату, если необходимо
  const date =
    typeof timestamp === 'number'
      ? new Date(timestamp * 1000) // Умножаем на 1000, так как timestamp с бэкенда в секундах
      : new Date(timestamp)

  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Разница в секундах
  const seconds = Math.floor(diff / 1000)

  // Если меньше минуты
  if (seconds < 60) {
    return 'Только что'
  }

  // Если меньше часа
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} ${formatMinutes(minutes)} назад`
  }

  // Если меньше суток
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    return `${hours} ${formatHours(hours)} назад`
  }

  // Если вчера
  if (isYesterday(date)) {
    return 'Вчера'
  }

  // Если в этом году
  if (date.getFullYear() === now.getFullYear()) {
    return formatDate(date, false)
  }

  // Если в другом году
  return formatDate(date, true)
}

/**
 * Форматирует метку времени в удобный для чтения формат времени
 */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  return `${hours}:${minutes}`
}

/**
 * Форматирует дату сообщения для отображения в чате
 * Возвращает строку формата "Вчера", "Сегодня" или конкретную дату
 */
export function formatMessageDate(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()

  // Если сегодня
  if (isSameDay(date, now)) {
    return 'Сегодня'
  }

  // Если вчера
  if (isYesterday(date)) {
    return 'Вчера'
  }

  // Возвращаем полную дату
  return formatDate(date, date.getFullYear() !== now.getFullYear())
}

/**
 * Проверяет, соответствует ли дата вчерашнему дню
 */
function isYesterday(date: Date): boolean {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return isSameDay(date, yesterday)
}

/**
 * Проверяет, относятся ли две даты к одному и тому же дню
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

/**
 * Форматирует дату в строку
 */
function formatDate(date: Date, includeYear: boolean): string {
  const day = date.getDate()
  const month = getMonthName(date.getMonth())

  return includeYear
    ? `${day} ${month} ${date.getFullYear()}`
    : `${day} ${month}`
}

/**
 * Возвращает название месяца по его номеру
 */
function getMonthName(month: number): string {
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ]

  return months[month]
}

/**
 * Возвращает слово "минута" в правильном склонении
 */
function formatMinutes(minutes: number): string {
  if (minutes % 10 === 1 && minutes % 100 !== 11) {
    return 'минуту'
  } else if (
    [2, 3, 4].includes(minutes % 10) &&
    ![12, 13, 14].includes(minutes % 100)
  ) {
    return 'минуты'
  } else {
    return 'минут'
  }
}

/**
 * Возвращает слово "час" в правильном склонении
 */
function formatHours(hours: number): string {
  if (hours % 10 === 1 && hours % 100 !== 11) {
    return 'час'
  } else if (
    [2, 3, 4].includes(hours % 10) &&
    ![12, 13, 14].includes(hours % 100)
  ) {
    return 'часа'
  } else {
    return 'часов'
  }
}
