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
  Phone
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface UserMetadata {
  id: string;
  email: string;
  role: string;
  nome?: string;
  numeroPessoal?: string;
  photoURL?: string;
  congregacao?: string;
  circuito?: string;
  isInactive?: boolean;
}

interface CongregationGroup {
  tjSecAccount: UserMetadata;
  relatedUsers: UserMetadata[];
  tjSecNumber: string;
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
      const [usersSnapshot, personalDataSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'personal_data'))
      ]);

      const usersDocs = usersSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const pdDocs = personalDataSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      const allUsers: UserMetadata[] = usersDocs.map(userData => {
        const pdData = pdDocs.find(p => p.id === userData.id || p.userId === userData.id);
        return {
          id: userData.id,
          email: userData.email || pdData?.emailPessoal || '',
          role: pdData?.role || userData.role || 'user',
          nome: pdData?.nome || userData.nome || userData.displayName || 'Sem nome',
          numeroPessoal: pdData?.numeroPessoal || userData.usuario || '',
          photoURL: pdData?.profilePhoto || userData.photoURL || null,
          congregacao: pdData?.congregacao || '',
          circuito: pdData?.circuito || '',
          isInactive: !!userData.isInactive
        };
      });

      // Filter for TJSec accounts
      const tjSecAccounts = allUsers.filter(u => u.email?.toLowerCase().endsWith('@tjsec.app'));
      
      const groups: CongregationGroup[] = tjSecAccounts.map(tjAcc => {
        const tjSecNumber = tjAcc.email.split('@')[0];
        
        // Find related users
        const related = allUsers.filter(u => {
          if (u.id === tjAcc.id) return false; // Don't include itself in related list

          // Logic for relation:
          // 1. numeroPessoal matches tjSecNumber (rare if unique, but possible if they are linked)
          // 2. email starts with tjSecNumber (e.g. 12345.elder@gmail.com - just guessing)
          // 3. congregacao name matches exactly
          const sameCongName = tjAcc.congregacao && u.congregacao && tjAcc.congregacao.toLowerCase() === u.congregacao.toLowerCase();
          const startsWithNumber = u.email?.startsWith(tjSecNumber);
          const sameNumber = u.numeroPessoal === tjSecNumber;

          return sameCongName || startsWithNumber || sameNumber;
        });

        return {
          tjSecAccount: tjAcc,
          relatedUsers: related,
          tjSecNumber
        };
      });

      // Sort groups by congregation number or name
      groups.sort((a, b) => {
        const nameA = a.tjSecAccount.congregacao || a.tjSecAccount.nome || '';
        const nameB = b.tjSecAccount.congregacao || b.tjSecAccount.nome || '';
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
    const matchesTjSec = 
      group.tjSecAccount.nome?.toLowerCase().includes(search) ||
      group.tjSecAccount.email?.toLowerCase().includes(search) ||
      group.tjSecAccount.congregacao?.toLowerCase().includes(search) ||
      group.tjSecNumber.includes(search);
    
    const matchesRelated = group.relatedUsers.some(u => 
      u.nome?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );

    return matchesTjSec || matchesRelated;
  });

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
              Contas das Congregações
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
              Gerencie contas @tjsec.app e seus usuários relacionados
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar congregação ou usuário..."
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-[#059669]" size={48} />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando contas...</p>
        </div>
      ) : filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredGroups.map((group) => (
            <div 
              key={group.tjSecAccount.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main Card Header */}
              <div 
                className="p-4 md:p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                onClick={() => toggleGroup(group.tjSecAccount.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#059669]/10 rounded-2xl flex items-center justify-center text-[#059669] flex-shrink-0 shadow-inner">
                    <Landmark size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">
                        {group.tjSecAccount.congregacao || `Congregação ${group.tjSecNumber}`}
                      </h3>
                      <span className="bg-[#059669]/10 text-[#059669] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Nº {group.tjSecNumber}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                      <Mail size={12} className="text-gray-400" />
                      {group.tjSecAccount.email}
                    </p>
                    {group.tjSecAccount.circuito && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                        Circuito: {group.tjSecAccount.circuito}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Contas Relacionadas</p>
                    <p className="text-2xl font-black text-gray-900 leading-none mt-1">
                      {group.relatedUsers.length}
                    </p>
                  </div>
                  <div className={`p-2 rounded-full bg-gray-50 text-gray-400 transition-transform duration-300 ${expandedGroups.includes(group.tjSecAccount.id) ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Related Users List */}
              <AnimatePresence>
                {expandedGroups.includes(group.tjSecAccount.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-50 bg-gray-50/50"
                  >
                    <div className="p-4 md:p-6 space-y-4">
                      {group.relatedUsers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.relatedUsers.map((u) => (
                            <div 
                              key={u.id}
                              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 group/item hover:border-[#059669] transition-colors"
                            >
                              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border border-gray-100 group-hover/item:bg-[#059669]/5 group-hover/item:text-[#059669] transition-colors">
                                {u.photoURL ? (
                                  <Image 
                                    src={u.photoURL} 
                                    alt={u.nome || ''} 
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
                                <p className="text-sm font-bold text-gray-900 truncate">{u.nome}</p>
                                <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                    u.role === 'admin' ? 'bg-amber-100 text-amber-600' :
                                    u.role === 'viajante' ? 'bg-blue-100 text-blue-600' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {u.role.replace('_', ' ')}
                                  </span>
                                  {u.numeroPessoal && (
                                    <span className="text-[8px] font-mono text-gray-400">ID: {u.numeroPessoal}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200">
                          <Users size={32} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-sm text-gray-500">Nenhum usuário relacionado encontrado.</p>
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
          <h3 className="text-xl font-bold text-gray-800">Nenhuma conta encontrada</h3>
          <p className="text-gray-500 mt-2">Nenhuma conta com email @tjsec.app foi identificada.</p>
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
