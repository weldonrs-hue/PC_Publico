'use client';

import { useState, useEffect } from 'react';
import { 
  UserRound, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronLeft,
  Search,
  MapPin,
  Store,
  Save,
  UserCheck,
  Loader2
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
  cidade: string;
  estado: string;
}

interface Substitute {
  id: string;
  nome: string;
  congregacaoId: string;
  congregacaoNome: string;
  cidade: string;
  estado: string;
}

interface SubstitutesViewProps {
  userId: string;
  onBack: () => void;
}

export default function SubstitutesView({ userId, onBack }: SubstitutesViewProps) {
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to substitutes
    const qSubs = query(collection(db, 'substitutes'), where('userId', '==', userId));
    const unsubscribeSubs = onSnapshot(qSubs, (snapshot) => {
      const subsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Substitute[];
      setSubstitutes(subsData);
      setLoading(false);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'substitutes');
      }
      setLoading(false);
    });

    // Fetch congregations once for the select dropdown
    const fetchCongregations = async () => {
      try {
        const qCongs = query(collection(db, 'congregations'), where('userId', '==', userId));
        const snapshot = await getDocs(qCongs);
        const congsData = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Congregation[];
        setCongregations(congsData);
      } catch (error) {
        if (auth.currentUser) {
          handleFirestoreError(error, OperationType.GET, 'congregations');
        }
      }
    };

    fetchCongregations();

    return () => unsubscribeSubs();
  }, [userId]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Substitute | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const defaultFormData: Substitute = {
    id: '', nome: '', congregacaoId: '', congregacaoNome: '', cidade: '', estado: ''
  };
  
  const [formData, setFormData] = useState<Substitute>(defaultFormData);

  const handleCongregationChange = (congId: string) => {
    const cong = congregations.find(c => c.id === congId);
    if (cong) {
      setFormData(prev => ({
        ...prev,
        congregacaoId: cong.id,
        congregacaoNome: cong.nome,
        cidade: cong.cidade.toUpperCase(),
        estado: cong.estado.toUpperCase()
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        congregacaoId: '',
        congregacaoNome: '',
        cidade: '',
        estado: ''
      }));
    }
  };

  const handleAddNew = () => {
    setSelectedSub(null);
    setFormData(defaultFormData);
    setIsEditing(true);
  };

  const handleEdit = (sub: Substitute) => {
    setSelectedSub(sub);
    setFormData({ ...defaultFormData, ...sub });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'substitutes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'substitutes');
    }
    setShowDeleteConfirm(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let docRef;
      if (selectedSub) {
        docRef = doc(db, 'substitutes', selectedSub.id);
      } else {
        docRef = doc(collection(db, 'substitutes'));
      }

      const { id, ...dataToSave } = formData;
      await setDoc(docRef, { ...dataToSave, userId });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'substitutes');
    }
  };

  const filteredSubstitutes = substitutes.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.congregacaoNome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#C2185B] bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          Superintendentes Substitutos
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
                  placeholder="Buscar por nome ou congregação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#C2185B] transition-colors"
                />
              </div>
              <button 
                onClick={handleAddNew}
                className="w-full md:w-auto bg-[#C2185B] text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#ad1457] transition-colors shadow-md"
              >
                <Plus size={20} />
                Novo Substituto
              </button>
            </div>

            {/* List Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#C2185B]" size={48} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSubstitutes.length > 0 ? (
                  filteredSubstitutes.map((sub) => (
                    <div 
                      key={sub.id}
                      className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#C2185B]/10 rounded-lg flex items-center justify-center text-[#C2185B]">
                            <UserRound size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{sub.nome}</h3>
                            <p className="text-xs text-gray-500 font-medium">{sub.congregacaoNome}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(sub)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(sub.id)}
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
                          <span className="truncate">{sub.cidade} - {sub.estado}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Store size={14} className="text-gray-400" />
                          <span className="truncate">Congregação: {sub.congregacaoNome}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleEdit(sub)}
                        className="w-full mt-4 py-2 text-xs font-bold text-[#C2185B] border border-[#C2185B]/20 rounded-lg hover:bg-[#C2185B] hover:text-white transition-all"
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <UserRound className="mx-auto text-gray-300 mb-2" size={48} />
                    <p className="text-gray-500 font-medium">Nenhum substituto encontrado.</p>
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
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden max-w-2xl mx-auto"
          >
            <div className="bg-[#C2185B] p-4 text-white">
              <h3 className="font-bold">
                {selectedSub ? 'Editar Substituto' : 'Novo Substituto'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome Completo</label>
                  <input 
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#C2185B]"
                    placeholder="Nome do Superintendente Substituto"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Congregação</label>
                  <select 
                    required
                    value={formData.congregacaoId}
                    onChange={(e) => handleCongregationChange(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#C2185B]"
                  >
                    <option value="">Selecione uma congregação...</option>
                    {congregations.map(cong => (
                      <option key={cong.id} value={cong.id}>{cong.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                    <input 
                      readOnly
                      value={formData.cidade}
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg outline-none text-gray-500 cursor-not-allowed"
                      placeholder="Preenchido automaticamente"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Estado</label>
                    <input 
                      readOnly
                      value={formData.estado}
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg outline-none text-gray-500 cursor-not-allowed"
                      placeholder="UF"
                    />
                  </div>
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
                  className="px-8 py-2 bg-[#C2185B] text-white font-bold rounded-lg hover:bg-[#ad1457] transition-colors shadow-md flex items-center gap-2"
                >
                  <Save size={20} />
                  Salvar Substituto
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
              <h3 className="text-xl font-bold text-gray-800">Excluir Substituto</h3>
              <p className="text-gray-600">Tem certeza que deseja excluir este substituto? Esta ação não pode ser desfeita.</p>
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
    </div>
  );
}
