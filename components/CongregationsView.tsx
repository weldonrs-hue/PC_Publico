'use client';

import { useState, useEffect } from 'react';
import { 
  Store, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  User,
  Phone,
  Users,
  Save,
  Loader2,
  X,
  Calendar,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface Congregation {
  id: string;
  nome: string;
  numero: string;
  parte: string;
  endereco: string;
  coordenador: string;
  telefone: string;
  cidade: string;
  cep: string;
  estado: string;
  grupos: string[];
}

interface CongregationsViewProps {
  userId: string;
  onBack: () => void;
}

export default function CongregationsView({ userId, onBack }: CongregationsViewProps) {
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'congregations'), where('userId', '==', userId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const congsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Congregation[];
      setCongregations(congsData);
      setLoading(false);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'congregations');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedCong, setSelectedCong] = useState<Congregation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showJWSearch, setShowJWSearch] = useState(false);
  const [jwSearchTerm, setJWSearchTerm] = useState('');
  const [jwResults, setJWResults] = useState<any[]>([]);
  const [jwLoading, setJWLoading] = useState(false);
  const [jwError, setJWError] = useState<string | null>(null);
  const [selectedJWResult, setSelectedJWResult] = useState<any | null>(null);
  
  const defaultFormData: Congregation = {
    id: '', nome: '', numero: '', parte: 'A', endereco: '', coordenador: '',
    telefone: '', cidade: '', cep: '', estado: '', grupos: []
  };
  
  const [formData, setFormData] = useState<Congregation>(defaultFormData);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  };

  const handleCEPSearch = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setIsSearchingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`,
          cidade: data.localidade.toUpperCase(),
          estado: data.uf.toUpperCase(),
          cep: formatCEP(data.cep)
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsSearchingCEP(false);
    }
  };

  const handleAddGroup = () => {
    setFormData(prev => ({
      ...prev,
      grupos: [...prev.grupos, '']
    }));
  };

  const handleGroupChange = (index: number, value: string) => {
    const newGrupos = [...formData.grupos];
    newGrupos[index] = value;
    setFormData(prev => ({ ...prev, grupos: newGrupos }));
  };

  const handleRemoveGroup = (index: number) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos.filter((_, i) => i !== index)
    }));
  };

  const handleAddNew = () => {
    setSelectedCong(null);
    setFormData(defaultFormData);
    setIsEditing(true);
  };

  const handleEdit = (cong: Congregation) => {
    setSelectedCong(cong);
    setFormData({ ...defaultFormData, ...cong });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'congregations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'congregations');
    }
    setShowDeleteConfirm(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let docRef;
      if (selectedCong) {
        docRef = doc(db, 'congregations', selectedCong.id);
      } else {
        docRef = doc(collection(db, 'congregations'));
      }

      const { id, ...dataToSave } = formData;
      await setDoc(docRef, { ...dataToSave, userId });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'congregations');
    }
  };

  const filteredCongregations = congregations.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.numero.includes(searchTerm)
  );

  const handleJWSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwSearchTerm.trim()) return;

    setJWLoading(true);
    setJWError(null);
    try {
      const response = await fetch(`/api/jw-search?q=${encodeURIComponent(jwSearchTerm)}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const results = data.results || [];
      setJWResults(results);
      setSelectedJWResult(null);
      
      if (results.length === 0) {
        setJWError('Nenhuma congregação encontrada nessa localização.');
      }
    } catch (error: any) {
      console.error('Erro na busca JW:', error);
      setJWError('Erro ao buscar congregações. Tente novamente.');
    } finally {
      setJWLoading(false);
    }
  };

  const handleSelectJWCong = () => {
    if (!selectedJWResult) return;
    
    // Extract info from JW.org result
    const address = selectedJWResult.address || {};
    const phones = selectedJWResult.phones || [];
    const mainPhone = phones.length > 0 ? formatPhone(phones[0].phone) : '';
    
    setFormData({
      ...defaultFormData,
      nome: selectedJWResult.orgName || '',
      numero: selectedJWResult.orgNumber?.toString() || '',
      endereco: `${address.addressLine1 || ''}${address.addressLine2 ? `, ${address.addressLine2}` : ''}`,
      cidade: address.city?.toUpperCase() || '',
      estado: address.stateCode?.toUpperCase() || '',
      cep: address.postalCode || '',
      telefone: mainPhone,
    });
    
    setShowJWSearch(false);
    setIsEditing(true);
    setSelectedCong(null);
    setSelectedJWResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#E67E22] bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          Gestão de Congregações
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Search and Add Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar por nome ou número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22] transition-colors"
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setShowJWSearch(true)}
                    className="w-full md:w-auto bg-white text-[#E67E22] border border-[#E67E22] px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#E67E22]/5 transition-colors shadow-sm"
                  >
                    <Search size={20} />
                    Buscar no JW.org
                  </button>
                  <button 
                    onClick={handleAddNew}
                    className="w-full md:w-auto bg-[#E67E22] text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#d35400] transition-colors shadow-md"
                  >
                    <Plus size={20} />
                    Nova Congregação
                  </button>
                </div>
              </div>

            {/* List Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#E67E22]" size={48} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCongregations.length > 0 ? (
                  filteredCongregations.map((cong) => (
                    <div 
                      key={cong.id}
                      className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#E67E22]/10 rounded-lg flex items-center justify-center text-[#E67E22]">
                            <Store size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{cong.nome}</h3>
                            <p className="text-xs text-gray-500 font-mono">Nº {cong.numero} • Parte {cong.parte}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(cong)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(cong.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="truncate">{cong.cidade} - {cong.estado}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="truncate">{cong.coordenador || 'Sem coordenador'}</span>
                        </div>
                        {cong.grupos && cong.grupos.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-gray-400" />
                            <span className="text-xs">{cong.grupos.length} Grupo(s)</span>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleEdit(cong)}
                        className="w-full mt-4 py-2 text-xs font-bold text-[#E67E22] border border-[#E67E22]/20 rounded-lg hover:bg-[#E67E22] hover:text-white transition-all"
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Store className="mx-auto text-gray-300 mb-2" size={48} />
                    <p className="text-gray-500 font-medium">Nenhuma congregação encontrada.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
          >
            <div className="bg-[#E67E22] p-4 text-white">
              <h3 className="font-bold">
                {selectedCong ? 'Editar Congregação' : 'Nova Congregação'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Nome da Congregação</label>
                      <input 
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({...formData, nome: e.target.value})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22]"
                        placeholder="Ex: Central"
                      />
                    </div>
                    <div className="w-full md:w-[140px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Número</label>
                      <input 
                        required
                        value={formData.numero}
                        onChange={(e) => setFormData({...formData, numero: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22]"
                        placeholder="000000"
                      />
                    </div>
                    <div className="w-full md:w-[100px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Parte</label>
                      <input 
                        value={formData.parte}
                        onChange={(e) => setFormData({...formData, parte: e.target.value.toUpperCase().slice(0, 1)})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22] text-center"
                        placeholder="A"
                        maxLength={1}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Endereço Completo</label>
                    <input 
                      value={formData.endereco}
                      onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22]"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-[180px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">CEP</label>
                      <div className="relative">
                        <input 
                          value={formData.cep}
                          onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                          onBlur={handleCEPSearch}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22] pr-8"
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        <button 
                          type="button"
                          onClick={handleCEPSearch}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#E67E22] hover:text-[#d35400]"
                        >
                          {isSearchingCEP ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                      <input 
                        value={formData.cidade}
                        onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22]"
                        placeholder="CIDADE"
                      />
                    </div>
                    <div className="w-full md:w-[80px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">UF</label>
                      <input 
                        value={formData.estado}
                        onChange={(e) => setFormData({...formData, estado: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22] text-center"
                        placeholder="UF"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                  <h4 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">
                    Coordenador
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nome do CCA</label>
                    <input 
                      value={formData.coordenador}
                      onChange={(e) => setFormData({...formData, coordenador: e.target.value})}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#E67E22]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Telefone</label>
                    <input 
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: formatPhone(e.target.value)})}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#E67E22]"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>

              {/* Groups Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-sm font-bold text-gray-700">
                    Grupos e Pré-grupos
                  </h4>
                  <button 
                    type="button"
                    onClick={handleAddGroup}
                    className="flex items-center gap-1 text-xs font-bold text-[#E67E22] hover:bg-[#E67E22]/10 px-2 py-1 rounded-lg transition-all"
                  >
                    <Plus size={14} /> Adicionar Grupo
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.grupos.map((grupo, index) => (
                    <div key={index} className="relative group">
                      <input 
                        value={grupo}
                        onChange={(e) => handleGroupChange(index, e.target.value)}
                        placeholder={`Nome do Grupo ${index + 1}`}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#E67E22] pr-8"
                      />
                      <button 
                        type="button"
                        onClick={() => handleRemoveGroup(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.grupos.length === 0 && (
                    <p className="text-xs text-gray-400 italic col-span-full">Nenhum grupo adicionado. Clique no &quot;+&quot; para adicionar.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2 bg-[#E67E22] text-white font-bold rounded-lg hover:bg-[#d35400] transition-colors shadow-md flex items-center gap-2"
                >
                  <Save size={20} />
                  Salvar Congregação
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gray-800">Excluir Congregação</h3>
              <p className="text-gray-600">Tem certeza que deseja excluir esta congregação? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => handleDelete(showDeleteConfirm)}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
              >
                Confirmar Exclusão
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* JW.org Search Modal */}
      {showJWSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-0 max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-200"
          >
            {/* Header */}
            <div className="bg-[#4A6DA7] p-5 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Search size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Buscar no JW.org</h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-wider font-medium">Localizador de Congregações</p>
                </div>
              </div>
              <button 
                onClick={() => setShowJWSearch(false)} 
                className="hover:bg-white/20 p-2 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row h-[600px]">
              {/* Left Side: Search and Results */}
              <div className={`flex-1 flex flex-col border-r border-gray-100 ${selectedJWResult ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                  <form onSubmit={handleJWSearch} className="relative">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Cidade, bairro ou endereço..."
                      value={jwSearchTerm}
                      onChange={(e) => setJWSearchTerm(e.target.value)}
                      className="w-full p-4 pl-12 bg-white border border-gray-200 rounded-2xl outline-none focus:border-[#4A6DA7] focus:ring-4 focus:ring-[#4A6DA7]/10 transition-all shadow-sm"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <button 
                      type="submit"
                      disabled={jwLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#4A6DA7] text-white p-2 rounded-xl hover:bg-[#3b5998] transition-colors disabled:opacity-50"
                    >
                      {jwLoading ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                    </button>
                  </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {jwLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                      <Loader2 className="animate-spin text-[#4A6DA7]" size={40} />
                      <p className="text-sm font-medium">Buscando congregações...</p>
                    </div>
                  ) : jwResults.length > 0 ? (
                    jwResults.map((result, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setSelectedJWResult(result)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all group ${
                          selectedJWResult?.orgNumber === result.orgNumber 
                            ? 'bg-[#4A6DA7]/5 border-[#4A6DA7] shadow-md' 
                            : 'bg-white border-gray-100 hover:border-[#4A6DA7]/30 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className={`font-bold transition-colors ${
                              selectedJWResult?.orgNumber === result.orgNumber ? 'text-[#4A6DA7]' : 'text-gray-900'
                            }`}>
                              {result.orgName}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <MapPin size={12} />
                              <span className="truncate">{result.address?.city}, {result.address?.stateCode}</span>
                            </div>
                          </div>
                          <ChevronRight size={16} className={`transition-transform ${
                            selectedJWResult?.orgNumber === result.orgNumber ? 'translate-x-1 text-[#4A6DA7]' : 'text-gray-300'
                          }`} />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center p-8">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Search size={40} className="opacity-20" />
                      </div>
                      <h4 className="text-gray-600 font-bold mb-1">
                        {jwError ? 'Ops!' : 'Comece sua busca'}
                      </h4>
                      <p className="text-sm">
                        {jwError || 'Digite uma localização acima para encontrar congregações próximas.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Details */}
              <div className={`flex-1 flex flex-col bg-gray-50/30 ${selectedJWResult ? 'flex' : 'hidden md:flex'}`}>
                {selectedJWResult ? (
                  <div className="flex-1 flex flex-col">
                    <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[#4A6DA7] font-bold text-xs uppercase tracking-widest">
                          <Store size={14} />
                          <span>Detalhes da Congregação</span>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 leading-tight">
                          {selectedJWResult.orgName}
                        </h2>
                        <p className="text-sm font-mono text-gray-500 bg-white inline-block px-2 py-1 rounded-md border border-gray-100">
                          Nº {selectedJWResult.orgNumber}
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                          <div className="flex gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#4A6DA7] shrink-0">
                              <MapPin size={20} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-gray-400 uppercase">Localização</p>
                              <p className="text-gray-700 font-medium leading-relaxed">
                                {selectedJWResult.address?.addressLine1}
                                {selectedJWResult.address?.addressLine2 && <><br />{selectedJWResult.address?.addressLine2}</>}
                                <br />
                                {selectedJWResult.address?.city}, {selectedJWResult.address?.stateCode} {selectedJWResult.address?.postalCode}
                              </p>
                            </div>
                          </div>

                          {selectedJWResult.phones?.length > 0 && (
                            <div className="flex gap-4 pt-4 border-t border-gray-50">
                              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shrink-0">
                                <Phone size={20} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-gray-400 uppercase">Telefone</p>
                                <p className="text-gray-700 font-bold">{selectedJWResult.phones[0].phone}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedJWResult.properties?.length > 0 && (
                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                              <Calendar size={14} />
                              <span>Horários das Reuniões</span>
                            </div>
                            <div className="space-y-3">
                              {selectedJWResult.properties.map((prop: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600">{prop.label}</span>
                                  <span className="font-bold text-gray-900">{prop.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-6 bg-white border-t border-gray-100 flex gap-3">
                      <button 
                        onClick={() => setSelectedJWResult(null)}
                        className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all md:hidden"
                      >
                        Voltar
                      </button>
                      <button 
                        onClick={handleSelectJWCong}
                        className="flex-[2] py-4 bg-[#4A6DA7] text-white font-bold rounded-2xl hover:bg-[#3b5998] transition-all shadow-lg shadow-[#4A6DA7]/20 flex items-center justify-center gap-2"
                      >
                        <Save size={20} />
                        Carregar no ProgCir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                    <div className="w-24 h-24 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
                      <Info size={40} className="opacity-10" />
                    </div>
                    <h4 className="text-gray-600 font-bold mb-2">Detalhes da Seleção</h4>
                    <p className="text-sm max-w-[200px]">
                      Selecione uma congregação na lista ao lado para ver as informações detalhadas.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-center items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                Conectado ao Banco de Dados Oficial JW.org
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
