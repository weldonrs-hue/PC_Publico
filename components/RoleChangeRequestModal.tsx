'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Sparkles, User as UserIcon, Check, Loader2, Info, X, Phone } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { formatBRPhone } from '@/utils/formatters';
import { useDialog } from '@/hooks/useDialog';

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
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6">
          <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center text-amber-600 mx-auto">
            <Info size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-gray-800">Solicitação Pendente</h3>
            <p className="text-gray-500 text-sm mt-1">Você já possui uma solicitação de alteração aguardando aprovação do administrador.</p>
          </div>
          <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-all">
            FECHAR
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
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="bg-[#6c40bd] p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter italic">Alterar Categoria</h2>
            <p className="text-purple-100 text-[10px] font-bold uppercase tracking-widest mt-0.5">Solicitação ao Administrador</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {success ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 space-y-4">
              <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
                <Check size={40} strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Enviado!</h3>
                <p className="text-gray-500 text-xs font-bold uppercase">Sua solicitação foi enviada para o administrador.</p>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Nova Categoria Desejada
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        selectedRole === role.id 
                          ? 'border-purple-500 bg-purple-50 text-purple-900' 
                          : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-purple-100'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedRole === role.id ? 'bg-purple-500 text-white' : 'bg-white border text-gray-400'}`}>
                        <role.icon size={18} />
                      </div>
                      <span className="font-bold text-sm uppercase tracking-tight">{role.label}</span>
                      {selectedRole === role.id && <Check size={16} className="ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Seu Telefone de Contato
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(formatBRPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-purple-500 font-bold transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selectedRole || phoneNumber.length < 14 || loading}
                className="w-full bg-[#6c40bd] hover:bg-[#5a35a0] disabled:bg-gray-200 disabled:text-gray-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-200 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'ENVIAR SOLICITAÇÃO'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
