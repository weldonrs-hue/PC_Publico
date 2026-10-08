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
  Globe,
  Sparkles,
  AlertCircle,
  Trash2,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Phone
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
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal } from '@/utils/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useDialog } from '@/hooks/useDialog';
import { cn } from '@/lib/utils';

interface UserMetadata {
  id: string;
  email: string;
  role: string;
  createdAt: any;
  lastLogin: any;
  photoURL?: string | null;
  nome?: string;
  numeroPessoal?: string;
  isInactive?: boolean;
  hasPasskey?: boolean;
}

interface RoleChangeRequest {
  id: string;
  userId: string;
  userName: string;
  currentRole: string;
  requestedRole: string;
  phoneNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface UsersViewProps {
  onBack: () => void;
}

export default function UsersView({ onBack }: UsersViewProps) {
  const { showAlert, showConfirm } = useDialog();
  const [users, setUsers] = useState<UserMetadata[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [userToDelete, setUserToDelete] = useState<UserMetadata | null>(null);
  const [userToEditRole, setUserToEditRole] = useState<UserMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
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
      // Fetch collections using Promise.allSettled so a failure or empty collection in one doesn't crash the other
      const [usersRes, pdRes, pubRes, credsRes] = await Promise.allSettled([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'personal_data')),
        getDocs(collection(db, 'publishers')),
        getDocs(collection(db, 'webauthn_credentials'))
      ]);

