'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemeType = '' | 'theme-teal' | 'theme-blue' | 'theme-dark'

export interface ThemeOption {
  id: ThemeType
  name: string
  color: string
  isDark: boolean
}

export const themes: ThemeOption[] = [
  { id: '', name: 'Roxo (Padrão)', color: '#6d42be', isDark: false },
  { id: 'theme-teal', name: 'Verde / Teal', color: '#178582', isDark: false },
  { id: 'theme-blue', name: 'Azul', color: '#3e6ba3', isDark: false },
  { id: 'theme-dark', name: 'Escuro', color: '#5d349e', isDark: true },
]

export const themeColorsMap: Record<ThemeType, string> = {
  '': '#6d42be',
  'theme-teal': '#178582',
  'theme-blue': '#3e6ba3',
  'theme-dark': '#5d349e',
}

interface ThemeContextType {
  theme: ThemeType
  setTheme: (theme: ThemeType) => void
  isDark: boolean
  currentThemeOption: ThemeOption
}

const ThemeContext = createContext<ThemeContextType>({
  theme: '',
  setTheme: () => {},
  isDark: false,
  currentThemeOption: themes[0],
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('')

  useEffect(() => {
    try {
      const saved = (localStorage.getItem('theme') || '') as ThemeType
      const exists = themes.some((t) => t.id === saved)
      if (exists) {
        setThemeState(saved)
        applyThemeClass(saved)
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [])

  const applyThemeClass = (newTheme: ThemeType) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    // Remove any previously set theme classes
    themes.forEach((t) => {
      if (t.id) root.classList.remove(t.id)
    })

    if (newTheme) {
      root.classList.add(newTheme)
    }

    // Update meta theme-color
    const color = themeColorsMap[newTheme] || '#6d42be'
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', color)
    }
  }

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme)
    applyThemeClass(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
    } catch {
      // Ignore localStorage write errors
    }
  }

  const isDark = theme === 'theme-dark'
  const currentThemeOption = themes.find((t) => t.id === theme) || themes[0]

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, currentThemeOption }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
