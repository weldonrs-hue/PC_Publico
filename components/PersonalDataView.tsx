'use client';

import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  MapPin,
  PenTool,
  Save,
  Search,
  Shield,
  Trash2,
  User
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import SignaturePad from './SignaturePad';

import { useDialog } from '@/hooks/useDialog';
import { auth, db } from '@/lib/firebase';
import { handleFirestoreError, isQuotaExceeded, OperationType, setQuotaExceededGlobal } from '@/utils/firestore';
import { formatBRPhone, formatCEP, formatCircuito } from '@/utils/formatters';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

interface PersonalDataViewProps {
  userId: string;
  onBack: () => void;
  onSave: () => void;
}

const defaultData = {
  numeroPessoal: '',
  nome: '',
  nomeEsposa: '',
  endereco: '',
  cidade: '',
  cep: '',
  uf: '',
  circuito: '',
  emailJwpub: '',
  telefoneCircuito: '',
  emailPessoal: '',
  telefonePessoal: '',
  signatureImage: null as string | null,
  signatureOffset: 0,
  signatureSize: 60,
  profilePhoto: null as string | null,
  role: '' as 'viajante' | 'pioneiro_especial' | 'pioneiro_regular' | 'secretaria' | ''
};

export default function PersonalDataView({ userId, onBack, onSave }: PersonalDataViewProps) {
  const { showAlert } = useDialog();
  const [initialData, setInitialData] = useState(defaultData);
  const [formData, setFormData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSignatureSave = (signatureDataUrl: string) => {
    setFormData({ ...formData, signatureImage: signatureDataUrl });
    setShowSignaturePad(false);
  };

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        const currentUser = auth.currentUser;
        const accountNumeroPessoal = currentUser?.displayName || '';

        // Try to get by userId as doc ID first
        const docRef = doc(db, 'personal_data', userId);
        let docSnap = null;
        try {
          docSnap = await getDoc(docRef);
        } catch (error) {
          console.warn('Initial getDoc(personal_data) failed, trying fallback query:', error);
        }
        
        if (docSnap && docSnap.exists()) {
          const docData = docSnap.data() as any;
          const mergedData = { ...defaultData, ...docData };
          
          // Enforce account's numeroPessoal if available
          if (accountNumeroPessoal) {
            mergedData.numeroPessoal = accountNumeroPessoal;
          }

          setInitialData(mergedData);
          setFormData(mergedData);
        } else {
          // Fallback: search by userId field
          const hasMigrated = sessionStorage.getItem(`pdMigrationAttempted_${userId}`);
          if (hasMigrated) {
            if (accountNumeroPessoal) {
              setFormData(prev => ({ ...prev, numeroPessoal: accountNumeroPessoal }));
            }
            setLoading(false);
            return;
          }

          // Use active ID (prop userId or auth.currentUser.uid)
          const activeId = userId || auth.currentUser?.uid;
          if (!activeId) {
            setLoading(false);
            return;
          }

          let querySnapshot = await getDocs(query(collection(db, 'personal_data'), where('userId', '==', activeId), limit(1))).catch(() => null);
          
          if (!querySnapshot || querySnapshot.empty) {
            if (accountNumeroPessoal) {
              querySnapshot = await getDocs(query(collection(db, 'personal_data'), where('numeroPessoal', '==', accountNumeroPessoal), limit(1))).catch(() => null);
            }
          }

          if (querySnapshot && !querySnapshot.empty) {
            sessionStorage.setItem(`pdMigrationAttempted_${userId}`, 'true');
            const docData = querySnapshot.docs[0].data() as any;
            const mergedData = { ...defaultData, ...docData };
            
            // Enforce account's numeroPessoal
            if (accountNumeroPessoal) {
              mergedData.numeroPessoal = accountNumeroPessoal;
            }

            setInitialData(mergedData);
            setFormData(mergedData);
            // Migrate to use userId as doc ID for future efficiency
            try {
              await setDoc(doc(db, 'personal_data', userId), { ...mergedData, userId });
            } catch (error) {
              console.warn('Failed to migrate personal_data doc:', error);
            }
          } else {
            // New user, initialize with account id
            if (accountNumeroPessoal) {
              setFormData(prev => ({ ...prev, numeroPessoal: accountNumeroPessoal }));
            }
          }
        }
      } catch (error) {
        if (auth.currentUser) {
          console.error('Error fetching personal data:', error);
          handleFirestoreError(error, OperationType.LIST, 'personal_data (query by userId)');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalData();
  }, [userId]);

  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);

  // Alerta ao sair com alterações não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const removeSignature = () => {
    setFormData({ ...formData, signatureImage: null });
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowConfirmBack(true);
    } else {
      onBack();
    }
  };

  const handleCepSearch = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData({
          ...formData,
          endereco: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`,
          cidade: data.localidade.toUpperCase(),
          uf: data.uf.toUpperCase(),
          cep: formatCEP(data.cep)
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validar Número Pessoal
    const accountNumeroPessoal = auth.currentUser?.displayName;
    const finalNumeroPessoal = accountNumeroPessoal || formData.numeroPessoal.trim();
    
    if (!finalNumeroPessoal || finalNumeroPessoal.length === 0) {
      await showAlert('O Número Pessoal é obrigatório.', 'Campo Obrigatório');
      return;
    }

    setIsProcessing(true);

    try {
      if (isQuotaExceeded()) {
        throw new Error('quota/limit-exceeded');
      }

      // Enforce the account number during save
      const dataToSave = { 
        ...formData, 
        numeroPessoal: finalNumeroPessoal,
        userId 
      };

      // 1. Save data using userId as document ID
      const docRef = doc(db, 'personal_data', userId);
      await setDoc(docRef, dataToSave);

      // 2. Also sync name and role to users collection for consistency across the app
      try {
        const userDocRef = doc(db, 'users', userId);
        const uDoc = await getDoc(userDocRef);
        
        const userUpdate: any = {
          nome: formData.nome || '',
          role: formData.role || 'user',
          photoURL: formData.profilePhoto || null
        };

        if (uDoc.exists()) {
          await updateDoc(userDocRef, userUpdate);
        } else {
          await setDoc(userDocRef, {
            ...userUpdate,
            email: auth.currentUser?.email,
            lastLogin: new Date().toISOString()
          });
        }
      } catch (err: any) {
        console.warn('Failed to sync profile info to users collection:', err);
        if (err.message?.includes('quota') || err.message?.includes('resource-exhausted')) {
          setQuotaExceededGlobal();
        }
      }

      setInitialData(dataToSave);
      setFormData(dataToSave);
      await showAlert('Dados salvos com sucesso!', 'Sucesso');
      onSave();
    } catch (error: any) {
      if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
        setQuotaExceededGlobal();
      }
      handleFirestoreError(error, OperationType.WRITE, 'personal_data');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={handleBack}
          className="p-2 sm:p-2.5 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 hover:border-primary-200/50 shrink-0 cursor-pointer"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-typography-900 tracking-tight truncate">
            {formData.role === 'viajante' 
              ? 'Dados Pessoais do Viajante' 
              : formData.role === 'pioneiro_especial'
              ? 'Dados Pessoais do Pioneiro Especial'
              : formData.role === 'pioneiro_regular'
              ? 'Dados Pessoais do Pioneiro Regular'
              : formData.role === 'secretaria'
              ? 'Dados Pessoais da Secretaria (TJSec)'
              : initialData.role === 'viajante'
              ? 'Dados Pessoais do Viajante'
              : initialData.role === 'pioneiro_especial'
              ? 'Dados Pessoais do Pioneiro Especial'
              : initialData.role === 'pioneiro_regular'
              ? 'Dados Pessoais do Pioneiro Regular'
              : initialData.role === 'secretaria'
              ? 'Dados Pessoais da Secretaria (TJSec)'
              : 'Meus Dados Pessoais'}
          </h2>
          <p className="text-xs sm:text-sm text-typography-500 truncate mt-0.5">
            Gerencie suas informações de contato, circuito e assinatura digital
          </p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-100 rounded-2xl shadow-sm border border-surface-300 overflow-hidden"
      >
        {/* Card Header Strip */}
        <div className="px-5 sm:px-6 py-4 border-b border-surface-300 bg-surface-200/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl border border-primary-200/30 bg-primary-200/10 text-primary-200 flex items-center justify-center shrink-0">
              <User size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-typography-900 text-sm sm:text-base leading-tight truncate">
                Perfil e Identificação
              </h3>
              <p className="text-xs text-typography-500 truncate">
                Dados vinculados à sua conta e relatórios oficiais
              </p>
            </div>
          </div>
          {formData.circuito && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-200/10 text-primary-200 border border-primary-200/20 whitespace-nowrap shrink-0">
              <MapPin size={12} />
              {formData.circuito}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="animate-spin text-primary-200" size={40} />
            <span className="text-xs font-medium text-typography-500">Carregando dados...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 md:p-8 space-y-6 sm:space-y-8">
            {/* Row 1: Names and ID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="md:col-span-1 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider flex items-center gap-1.5">
                  Número Pessoal (ID)
                  <span title="Identificador da Conta (Protegido)">
                    <Shield size={12} className="text-primary-200" />
                  </span>
                </label>
                <div className="relative">
                  <input 
                    value={formData.numeroPessoal}
                    readOnly
                    className="w-full p-2.5 sm:p-3 bg-surface-200/60 border border-surface-300 rounded-xl outline-none font-mono text-typography-500 cursor-not-allowed text-sm pl-9"
                    title="Este número é extraído automaticamente da sua conta e não pode ser alterado."
                  />
                  <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                  Nome Completo
                </label>
                <input 
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                  Nome da Esposa
                </label>
                <input 
                  value={formData.nomeEsposa}
                  onChange={(e) => setFormData({...formData, nomeEsposa: e.target.value})}
                  className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                  placeholder="Nome da esposa (se houver)"
                />
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="space-y-2">
              <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                Endereço
              </label>
              <input 
                value={formData.endereco}
                onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                placeholder="Rua, número, bairro..."
              />
            </div>

            {/* Row 3: City, CEP, UF, Circuit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 sm:gap-6">
              <div className="md:col-span-5 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                  Cidade
                </label>
                <input 
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                  className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                  placeholder="CIDADE"
                />
              </div>
              <div className="md:col-span-3 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                  CEP
                </label>
                <div className="relative">
                  <input 
                    value={formData.cep}
                    onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                    onBlur={handleCepSearch}
                    className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm pr-9"
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  <button 
                    type="button"
                    onClick={handleCepSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-typography-400 hover:text-primary-200 transition-colors p-1 cursor-pointer"
                    title="Buscar CEP automaticamente"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                  UF
                </label>
                <input 
                  value={formData.uf}
                  onChange={(e) => setFormData({...formData, uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                  maxLength={2}
                  className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm text-center font-semibold"
                  placeholder="UF"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                  Circuito
                </label>
                <input 
                  value={formData.circuito}
                  onChange={(e) => setFormData({...formData, circuito: formatCircuito(e.target.value)})}
                  maxLength={6}
                  className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm text-center font-semibold"
                  placeholder="AB-123"
                />
              </div>
            </div>

            {/* Row 4: Emails and Phones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                    E-mail JWPUB
                  </label>
                  <input 
                    type="email"
                    value={formData.emailJwpub}
                    onChange={(e) => setFormData({...formData, emailJwpub: e.target.value})}
                    className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                    placeholder="usuario@jwpub.org"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                    E-mail Pessoal
                  </label>
                  <input 
                    type="email"
                    value={formData.emailPessoal}
                    onChange={(e) => setFormData({...formData, emailPessoal: e.target.value})}
                    className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                    Telefone Circuito
                  </label>
                  <input 
                    value={formData.telefoneCircuito}
                    onChange={(e) => setFormData({...formData, telefoneCircuito: formatBRPhone(e.target.value)})}
                    className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-semibold text-typography-600 uppercase tracking-wider">
                    Telefone Pessoal
                  </label>
                  <input 
                    value={formData.telefonePessoal}
                    onChange={(e) => setFormData({...formData, telefonePessoal: formatBRPhone(e.target.value)})}
                    className="w-full p-2.5 sm:p-3 bg-surface-200 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 transition-all text-sm"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="bg-surface-200/50 p-5 sm:p-6 rounded-2xl border border-surface-300 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-primary-200 rounded-full" />
                  <h3 className="text-xs sm:text-sm font-bold text-typography-900 uppercase tracking-wider">
                    Assinatura Global
                  </h3>
                </div>
              </div>
              <p className="text-xs text-typography-500">
                Esta assinatura será utilizada automaticamente em todos os documentos oficiais (S-302, designações, etc.).
                Se você remover aqui, ela será removida de todos os formulários.
              </p>

              <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-surface-100 border border-surface-300 rounded-2xl shadow-xs relative group overflow-hidden">
                {formData.signatureImage && formData.signatureImage.length > 10 ? (
                  <div className="relative w-full max-w-[320px] mx-auto p-4 bg-white rounded-xl shadow-xs border border-surface-300/60">
                    <div 
                      className="flex items-end justify-center relative w-full h-[120px] overflow-visible transition-all duration-200"
                    >
                      <Image 
                        src={formData.signatureImage} 
                        alt="Assinatura Digital" 
                        fill 
                        className="object-contain object-bottom"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="border-t border-gray-900 w-full mt-2 relative z-10" />
                    <p className="text-center font-bold text-[11px] mt-1 uppercase tracking-tight text-gray-900">
                      {formData.nome || 'SEU NOME'}
                    </p>
                    
                    <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                      <button 
                        type="button"
                        onClick={() => setShowSignaturePad(true)}
                        className="p-1.5 bg-surface-100/90 text-typography-700 rounded-lg hover:bg-surface-200 transition-all border border-surface-300 shadow-xs cursor-pointer"
                        title="Alterar Assinatura"
                      >
                        <PenTool size={14} />
                      </button>
                      <button 
                        type="button"
                        onClick={removeSignature}
                        className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all border border-red-500/20 shadow-xs cursor-pointer"
                        title="Remover Assinatura"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 sm:py-6">
                    <div className="w-14 h-14 rounded-2xl border border-primary-200/30 bg-primary-200/10 flex items-center justify-center mx-auto mb-3 text-primary-200">
                      <PenTool size={22} strokeWidth={2} />
                    </div>
                    <p className="text-sm font-semibold text-typography-800">Nenhuma assinatura cadastrada</p>
                    <p className="text-xs text-typography-500 mt-1 mb-5">Escolha uma fonte caligráfica, digite, desenhe ou envie imagem</p>
                    <div className="flex justify-center">
                      <button 
                        type="button"
                        onClick={() => setShowSignaturePad(true)}
                        className="bg-primary-200 hover:bg-primary-150 active:scale-95 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <PenTool size={16} />
                        <span>Criar Assinatura Digital</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface-300">
              <p className="text-[11px] text-typography-400 font-medium italic">
                As alterações podem ser salvas através da barra flutuante.
              </p>
            </div>
          </form>
        )}
      </motion.div>

      {/* Floating Save Bar (quando houver alterações não salvas) */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-surface-100/95 dark:bg-surface-200/95 text-typography-900 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 sm:gap-4 border border-surface-300 w-[calc(100vw-1.5rem)] max-w-md no-print"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-primary-200"></span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-semibold truncate">
                  Alterações não salvas
                </span>
                <span className="text-[10px] text-typography-500 font-mono hidden sm:inline truncate">
                  Meus Dados • Perfil
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setFormData(JSON.parse(JSON.stringify(initialData)))}
                disabled={isProcessing}
                className="px-2.5 py-1.5 text-xs font-medium text-typography-600 hover:text-typography-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-primary text-brand-on-primary text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} className="shrink-0" />
                    <span>Salvar</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      {showConfirmBack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-surface-100 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-surface-300 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-transparent" />
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-typography-900 mb-1.5">Alterações não salvas</h3>
            <p className="text-xs sm:text-sm text-typography-600 mb-5 leading-relaxed">Você possui alterações que não foram salvas. Deseja salvar antes de sair?</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  handleSubmit();
                  onBack();
                }}
                className="w-full py-2.5 px-4 bg-brand-primary text-brand-on-primary rounded-xl font-bold text-xs sm:text-sm hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                Salvar e Sair
              </button>
              <button 
                onClick={onBack}
                className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                Descartar e Sair
              </button>
              <button 
                onClick={() => setShowConfirmBack(false)}
                className="w-full py-2 px-4 border border-surface-300 text-typography-600 hover:text-typography-900 hover:bg-surface-200/50 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer mt-1"
              >
                Continuar Editando
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {showSignaturePad && (
          <SignaturePad 
            initialName={formData.nome || ''}
            onSave={handleSignatureSave}
            onCancel={() => setShowSignaturePad(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
