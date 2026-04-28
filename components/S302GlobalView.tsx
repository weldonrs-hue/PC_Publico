'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  Search,
  Calendar,
  MapPin,
  User,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import S302NoticeView from './S302NoticeView';

interface Congregation {
  id?: string;
  nome: string;
  numero: string;
  cidade: string;
  estado: string;
  endereco: string;
  bairro: string;
  cep: string;
  telefone: string;
  email: string;
  reuniaoFimSemana: string;
  reuniaoMeioSemana: string;
}

interface ItineraryItem {
  id?: string;
  semana: string;
  dataEvento: string;
  evento: string;
  congregacao: string;
  substituto?: string;
}

interface GlobalS302ViewProps {
  userId: string;
  isAdmin: boolean;
  onBack: () => void;
}

export default function GlobalS302View({ userId, isAdmin, onBack }: GlobalS302ViewProps) {
  const [loading, setLoading] = useState(true);
  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);

  useEffect(() => {
    // Fetch congregations to have full data
    const fetchCongs = async () => {
      try {
        const q = query(collection(db, 'congregations'), where('userId', '==', userId));
        const snap = await getDocs(q);
        setCongregations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Congregation[]);
      } catch (e) {
        console.error('Error fetching congregations:', e);
      }
    };
    fetchCongs();

    // Listen to itineraries
    const q = query(collection(db, 'itineraries'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as ItineraryItem[];
      
      // Filter only those with congregation
      const filtered = items
        .filter(item => item.congregacao && item.congregacao.trim() !== '')
        .sort((a, b) => {
          const [da, ma, ya] = a.semana.split('/').map(Number);
          const [db, mb, yb] = b.semana.split('/').map(Number);
          const dateA = new Date(ya, ma - 1, da).getTime();
          const dateB = new Date(yb, mb - 1, db).getTime();
          return dateB - dateA; // Newest first
        });

      setItineraries(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const filteredEvents = itineraries.filter(item => 
    item.congregacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.semana.includes(searchTerm)
  );

  const mappedEvents = filteredEvents.map(item => {
    const cong = congregations.find(c => c.nome === item.congregacao);
    return {
      id: item.id,
      congregacao: cong || { nome: item.congregacao, numero: '', cidade: '', estado: '' } as any,
      data: item.dataEvento || item.semana,
      substituteName: item.substituto
    };
  }).filter(e => e.congregacao.nome);

  if (selectedEventIndex !== null) {
    return (
      <S302NoticeView 
        userId={userId}
        isAdmin={isAdmin}
        events={mappedEvents}
        initialIndex={selectedEventIndex}
        onBack={() => setSelectedEventIndex(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-orange-600 bg-white shadow-md border border-gray-200"
            title="Voltar"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            Avisos de Visitas (S-302)
          </h2>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
        <input 
          type="text"
          placeholder="Buscar por congregação ou data..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-50 outline-none transition-all shadow-sm text-gray-700"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-orange-500" size={48} />
        </div>
      ) : mappedEvents.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
          <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="text-orange-400" size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhum aviso encontrado</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Certifique-se de que existem itinerários vinculados a congregações no menu Itinerários.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mappedEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedEventIndex(index)}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:border-orange-500 hover:shadow-xl transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-orange-100 p-3 rounded-2xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <FileText size={24} />
                </div>
                <div className="bg-gray-50 px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  S-302-T
                </div>
              </div>

              <h4 className="text-lg font-bold text-gray-800 mb-4 group-hover:text-orange-600 transition-colors line-clamp-1">
                {event.congregacao.nome}
              </h4>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar size={16} className="text-orange-400" />
                  <span className="font-medium">{event.data}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <User size={16} className="text-orange-400" />
                  <span className="truncate">{event.substituteName ? `${event.substituteName} (SCS)` : 'Superintendente'}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end text-orange-600 font-bold text-sm gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                Gerar Aviso <ArrowRight size={16} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
