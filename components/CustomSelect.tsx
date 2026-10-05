'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: (CustomSelectOption | string)[];
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  label,
  className = '',
  disabled = false,
  size = 'sm',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectId = useId();

  // Normalizar opções para formato uniforme
  const normalizedOptions: CustomSelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'h-8 sm:h-9 px-2.5 sm:px-3 text-xs',
    md: 'h-9 sm:h-10 px-3 sm:px-3.5 text-xs sm:text-sm',
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {label && (
        <label 
          htmlFor={selectId}
          className="block text-[10px] font-black uppercase text-typography-400 tracking-wider mb-1 ml-1"
        >
          {label}
        </label>
      )}

      {/* Botão Gatilho */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full ${sizeClasses[size]} rounded-xl font-bold bg-surface-200/80 hover:bg-surface-200 active:scale-[0.99] border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 text-typography-900 flex items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-typography-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary-200' : ''
          }`}
        />
      </button>

      {/* Painel Dropdown Customizado */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute left-0 top-full mt-1.5 z-[100] min-w-full w-max max-w-[280px] bg-surface-100 border border-surface-300 rounded-2xl shadow-xl p-1.5 space-y-0.5 overflow-hidden"
          >
            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-primary-200 text-white shadow-2xs'
                        : 'text-typography-700 hover:bg-surface-200 hover:text-typography-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className={`text-[10px] font-normal truncate ${isSelected ? 'text-white/80' : 'text-typography-400'}`}>
                          {opt.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-surface-300 text-typography-500'
                        }`}>
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={14} className="shrink-0 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
