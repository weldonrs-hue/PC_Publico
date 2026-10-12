'use client';

import { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
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
  dropdownClassName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  searchable?: boolean;
  direction?: 'down' | 'up' | 'auto';
  align?: 'left' | 'right';
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  label,
  className = '',
  dropdownClassName = '',
  disabled = false,
  size = 'sm',
  searchable,
  direction = 'down',
  align = 'left',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  // Normalizar opções para formato uniforme
  const normalizedOptions: CustomSelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Ativa busca automaticamente se mais de 7 opções ou explicitamente configurado
  const isSearchEnabled = searchable ?? normalizedOptions.length > 7;

  // Filtragem de opções
  const filteredOptions = useMemo(() => {
    if (!isSearchEnabled || !searchQuery.trim()) {
      return normalizedOptions;
    }
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery, isSearchEnabled]);

  // Foco no campo de busca ao abrir
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (isSearchEnabled) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, isSearchEnabled]);

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

  const isUp = direction === 'up';
  const isRight = align === 'right';

  return (
    <div ref={containerRef} className={`relative inline-block max-w-full ${className}`}>
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
        className={`w-full max-w-full min-w-0 overflow-hidden ${sizeClasses[size]} rounded-xl font-bold bg-surface-200/80 hover:bg-surface-200 active:scale-[0.99] border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 text-typography-900 flex items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate min-w-0 flex-1 text-left">
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
            initial={{ opacity: 0, y: isUp ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isUp ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className={`absolute ${isRight ? 'right-0' : 'left-0'} ${
              isUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            } z-[100] min-w-full bg-surface-100 border border-surface-300 rounded-2xl shadow-xl p-1.5 space-y-1 overflow-hidden ${
              dropdownClassName || 'w-max max-w-[min(320px,calc(100vw-2rem))]'
            }`}
          >
            {/* Campo de Busca Rápida */}
            {isSearchEnabled && (
              <div className="px-1 pt-0.5 pb-1">
                <div className="relative flex items-center">
                  <Search size={12} className="absolute left-2.5 text-typography-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-7 pr-2.5 py-1 text-xs font-medium rounded-lg bg-surface-200/70 border border-surface-300/60 text-typography-900 placeholder:text-typography-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                  />
                </div>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-typography-400 italic">
                  Nenhum resultado
                </div>
              ) : (
                filteredOptions.map((opt) => {
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
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