      const usersDocs: any[] = usersRes.status === 'fulfilled' ? usersRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const pdDocs: any[] = pdRes.status === 'fulfilled' ? pdRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const pubDocs: any[] = pubRes.status === 'fulfilled' ? pubRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const credsDocs: any[] = credsRes.status === 'fulfilled' ? credsRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];

      // Helper para encontrar personal_data correspondente com busca abrangente
      const findMatchingPd = (userData?: any, fallbackId?: string) => {
        if (!userData && !fallbackId) return null;
        const uid = userData?.id || fallbackId;
        const usuario = userData?.usuario;
        const email = (userData?.email || '').toLowerCase().trim();
        const emailPrefix = email.includes('@') ? email.split('@')[0] : '';

        return pdDocs.find(p => {
          // 1. Por UID exato ou userId
          if (uid && (p.id === uid || p.userId === uid)) return true;
          
          // 2. Por numeroPessoal / usuario
          if (usuario && (p.numeroPessoal === usuario || p.id === usuario || p.userId === usuario || p.usuario === usuario)) return true;
          
          // 3. Por prefixo do email (ex: 2283701@progcir.app -> numeroPessoal: 2283701)
          if (emailPrefix && (p.numeroPessoal === emailPrefix || p.id === emailPrefix || p.userId === emailPrefix)) return true;

          // 4. Por email pessoal ou institucional
          if (email) {
            if (p.emailPessoal && p.emailPessoal.toLowerCase().trim() === email) return true;
            if (p.emailJwpub && p.emailJwpub.toLowerCase().trim() === email) return true;
            if (p.email && p.email.toLowerCase().trim() === email) return true;
          }

          return false;
        }) || null;
      };

      // Helper para verificar se um usuário possui passkey cadastrada
      const checkHasPasskey = (uid?: string, email?: string, usuario?: string) => {
        return credsDocs.some(c => {
          if (uid && (c.userId === uid || c.id === uid)) return true;
          if (email && c.email && c.email.toLowerCase().trim() === email.toLowerCase().trim()) return true;
          if (usuario && c.userName && c.userName === usuario) return true;
          return false;
        });
      };

      const processedUserIds = new Set<string>();
      const processedPdIds = new Set<string>();
      const processedEmails = new Set<string>();
      const processedNumbers = new Set<string>();
      const usersData: UserMetadata[] = [];

      // 1. Processar todas as contas da coleção 'users'
      for (const u of usersDocs) {
        if (processedUserIds.has(u.id)) continue;
        processedUserIds.add(u.id);

        const pdData = findMatchingPd(u);
        if (pdData?.id) processedPdIds.add(pdData.id);
        if (pdData?.userId) processedUserIds.add(pdData.userId);

        const email = (u.email || (u.usuario?.includes('@') ? u.usuario : '') || pdData?.emailPessoal || pdData?.emailJwpub || '').trim();
        const numeroPessoal = pdData?.numeroPessoal || u.usuario || (email.includes('@progcir') ? email.split('@')[0] : '') || '---';

        if (email) processedEmails.add(email.toLowerCase());
        if (numeroPessoal && numeroPessoal !== '---') processedNumbers.add(numeroPessoal);

        const pubData = pubDocs.find(p => (email && p.email?.toLowerCase() === email.toLowerCase()) || (u.displayName && p.name === u.displayName));

        const isAdmin = 
          u.role === 'admin' ||
          pdData?.role === 'admin' ||
          email.toLowerCase() === 'weldonrs@gmail.com' ||
          email.toLowerCase() === '2283701@progcir.app' ||
          email.toLowerCase() === '2283701@progcir.com' ||
          email.toLowerCase() === '2283701@gmail.com' ||
          numeroPessoal === '2283701' ||
          u.usuario === '2283701' ||
          u.id === '2283701';

        const isTjSec = /@tjsec\.app$/i.test(email) || pdData?.role === 'secretaria' || u.role === 'secretaria' || Boolean(pubData?.hasAppAccess);
        const role = isAdmin ? 'admin' : (pdData?.role || u.role || (isTjSec ? 'secretaria' : 'user'));

        const nome = 
          pdData?.nome || 
          pubData?.name || 
          u.nome || 
          u.displayName || 
          (numeroPessoal !== '---' ? `Usuário ${numeroPessoal}` : '') ||
          'Sem nome';

        usersData.push({
          id: u.id,
          ...u,
          nome,
          email,
          numeroPessoal,
          role,
          photoURL: pdData?.profilePhoto || pdData?.foto || u.photoURL || null,
          isInactive: Boolean(u.isInactive),
          hasPasskey: checkHasPasskey(u.id, email, u.usuario),
          createdAt: u.createdAt || pdData?.createdAt || null,
          lastLogin: u.lastLogin || pdData?.lastLogin || null,
        } as UserMetadata);
      }

      // 2. Processar registros de personal_data que não foram vinculados a um user doc ainda
      for (const pd of pdDocs) {
        if (processedPdIds.has(pd.id)) continue;
        if (pd.userId && processedUserIds.has(pd.userId)) continue;
        if (processedUserIds.has(pd.id)) continue;

        const email = (pd.emailPessoal || pd.emailJwpub || pd.email || '').trim();
        const numeroPessoal = pd.numeroPessoal || (email.includes('@progcir') ? email.split('@')[0] : '') || '---';

        // Evitar duplicar se o email ou número já foram processados na primeira etapa
        if (email && processedEmails.has(email.toLowerCase())) continue;
        if (numeroPessoal !== '---' && processedNumbers.has(numeroPessoal)) continue;

        const userUniqueId = pd.userId || pd.id;
        if (processedUserIds.has(userUniqueId)) continue;
        processedUserIds.add(userUniqueId);
        processedPdIds.add(pd.id);
        if (email) processedEmails.add(email.toLowerCase());
        if (numeroPessoal !== '---') processedNumbers.add(numeroPessoal);

        const pubData = pubDocs.find(p => (email && p.email?.toLowerCase() === email.toLowerCase()) || (pd.nome && p.name === pd.nome));

        const isAdmin = 
          pd.role === 'admin' ||
          email.toLowerCase() === 'weldonrs@gmail.com' ||
          email.toLowerCase() === '2283701@progcir.app' ||
          email.toLowerCase() === '2283701@progcir.com' ||
          email.toLowerCase() === '2283701@gmail.com' ||
          numeroPessoal === '2283701' ||
          pd.id === '2283701' ||
          pd.userId === '2283701';

        const isTjSec = /@tjsec\.app$/i.test(email) || pd.role === 'secretaria' || Boolean(pubData?.hasAppAccess);
        const role = isAdmin ? 'admin' : (pd.role || (isTjSec ? 'secretaria' : 'user'));

        const nome = pd.nome || pubData?.name || (numeroPessoal !== '---' ? `Usuário ${numeroPessoal}` : 'Sem nome');

        usersData.push({
          id: userUniqueId,
          nome,
          email,
          numeroPessoal,
          role,
          photoURL: pd.profilePhoto || pd.foto || null,
          isInactive: false,
          hasPasskey: checkHasPasskey(userUniqueId, email, numeroPessoal),
          createdAt: pd.createdAt || null,
          lastLogin: pd.lastLogin || null,
        } as UserMetadata);
      }

      // 3. Processar contas TJSec ou publicadores com acesso que não foram listados
      for (const pub of pubDocs) {
        if (!pub.hasAppAccess || !pub.email) continue;
        const email = pub.email.trim();
        if (processedEmails.has(email.toLowerCase())) continue;
        processedEmails.add(email.toLowerCase());

        const pubUniqueId = pub.id || email;
        if (processedUserIds.has(pubUniqueId)) continue;
        processedUserIds.add(pubUniqueId);

        const tjSecNum = email.includes('@') ? email.split('@')[0] : '---';

        usersData.push({
          id: pubUniqueId,
          nome: pub.name || 'Secretaria TJSec',
          email,
          numeroPessoal: tjSecNum,
          role: 'secretaria',
          photoURL: null,
          isInactive: false,
          hasPasskey: checkHasPasskey(undefined, email),
          createdAt: pub.createdAt || null,
          lastLogin: null,
        } as UserMetadata);
      }

      // Desduplicação final por ID garantida
      const uniqueUsersMap = new Map<string, UserMetadata>();
      for (const item of usersData) {
        if (!uniqueUsersMap.has(item.id)) {
          uniqueUsersMap.set(item.id, item);
        }
      }
      const finalUsers = Array.from(uniqueUsersMap.values());

      // Ordenar: mais recentes primeiro, usuários sem data ao final
      finalUsers.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setUsers(finalUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      handleFirestoreError(error, OperationType.GET, 'users_and_personal_data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    // Fetch role requests separately to avoid blocking users list if permission is denied for requests
    try {
      const requestsSnapshot = await getDocs(query(collection(db, 'role_change_requests'), orderBy('createdAt', 'desc')));
      const requestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RoleChangeRequest[];
      setRoleRequests(requestsData);
    } catch (error) {
      console.warn('UsersView: Permission denied or error fetching role requests:', error);
      // We don't block the UI, just show no requests
      setRoleRequests([]);
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

  const filteredUsers = getSortedUsers(users.filter(user => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.numeroPessoal?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  }));

  const handleToggleInactive = async (user: UserMetadata) => {
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { isInactive: !user.isInactive });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isInactive: !u.isInactive } : u));
    } catch (error) {
      console.error('Error toggling inactive status:', error);
      await showAlert('Erro ao alterar status.', 'Erro');
    }
  };

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

  const handleApproveRequest = async (request: RoleChangeRequest) => {
    try {
      const batch = writeBatch(db);
      
      // Update request status
      batch.update(doc(db, 'role_change_requests', request.id), { 
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      
      // Update user personal_data role
      batch.update(doc(db, 'personal_data', request.userId), { 
        role: request.requestedRole 
      });
      
      await batch.commit();
      
      // Update local state
      setRoleRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'approved' } : r));
      // Refresh users to reflect role change
      fetchUsers();
    } catch (error) {
      console.error('Error approving request:', error);
      await showAlert('Erro ao aprovar solicitação.', 'Erro');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'role_change_requests', requestId), { 
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setRoleRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
    } catch (error) {
      console.error('Error rejecting request:', error);
      await showAlert('Erro ao rejeitar solicitação.', 'Erro');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setIsUpdatingRole(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', userId), { role: newRole });
      batch.update(doc(db, 'personal_data', userId), { role: newRole });
      await batch.commit();
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setUserToEditRole(null);
      await showAlert('Categoria atualizada com sucesso!', 'Sucesso');
    } catch (error) {
      console.error('Error updating role:', error);
      await showAlert('Erro ao atualizar categoria.', 'Erro');
    } finally {
      setIsUpdatingRole(false);
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-20"
    >
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={onBack}
              className="p-2 sm:p-2.5 bg-surface-100 hover:bg-surface-200 text-typography-700 hover:text-typography-900 rounded-2xl border border-surface-300 shadow-xs transition-all active:scale-95 shrink-0"
              title="Voltar"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-transparent border border-primary-200/40 dark:border-primary-200/50 text-primary-200 flex items-center justify-center shrink-0">
              <Users size={20} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
              Usuários do Sistema
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-typography-500 pl-14 sm:pl-16">
            Gerenciamento de contas, categorias de acesso e membros cadastrados.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto pl-14 sm:pl-0">
          <button 
            onClick={fetchUsers}
            disabled={refreshing}
            className="p-2.5 bg-surface-100 hover:bg-surface-200 text-typography-700 hover:text-typography-900 rounded-2xl border border-surface-300 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={onBack}
            className="p-2.5 bg-surface-100 hover:bg-surface-200 text-typography-700 hover:text-typography-900 rounded-2xl border border-surface-300 shadow-xs transition-all active:scale-95 shrink-0 sm:hidden flex items-center gap-1.5 text-xs font-bold"
            title="Fechar"
          >
            <X size={16} strokeWidth={2.5} />
            <span>Fechar</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs sm:text-sm font-medium text-typography-900 placeholder:text-typography-400 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all"
            />
          </div>

          {/* Filtro de Categoria */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs sm:text-sm font-bold text-typography-900 focus:border-primary-200 outline-none transition-all cursor-pointer"
          >
            <option value="all">Todas as Categorias</option>
            <option value="admin">Administradores</option>
            <option value="viajante">Viajantes</option>
            <option value="pioneiro_especial">Pioneiros Especiais</option>
            <option value="pioneiro_regular">Pioneiros Regulares</option>
            <option value="secretaria">Secretarias (TJSec)</option>
            <option value="user">Usuários Comuns</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button 
            onClick={async () => {
              if (isQuotaExceeded()) {
                await showAlert('Limite diário de cota excedido. Não é possível realizar operações de escrita no momento.', 'Aviso de Cota');
                return;
              }
              const confirmMsg = `AVISO DE COTA FIRESTORE:\n\nEsta operação irá comparar e atualizar TODOS os usuários cadastrados.\nDependendo do número de usuários, isso pode consumir escritas da sua cota diária.\n\nDeseja realmente continuar?`;
              const confirmed = await showConfirm(confirmMsg, 'Confirmar Sincronização em Lote');
              if (!confirmed) return;
              
              setRefreshing(true);
              try {
                const [usersSnapshot, personalDataSnapshot] = await Promise.all([
                  getDocs(collection(db, 'users')),
                  getDocs(collection(db, 'personal_data'))
                ]);
                
                const pdDocs = personalDataSnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
                const batch = writeBatch(db);
                let count = 0;

                usersSnapshot.docs.forEach(uDoc => {
                  const uData = uDoc.data();
                  const pd = pdDocs.find(p => p.id === uDoc.id || p.userId === uDoc.id || (uData.usuario && p.numeroPessoal === uData.usuario));
                  
                  if (pd && (pd.nome || pd.role)) {
                    const update: any = {};
                    if (pd.nome && pd.nome !== uData.nome) update.nome = pd.nome;
                    if (pd.role && pd.role !== uData.role) update.role = pd.role;
                    if (pd.profilePhoto && pd.profilePhoto !== uData.photoURL) update.photoURL = pd.profilePhoto;

                    if (Object.keys(update).length > 0) {
                      batch.update(doc(db, 'users', uDoc.id), update);
                      count++;
                    }
                  }
                });

                if (count > 0) {
                  await batch.commit();
                  await showAlert(`${count} usuários atualizados com sucesso.`, 'Sucesso');
                } else {
                  await showAlert('Todos os usuários já estão sincronizados.', 'Aviso');
                }
                fetchUsers();
              } catch (err) {
                console.error('Error in batch sync:', err);
                await showAlert('Erro na sincronização em lote. Tente novamente.', 'Erro');
              } finally {
                setRefreshing(false);
              }
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-200 hover:bg-surface-300 text-primary-200 font-bold rounded-xl border border-surface-300 text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Sincronizar nomes e categorias"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Role Change Requests Section */}
      {roleRequests.some(r => r.status === 'pending') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 ml-1">
            <RefreshCw className="text-primary-200" size={18} />
            <h3 className="text-xs font-black text-typography-900 uppercase tracking-widest">Solicitações de Categoria Pendentes</h3>
            <span className="bg-primary-200/10 text-primary-200 text-[10px] font-black px-2 py-0.5 rounded-full border border-primary-200/20">
              {roleRequests.filter(r => r.status === 'pending').length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roleRequests.filter(r => r.status === 'pending').map((request) => (
              <motion.div 
                key={request.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface-100 p-5 rounded-3xl border border-surface-300 shadow-xs space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-typography-900 uppercase tracking-tight">{request.userName || 'Usuário'}</h4>
                    <p className="text-[10px] text-typography-500 font-bold uppercase mt-0.5">{formatDate(request.createdAt)}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-primary-200/10 border border-primary-200/30 text-primary-200 flex items-center justify-center shrink-0">
                    <Fingerprint size={18} />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-surface-200/60 p-3 rounded-2xl border border-surface-300">
                  <div className="flex-1 text-center">
                    <p className="text-[9px] text-typography-400 font-black uppercase">Atual</p>
                    <p className="text-[10px] font-bold text-typography-700 uppercase truncate">{request.currentRole.replace('_', ' ')}</p>
                  </div>
                  <div className="text-typography-400">→</div>
                  <div className="flex-1 text-center font-black">
                    <p className="text-[9px] text-primary-200 uppercase">Solicitada</p>
                    <p className="text-[11px] text-primary-200 uppercase truncate">{request.requestedRole.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  <Phone size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{request.phoneNumber}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleApproveRequest(request)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-wider shadow-xs cursor-pointer"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="flex-1 bg-surface-200 hover:bg-surface-300 text-typography-700 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-wider border border-surface-300 cursor-pointer"
                  >
                    Recusar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de sincronização / observações */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <p>
            <strong>Nota:</strong> Se você excluiu um usuário do Firebase Auth, ele ainda aparecerá aqui até que seus dados sejam removidos. Contas marcadas como <span className="text-red-600 font-bold">DUPLICADO</span> indicam que o mesmo ID Pessoal está em dois perfis diferentes.
          </p>
        </div>
      </div>

      {/* Visualização Mobile: Cards (md:hidden) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-100 p-4 rounded-3xl border border-surface-300 shadow-xs animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-surface-200 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-surface-200 rounded-md w-3/4" />
                  <div className="h-2.5 bg-surface-200 rounded-md w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div 
              key={user.id} 
              className="bg-surface-100 p-4 rounded-3xl border border-surface-300 shadow-xs space-y-3 transition-all"
            >
              {/* Top: Avatar, Nome, ID Pessoal */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center text-primary-200 overflow-hidden border border-surface-300 shrink-0">
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
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-typography-900 truncate">{user.nome || 'Sem Nome'}</p>
                    <p className="text-xs text-typography-500 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border block",
                    users.filter(u => u.numeroPessoal === user.numeroPessoal && u.numeroPessoal !== '---').length > 1
                      ? "bg-red-500/10 text-red-600 border-red-500/30"
                      : "bg-surface-200 text-typography-700 border-surface-300"
                  )}>
                    {user.numeroPessoal || '---'}
                  </span>
                  {users.filter(u => u.numeroPessoal === user.numeroPessoal && u.numeroPessoal !== '---').length > 1 && (
                    <span className="text-[8px] text-red-500 font-black uppercase tracking-tight block mt-0.5">Duplicado</span>
                  )}
                </div>
              </div>

              {/* Badges de Categoria */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase border border-amber-500/20">
                    <ShieldCheck size={10} />
                    Administrador
                  </span>
                )}
                {user.role === 'viajante' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[9px] font-bold uppercase border border-blue-500/20">
                    <Globe size={10} />
                    Viajante
                  </span>
                )}
                {user.role === 'pioneiro_especial' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[9px] font-bold uppercase border border-purple-500/20">
                    <Sparkles size={10} />
                    Pioneiro Especial
                  </span>
                )}
                {user.role === 'pioneiro_regular' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase border border-emerald-500/20">
                    <UserIcon size={10} />
                    Pioneiro Regular
                  </span>
                )}
                {user.role === 'secretaria' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[9px] font-bold uppercase border border-rose-500/20">
                    <ShieldCheck size={10} />
                    Secretaria
                  </span>
                )}
                {user.hasPasskey && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold uppercase border border-indigo-500/20">
                    <Fingerprint size={10} />
                    Passkey
                  </span>
                )}
              </div>

              {/* Datas de Criação e Login */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-300/60 text-[10px] text-typography-500">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-typography-400" />
                  <span>{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <Clock size={12} className="text-typography-400" />
                  <span>{formatDate(user.lastLogin)}</span>
                </div>
              </div>

              {/* Botões de Ação Mobile */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-300/60">
                <button
                  onClick={() => handleToggleInactive(user)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border shadow-xs cursor-pointer",
                    user.isInactive 
                      ? "bg-surface-200 text-typography-500 border-surface-300" 
                      : "bg-emerald-600 text-white border-emerald-500"
                  )}
                >
                  {user.isInactive ? 'OFFLINE' : 'ATIVO'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setUserToEditRole(user)}
                    className="p-2 text-typography-500 hover:text-primary-200 bg-surface-200 hover:bg-surface-300 rounded-xl transition-all border border-surface-300 cursor-pointer"
                    title="Alterar Categoria"
                  >
                    <Fingerprint size={16} />
                  </button>
                  {auth.currentUser?.uid !== user.id && user.role !== 'admin' && user.email !== 'weldonrs@gmail.com' && (
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="p-2 text-typography-500 hover:text-red-500 bg-surface-200 hover:bg-surface-300 rounded-xl transition-all border border-surface-300 cursor-pointer"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface-100 p-8 rounded-3xl border border-surface-300 text-center text-typography-500 space-y-2">
            <Users size={36} className="mx-auto opacity-40" />
            <p className="text-sm font-bold text-typography-900">Nenhum usuário encontrado</p>
            <p className="text-xs">Tente ajustar seus filtros de busca.</p>
          </div>
        )}
      </div>

      {/* Visualização Desktop: Tabela (hidden md:block) */}
      <div className="hidden md:block bg-surface-100 rounded-3xl shadow-xs border border-surface-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-200/50 border-b border-surface-300">
                <th 
                  className="px-4 py-3 text-[10px] font-black text-typography-500 uppercase tracking-widest cursor-pointer hover:bg-surface-300/40 transition-colors"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center gap-1">
                    Usuário / Nome
                    {sortConfig?.key === 'nome' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="text-typography-400" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-black text-typography-500 uppercase tracking-widest text-center cursor-pointer hover:bg-surface-300/40 transition-colors"
                  onClick={() => handleSort('numeroPessoal')}
                >
                  <div className="flex items-center justify-center gap-1">
                    ID Pessoal
                    {sortConfig?.key === 'numeroPessoal' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="text-typography-400" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-black text-typography-500 uppercase tracking-widest cursor-pointer hover:bg-surface-300/40 transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Criação
                    {sortConfig?.key === 'createdAt' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="text-typography-400" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-black text-typography-500 uppercase tracking-widest cursor-pointer hover:bg-surface-300/40 transition-colors"
                  onClick={() => handleSort('lastLogin')}
                >
                  <div className="flex items-center gap-1">
                    Último login
                    {sortConfig?.key === 'lastLogin' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="text-typography-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-[10px] font-black text-typography-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-4 py-3 text-[10px] font-black text-typography-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-300/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6">
                      <div className="h-4 bg-surface-200 rounded-md w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-200/40 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center text-primary-200 overflow-hidden border border-surface-300 shrink-0">
                          {user.photoURL && user.photoURL.length > 5 && (user.photoURL.startsWith('http') || user.photoURL.startsWith('data:')) ? (
                            <Image 
                              src={user.photoURL} 
                              alt={user.nome || 'Usuário'} 
                              width={32} 
                              height={32} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserIcon size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-typography-900 leading-tight truncate">{user.nome || 'Sem Nome'}</p>
                          <p className="text-[10px] text-typography-500 font-medium truncate">{user.email}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {user.role === 'admin' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[8px] font-bold uppercase border border-amber-500/20">
                                <ShieldCheck size={8} />
                                Administrador
                              </span>
                            )}
                            {user.role === 'viajante' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[8px] font-bold uppercase border border-blue-500/20">
                                <Globe size={8} />
                                Viajante
                              </span>
                            )}
                            {user.role === 'pioneiro_especial' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[8px] font-bold uppercase border border-purple-500/20">
                                <Sparkles size={8} />
                                Pioneiro Especial
                              </span>
                            )}
                            {user.role === 'pioneiro_regular' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[8px] font-bold uppercase border border-emerald-500/20">
                                <UserIcon size={8} />
                                Pioneiro Regular
                              </span>
                            )}
                            {user.role === 'secretaria' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[8px] font-bold uppercase border border-rose-500/20">
                                <ShieldCheck size={8} />
                                Secretaria
                              </span>
                            )}
                            {user.hasPasskey && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[8px] font-bold uppercase border border-indigo-500/20">
                                <Fingerprint size={8} />
                                Passkey
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border",
                          users.filter(u => u.numeroPessoal === user.numeroPessoal && u.numeroPessoal !== '---').length > 1
                            ? "bg-red-500/10 text-red-600 border-red-500/30"
                            : "bg-surface-200 text-typography-700 border-surface-300"
                        )}>
                          {user.numeroPessoal || '---'}
                        </span>
                        {users.filter(u => u.numeroPessoal === user.numeroPessoal && u.numeroPessoal !== '---').length > 1 && (
                          <span className="text-[8px] text-red-500 font-black uppercase tracking-tighter">Duplicado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-typography-600">
                        <Calendar size={12} className="text-typography-400" />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-typography-600">
                        <Clock size={12} className="text-typography-400" />
                        {formatDate(user.lastLogin)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleInactive(user)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black transition-all border shadow-xs w-full max-w-[70px] mx-auto cursor-pointer",
                          user.isInactive 
                            ? "bg-surface-200 text-typography-500 border-surface-300" 
                            : "bg-emerald-600 text-white border-emerald-500"
                        )}
                      >
                        {user.isInactive ? 'OFFLINE' : 'ATIVO'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setUserToEditRole(user)}
                          className="p-1.5 text-typography-400 hover:text-primary-200 hover:bg-surface-200 rounded-lg transition-all cursor-pointer"
                          title="Alterar Categoria"
                        >
                          <Fingerprint size={16} />
                        </button>
                        {auth.currentUser?.uid !== user.id && user.role !== 'admin' && user.email !== 'weldonrs@gmail.com' && (
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="p-1.5 text-typography-400 hover:text-red-500 hover:bg-surface-200 rounded-lg transition-all cursor-pointer"
                            title="Excluir dados do usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-typography-400">
                      <Users size={48} strokeWidth={1} />
                      <p className="text-base font-bold text-typography-900">Nenhum usuário encontrado</p>
                      <p className="text-xs">Tente ajustar sua busca ou recarregar a página.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && (
          <div className="px-6 py-4 bg-surface-200/40 border-t border-surface-300 text-[10px] text-typography-500 font-bold uppercase tracking-widest">
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
              className="bg-surface-100 border border-surface-300 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-typography-900"
            >
              <div className="p-6">
                {deleteStatus === 'idle' && (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                      <Trash2 size={32} />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-typography-900">Excluir Dados do Usuário?</h3>
                      <div className="mt-4 p-4 bg-surface-200/60 border border-surface-300 rounded-2xl text-left space-y-2">
                        <p className="text-sm font-bold text-typography-900">Usuário: <span className="text-primary-200">{userToDelete.nome}</span></p>
                        <p className="text-xs text-typography-500">Email: {userToDelete.email}</p>
                      </div>
                      <p className="text-sm text-typography-500 mt-4">
                        Esta ação removerá permanentemente todos os dados deste usuário do sistema.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setUserToDelete(null)}
                        className="flex-1 py-3 px-4 bg-surface-200 hover:bg-surface-300 text-typography-700 font-bold rounded-2xl border border-surface-300 transition-all cursor-pointer"
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
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20 cursor-pointer"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                )}

                {deleteStatus === 'reauth' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-typography-900">Confirme sua Senha</h3>
                      <p className="text-sm text-typography-500 mt-2">
                        Para autorizar a exclusão deste usuário, digite sua senha de administrador.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-typography-500 uppercase ml-1">Sua Senha (Admin)</label>
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Digite sua senha"
                          className="w-full px-4 py-3 bg-surface-200 border border-surface-300 text-typography-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-typography-400"
                        />
                      </div>
                      {adminError && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-medium">
                          <AlertCircle size={14} />
                          {adminError}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteStatus('idle')}
                        disabled={isDeleting}
                        className="flex-1 py-3 px-4 bg-surface-200 hover:bg-surface-300 text-typography-700 font-bold rounded-2xl border border-surface-300 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={handleDeleteUser}
                        disabled={isDeleting || !adminPassword}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Exclusão'}
                      </button>
                    </div>
                  </div>
                )}

                {deleteStatus === 'deleting' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="animate-spin text-red-600" size={48} />
                    <p className="text-lg font-bold text-typography-900">Excluindo dados...</p>
                    <p className="text-sm text-typography-500">Limpando registros do banco de dados.</p>
                  </div>
                )}

                {deleteStatus === 'success' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                      <ShieldCheck size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-typography-900">Dados Removidos</h3>
                    <p className="text-typography-500">Todos os registros associados a este usuário foram excluídos com sucesso.</p>
                  </div>
                )}

                {deleteStatus === 'error' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-2">
                      <AlertCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-typography-900">Erro na Exclusão</h3>
                    <p className="text-typography-500">Não foi possível remover todos os dados. Verifique as permissões.</p>
                    <button
                      onClick={() => setUserToDelete(null)}
                      className="mt-4 px-6 py-2.5 bg-surface-200 hover:bg-surface-300 text-typography-900 font-bold rounded-2xl border border-surface-300 cursor-pointer"
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

      {/* Role Change Modal */}
      <AnimatePresence>
        {userToEditRole && (
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
              className="bg-surface-100 border border-surface-300 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-typography-900"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-typography-900">Alterar Categoria</h3>
                  <button onClick={() => setUserToEditRole(null)} className="text-typography-400 hover:text-typography-900 p-1.5 rounded-xl hover:bg-surface-200 transition-colors cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-4 bg-surface-200/60 border border-surface-300 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface-100 border border-surface-300 rounded-xl flex items-center justify-center text-primary-200 shadow-sm shrink-0">
                    <UserIcon size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-typography-900 truncate">{userToEditRole.nome}</p>
                    <p className="text-xs text-typography-500">ID: {userToEditRole.numeroPessoal || 'Não informado'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1">Selecione a Categoria</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: 'viajante', label: 'Viajante', icon: Globe, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
                      { value: 'pioneiro_especial', label: 'Pioneiro Especial', icon: Sparkles, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10' },
                      { value: 'pioneiro_regular', label: 'Pioneiro Regular', icon: UserIcon, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                      { value: 'secretaria', label: 'Secretaria (TJSec)', icon: ShieldCheck, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10' },
                      { value: 'user', label: 'Usuário Comum', icon: UserIcon, color: 'text-typography-500', bg: 'bg-surface-200' }
                    ].map((role) => (
                      <button
                        key={role.value}
                        onClick={() => handleUpdateRole(userToEditRole.id, role.value)}
                        disabled={isUpdatingRole}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-2xl border transition-all group cursor-pointer text-left",
                          userToEditRole.role === role.value 
                            ? 'border-primary-200 bg-primary-200/10' 
                            : 'border-surface-300 hover:border-primary-200/50 bg-surface-200/40 hover:bg-surface-200'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border border-surface-300/40", role.bg, role.color)}>
                            <role.icon size={18} />
                          </div>
                          <span className={cn("text-sm font-bold", userToEditRole.role === role.value ? 'text-primary-200' : 'text-typography-700')}>
                            {role.label}
                          </span>
                        </div>
                        {userToEditRole.role === role.value && (
                          <div className="w-5 h-5 bg-primary-200 rounded-full flex items-center justify-center text-white">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setUserToEditRole(null)}
                  className="w-full py-3 text-typography-500 font-bold hover:bg-surface-200 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
