import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppearanceSettings {
  markdownEnabled: boolean
  markdownSyntaxHighlighting: boolean
  markdownMathEnabled: boolean
  markdownDiagramsEnabled: boolean
  fontSize: number
  interfaceFontSize: number
  messageWidth: 'narrow' | 'normal' | 'wide'
  lineSpacing: number
}

interface SettingsStore {
  appearanceSettings: AppearanceSettings
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      appearanceSettings: {
        markdownEnabled: true,
        markdownSyntaxHighlighting: true,
        markdownMathEnabled: true,
        markdownDiagramsEnabled: true,
        fontSize: 16,
        interfaceFontSize: 14,
        messageWidth: 'normal',
        lineSpacing: 1.5,
      },
      updateAppearanceSettings: (settings) =>
        set((state) => ({
          appearanceSettings: {
            ...state.appearanceSettings,
            ...settings,
          },
        })),
    }),
    {
      name: 'settings-storage',
    },
  ),
)
