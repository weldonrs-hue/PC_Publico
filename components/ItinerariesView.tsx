'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Map, 
  ChevronLeft,
  Save,
  Loader2,
  CheckCircle2,
  Circle,
  Edit2,
  Plus,
  Trash2,
  X,
  Calendar,
  Info,
  Type,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  onSnapshot,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface ItinerariesViewProps {
  userId: string;
  onBack: () => void;
}

interface ItineraryItem {
  id?: string;
  semana: string;
  dataEvento: string;
  evento: string;
  tipoEvento?: string;
  observacoes: string;
  escritorioNotificado: boolean;
  congregacaoNotificada: boolean;
  ordem: number;
  // New fields
  dataInicialDia?: string;
  dataTerminoDia?: string;
  congregacao?: string;
  substituto?: string;
  grupo?: string;
  outroEvento?: string;
}

interface Congregation {
  id: string;
  nome: string;
  cidade: string;
  grupos?: string[];
}

interface Substitute {
  id: string;
  nome: string;
}

const DIAS_SEMANA = [
  'Segunda-Feira',
  'Terça-Feira',
  'Quarta-Feira',
  'Quinta-Feira',
  'Sexta-Feira',
  'Sábado',
  'Domingo'
];

const TIPOS_EVENTO = [
  'Visita a Congregação',
  'Visita a Grupo',
  'Outros Eventos',
  'SEMANA DE PIONEIRO',
  'Recebendo visita de pastoreio',
  'SEMANA LIVRE'
];

const OUTROS_EVENTOS = [
  'Assembleia CA_Br',
  'Assembleia CA_Co',
  'AUSÊNCIA',
  'LICENÇA',
  'Congresso Regional',
  'Cursando Escola',
  'Escola de Pioneiros',
  'Escola para Anciãos',
  'Refeição Noturna do Senhor',
  'Reunião especial com os pioneiros'
];

