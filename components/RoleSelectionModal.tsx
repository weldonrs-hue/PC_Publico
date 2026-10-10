'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Globe, Sparkles, User, Check, Loader2, Info } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useDialog } from '@/hooks/useDialog';

interface RoleSelectionModalProps {
  userId: string;
  onRoleSelected: (role: string) => void;
}

export default function RoleSelectionModal({ userId, onRoleSelected }: RoleSelectionModalProps) {
  const { showAlert } = useDialog();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: 'viajante', label: 'Viajante no Circuito', icon: Globe, description: 'Superintendente de Circuito ou Substituto' },
    { id: 'pioneiro_especial', label: 'Pioneiro Especial', icon: Sparkles, description: 'Pioneiros em designação especial' },
    { id: 'pioneiro_regular', label: 'Pioneiro Regular', icon: User, description: 'Pioneiros regulares no circuito' }
  ];

  const handleConfirm = async () => {
    if (!selectedRole || !userId) return;
    
    setLoading(true);
    try {
      const pdRef = doc(db, 'personal_data', userId);
      await setDoc(pdRef, { role: selectedRole }, { merge: true });
      onRoleSelected(selectedRole);
    } catch (error) {
      console.error('Error saving role:', error);
      await showAlert('Erro ao salvar categoria. Tente novamente.', 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-100 border border-surface-300 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative"
      >
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />

        <div className="p-6 sm:p-8 pb-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary-200/10 text-primary-200 flex items-center justify-center mx-auto mb-3 border border-primary-200/20">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-black text-typography-900 tracking-tight">Seja Bem-vindo!</h2>
          <p className="text-typography-500 text-xs sm:text-sm font-medium mt-1">
            Para começar, selecione sua categoria de atuação no circuito.
          </p>
        </div>

        <div className="p-6 sm:p-8 pt-2 space-y-5">
          <div className="space-y-3">
            <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider block ml-1">
              Selecione uma categoria
            </label>
            <div className="space-y-2.5">
              {roles.map((role) => {
                const isSelected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'border-primary-200 bg-primary-200/10 shadow-xs'
                        : 'border-surface-300 bg-surface-200/40 hover:bg-surface-200 hover:border-surface-300'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                      isSelected 
                        ? 'bg-primary-200 text-white border-primary-200 shadow-sm' 
                        : 'bg-surface-100 text-typography-600 border-surface-300'
                    }`}>
                      <role.icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm leading-tight ${isSelected ? 'text-primary-200' : 'text-typography-900'}`}>
                        {role.label}
                      </div>
                      <div className="text-xs text-typography-500 font-medium truncate mt-0.5">
                        {role.description}
                      </div>
                    </div>
                    {isSelected && (
                      <motion.div 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-primary-200 text-white rounded-full flex items-center justify-center shrink-0"
                      >
                        <Check size={14} strokeWidth={3} />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-500/10 rounded-2xl p-3.5 border border-amber-500/20 flex gap-3 items-start">
            <Info className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              <strong className="font-bold">Aviso:</strong> Esta escolha define seu perfil inicial. Se precisar alterar futuramente, poderá solicitar aprovação de um administrador.
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selectedRole || loading}
            className="w-full bg-primary-200 hover:bg-primary-150 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Check size={18} strokeWidth={3} />
                <span>Confirmar e Continuar</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
