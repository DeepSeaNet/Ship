import js from '@eslint/js'
import ts from 'typescript-eslint'
import unusedImports from 'eslint-plugin-unused-imports'

export default [
  {
    ignores: [
      'node_modules/**',
      'ui/dist/**',
      'ui/out/**',
      'build/**',
      'target/**',
      'ui/.next/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['src/**/*.{js,ts,jsx,tsx}', 'ui/**/*.{js,ts,jsx,tsx}'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      // Неиспользуемые переменные
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
]