export default function ItinerariesView({ userId, onBack }: ItinerariesViewProps) {
  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data for selects
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  
  // Modal states
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [modalMode, setModalMode] = useState<'actions' | 'edit' | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ItineraryItem>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);

  const calculateDate = (mondayStr: string, dayName: string) => {
    try {
      const [day, month, year] = mondayStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      const dayIndex = DIAS_SEMANA.indexOf(dayName);
      if (dayIndex === -1) return '';
      
      date.setDate(date.getDate() + dayIndex);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    } catch (e) {
      return '';
    }
  };

  const getWeekRangeDisplay = (mondayStr: string) => {
    try {
      const [day, month, year] = mondayStr.split('/').map(Number);
      const monday = new Date(year, month - 1, day);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const d1 = String(monday.getDate()).padStart(2, '0');
      const m1 = String(monday.getMonth() + 1).padStart(2, '0');
      const y1 = monday.getFullYear();
      
      const d2 = String(sunday.getDate()).padStart(2, '0');
      const m2 = String(sunday.getMonth() + 1).padStart(2, '0');
      const y2 = sunday.getFullYear();
      
      return `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
    } catch (e) {
      return mondayStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      // Fetch congregations
      const congQuery = query(collection(db, 'congregations'), where('userId', '==', userId));
      const congSnap = await getDocs(congQuery);
      const congList = congSnap.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome,
        cidade: doc.data().cidade,
        grupos: doc.data().grupos || []
      })) as Congregation[];
      setCongregations(congList);

      // Fetch substitutes
      const subQuery = query(collection(db, 'substitutes'), where('userId', '==', userId));
      const subSnap = await getDocs(subQuery);
      const subList = subSnap.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome
      })) as Substitute[];
      setSubstitutes(subList);
    } catch (error) {
      console.error('Error fetching auxiliary data:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  const generateMondays = () => {
    const dates: string[] = [];
    const now = new Date();
    // Start from the first day of the current month
    const date = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Find the first Monday of the month
    while (date.getDay() !== 1) {
      date.setDate(date.getDate() + 1);
    }
    
    // Generate 27 Mondays
    for (let i = 0; i < 27; i++) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      dates.push(`${day}/${month}/${year}`);
      date.setDate(date.getDate() + 7);
    }
    return dates;
  };

  const isCurrentWeek = (semanaStr: string) => {
    const [day, month, year] = semanaStr.split('/').map(Number);
    const mondayDate = new Date(year, month - 1, day);
    const nextMonday = new Date(mondayDate);
    nextMonday.setDate(nextMonday.getDate() + 7);
    
    const now = new Date();
    return now >= mondayDate && now < nextMonday;
  };

  const initializeItineraries = useCallback(async () => {
    try {
      const batch = writeBatch(db);
      const newItems: ItineraryItem[] = [];
      const mondays = generateMondays();
      
      for (let i = 0; i < 27; i++) {
        const newDocRef = doc(collection(db, 'itineraries'));
        const item: ItineraryItem = {
          semana: mondays[i],
          dataEvento: '',
          evento: '',
          observacoes: '',
          escritorioNotificado: false,
          congregacaoNotificada: false,
          ordem: i + 1
        };
        batch.set(newDocRef, { ...item, userId });
        newItems.push({ ...item, id: newDocRef.id });
      }
      
      await batch.commit();
      setItineraries(newItems);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'itineraries_init');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleRegenerateDates = () => {
    const mondays = generateMondays();
    setItineraries(prev => prev.map((item, i) => ({
      ...item,
      semana: mondays[i] || item.semana
    })));
  };

  useEffect(() => {
    const q = query(
      collection(db, 'itineraries'), 
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Initialize 27 rows if none exist
        initializeItineraries();
      } else {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ItineraryItem[];
        // Sort by ordem and then by id for stable ordering of multiple events in a week
        items.sort((a, b) => {
          if (a.ordem !== b.ordem) return a.ordem - b.ordem;
          return (a.id || '').localeCompare(b.id || '');
        });
        
        // Check if we need to fix the week dates (old format "Semana X")
        const needsFix = items.some(item => item.semana.includes('Semana'));
        if (needsFix) {
          const mondays = generateMondays();
          const fixedItems = items.map((item, i) => ({
            ...item,
            semana: mondays[i] || item.semana
          }));
          setItineraries(fixedItems);
        } else {
          setItineraries(items);
        }
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'itineraries');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, initializeItineraries]);

  const handleChange = (id: string, field: keyof ItineraryItem, value: any) => {
    setItineraries(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      itineraries.forEach(item => {
        if (item.id) {
          const docRef = doc(db, 'itineraries', item.id);
          const { id, ...data } = item;
          batch.update(docRef, data);
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'itineraries_save');
    } finally {
      setSaving(false);
    }
  };

  const handleRowDoubleClick = (item: ItineraryItem) => {
    setSelectedItem(item);
    setModalMode('actions');
  };

  const handleEditClick = () => {
    if (selectedItem) {
      setIsAddingNew(false);
      
      // Infer tipoEvento if it doesn't exist (for existing data)
      let tipo = selectedItem.tipoEvento;
      if (!tipo) {
        if (selectedItem.evento === 'SEMANA LIVRE') tipo = 'SEMANA LIVRE';
        else if (selectedItem.evento === 'SEMANA DE PIONEIRO') tipo = 'SEMANA DE PIONEIRO';
        else if (selectedItem.evento === 'Recebendo visita de pastoreio') tipo = 'Recebendo visita de pastoreio';
        else if (selectedItem.grupo) tipo = 'Visita a Grupo';
        else if (OUTROS_EVENTOS.includes(selectedItem.evento)) tipo = 'Outros Eventos';
        else if (selectedItem.congregacao) tipo = 'Visita a Congregação';
        else tipo = TIPOS_EVENTO[0];
      }

      setEditFormData({
        dataEvento: selectedItem.dataEvento,
        evento: tipo,
        tipoEvento: tipo,
        observacoes: selectedItem.observacoes,
        dataInicialDia: selectedItem.dataInicialDia || 'Terça-Feira',
        dataTerminoDia: selectedItem.dataTerminoDia || 'Domingo',
        congregacao: selectedItem.congregacao || '',
        substituto: selectedItem.substituto || '',
        grupo: selectedItem.grupo || '',
        outroEvento: selectedItem.outroEvento || (tipo === 'Outros Eventos' ? selectedItem.evento : '')
      });
      setModalMode('edit');
    }
  };

  const handleAddClick = () => {
    if (selectedItem) {
      setIsAddingNew(true);
      setEditFormData({
        dataEvento: '',
        evento: TIPOS_EVENTO[0],
        observacoes: '',
        dataInicialDia: 'Terça-Feira',
        dataTerminoDia: 'Domingo',
        congregacao: '',
        substituto: '',
        grupo: '',
        outroEvento: ''
      });
      setModalMode('edit');
    }
  };

  const handleDeleteClick = async () => {
    if (selectedItem && selectedItem.id) {
      setSaving(true);
      try {
        // Check if there are other events for this week
        const othersInWeek = itineraries.filter(item => 
          item.semana === selectedItem.semana && item.id !== selectedItem.id
        );

        if (othersInWeek.length > 0) {
          // Delete the document
          await deleteDoc(doc(db, 'itineraries', selectedItem.id));
        } else {
          // Just clear the fields
          const docRef = doc(db, 'itineraries', selectedItem.id);
          await setDoc(docRef, { 
            semana: selectedItem.semana,
            dataEvento: '',
            evento: '',
            observacoes: '',
            escritorioNotificado: selectedItem.escritorioNotificado,
            congregacaoNotificada: selectedItem.congregacaoNotificada,
            ordem: selectedItem.ordem,
            userId,
            dataInicialDia: '',
            dataTerminoDia: '',
            congregacao: '',
            substituto: '',
            grupo: '',
            outroEvento: ''
          });
        }
        setModalMode(null);
        setSelectedItem(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'itinerary_delete');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleFormSave = async () => {
    if (selectedItem && selectedItem.id) {
      setSaving(true);
      try {
        // Calculate start and end dates in dd/mm/yyyy
        const start = calculateDate(selectedItem.semana, editFormData.dataInicialDia || 'Terça-Feira');
        const end = calculateDate(selectedItem.semana, editFormData.dataTerminoDia || 'Domingo');
        
        // 1. Format Date Range according to rules:
        // - Same month: dd a dd/mm/aa
        // - Different months: dd/mm a dd/mm/aa
        // - Different years: dd/mm/aa a dd/mm/aa
        let dateRange = '';
        if (start && end && start.includes('/') && end.includes('/')) {
          const [d1, m1, y1] = start.split('/');
          const [d2, m2, y2] = end.split('/');
          const yy1 = y1.slice(-2);
          const yy2 = y2.slice(-2);

          if (y1 !== y2) {
            dateRange = `${d1}/${m1}/${yy1} a ${d2}/${m2}/${yy2}`;
          } else if (m1 !== m2) {
            dateRange = `${d1}/${m1} a ${d2}/${m2}/${yy2}`;
          } else {
            dateRange = `${d1} a ${d2}/${m1}/${yy2}`;
          }
        }

        // 2. Format Event Name according to rules:
        // - If "SEMANA LIVRE", use that exactly
        // - If "SEMANA DE PIONEIRO", use that exactly
        // - If "Visita a Grupo", use "{Grupo} - {Congregação}"
        // - If "Outros Eventos", use the selected/typed value
        // - If congregation selected: "Nome - Cidade" (if different) or just "Nome" (if same)
        // - Otherwise use the selected event type
        let finalEvento = editFormData.evento || '';
        if (editFormData.evento === 'SEMANA LIVRE') {
          finalEvento = 'SEMANA LIVRE';
        } else if (editFormData.evento === 'SEMANA DE PIONEIRO') {
          finalEvento = 'SEMANA DE PIONEIRO';
        } else if (editFormData.evento === 'Visita a Grupo') {
          finalEvento = `${editFormData.grupo || ''} - ${editFormData.congregacao || ''}`;
        } else if (editFormData.evento === 'Outros Eventos') {
          finalEvento = editFormData.outroEvento || 'Outros Eventos';
        } else if (editFormData.congregacao) {
          const cong = congregations.find(c => c.nome === editFormData.congregacao);
          if (cong) {
            // Check if name and city are the same (ignoring case)
            if (cong.nome.trim().toLowerCase() === cong.cidade.trim().toLowerCase()) {
              finalEvento = cong.nome;
            } else {
              finalEvento = `${cong.nome} - ${cong.cidade}`;
            }
          } else {
            finalEvento = editFormData.congregacao;
          }
        }

        const dataToSave = {
          ...editFormData,
          tipoEvento: editFormData.evento,
          dataEvento: dateRange,
          evento: finalEvento,
          semana: selectedItem.semana,
          ordem: selectedItem.ordem,
          userId
        };

        if (isAddingNew) {
          // Create new document
          const newDocRef = doc(collection(db, 'itineraries'));
          await setDoc(newDocRef, dataToSave);
        } else {
          // Update existing document
          const docRef = doc(db, 'itineraries', selectedItem.id);
          await setDoc(docRef, dataToSave, { merge: true });
        }

        setModalMode(null);
        setSelectedItem(null);
        setIsAddingNew(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'itinerary_save');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#512da8] font-bold hover:underline transition-all"
        >
          <ChevronLeft size={20} />
          Voltar ao Painel
        </button>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Map className="text-[#512da8]" />
          Itinerários do Circuito
        </h2>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="bg-[#512da8] p-4 text-white flex justify-between items-center print:hidden">
          <h3 className="font-bold flex items-center gap-2">
            Tabela de Itinerários
          </h3>
          <div className="flex gap-2 print:hidden">
            <button 
              onClick={handlePrint}
              className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <Printer size={16} />
              Imprimir
            </button>
            <button 
              onClick={handleRegenerateDates}
              className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              Gerar Datas (Segundas)
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-white text-[#512da8] px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Tudo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[#512da8]" size={48} />
          </div>
        ) : (
          <div className="overflow-x-auto pb-8">
            <div className="w-full max-w-full bg-white print:w-[210mm] print:mx-auto print:p-[10mm] print:shadow-none">
              <h1 className="hidden print:block text-2xl font-bold text-center mb-6">Tabela de Itinerários</h1>
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-2 text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/10 w-24 bg-[#673ab7] text-center">Semana</th>
                    <th className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 w-40">Data do Evento</th>
                    <th className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">Evento</th>
                    <th className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">Observações</th>
                    <th className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 w-24 text-center">Escritório Notificado</th>
                    <th className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Congregação Notificada</th>
                  </tr>
                </thead>
                <tbody>
                  {itineraries.map((item) => {
                    const current = isCurrentWeek(item.semana);
                    return (
                      <tr 
                        key={item.id} 
                        onDoubleClick={() => handleRowDoubleClick(item)}
                        className={`border-b border-gray-100 transition-colors cursor-pointer select-none ${current ? 'bg-amber-50/50' : 'hover:bg-gray-50/50'}`}
                      >
                        <td className={`p-1 border-r border-gray-100 ${current ? 'bg-amber-100/30' : ''}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-bold text-center p-1 rounded ${current ? 'text-[#512da8]' : 'text-gray-700'}`}>
                              {item.semana}
                            </span>
                            {current && (
                              <span className="text-[8px] font-bold bg-[#512da8] text-white px-1 rounded uppercase tracking-tighter print:hidden">
                                HOJE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-1 border-r border-gray-100">
                          <div className="text-sm text-gray-600 p-1">
                            {item.dataEvento || '-'}
                          </div>
                        </td>
                        <td className="p-1 border-r border-gray-100">
                          <div className="text-sm text-gray-600 p-1 break-words max-w-[200px]">
                            {item.evento || <span className="text-gray-300 italic">Vazio...</span>}
                          </div>
                        </td>
                        <td className="p-1 border-r border-gray-100">
                          <div className="text-sm text-gray-600 p-1 break-words max-w-[300px]">
                            {item.substituto && (
                              <span className="font-bold text-indigo-600">Substituto: {item.substituto}</span>
                            )}
                            {item.substituto && item.observacoes ? ' - ' : ''}
                            {item.observacoes || (!item.substituto && <span className="text-gray-300 italic">-</span>)}
                          </div>
                        </td>
                        <td className="p-1 border-r border-gray-100 text-center">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChange(item.id!, 'escritorioNotificado', !item.escritorioNotificado);
                            }}
                            className={`transition-colors ${item.escritorioNotificado ? 'text-green-500' : 'text-gray-300'}`}
                          >
                            {item.escritorioNotificado ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>
                        </td>
                        <td className="p-1 text-center">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChange(item.id!, 'congregacaoNotificada', !item.congregacaoNotificada);
                            }}
                            className={`transition-colors ${item.congregacaoNotificada ? 'text-green-500' : 'text-gray-300'}`}
                          >
                            {item.congregacaoNotificada ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              {/* Modal Header */}
              <div className="bg-[#512da8] p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  {modalMode === 'actions' ? 'Opções do Evento' : 'Editar Evento'}
                </h3>
                <button 
                  onClick={() => setModalMode(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {modalMode === 'actions' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 mb-4">
                      Semana de <span className="font-bold text-[#512da8]">{selectedItem?.semana}</span>
                    </p>
                    
                    <button 
                      onClick={handleEditClick}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-[#512da8] hover:bg-indigo-50 transition-all group"
                    >
                      <div className="bg-indigo-100 p-2 rounded-lg text-[#512da8] group-hover:bg-[#512da8] group-hover:text-white transition-colors">
                        <Edit2 size={20} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-gray-800">Editar Evento</div>
                        <div className="text-xs text-gray-500">Alterar informações existentes</div>
                      </div>
                    </button>

                    {selectedItem?.evento && (
                      <>
                        <button 
                          onClick={handleAddClick}
                          className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                        >
                          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <Plus size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-gray-800">Adicionar Evento</div>
                            <div className="text-xs text-gray-500">Limpar campos e adicionar novo</div>
                          </div>
                        </button>

                        <button 
                          onClick={handleDeleteClick}
                          className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-red-500 hover:bg-red-50 transition-all group"
                        >
                          <div className="bg-red-100 p-2 rounded-lg text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <Trash2 size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-gray-800">Excluir Evento</div>
                            <div className="text-xs text-gray-500">Remover evento desta semana</div>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="text-center pb-2 border-b border-gray-100 mb-4">
                      <h4 className="text-lg font-bold text-[#512da8]">
                        {selectedItem && getWeekRangeDisplay(selectedItem.semana)}
                      </h4>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        Tipo de Evento:
                      </label>
                      <select 
                        value={editFormData.evento}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updates: Partial<ItineraryItem> = { 
                            evento: val,
                            congregacao: '',
                            substituto: '',
                            grupo: '',
                            outroEvento: ''
                          };
                          if (val === 'SEMANA LIVRE') {
                            updates.dataInicialDia = 'Segunda-Feira';
                            updates.dataTerminoDia = 'Domingo';
                          } else {
                            updates.dataInicialDia = 'Terça-Feira';
                            updates.dataTerminoDia = 'Domingo';
                          }
                          setEditFormData({ ...editFormData, ...updates });
                        }}
                        className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white"
                      >
                        {TIPOS_EVENTO.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          Data inicial:
                        </label>
                        <div className="relative">
                          <select 
                            value={editFormData.dataInicialDia}
                            onChange={(e) => setEditFormData({ ...editFormData, dataInicialDia: e.target.value })}
                            className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white appearance-none pr-10"
                          >
                            {DIAS_SEMANA.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-red-700 font-serif italic text-xs">
                            {selectedItem && calculateDate(selectedItem.semana, editFormData.dataInicialDia || 'Terça-Feira')}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          Data de término:
                        </label>
                        <div className="relative">
                          <select 
                            value={editFormData.dataTerminoDia}
                            onChange={(e) => setEditFormData({ ...editFormData, dataTerminoDia: e.target.value })}
                            className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white appearance-none pr-10"
                          >
                            {DIAS_SEMANA.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-red-700 font-serif italic text-xs">
                            {selectedItem && calculateDate(selectedItem.semana, editFormData.dataTerminoDia || 'Domingo')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Conditional Fields based on Event Type */}
                    {editFormData.evento === 'Visita a Grupo' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          Grupo:
                        </label>
                        <select 
                          value={editFormData.grupo}
                          onChange={(e) => {
                            const grupoNome = e.target.value;
                            // Find the congregation this group belongs to
                            const cong = congregations.find(c => c.grupos?.includes(grupoNome));
                            setEditFormData({ 
                              ...editFormData, 
                              grupo: grupoNome,
                              congregacao: cong ? cong.nome : ''
                            });
                          }}
                          className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white"
                        >
                          <option value="">Selecione um grupo...</option>
                          {congregations.flatMap(c => (c.grupos || []).map(g => ({ nome: g, congNome: c.nome }))).map((g, idx) => (
                            <option key={idx} value={g.nome}>{g.nome} ({g.congNome})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {editFormData.evento === 'Outros Eventos' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          Evento:
                        </label>
                        <div className="relative">
                          <input 
                            list="outros-eventos-list"
                            value={editFormData.outroEvento}
                            onChange={(e) => setEditFormData({ ...editFormData, outroEvento: e.target.value })}
                            placeholder="Digite ou selecione um evento..."
                            className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white"
                          />
                          <datalist id="outros-eventos-list">
                            {OUTROS_EVENTOS.map((oe, idx) => (
                              <option key={idx} value={oe} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}

                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Recebendo visita de pastoreio') && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          Congregação:
                        </label>
                        <select 
                          value={editFormData.congregacao}
                          onChange={(e) => setEditFormData({ ...editFormData, congregacao: e.target.value })}
                          className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white"
                        >
                          <option value="">Selecione uma congregação...</option>
                          {congregations.map(c => (
                            <option key={c.id} value={c.nome}>{c.nome} - {c.cidade}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Visita a Grupo') && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          Substituto (se aplicável):
                        </label>
                        <div className="relative">
                          <input 
                            list="substitutes-list"
                            value={editFormData.substituto}
                            onChange={(e) => setEditFormData({ ...editFormData, substituto: e.target.value })}
                            placeholder="Digite ou selecione um substituto..."
                            className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all bg-white"
                          />
                          <datalist id="substitutes-list">
                            {substitutes.map(s => (
                              <option key={s.id} value={s.nome} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        COMENTÁRIOS
                      </label>
                      <textarea 
                        value={editFormData.observacoes}
                        onChange={(e) => setEditFormData({ ...editFormData, observacoes: e.target.value })}
                        placeholder="..."
                        rows={3}
                        className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[#512da8] outline-none transition-all resize-none bg-[#f0f0f5]"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setModalMode('actions')}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                      >
                        <X size={18} /> Cancelar
                      </button>
                      <button 
                        onClick={handleFormSave}
                        className="flex-1 py-3 rounded-xl font-bold bg-[#512da8] text-white hover:bg-[#4527a0] shadow-lg shadow-indigo-200 transition-all"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
