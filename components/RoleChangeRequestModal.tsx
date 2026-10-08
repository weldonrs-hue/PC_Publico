'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Sparkles, User as UserIcon, Check, Loader2, Info, X, Phone } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { formatBRPhone } from '@/utils/formatters';
import { useDialog } from '@/hooks/useDialog';
import { cn } from '@/lib/utils';

interface RoleChangeRequestModalProps {
  userId: string;
  currentRole: string;
  userName: string;
  onClose: () => void;
}

export default function RoleChangeRequestModal({ userId, currentRole, userName, onClose }: RoleChangeRequestModalProps) {
  const { showAlert } = useDialog();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const q = query(
        collection(db, 'role_change_requests'),
        where('userId', '==', userId),
        where('status', '==', 'pending'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setPendingRequest(true);
      }
    };
    checkPending();
  }, [userId]);

  const roles = [
    { id: 'viajante', label: 'Viajante no Circuito', icon: Globe },
    { id: 'pioneiro_especial', label: 'Pioneiro Especial', icon: Sparkles },
    { id: 'pioneiro_regular', label: 'Pioneiro Regular', icon: UserIcon }
  ].filter(r => r.id !== currentRole);

  const handleSubmit = async () => {
    if (!selectedRole || !phoneNumber || phoneNumber.length < 14) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'role_change_requests'), {
        userId,
        userName,
        currentRole,
        requestedRole: selectedRole,
        phoneNumber,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      setSuccess(true);
      setTimeout(() => onClose(), 3000);
    } catch (error) {
      console.error('Error submitting request:', error);
      await showAlert('Erro ao enviar solicitação.', 'Erro');
    } finally {
      setLoading(false);
    }
  };

  if (pendingRequest) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface-100 border border-surface-300 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl text-typography-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-transparent" />
          <div className="bg-amber-500/10 border border-amber-500/20 w-16 h-16 rounded-2xl flex items-center justify-center text-amber-500 mx-auto">
            <Info size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-typography-900">Solicitação Pendente</h3>
            <p className="text-typography-500 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed">Você já possui uma solicitação de alteração aguardando aprovação do administrador.</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-full bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-700 font-bold py-3.5 rounded-2xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-100 border border-surface-300 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-typography-900 relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
        <div className="bg-surface-200/60 border-b border-surface-300 p-5 sm:p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-200/10 border border-primary-200/20 text-primary-200 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-typography-900 tracking-tight leading-tight">Alterar Categoria</h2>
              <p className="text-typography-500 text-xs font-medium mt-0.5">Solicitação ao Administrador</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-typography-400 hover:text-typography-900 hover:bg-surface-200 rounded-xl transition-all cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {success ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center text-emerald-500 mx-auto shadow-inner">
                <Check size={40} strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-typography-900 tracking-tight">Enviado!</h3>
                <p className="text-typography-500 text-xs font-medium mt-1">Sua solicitação foi enviada para o administrador.</p>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="space-y-2.5">
                <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1">
                  Nova Categoria Desejada
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left cursor-pointer",
                        selectedRole === role.id 
                          ? 'border-primary-200 bg-primary-200/10 text-primary-200' 
                          : 'border-surface-300 bg-surface-200/40 text-typography-700 hover:border-primary-200/50 hover:bg-surface-200'
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        selectedRole === role.id ? 'bg-primary-200 text-white' : 'bg-surface-100 border border-surface-300 text-typography-500'
                      )}>
                        <role.icon size={18} />
                      </div>
                      <span className="font-bold text-sm tracking-tight">{role.label}</span>
                      {selectedRole === role.id && <Check size={18} className="ml-auto text-primary-200" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1">
                  Seu Telefone de Contato
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" size={18} />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(formatBRPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-200 border border-surface-300 rounded-2xl outline-none focus:border-primary-200 text-typography-900 placeholder:text-typography-400 font-bold transition-all text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selectedRole || phoneNumber.length < 14 || loading}
                className="w-full bg-primary-200 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary-200/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Solicitação'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
