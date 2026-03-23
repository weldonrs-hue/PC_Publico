'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Users, 
  Search, 
  Mail, 
  Calendar, 
  Clock, 
  Fingerprint,
  ChevronLeft,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  AlertCircle
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy,
  doc,
  updateDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { motion } from 'motion/react';

interface UserMetadata {
  id: string;
  email: string;
  role: string;
  createdAt: any;
  lastLogin: any;
  photoURL?: string;
  nome?: string;
  numeroPessoal?: string;
}

interface UsersViewProps {
  onBack: () => void;
}

export default function UsersView({ onBack }: UsersViewProps) {
  const [users, setUsers] = useState<UserMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      // Fetch users and personal data in parallel to save time
      const [usersSnapshot, personalDataSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'personal_data'))
      ]);

      // Map personal data for quick lookup
      const personalDataMap = new Map();
      personalDataSnapshot.docs.forEach(doc => {
        personalDataMap.set(doc.id, doc.data());
      });

      const usersData = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        const pd = personalDataMap.get(doc.id);
        
        return {
          id: doc.id,
          ...data,
          nome: pd?.nome || data.displayName || 'Sem nome',
          numeroPessoal: pd?.numeroPessoal || data.email?.split('@')[0] || '---'
        } as UserMetadata;
      });
      
      // Sort in-memory: newest first, users without date at the end
      usersData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setUsers(usersData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users_and_personal_data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.numeroPessoal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      // Handle Firestore Timestamp if it's not a string
      let date: Date;
      if (dateStr && typeof dateStr === 'object' && 'seconds' in dateStr) {
        date = new Date(dateStr.seconds * 1000);
      } else if (dateStr && typeof dateStr.toDate === 'function') {
        date = dateStr.toDate();
      } else {
        date = new Date(dateStr);
      }
      
      if (isNaN(date.getTime())) return 'N/A';

      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="text-[#512da8]" />
              Usuários do Sistema
            </h2>
            <p className="text-sm text-gray-500">Gerencie os acessos e visualize metadados dos usuários</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por email ou UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#512da8]/20 focus:border-[#512da8] transition-all"
            />
          </div>
          <button 
            onClick={fetchUsers}
            disabled={refreshing}
            className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-600 transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Nota:</strong> As datas de criação e último login são sincronizadas a partir do Firebase Authentication quando o usuário realiza login no sistema. Se um usuário ainda não acessou esta versão do sistema, os dados podem aparecer como &quot;N/A&quot;.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-bottom border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuário / Nome</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">ID Pessoal</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Criação</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Último login</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">UID do usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8">
                      <div className="h-4 bg-gray-100 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#512da8]/10 flex items-center justify-center text-[#512da8] overflow-hidden border border-[#512da8]/5">
                          {user.photoURL ? (
                            <Image 
                              src={user.photoURL} 
                              alt={user.nome || 'Usuário'} 
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserIcon size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{user.nome}</p>
                          <p className="text-[11px] text-gray-500 font-medium">{user.email}</p>
                          {user.role === 'admin' && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold uppercase">
                              <ShieldCheck size={10} />
                              Administrador
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-xs font-mono font-bold text-[#512da8] bg-[#512da8]/5 px-2 py-1 rounded-lg">
                          {user.numeroPessoal}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock size={14} className="text-gray-400" />
                        {formatDate(user.lastLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                        <Fingerprint size={14} />
                        {user.id}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Users size={48} strokeWidth={1} />
                      <p className="text-lg font-medium">Nenhum usuário encontrado</p>
                      <p className="text-sm">Tente ajustar sua busca ou recarregar a página.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 text-[10px] text-gray-400 font-medium uppercase tracking-widest">
            Total de usuários: {filteredUsers.length}
          </div>
        )}
      </div>
    </div>
  );
}
