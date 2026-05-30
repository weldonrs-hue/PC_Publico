'use client';

import React, { useState, useEffect } from 'react';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import PSSAssignmentLetters from './PSSAssignmentLetters';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  getDocs 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface CartasPSSViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  onBack: () => void;
}

export default function CartasPSSView({ userId, isAdmin, canManage, onBack }: CartasPSSViewProps) {
  const [selectedTurma, setSelectedTurma] = useState<'1' | '2' | '3'>('1');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [workshopAssignments, setWorkshopAssignments] = useState<any>({});
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    setLoadingInfo(true);
    const infoDocId = `${userId}_turma${selectedTurma}`;
    
    // Listen to school info
    const unsubInfo = onSnapshot(doc(db, 'pioneer_school_info', infoDocId), (doc) => {
      if (doc.exists()) {
        setSchoolInfo(doc.data());
      } else {
        setSchoolInfo({
          dataTurma: '',
          instrutorA: '',
          instrutorB: '',
          confirmacaoEmail: '',
          confirmacaoWhatsapp: '',
        });
      }
      setLoadingInfo(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pioneer_school_info');
      setLoadingInfo(false);
    });

    // Fetch workshop assignments for this turma
    const assignmentsQuery = query(
      collection(db, 'pioneer_school_workshops'),
      where('ownerId', '==', userId),
      where('turma', '==', selectedTurma)
    );

    const unsubWorkshops = onSnapshot(assignmentsQuery, (snap) => {
      const data: any = {};
      snap.forEach(doc => {
        const item = doc.data();
        data[item.scenarioId] = {
          id: doc.id,
          participants: item.participants || ''
        };
      });
      setWorkshopAssignments(data);
    });

    return () => {
      unsubInfo();
      unsubWorkshops();
    };
  }, [userId, selectedTurma]);

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
              Gerenciar Templates PSS
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[12px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 w-fit mt-1">
              Escola de Pioneiros
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-widest">Turma:</span>
            <div className="flex gap-1">
              {(['1', '2', '3'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTurma(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedTurma === t 
                      ? 'bg-blue-100 text-blue-700 shadow-sm' 
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
              <RefreshCw size={32} className="text-blue-500 animate-spin" />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Informações...</p>
            </div>
          ) : (
            <PSSAssignmentLetters 
              userId={userId}
              isAdmin={isAdmin}
              canManage={canManage}
              initialMode="manager"
              selectedTurma={selectedTurma}
              schoolInfo={schoolInfo}
              workshopAssignments={workshopAssignments}
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
