'use client';

import React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import CongressLetters from './CongressLetters';

interface CartasCongressoViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  onBack: () => void;
}

export default function CartasCongressoView({ userId, isAdmin, canManage, initialMode, onBack }: CartasCongressoViewProps) {
  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-300 pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-typography-600 hover:text-typography-900 transition-colors shrink-0"
            title="Voltar para Cartas"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="w-10 h-10 rounded-xl bg-transparent border border-violet-500/40 dark:border-violet-400/50 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Mail size={20} strokeWidth={1.8} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
                Cartas Congresso
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                Congresso
              </span>
            </div>
            <p className="text-xs text-typography-500 mt-0.5">
              Gerador de Documentos para Congresso Regional
            </p>
          </div>
        </div>
      </div>

      <CongressLetters 
        userId={userId}
        isAdmin={isAdmin}
        canManage={canManage}
        initialMode={initialMode}
      />
    </div>
  );
}
