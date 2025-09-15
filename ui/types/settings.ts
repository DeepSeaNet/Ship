// Интерфейсы для состояний и настроек
export interface AppearanceSettings {
  markdownEnabled: boolean
  markdownSyntaxHighlighting: boolean
  markdownMathEnabled: boolean
  markdownDiagramsEnabled: boolean
  fontSize: number
  interfaceFontSize: number
  messageWidth: 'narrow' | 'normal' | 'wide'
  lineSpacing: number
}
