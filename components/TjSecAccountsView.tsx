'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Landmark, 
  Search, 
  Mail, 
  ChevronLeft,
  RefreshCw,
  User as UserIcon,
  ShieldCheck,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Phone,
  Landmark as LandmarkIcon
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface Publisher {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  situation: string;
  userId: string; // The "Key" linking to a congregation
  hasAppAccess: boolean;
  photoURL?: string;
}

interface Congregation {
  id: string;
  name: string;
  number?: string;
  circuito?: string;
  circuitOverseerEmail?: string;
}

interface CongregationGroup {
  congregation: Congregation;
  publishers: Publisher[];
  activeWithAccessCount: number;
}

interface TjSecAccountsViewProps {
  onBack: () => void;
}

export default function TjSecAccountsView({ onBack }: TjSecAccountsViewProps) {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [congregationGroups, setCongregationGroups] = useState<CongregationGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) throw new Error('Usuário não autenticado');

      const isCircuitAdmin = userEmail.endsWith('@progcir.app');
      const isSystemAdmin = ['weldonrs@gmail.com', '2283701@progcir.app', '2283701@progcir.com'].includes(userEmail);
      
      let targetCongregationIds: string[] = [];
      let congregations: Congregation[] = [];

      if (isSystemAdmin) {
        // System Admins see everything
        const congsSnap = await getDocs(collection(db, 'congregations'));
        congregations = congsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        targetCongregationIds = congregations.map(c => c.id);
      } else if (isCircuitAdmin) {
        // Circuit Overseers see their assigned congregations
        const congQuery = query(
          collection(db, 'congregations'), 
          where('circuitOverseerEmail', '==', userEmail)
        );
        const congSnap = await getDocs(congQuery);
        congregations = congSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        targetCongregationIds = congregations.map(c => c.id);
      } else {
        // Regular Secretary: Identify their own congregation ID via publishers collection
        const pubQuery = query(
          collection(db, 'publishers'), 
          where('email', '==', userEmail),
          limit(1)
        );
        const pubSnap = await getDocs(pubQuery);
        
        if (!pubSnap.empty) {
          const myData = pubSnap.docs[0].data();
          const myCongId = myData.userId; 
          targetCongregationIds = [myCongId];

          const congregationsSnap = await getDocs(collection(db, 'congregations'));
          congregations = congregationsSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) }))
            .filter(c => c.id === myCongId);
        }
      }

      if (targetCongregationIds.length === 0) {
        setCongregationGroups([]);
        return;
      }

      // Step 2: Fetch publishers for these congregations
      // Note: If the list is large, we might need multiple queries or use 'in' operator
      const pubsSnap = await getDocs(collection(db, 'publishers'));
      const allPublishers = pubsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Publisher[];
      
      const filteredPublishers = allPublishers.filter(p => targetCongregationIds.includes(p.userId));

      const groups: CongregationGroup[] = congregations.map(cong => {
        const relatedPubs = filteredPublishers.filter(p => p.userId === cong.id);
        const activeWithAccess = relatedPubs.filter(p => p.status === 'Ativo' && p.hasAppAccess === true);

        return {
          congregation: cong,
          publishers: relatedPubs,
          activeWithAccessCount: activeWithAccess.length
        };
      });

      // Sort groups by congregation name
      groups.sort((a, b) => {
        const nameA = a.congregation?.name || '';
        const nameB = b.congregation?.name || '';
        return nameA.localeCompare(nameB);
      });

      setCongregationGroups(groups);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const filteredGroups = congregationGroups.filter(group => {
    const search = searchTerm.toLowerCase();
    const matchesCong = 
      (group.congregation?.name || '').toLowerCase().includes(search) ||
      (group.congregation?.number || '').includes(search);
    
    const matchesPubs = group.publishers.some(p => 
      (p.name || '').toLowerCase().includes(search) ||
      (p.email || '').toLowerCase().includes(search)
    );

    return matchesCong || matchesPubs;
  });

  const totalActiveWithAccess = congregationGroups.reduce((acc, curr) => acc + curr.activeWithAccessCount, 0);
  const totalPublishers = congregationGroups.reduce((acc, curr) => acc + curr.publishers.length, 0);
  const activeCongregations = congregationGroups.filter(g => g.activeWithAccessCount > 0).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-[#059669] bg-white shadow-md border border-gray-200"
            title="Voltar"
          >
            <ChevronLeft size={22} strokeWidth={3} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              Contas do Circuito (TJSEC)
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
              Gerencie acessos de publicadores por congregação
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar congregação ou publicador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] transition-all"
            />
          </div>
          <button 
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-500 transition-all disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && congregationGroups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:border-emerald-500 transition-all"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Contas Ativas</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {totalActiveWithAccess}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Landmark size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Congregações Ativas</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {activeCongregations}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Publicadores</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {totalPublishers}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-[#059669]" size={48} />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando dados...</p>
        </div>
      ) : filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredGroups.map((group) => (
            <div 
              key={group.congregation.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main Card Header */}
              <div 
                className="p-4 md:p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                onClick={() => toggleGroup(group.congregation.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#059669]/10 rounded-2xl flex items-center justify-center text-[#059669] flex-shrink-0 shadow-inner">
                    <Landmark size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">
                        {group.congregation?.name || 'Congregação sem Nome'}
                      </h3>
                      {group.congregation.number && (
                        <span className="bg-[#059669]/10 text-[#059669] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          Nº {group.congregation.number}
                        </span>
                      )}
                      {group.activeWithAccessCount > 0 ? (
                        <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-200 flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-emerald-600 animate-pulse"></div>
                          Ativa
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase border border-gray-200">
                          Sem Acesso
                        </span>
                      )}
                    </div>
                    {group.congregation.circuito && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                        Circuito: {group.congregation.circuito}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Publicadores com Acesso</p>
                    <p className="text-2xl font-black text-gray-900 leading-none mt-1">
                      {group.activeWithAccessCount}
                    </p>
                  </div>
                  <div className={`p-2 rounded-full bg-gray-50 text-gray-400 transition-transform duration-300 ${expandedGroups.includes(group.congregation.id) ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Related Users List */}
              <AnimatePresence>
                {expandedGroups.includes(group.congregation.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-50 bg-gray-50/50"
                  >
                    <div className="p-4 md:p-6 space-y-4">
                      {group.publishers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.publishers
                            .filter(p => p.hasAppAccess)
                            .map((p) => (
                            <div 
                              key={p.id}
                              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 group/item hover:border-[#059669] transition-colors"
                            >
                              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border border-gray-100 group-hover/item:bg-[#059669]/5 group-hover/item:text-[#059669] transition-colors">
                                {p.photoURL ? (
                                  <Image 
                                    src={p.photoURL} 
                                    alt={p.name} 
                                    width={40} 
                                    height={40} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <UserIcon size={20} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                                {p.email && <p className="text-[10px] text-gray-500 truncate">{p.email}</p>}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                    p.status === 'Ativo' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                    {p.status}
                                  </span>
                                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                    {p.situation}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {group.publishers.filter(p => !p.hasAppAccess).length > 0 && (
                            <div className="col-span-full pt-4 border-t border-gray-100">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Registros sem acesso ao App ({group.publishers.filter(p => !p.hasAppAccess).length})</p>
                              <div className="flex flex-wrap gap-2">
                                {group.publishers
                                  .filter(p => !p.hasAppAccess)
                                  .map(p => (
                                    <span key={p.id} className="text-[10px] font-medium text-gray-500 bg-white border border-gray-100 px-2 py-1 rounded-lg">
                                      {p.name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200">
                          <Users size={32} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-sm text-gray-500">Nenhum publicador encontrado.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-20 text-center shadow-sm border border-gray-100">
          <Landmark size={64} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-xl font-bold text-gray-800">Nenhuma congregação encontrada</h3>
          <p className="text-gray-500 mt-2">Nenhum dado disponível no banco de dados.</p>
        </div>
      )}
    </motion.div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <div className={`animate-spin rounded-full border-4 border-gray-200 border-t-current ${className}`} style={{ width: size, height: size }} />
  );
}
