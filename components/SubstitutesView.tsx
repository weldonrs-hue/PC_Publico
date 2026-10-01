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
import { useMemo } from 'react';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';

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

interface ItineraryItem {
  id?: string;
  semana: string;
  congregacaoId?: string;
  evento: string;
}

interface SubstitutesViewProps {
  userId: string;
  onBack: () => void;
}

export default function SubstitutesView({ userId, onBack }: SubstitutesViewProps) {
  const { showAlert, showConfirm, showDeleteConfirm } = useDialog();
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
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

    // Fetch itineraries once for sorting
    const fetchItineraries = async () => {
      try {
        const qItin = query(collection(db, 'itineraries'), where('userId', '==', userId));
        const snapshot = await getDocs(qItin);
        const itinData = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as ItineraryItem[];
        setItineraries(itinData);
      } catch (error) {
        console.error("Error fetching itineraries for sorting:", error);
      }
    };

    fetchCongregations();
    fetchItineraries();

    return () => unsubscribeSubs();
  }, [userId]);

  const sortedCongregations = useMemo(() => {
    if (!congregations.length) return [];
    
    const visitMap = new Map<string, number>();
    
    itineraries.forEach(item => {
      const isVisit = item.evento?.toLowerCase().includes('visita') || 
                      (item.congregacaoId && !item.evento);

      if ((item.congregacaoId) && isVisit) {
        try {
          const s = item.semana || '';
          const parts = s.split('/');
          if (parts.length === 3) {
            const [d, m, y] = parts.map(Number);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const date = new Date(y, m - 1, d).getTime();
              
              const targetId = item.congregacaoId;
              
              if (targetId) {
                const current = visitMap.get(targetId);
                if (current === undefined || date < current) {
                  visitMap.set(targetId, date);
                }
              }
            }
          }
        } catch (e) {}
      }
    });
    
    return [...congregations].sort((a, b) => {
      const dateA = visitMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const dateB = visitMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      
      if (dateA !== dateB) return dateA - dateB;
      return a.nome.localeCompare(b.nome);
    });
  }, [congregations, itineraries]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Substitute | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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
      showAlert('Substituto excluído com sucesso.', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'substitutes');
    }
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
          className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-rose-600 bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={22} strokeWidth={3} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">
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
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-colors"
                />
              </div>
              <button 
                onClick={handleAddNew}
                className="w-full md:w-auto bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 active:scale-95"
              >
                <Plus size={16} />
                NOVO
              </button>
            </div>

            {/* List Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-rose-500" size={48} />
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
                          <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
                            <UserRound size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{sub.nome}</h3>
                            <p className="text-xs text-gray-500 font-medium">{sub.congregacaoNome}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(sub)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={async () => {
                              const confirmed = await showDeleteConfirm('Tem certeza que deseja excluir este substituto? Esta ação não pode ser desfeita.', 'Excluir Substituto');
                              if (confirmed) {
                                handleDelete(sub.id);
                              }
                            }}
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
                        className="w-full mt-4 py-2 text-xs font-bold text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-600 hover:text-white transition-all"
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
            <div className="bg-rose-600 p-4 text-white">
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
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-rose-500"
                    placeholder="Nome do Superintendente Substituto"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Congregação</label>
                  <select 
                    required
                    value={formData.congregacaoId}
                    onChange={(e) => handleCongregationChange(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-rose-500"
                  >
                    <option value="">Selecione uma congregação...</option>
                    {sortedCongregations.map(cong => (
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
                  className="px-8 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-md flex items-center gap-2"
                >
                  <Save size={20} />
                  Salvar Substituto
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
