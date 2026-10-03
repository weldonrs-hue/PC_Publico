'use client';

import React, { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { FileUp, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, Save, List, ArrowLeft, Mail, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import PioneerSchoolLetters from './PioneerSchoolLetters';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  onSnapshot, 
  query, 
  where,
  deleteDoc 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const ESP_TEMPLATES = [
  { id: 'esp_anfitria', name: 'Carta à anfitriã' },
  { id: 'esp_refeicoes', name: 'Carta convites refeições' },
  { id: 'esp_pioneiros', name: 'Carta convite pioneiros' },
];

interface CartasESPViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  onBack: () => void;
}

export default function CartasESPView({ userId, isAdmin, canManage, onBack }: CartasESPViewProps) {
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
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-emerald-600 hover:scale-110 active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              Cartas ESP
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[12px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 w-fit mt-1">
              Escola de Pioneiros auxiliares
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-2 py-1 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-widest">Turma:</span>
            <div className="flex gap-1">
              {(['1', '2', '3'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTurma(t)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    selectedTurma === t 
                      ? 'bg-emerald-100 text-emerald-700 shadow-sm' 
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTurma}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {loadingInfo ? (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
              <RefreshCw size={32} className="text-emerald-500 animate-spin" />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Informações...</p>
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
