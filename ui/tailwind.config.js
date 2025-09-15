/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './*.{js,ts,jsx,tsx}',
    '../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        // Основные цвета через CSS-переменные для поддержки динамических тем
        foreground: 'var(--theme-foreground)',
        background: 'var(--theme-background)',
        primary: {
          light: 'var(--theme-primaryLight)',
          DEFAULT: 'var(--theme-primary)',
          dark: 'var(--theme-primaryDark)',
        },
        secondary: {
          light: 'var(--theme-secondaryLight)',
          DEFAULT: 'var(--theme-secondary)',
          dark: 'var(--theme-secondaryDark)',
        },
        accent: {
          light: 'color-mix(in srgb, var(--theme-accent) 80%, white 20%)',
          DEFAULT: 'var(--theme-accent)',
          dark: 'color-mix(in srgb, var(--theme-accent) 80%, black 20%)',
        },
        dark: {
          light: 'var(--theme-dark)',
          DEFAULT: 'var(--theme-dark)',
          dark: 'color-mix(in srgb, var(--theme-dark) 80%, black 20%)',
        },
        light: {
          light: 'color-mix(in srgb, var(--theme-light) 80%, white 20%)',
          DEFAULT: 'var(--theme-light)',
          dark: 'var(--theme-light)',
        },
        // UI состояния
        success: {
          light: 'color-mix(in srgb, var(--theme-success) 30%, white 70%)',
          DEFAULT: 'var(--theme-success)',
          dark: 'color-mix(in srgb, var(--theme-success) 80%, black 20%)',
        },
        warning: {
          light: 'color-mix(in srgb, var(--theme-warning) 30%, white 70%)',
          DEFAULT: 'var(--theme-warning)',
          dark: 'color-mix(in srgb, var(--theme-warning) 80%, black 20%)',
        },
        danger: {
          light: 'color-mix(in srgb, var(--theme-danger) 30%, white 70%)',
          DEFAULT: 'var(--theme-danger)',
          dark: 'color-mix(in srgb, var(--theme-danger) 80%, black 20%)',
        },
        info: {
          light: 'color-mix(in srgb, var(--theme-info) 30%, white 70%)',
          DEFAULT: 'var(--theme-info)',
          dark: 'color-mix(in srgb, var(--theme-info) 80%, black 20%)',
        },
        // Цвета для контейнеров чатов сохраняем для совместимости
        container: {
          blue: 'from-blue-500 to-blue-600',
          orange: 'from-orange-500 to-orange-600',
          green: 'from-green-500 to-green-600',
          red: 'from-red-500 to-red-600',
          purple: 'from-purple-500 to-purple-600',
          yellow: 'from-yellow-500 to-yellow-600',
          teal: 'from-teal-500 to-teal-600',
          pink: 'from-pink-500 to-pink-600',
        },
        // Material Design Colors
        purple: {
          50: '#f3e5f5',
          100: '#e1bee7',
          200: '#ce93d8',
          300: '#ba68c8',
          400: '#ab47bc',
          500: '#9c27b0',
          600: '#8e24aa',
          700: '#7b1fa2',
          800: '#6a1b9a',
          900: '#4a148c',
        },
        indigo: {
          50: '#e8eaf6',
          100: '#c5cae9',
          200: '#9fa8da',
          300: '#7986cb',
          400: '#5c6bc0',
          500: '#3f51b5',
          600: '#3949ab',
          700: '#303f9f',
          800: '#283593',
          900: '#1a237e',
        },
        teal: {
          50: '#e0f2f1',
          100: '#b2dfdb',
          200: '#80cbc4',
          300: '#4db6ac',
          400: '#26a69a',
          500: '#009688',
          600: '#00897b',
          700: '#00796b',
          800: '#00695c',
          900: '#004d40',
        },
        // Дополнительные цвета для состояний интерфейса
        success: {
          light: '#d4edda',
          DEFAULT: '#28a745',
          dark: '#1e7e34',
        },
        warning: {
          light: '#fff3cd',
          DEFAULT: '#ffc107',
          dark: '#d39e00',
        },
        danger: {
          light: '#f8d7da',
          DEFAULT: '#dc3545',
          dark: '#bd2130',
        },
        info: {
          light: '#d1ecf1',
          DEFAULT: '#17a2b8',
          dark: '#117a8b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-in-out',
        'scale-in': 'scaleIn 0.2s ease-in-out',
        ripple: 'ripple 0.6s linear',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        wave: 'wave 8s linear infinite',
        'wave-slow': 'wave-slow 12s linear infinite',
        blob: 'blob 7s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: 1 },
          '100%': { transform: 'scale(2.5)', opacity: 0 },
        },
        wave: {
          '0%': { transform: 'translateX(-100%) scaleY(1)' },
          '50%': { transform: 'translateX(-50%) scaleY(0.8)' },
          '100%': { transform: 'translateX(0%) scaleY(1)' },
        },
        'wave-slow': {
          '0%': { transform: 'translateX(0%) scaleY(1)' },
          '50%': { transform: 'translateX(-50%) scaleY(1.2)' },
          '100%': { transform: 'translateX(-100%) scaleY(1)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
      boxShadow: {
        'elevation-1': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        'elevation-2': '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
        'elevation-3':
          '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
        'elevation-4':
          '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
        'elevation-5':
          '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)',
      },
      // Добавляем возможность использовать тематические цвета в градиентах
      backgroundImage: {
        'gradient-primary':
          'linear-gradient(to right, var(--theme-primary), var(--theme-accent))',
        'gradient-secondary':
          'linear-gradient(to right, var(--theme-secondary), var(--theme-secondaryDark))',
        'gradient-success':
          'linear-gradient(to right, var(--theme-success), color-mix(in srgb, var(--theme-success) 70%, var(--theme-accent) 30%))',
        'gradient-danger':
          'linear-gradient(to right, var(--theme-danger), color-mix(in srgb, var(--theme-danger) 70%, black 30%))',
      },
    },
  },
  plugins: [
    function ({ addBase, addComponents }) {
      // Добавляем утилиты для работы с темами
      addComponents({
        '.theme-transition': {
          transition:
            'color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease',
        },
      })
    },
  ],
}
