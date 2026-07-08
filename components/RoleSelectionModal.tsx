'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Sparkles, User, Check, Loader2, Info } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
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
      // We use setDoc with merge to ensure it exists
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
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        <div className="bg-emerald-600 p-6 text-white text-center">
          <h2 className="text-2xl font-black uppercase tracking-tighter italic">Seja Bem-vindo!</h2>
          <p className="text-emerald-100 text-sm font-medium mt-1">Para começar, precisamos saber sua categoria no circuito.</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Selecione uma categoria
            </label>
            <div className="space-y-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    selectedRole === role.id 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md translate-x-1' 
                      : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-100 hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedRole === role.id ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-100'}`}>
                    <role.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-sm uppercase tracking-tight">{role.label}</div>
                    <div className="text-[10px] opacity-70 font-bold uppercase">{role.description}</div>
                  </div>
                  {selectedRole === role.id && (
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }}
                      className="bg-emerald-500 text-white rounded-full p-1"
                    >
                      <Check size={16} strokeWidth={4} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
            <Info className="text-amber-500 shrink-0" size={20} />
            <p className="text-[10px] text-amber-800 font-bold uppercase leading-tight">
              Aviso: Esta escolha é permanente. Se precisar alterar futuramente, deverá solicitar aprovação de um administrador do sistema.
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selectedRole || loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-200 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Check size={20} strokeWidth={3} />
                CONFIRMAR E CONTINUAR
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
