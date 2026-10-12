'use client';

import {
    ChevronLeft,
    Edit2,
    Loader2,
    MapPin,
    Plus,
    Save,
    Search,
    Store,
    Trash2,
    UserRound
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import CustomSelect from '@/components/CustomSelect';
import { useDialog } from '@/hooks/useDialog';
import { auth, db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    where
} from 'firebase/firestore';

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

const defaultFormData: Substitute = {
  id: '',
  nome: '',
  congregacaoId: '',
  congregacaoNome: '',
  cidade: '',
  estado: ''
};

export default function SubstitutesView({ userId, onBack }: SubstitutesViewProps) {
  const { showAlert, showDeleteConfirm } = useDialog();
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    if (!formData.nome.trim()) {
      showAlert('Informe o nome do substituto.', 'Atenção');
      return;
    }
    if (!formData.congregacaoId) {
      showAlert('Selecione uma congregação para o substituto.', 'Atenção');
      return;
    }

    setIsSaving(true);
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
      showAlert('Substituto salvo com sucesso.', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'substitutes');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSubstitutes = substitutes.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.congregacaoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cidade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header com botão Voltar estilizado */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 cursor-pointer"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-typography-900 tracking-tight">
            Superintendentes Substitutos
          </h2>
          <p className="text-xs text-typography-500">
            Gerencie os irmãos designados como substitutos no circuito
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-4"
          >
            {/* Barra de Pesquisa e Botão Novo */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface-100 p-3 sm:p-4 rounded-2xl shadow-xs border border-surface-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-400 to-transparent opacity-85" />
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar por nome, congregação ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs text-typography-900 placeholder:text-typography-400 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-colors"
                />
              </div>
              <button 
                onClick={handleAddNew}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus size={16} />
                <span>Novo Substituto</span>
              </button>
            </div>

            {/* Grid de Substitutos */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-rose-500" size={40} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSubstitutes.length > 0 ? (
                  filteredSubstitutes.map((sub) => (
                    <div 
                      key={sub.id}
                      className="group relative bg-surface-100 p-4 sm:p-5 rounded-2xl shadow-xs border border-surface-300 hover:border-rose-500/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
                    >
                      {/* Brilho decorativo suave no canto */}
                      <div 
                        className="absolute -top-12 -right-12 w-24 h-24 rounded-full blur-2xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                        style={{ backgroundColor: '#F43F5E' }}
                      />

                      {/* Faixa gradiente superior */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundImage: 'linear-gradient(to right, #F43F5E, transparent)' }}
                      />

                      <div>
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 group-hover:scale-105 transition-transform duration-200 shrink-0">
                              <UserRound size={19} strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base text-typography-900 group-hover:text-rose-600 transition-colors truncate">
                                {sub.nome}
                              </h3>
                              <p className="text-xs text-typography-500 truncate flex items-center gap-1.5 mt-0.5">
                                <Store size={12} className="shrink-0 text-typography-400" />
                                <span className="truncate">{sub.congregacaoNome || 'Congregação não informada'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                            <button 
                              onClick={() => handleEdit(sub)}
                              className="p-1.5 text-typography-400 hover:text-rose-600 hover:bg-surface-200 rounded-lg transition-colors cursor-pointer"
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
                              className="p-1.5 text-typography-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Localização */}
                        <div className="space-y-1.5 text-xs text-typography-600 border-t border-surface-300/80 pt-3 mt-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-typography-400 shrink-0" />
                            <span className="truncate font-medium">
                              {sub.cidade ? `${sub.cidade} - ${sub.estado}` : 'Localização não informada'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleEdit(sub)}
                        className="w-full mt-4 py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded-xl border border-rose-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={13} />
                        <span>Editar Detalhes</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-14 text-center bg-surface-100 rounded-2xl border-2 border-dashed border-surface-300 p-8">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
                      <UserRound size={28} />
                    </div>
                    <p className="text-sm font-semibold text-typography-800">
                      {searchTerm ? 'Nenhum substituto encontrado para a busca.' : 'Nenhum substituto cadastrado.'}
                    </p>
                    <p className="text-xs text-typography-500 mt-1">
                      {searchTerm ? 'Tente buscar por outro termo.' : 'Clique em "Novo Substituto" para adicionar.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="relative bg-surface-100 rounded-3xl shadow-md border border-surface-300 overflow-hidden max-w-2xl mx-auto"
          >
            {/* Faixa gradiente superior */}
            <div 
              className="h-1.5 w-full bg-gradient-to-r"
              style={{ backgroundImage: 'linear-gradient(to right, #F43F5E, #FB7185, transparent)' }}
            />

            {/* Cabeçalho do Formulário */}
            <div className="p-5 sm:p-6 border-b border-surface-300/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 shrink-0">
                  <UserRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-typography-900">
                    {selectedSub ? 'Editar Substituto' : 'Novo Substituto'}
                  </h3>
                  <p className="text-xs text-typography-500">
                    {selectedSub ? 'Atualize as informações do substituto' : 'Preencha os dados para cadastrar um novo substituto'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
              <div className="space-y-4">
                {/* Nome Completo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-colors"
                    placeholder="Nome do Superintendente Substituto"
                  />
                </div>

                {/* Congregação com CustomSelect pesquisável */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                    Congregação <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={formData.congregacaoId}
                    onChange={handleCongregationChange}
                    options={sortedCongregations.map(cong => ({
                      value: cong.id,
                      label: cong.nome,
                      description: `${cong.cidade} - ${cong.estado}`
                    }))}
                    placeholder="Selecione ou busque uma congregação..."
                    searchable={true}
                    size="md"
                  />
                </div>

                {/* Cidade e Estado (Preenchimento automático a partir da congregação) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                      Cidade
                    </label>
                    <input 
                      readOnly
                      value={formData.cidade}
                      className="w-full px-3.5 py-2.5 bg-surface-200/60 border border-surface-300 rounded-xl text-sm text-typography-700 cursor-not-allowed outline-none select-none"
                      placeholder="Preenchido automaticamente"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                      Estado (UF)
                    </label>
                    <input 
                      readOnly
                      value={formData.estado}
                      className="w-full px-3.5 py-2.5 bg-surface-200/60 border border-surface-300 rounded-xl text-sm text-typography-700 cursor-not-allowed outline-none select-none uppercase"
                      placeholder="UF"
                    />
                  </div>
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-surface-300/80">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 text-typography-600 hover:text-typography-900 font-semibold text-sm hover:bg-surface-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  <span>{isSaving ? 'Salvando...' : 'Salvar Substituto'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
