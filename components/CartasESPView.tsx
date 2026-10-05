'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowLeft, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import PioneerSchoolLetters from './PioneerSchoolLetters';
import { doc, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface CartasESPViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  onBack: () => void;
}

export default function CartasESPView({ userId, isAdmin, canManage, initialMode, onBack }: CartasESPViewProps) {
  const [selectedTurma, setSelectedTurma] = useState<'1' | '2' | '3'>('1');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    const infoDocId = `${userId}_turma${selectedTurma}`;
    const unsubscribe = onSnapshot(doc(db, 'pioneer_school_info', infoDocId), (doc) => {
      if (doc.exists()) {
        setSchoolInfo(doc.data());
      } else {
        setSchoolInfo({
          dataTurma: '',
          instrutorA: '',
          instrutorB: '',
          localEscola: '',
          enderecoEscola: '',
          entregaLivroEndereco: '',
          entregaLivroDataHora: '',
          confirmacaoDataLimite: '',
          confirmacaoEmail: '',
          confirmacaoWhatsapp: '',
        });
      }
      setLoadingInfo(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pioneer_school_info');
      setLoadingInfo(false);
    });

    return () => unsubscribe();
  }, [userId, selectedTurma]);

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
          
          <div className="w-10 h-10 rounded-xl bg-transparent border border-emerald-500/40 dark:border-emerald-400/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Mail size={20} strokeWidth={1.8} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
                Cartas ESP
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Pioneiros
              </span>
            </div>
            <p className="text-xs text-typography-500 mt-0.5">
              Escola do Serviço de Pioneiro • Anfitriã e Refeições
            </p>
          </div>
        </div>

        {/* Turma Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] font-bold text-typography-400 uppercase tracking-widest">Turma:</span>
          <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-xl p-1">
            {(['1', '2', '3'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTurma(t)}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                  selectedTurma === t 
                    ? 'bg-primary-200 text-white shadow-2xs' 
                    : 'text-typography-500 hover:text-typography-900 hover:bg-surface-300/50'
                }`}
              >
                Turma {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTurma}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.15 }}
        >
          {loadingInfo ? (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-surface-100 border border-surface-300 rounded-3xl">
              <RefreshCw size={28} className="text-emerald-500 animate-spin" />
              <p className="text-typography-500 font-bold uppercase tracking-widest text-xs">Carregando Informações...</p>
            </div>
          ) : (
            <PioneerSchoolLetters 
              userId={userId}
              isAdmin={isAdmin}
              canManage={canManage}
              selectedTurma={selectedTurma}
              schoolInfo={schoolInfo}
              category="esp"
              initialMode={initialMode}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
