'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Contact, 
  ChevronLeft,
  Save,
  User,
  Mail,
  Phone,
  Calendar,
  Search,
  Map,
  Hash,
  Users,
  MapPin,
  Globe,
  Loader2,
  Upload,
  Trash2,
  PenTool,
  Eraser,
  Check,
  X,
  Shield
} from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import SignaturePad from './SignaturePad';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  limit,
  getDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal } from '@/utils/firestore';
import { formatBRPhone, formatCEP, formatCircuito } from '@/utils/formatters';

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
  role: '' as 'viajante' | 'pioneiro_especial' | 'pioneiro_regular' | ''
};

export default function PersonalDataView({ userId, onBack, onSave }: PersonalDataViewProps) {
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

          // Use auth.currentUser.uid directly to be absolutely sure we are using the authenticated UID
          const currentUid = auth.currentUser?.uid;
          if (!currentUid) {
            setLoading(false);
            return;
          }

          const q = query(collection(db, 'personal_data'), where('userId', '==', currentUid), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
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
      alert('O Número Pessoal é obrigatório.');
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
      setInitialData(dataToSave);
      setFormData(dataToSave);
      alert('Dados salvos com sucesso!');
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
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-emerald-600 bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {formData.role === 'viajante' 
            ? 'Dados Pessoais do Viajante' 
            : formData.role === 'pioneiro_especial'
            ? 'Dados Pessoais do Pioneiro Especial'
            : formData.role === 'pioneiro_regular'
            ? 'Dados Pessoais do Pioneiro Regular'
            : initialData.role === 'viajante'
            ? 'Dados Pessoais do Viajante'
            : initialData.role === 'pioneiro_especial'
            ? 'Dados Pessoais do Pioneiro Especial'
            : initialData.role === 'pioneiro_regular'
            ? 'Dados Pessoais do Pioneiro Regular'
            : 'Meus Dados Pessoais'}
        </h2>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="bg-emerald-600 p-4 text-white">
          <h3 className="font-bold flex items-center gap-2">
            Perfil e Acesso
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-emerald-600" size={48} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            {/* Row 1: Names and ID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  Número Pessoal (ID)
                  <Shield size={10} className="text-emerald-600" title="Identificador da Conta (Protegido)" />
                </label>
                <input 
                  value={formData.numeroPessoal}
                  readOnly
                  className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl outline-none font-mono text-gray-500 cursor-not-allowed"
                  title="Este número é extraído automaticamente da sua conta e não pode ser alterado."
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Nome Completo
                </label>
                <input 
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Nome da Esposa
                </label>
                <input 
                  value={formData.nomeEsposa}
                  onChange={(e) => setFormData({...formData, nomeEsposa: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                  placeholder="Nome da esposa (se houver)"
                />
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Endereço
              </label>
              <input 
                value={formData.endereco}
                onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                placeholder="Rua, número, bairro..."
              />
            </div>

            {/* Row 3: City, CEP, UF, Circuit */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Cidade
                </label>
                <input 
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                  placeholder="CIDADE"
                />
              </div>
              <div className="w-full md:w-[180px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  CEP
                </label>
                <div className="relative">
                  <input 
                    value={formData.cep}
                    onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                    onBlur={handleCepSearch}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all pr-10"
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  <button 
                    type="button"
                    onClick={handleCepSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500"
                  >
                    <Search size={18} />
                  </button>
                </div>
              </div>
              <div className="w-full md:w-[80px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  UF
                </label>
                <input 
                  value={formData.uf}
                  onChange={(e) => setFormData({...formData, uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                  maxLength={2}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all text-center"
                  placeholder="UF"
                />
              </div>
              <div className="w-full md:w-[120px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Circuito
                </label>
                <input 
                  value={formData.circuito}
                  onChange={(e) => setFormData({...formData, circuito: formatCircuito(e.target.value)})}
                  maxLength={6}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all text-center"
                  placeholder="AB-123"
                />
              </div>
            </div>

            {/* Row 4: Emails and Phones */}
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    E-mail JWPUB
                  </label>
                  <input 
                    type="email"
                    value={formData.emailJwpub}
                    onChange={(e) => setFormData({...formData, emailJwpub: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="usuario@jwpub.org"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    E-mail Pessoal
                  </label>
                  <input 
                    type="email"
                    value={formData.emailPessoal}
                    onChange={(e) => setFormData({...formData, emailPessoal: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              <div className="w-full md:w-[240px] space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Telefone Circuito
                  </label>
                  <input 
                    value={formData.telefoneCircuito}
                    onChange={(e) => setFormData({...formData, telefoneCircuito: formatBRPhone(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Telefone Pessoal
                  </label>
                  <input 
                    value={formData.telefonePessoal}
                    onChange={(e) => setFormData({...formData, telefonePessoal: formatBRPhone(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="bg-gray-50/50 p-6 rounded-2xl border border-dashed border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                Assinatura Global
              </h3>
              <p className="text-xs text-gray-500 mb-6 italic">
                Esta assinatura será utilizada automaticamente em todos os documentos (S-302, Uploads, etc). 
                Se você remover aqui, ela será removida de todos os formulários.
              </p>

              <div className="flex flex-col items-center justify-center p-8 bg-white border border-gray-100 rounded-2xl shadow-sm relative group overflow-hidden">
                {formData.signatureImage ? (
                  <div className="relative w-full max-w-[300px] mx-auto">
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
                    <div className="border-t border-black w-full mt-1 relative z-10" />
                    <p className="text-center font-bold text-[11px] mt-1 uppercase tracking-tight text-gray-900">
                      {formData.nome || 'SEU NOME'}
                    </p>
                    
                    <div className="absolute -top-4 -right-4 flex gap-2 z-10">
                      <button 
                        type="button"
                        onClick={removeSignature}
                        className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-all shadow-sm"
                        title="Remover Assinatura"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                      <Upload className="text-emerald-600" size={24} />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Nenhuma assinatura cadastrada</p>
                    <p className="text-xs text-gray-400 mt-1 mb-6">Escolha uma imagem, digite ou desenhe na tela</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button 
                        type="button"
                        onClick={() => setShowSignaturePad(true)}
                        className="bg-emerald-600 text-white px-10 py-3 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                      >
                        <PenTool size={18} />
                        Criar Assinatura Digital
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-100">
              <button 
                type="submit"
                disabled={!hasChanges || isProcessing}
                className={`px-10 py-3 font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                  hasChanges && !isProcessing
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {isProcessing ? 'Processando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* Confirmation Modal */}
      {showConfirmBack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <h3 className="text-xl font-bold text-gray-800">Alterações Pendentes</h3>
            <p className="text-gray-600">Você possui alterações que não foram salvas. Deseja salvar antes de sair?</p>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  handleSubmit();
                  onBack();
                }}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Salvar e Sair
              </button>
              <button 
                onClick={onBack}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Sair sem Salvar
              </button>
              <button 
                onClick={() => setShowConfirmBack(false)}
                className="w-full py-3 text-gray-500 font-medium hover:underline"
              >
                Cancelar
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
