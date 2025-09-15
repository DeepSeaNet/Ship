// utils/safeLocalStorage.ts
export const safeLocalStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch {}
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch {}
  },
}
