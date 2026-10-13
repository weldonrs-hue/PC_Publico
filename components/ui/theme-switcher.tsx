'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { useTheme, themes } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

interface ThemeSwitcherProps {
  className?: string
  showLabel?: boolean
}

export default function ThemeSwitcher({
  className,
  showLabel = false,
}: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme, currentThemeOption } = useTheme()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const [alignLeft, setAlignLeft] = useState(false)

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      // Se o botão estiver na metade esquerda da tela (ou com menos de 210px até a borda esquerda),
      // abre o menu alinhado à esquerda (left-0) para não cortar no celular
      setAlignLeft(rect.right < 220)
    }
    setOpen((prev) => !prev)
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 p-2.5 rounded-xl border border-surface-300 bg-surface-100 text-typography-800 shadow-xs hover:bg-surface-200 transition-all focus:outline-none focus:ring-2 focus:ring-primary-200 cursor-pointer active:scale-95"
        title="Escolher Tema"
        aria-label="Escolher Tema"
      >
        <span
          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 dark:border-white/20 shadow-xs"
          style={{ backgroundColor: currentThemeOption.color }}
        />
        <Palette className="w-4 h-4 text-typography-600" />
        {showLabel && (
          <span className="text-xs font-semibold">{currentThemeOption.name}</span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface-100 p-2 shadow-xl border border-surface-300 z-50 animate-in fade-in zoom-in-95 duration-150',
            alignLeft ? 'left-0' : 'right-0'
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-typography-500 mb-1.5 px-2">
            Escolher Tema
          </div>
          <div className="space-y-1">
            {themes.map((item) => {
              const isSelected = theme === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTheme(item.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-typography-800 hover:bg-surface-200 cursor-pointer',
                    isSelected && 'bg-primary-200/10 text-primary-200 font-bold'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary-200" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
