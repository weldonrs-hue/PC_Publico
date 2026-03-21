'use client';

import { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';

import { db } from '@/lib/firebase';
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
import { handleFirestoreError, OperationType } from '@/utils/firestore';
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
  telefonePessoal: ''
};

export default function PersonalDataView({ userId, onBack, onSave }: PersonalDataViewProps) {
  const [initialData, setInitialData] = useState(defaultData);
  const [formData, setFormData] = useState(defaultData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        // Try to get by userId as doc ID first
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const docData = docSnap.data() as any;
          const mergedData = { ...defaultData, ...docData };
          setInitialData(mergedData);
          setFormData(mergedData);
        } else {
          // Fallback: search by userId field
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0].data() as any;
            const mergedData = { ...defaultData, ...docData };
            setInitialData(mergedData);
            setFormData(mergedData);
            // Migrate to use userId as doc ID for future efficiency
            await setDoc(doc(db, 'personal_data', userId), { ...mergedData, userId });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'personal_data');
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalData();
  }, [userId]);

  const [showConfirmBack, setShowConfirmBack] = useState(false);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);

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
    
    try {
      // Use userId as document ID
      const docRef = doc(db, 'personal_data', userId);
      await setDoc(docRef, { ...formData, userId });
      setInitialData(formData);
      onSave();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'personal_data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-[#4CAF50] font-bold hover:underline transition-all"
        >
          <ChevronLeft size={20} />
          Voltar ao Painel
        </button>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Contact className="text-[#4CAF50]" />
          Dados Pessoais do Superintendente
        </h2>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="bg-[#4CAF50] p-4 text-white">
          <h3 className="font-bold flex items-center gap-2">
            Informações de Perfil
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[#4CAF50]" size={48} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            {/* Row 1: Personal Number and Names */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <Hash size={14} /> Número Pessoal
                </label>
                <input 
                  value={formData.numeroPessoal}
                  onChange={(e) => setFormData({...formData, numeroPessoal: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                  placeholder="Ex: 2283701"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <User size={14} /> Nome Completo
                </label>
                <input 
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <Users size={14} /> Nome da Esposa
                </label>
                <input 
                  value={formData.nomeEsposa}
                  onChange={(e) => setFormData({...formData, nomeEsposa: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                  placeholder="Nome da esposa (se houver)"
                />
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Map size={14} /> Endereço
              </label>
              <input 
                value={formData.endereco}
                onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                placeholder="Rua, número, bairro..."
              />
            </div>

            {/* Row 3: City, CEP, UF, Circuit */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <MapPin size={14} /> Cidade
                </label>
                <input 
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                  placeholder="CIDADE"
                />
              </div>
              <div className="w-full md:w-[180px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <Hash size={14} /> CEP
                </label>
                <div className="relative">
                  <input 
                    value={formData.cep}
                    onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                    onBlur={handleCepSearch}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all pr-10"
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  <button 
                    type="button"
                    onClick={handleCepSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#4CAF50]"
                  >
                    <Search size={18} />
                  </button>
                </div>
              </div>
              <div className="w-full md:w-[80px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <MapPin size={14} /> UF
                </label>
                <input 
                  value={formData.uf}
                  onChange={(e) => setFormData({...formData, uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                  maxLength={2}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all text-center"
                  placeholder="UF"
                />
              </div>
              <div className="w-full md:w-[120px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <Globe size={14} /> Circuito
                </label>
                <input 
                  value={formData.circuito}
                  onChange={(e) => setFormData({...formData, circuito: formatCircuito(e.target.value)})}
                  maxLength={6}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all text-center"
                  placeholder="AB-123"
                />
              </div>
            </div>

            {/* Row 4: Emails and Phones */}
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                    <Mail size={14} /> E-mail JWPUB
                  </label>
                  <input 
                    type="email"
                    value={formData.emailJwpub}
                    onChange={(e) => setFormData({...formData, emailJwpub: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                    placeholder="usuario@jwpub.org"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                    <Mail size={14} /> E-mail Pessoal
                  </label>
                  <input 
                    type="email"
                    value={formData.emailPessoal}
                    onChange={(e) => setFormData({...formData, emailPessoal: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              <div className="w-full md:w-[240px] space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                    <Phone size={14} /> Telefone Circuito
                  </label>
                  <input 
                    value={formData.telefoneCircuito}
                    onChange={(e) => setFormData({...formData, telefoneCircuito: formatBRPhone(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                    <Phone size={14} /> Telefone Pessoal
                  </label>
                  <input 
                    value={formData.telefonePessoal}
                    onChange={(e) => setFormData({...formData, telefonePessoal: formatBRPhone(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4CAF50] transition-all"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-100">
              <button 
                type="submit"
                disabled={!hasChanges}
                className={`px-10 py-3 font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                  hasChanges 
                    ? 'bg-[#4CAF50] text-white hover:bg-[#3d8b40]' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Save size={20} />
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* Confirmation Modal */}
      {showConfirmBack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                className="w-full py-3 bg-[#4CAF50] text-white font-bold rounded-xl hover:bg-[#3d8b40] transition-colors"
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
    </div>
  );
}
