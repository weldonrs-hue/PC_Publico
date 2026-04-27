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
  AlertCircle,
  Trash2,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { 
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { motion, AnimatePresence } from 'motion/react';

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
  const [userToDelete, setUserToDelete] = useState<UserMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'reauth' | 'deleting' | 'success' | 'error'>('idle');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserMetadata | 'nome' | 'numeroPessoal'; direction: 'asc' | 'desc' } | null>({ 
    key: 'createdAt', 
    direction: 'desc' 
  });

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

  const handleSort = (key: keyof UserMetadata | 'nome' | 'numeroPessoal') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedUsers = (usersList: UserMetadata[]) => {
    if (!sortConfig) return usersList;

    return [...usersList].sort((a, b) => {
      let valA = a[sortConfig.key] ?? '';
      let valB = b[sortConfig.key] ?? '';

      // Handle dates
      if (sortConfig.key === 'createdAt' || sortConfig.key === 'lastLogin') {
        const dateA = valA ? (typeof valA === 'object' && 'seconds' in valA ? valA.seconds : new Date(valA).getTime()) : 0;
        const dateB = valB ? (typeof valB === 'object' && 'seconds' in valB ? valB.seconds : new Date(valB).getTime()) : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // Handle strings
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortConfig.direction === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });
  };

  const filteredUsers = getSortedUsers(users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.numeroPessoal?.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const handleDeleteUser = async () => {
    if (!userToDelete || !auth.currentUser) return;
    
    setIsDeleting(true);
    setAdminError('');
    
    try {
      // 1. Re-authenticate Admin
      const providerId = auth.currentUser.providerData[0]?.providerId;
      if (providerId === 'password') {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, adminPassword);
        try {
          await reauthenticateWithCredential(auth.currentUser, credential);
        } catch (error: any) {
          setAdminError('Senha de administrador incorreta.');
          setDeleteStatus('reauth');
          setIsDeleting(false);
          return;
        }
      }

      setDeleteStatus('deleting');
      const batch = writeBatch(db);
      const uid = userToDelete.id;

      // 1. Delete main user documents
      batch.delete(doc(db, 'users', uid));
      batch.delete(doc(db, 'personal_data', uid));

      // 2. Find and delete all related data
      const collectionsToClean = ['congregations', 'substitutes', 'itineraries'];
      
      for (const collName of collectionsToClean) {
        const q = query(collection(db, collName), where('userId', '==', uid));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((d) => {
          batch.delete(doc(db, collName, d.id));
        });
      }

      await batch.commit();
      
      setDeleteStatus('success');
      // Remove from local state
      setUsers(prev => prev.filter(u => u.id !== uid));
      
      setTimeout(() => {
        setUserToDelete(null);
        setDeleteStatus('idle');
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting user data:', error);
      setDeleteStatus('error');
      handleFirestoreError(error, OperationType.DELETE, `user_data/${userToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

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
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
            title="Voltar ao Painel"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
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
              placeholder="Buscar por email ou nome..."
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
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center gap-1">
                    Usuário / Nome
                    {sortConfig?.key === 'nome' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="text-gray-300" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('numeroPessoal')}
                >
                  <div className="flex items-center justify-center gap-1">
                    ID Pessoal
                    {sortConfig?.key === 'numeroPessoal' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="text-gray-300" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Criação
                    {sortConfig?.key === 'createdAt' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="text-gray-300" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('lastLogin')}
                >
                  <div className="flex items-center gap-1">
                    Último login
                    {sortConfig?.key === 'lastLogin' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="text-gray-300" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
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
                          {user.photoURL && user.photoURL.length > 5 && (user.photoURL.startsWith('http') || user.photoURL.startsWith('data:')) ? (
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
                    <td className="px-6 py-4 text-right">
                      {auth.currentUser?.uid !== user.id && (
                        <button
                          onClick={() => setUserToDelete(user)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir dados do usuário"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                {deleteStatus === 'idle' && (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto">
                      <Trash2 size={32} />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-gray-900">Excluir Dados do Usuário?</h3>
                      <div className="mt-4 p-4 bg-gray-50 rounded-2xl text-left space-y-2">
                        <p className="text-sm font-bold text-gray-700">Usuário: <span className="text-[#512da8]">{userToDelete.nome}</span></p>
                        <p className="text-xs text-gray-500">Email: {userToDelete.email}</p>
                      </div>
                      <p className="text-sm text-gray-500 mt-4">
                        Esta ação removerá permanentemente todos os dados deste usuário do sistema.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setUserToDelete(null)}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          const providerId = auth.currentUser?.providerData[0]?.providerId;
                          if (providerId === 'password') {
                            setDeleteStatus('reauth');
                          } else {
                            handleDeleteUser();
                          }
                        }}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                )}

                {deleteStatus === 'reauth' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-gray-900">Confirme sua Senha</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Para autorizar a exclusão deste usuário, digite sua senha de administrador.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Sua Senha (Admin)</label>
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Digite sua senha"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        />
                      </div>
                      {adminError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
                          <AlertCircle size={14} />
                          {adminError}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteStatus('idle')}
                        disabled={isDeleting}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={handleDeleteUser}
                        disabled={isDeleting || !adminPassword}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Exclusão'}
                      </button>
                    </div>
                  </div>
                )}

                {deleteStatus === 'deleting' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="animate-spin text-red-600" size={48} />
                    <p className="text-lg font-bold text-gray-900">Excluindo dados...</p>
                    <p className="text-sm text-gray-500">Limpando registros do banco de dados.</p>
                  </div>
                )}

                {deleteStatus === 'success' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                      <ShieldCheck size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Dados Removidos</h3>
                    <p className="text-gray-500">Todos os registros associados a este usuário foram excluídos com sucesso.</p>
                  </div>
                )}

                {deleteStatus === 'error' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
                      <AlertCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Erro na Exclusão</h3>
                    <p className="text-gray-500">Não foi possível remover todos os dados. Verifique as permissões.</p>
                    <button
                      onClick={() => setUserToDelete(null)}
                      className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
