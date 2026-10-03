'use client';

import React from 'react';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import EMRLetters from './EMRLetters';

interface CartasEMRViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  initialSchoolType?: 'ancians' | 'servants';
  initialTurma?: string;
  initialPartId?: string;
  onBack: () => void;
}

export default function CartasEMRView({ 
  userId, 
  isAdmin, 
  canManage, 
  initialMode = 'geracao', 
  initialSchoolType,
  initialTurma,
  initialPartId,
  onBack 
}: CartasEMRViewProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-blue-600 hover:scale-110 active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              Cartas EMR
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[12px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 w-fit mt-1 flex items-center gap-1.5">
              <GraduationCap size={14} />
              Gerador de Documentos para Escola do Ministério do Reino
            </p>
          </div>
        </div>
      </div>

      <EMRLetters 
        userId={userId}
        isAdmin={isAdmin}
        canManage={canManage}
        initialMode={initialMode}
        initialSchoolType={initialSchoolType}
        initialTurma={initialTurma}
        initialPartId={initialPartId}
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
