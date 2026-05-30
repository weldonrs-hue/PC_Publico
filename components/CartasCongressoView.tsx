'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
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
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-violet-600 hover:scale-110 active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              Cartas Congresso
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[12px] bg-violet-50 text-violet-600 px-3 py-1 rounded-full border border-violet-100 w-fit mt-1">
              Gerador de Documentos para Congresso
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

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1A1B1E;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2e33;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
