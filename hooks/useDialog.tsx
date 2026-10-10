'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, HelpCircle, Trash2, X, Check, Edit3 } from 'lucide-react';

type DialogType = 'alert' | 'confirm' | 'prompt';
type DialogVariant = 'default' | 'danger' | 'warning';

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  defaultValue?: string;
  placeholder?: string;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  type: DialogType;
  resolve: (value: any) => void;
  promptValue?: string;
}

interface DialogContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showDeleteConfirm: (message: string, title?: string) => Promise<boolean>;
  showPrompt: (message: string, defaultValue?: string, title?: string, placeholder?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');

  const showAlert = useCallback((message: string, title: string = 'Aviso') => {
    return new Promise<void>((resolve) => {
      setDialog({
        isOpen: true,
        type: 'alert',
        variant: 'default',
        title,
        message,
        confirmText: 'Entendido',
        resolve: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  }, []);

  const showConfirm = useCallback((message: string, title: string = 'Confirmação') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        variant: 'default',
        title,
        message,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        resolve: (value: boolean) => {
          setDialog(null);
          resolve(value);
        },
      });
    });
  }, []);

  const showDeleteConfirm = useCallback((message: string, title: string = 'Excluir') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        variant: 'danger',
        title,
        message,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        resolve: (value: boolean) => {
          setDialog(null);
          resolve(value);
        },
      });
    });
  }, []);

  const showPrompt = useCallback((message: string, defaultValue: string = '', title: string = 'Informar Dados', placeholder: string = '') => {
    setInputValue(defaultValue);
    return new Promise<string | null>((resolve) => {
      setDialog({
        isOpen: true,
        type: 'prompt',
        variant: 'default',
        title,
        message,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        defaultValue,
        placeholder,
        resolve: (value: string | null) => {
          setDialog(null);
          resolve(value);
        },
      });
    });
  }, []);

  const isDanger = dialog?.variant === 'danger';

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showDeleteConfirm, showPrompt }}>
      {children}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (dialog.type === 'alert') dialog.resolve(true);
                else dialog.resolve(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-100 border border-surface-300 shadow-2xl text-typography-900"
            >
              {/* Top Accent Stripe */}
              <div 
                className={`h-1 w-full ${
                  isDanger 
                    ? 'bg-gradient-to-r from-rose-500 to-transparent' 
                    : dialog.type === 'confirm'
                    ? 'bg-gradient-to-r from-amber-500 to-transparent'
                    : 'bg-gradient-to-r from-primary-200 via-primary-150 to-transparent'
                }`} 
              />

              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs ${
                    isDanger 
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                      : dialog.type === 'prompt'
                      ? 'bg-primary-200/10 text-primary-200 border-primary-200/20'
                      : dialog.type === 'alert'
                      ? 'bg-primary-200/10 text-primary-200 border-primary-200/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}>
                    {isDanger ? (
                      <Trash2 size={22} strokeWidth={2.2} />
                    ) : dialog.type === 'prompt' ? (
                      <Edit3 size={22} strokeWidth={2.2} />
                    ) : dialog.type === 'alert' ? (
                      <AlertCircle size={22} strokeWidth={2.2} />
                    ) : (
                      <HelpCircle size={22} strokeWidth={2.2} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-bold text-typography-900 tracking-tight leading-snug">
                      {dialog.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-typography-600 leading-relaxed break-words whitespace-pre-wrap">
                      {dialog.message}
                    </p>
                  </div>
                </div>

                {/* Prompt Input */}
                {dialog.type === 'prompt' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') dialog.resolve(inputValue);
                        if (e.key === 'Escape') dialog.resolve(null);
                      }}
                      placeholder={dialog.placeholder || 'Digite aqui...'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/80 border border-surface-300 text-sm font-medium text-typography-900 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 transition-all"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
                    <button
                      type="button"
                      onClick={() => dialog.resolve(dialog.type === 'prompt' ? null : false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-typography-600 hover:text-typography-900 hover:bg-surface-200 border border-surface-300 transition-all active:scale-95 cursor-pointer"
                    >
                      {dialog.cancelText || 'Cancelar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => dialog.resolve(dialog.type === 'prompt' ? inputValue : true)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all active:scale-95 cursor-pointer ${
                      isDanger
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-primary-200 hover:bg-primary-150'
                    }`}
                  >
                    {dialog.type === 'alert' && <Check size={14} strokeWidth={2.5} />}
                    {dialog.confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
