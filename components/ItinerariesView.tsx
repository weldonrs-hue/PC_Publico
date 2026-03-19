'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Map, 
  ChevronLeft,
  Save,
  Loader2,
  CheckCircle2,
  Circle
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
  onSnapshot,
  writeBatch
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
  observacoes: string;
  escritorioNotificado: boolean;
  congregacaoNotificada: boolean;
  ordem: number;
}

export default function ItinerariesView({ userId, onBack }: ItinerariesViewProps) {
  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        // Sort by ordem in the client
        items.sort((a, b) => a.ordem - b.ordem);
        
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="bg-[#512da8] p-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            Tabela de Itinerários (27 Semanas)
          </h3>
          <div className="flex gap-2">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-3 text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/10 w-24 bg-[#673ab7] text-center">Semana</th>
                  <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100 w-40">Data do Evento</th>
                  <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Evento</th>
                  <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Observações</th>
                  <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100 w-24 text-center">Escritório Notif.</th>
                  <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Congr. Notif.</th>
                </tr>
              </thead>
              <tbody>
                {itineraries.map((item) => {
                  const current = isCurrentWeek(item.semana);
                  return (
                    <tr 
                      key={item.id} 
                      className={`border-b border-gray-50 transition-colors ${current ? 'bg-amber-50/50' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className={`p-2 border-r border-gray-100 ${current ? 'bg-amber-100/30' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          <input 
                            value={item.semana}
                            onChange={(e) => handleChange(item.id!, 'semana', e.target.value)}
                            className={`w-full bg-transparent outline-none text-sm font-bold text-center focus:bg-white p-1 rounded ${current ? 'text-[#512da8]' : 'text-gray-700'}`}
                          />
                          {current && (
                            <span className="text-[8px] font-bold bg-[#512da8] text-white px-1 rounded uppercase tracking-tighter">
                              HOJE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border-r border-gray-100">
                      <input 
                        type="date"
                        value={item.dataEvento}
                        onChange={(e) => handleChange(item.id!, 'dataEvento', e.target.value)}
                        className="w-full bg-transparent outline-none text-sm text-gray-600 focus:bg-white p-1 rounded"
                      />
                    </td>
                    <td className="p-2 border-r border-gray-100">
                      <input 
                        value={item.evento}
                        onChange={(e) => handleChange(item.id!, 'evento', e.target.value)}
                        className="w-full bg-transparent outline-none text-sm text-gray-600 focus:bg-white p-1 rounded"
                        placeholder="..."
                      />
                    </td>
                    <td className="p-2 border-r border-gray-100">
                      <input 
                        value={item.observacoes}
                        onChange={(e) => handleChange(item.id!, 'observacoes', e.target.value)}
                        className="w-full bg-transparent outline-none text-sm text-gray-600 focus:bg-white p-1 rounded"
                        placeholder="..."
                      />
                    </td>
                    <td className="p-2 border-r border-gray-100 text-center">
                      <button 
                        onClick={() => handleChange(item.id!, 'escritorioNotificado', !item.escritorioNotificado)}
                        className={`transition-colors ${item.escritorioNotificado ? 'text-green-500' : 'text-gray-300'}`}
                      >
                        {item.escritorioNotificado ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => handleChange(item.id!, 'congregacaoNotificada', !item.congregacaoNotificada)}
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
        )}
      </motion.div>
    </div>
  );
}
