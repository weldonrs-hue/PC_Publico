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
  CheckCircle2,
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

interface UserMetadata {
  id: string;
  email: string;
  role: string;
  createdAt: any;
  lastLogin: any;
  photoURL?: string;
  nome?: string;
  numeroPessoal?: string;
  isInactive?: boolean;
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
  const [userToDelete, setUserToDelete] = useState<UserMetadata | null>(null);
  const [userToEditRole, setUserToEditRole] = useState<UserMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'reauth' | 'deleting' | 'success' | 'error'>('idle');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{found: boolean, data?: any, searchedEmail?: string} | null>(null);
  const [verificationEmail, setVerificationEmail] = useState('');

  const handleVerifyAccount = async () => {
    if (!verificationEmail.trim()) return;
    
    setVerifyingAccount(true);
    setVerificationResult(null);
    
    try {
      let emailToSearch = verificationEmail.trim().toLowerCase();
      
      // If it's just a number, format it
      if (/^\d{7}$/.test(emailToSearch)) {
        emailToSearch = `${emailToSearch}@progcir.app`;
      }

      // Try searching in users collection
      const q = query(collection(db, 'users'), where('email', '==', emailToSearch));
      let snapshot = await getDocs(q);
      
      // If not found and it was a personal number pattern, try variants
      if (snapshot.empty && emailToSearch.includes('@')) {
        const prefix = emailToSearch.split('@')[0];
        if (/^\d{7}$/.test(prefix)) {
          const variants = [
            `${prefix}@procir.app`,
            `${prefix}@progcir.app`,
            `${prefix}@progcir.com`,
            `${prefix}@tjsec.app`
          ].filter(v => v !== emailToSearch);
          
          for (const variant of variants) {
            const variantQ = query(collection(db, 'users'), where('email', '==', variant));
            const variantSnapshot = await getDocs(variantQ);
            if (!variantSnapshot.empty) {
              snapshot = variantSnapshot;
              emailToSearch = variant;
              break;
            }
          }
        }
      }

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setVerificationResult({ found: true, data: userData, searchedEmail: emailToSearch });
      } else {
        setVerificationResult({ found: false, searchedEmail: emailToSearch });
      }
    } catch (error) {
      console.error('Error verifying account:', error);
      handleFirestoreError(error, OperationType.GET, 'users_verification');
      await showAlert('Erro ao verificar conta. Verifique sua conexão.', 'Erro');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: keyof UserMetadata | 'nome' | 'numeroPessoal'; direction: 'asc' | 'desc' } | null>({ 
    key: 'createdAt', 
    direction: 'desc' 
  });

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      // Fetch users and personal data in parallel - ONLY essential collections
      const [usersSnapshot, personalDataSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'personal_data'))
      ]);

      const usersDocs = usersSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const pdDocs = personalDataSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Create a set of all unique UIDs. 
      // We prioritize the UID (users document ID or personal_data userId field)
      const allUids = Array.from(new Set([
        ...usersDocs.map(u => u.id),
        ...pdDocs.map(p => p.userId).filter(Boolean)
      ]));
      
      // If there are documents in personal_data indexed by Personal Number, we add them as well if they don't have a userId
      pdDocs.forEach(pd => {
        if (!pd.userId && pd.id && !allUids.includes(pd.id)) {
          // Check if this ID looks like a UID or personal number
          // We add it to ensure we don't miss data
          allUids.push(pd.id);
        }
      });

      const usersData = allUids.map(uid => {
        const userData = usersDocs.find(u => u.id === uid);
        const pdData = pdDocs.find(p => p.id === uid || p.userId === uid);
        
        // Use UID as fallback for email if it looks like an email (TJSec pattern)
        const email = userData?.email || pdData?.emailPessoal || pdData?.emailJwpub || (uid.includes('@') ? uid : '');
        const isTjSec = email.toLowerCase().endsWith('@tjsec.app');
        const isProgCir = email.toLowerCase().endsWith('@progcir.app') || email.toLowerCase().endsWith('@procir.app');
        
        // If it's a TJSec or ProgCir account, we try to extract the number from the email
        const accountNumber = (isTjSec || isProgCir) ? email.split('@')[0] : '';
        
        // Check if this account should be shown
        const isRealUser = !!userData || isTjSec || isProgCir;

        return {
          id: uid,
          ...userData,
          nome: pdData?.nome || userData?.nome || (isTjSec ? `Secretaria ${accountNumber}` : (isProgCir ? `Viajante ${accountNumber}` : (userData?.displayName || (userData?.usuario && userData?.usuario.length > 5 ? userData?.usuario : 'Sem nome')))),
          role: pdData?.role || userData?.role || (isTjSec ? 'secretaria' : (isProgCir && accountNumber === '2283701' ? 'admin' : 'user')),
          numeroPessoal: pdData?.numeroPessoal || userData?.usuario || accountNumber || '---',
          photoURL: pdData?.profilePhoto || userData?.photoURL || null,
          isInactive: !!userData?.isInactive,
          email: email,
          isRealUser: isRealUser // Track if it's a real user for filtering
        } as UserMetadata;
      });

      // Filter to only show real users (Auth or TJSec)
      const filteredRealUsers = usersData.filter(u => (u as any).isRealUser);

      // Sort in-memory: newest first, users without date at the end
      filteredRealUsers.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setUsers(filteredRealUsers);
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

  const filteredUsers = getSortedUsers(users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.numeroPessoal?.toLowerCase().includes(searchTerm.toLowerCase())
  ));

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
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
            title="Voltar"
          >
            <ChevronLeft size={22} strokeWidth={3} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              Usuários do Sistema
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Gerencie os acessos do sistema</p>
          </div>
        </div>
        
        {/* Tools & Search Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print mt-4">
          {/* Verification Tool (For TJSec) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={14} />
              Verificador de Conta
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Número ou Email..."
                value={verificationEmail}
                onChange={(e) => setVerificationEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyAccount()}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:bg-white outline-none transition-all placeholder:text-gray-300"
              />
              <button
                onClick={handleVerifyAccount}
                disabled={verifyingAccount || !verificationEmail}
                className="px-3 bg-[#512da8] text-white rounded-xl hover:bg-[#4527a0] transition-all disabled:opacity-50 flex items-center justify-center shadow-md shadow-[#512da8]/10"
              >
                {verifyingAccount ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {verificationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className={`p-2.5 rounded-xl border ${
                    verificationResult.found ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                  }`}
                >
                  {verificationResult.found ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                        <CheckCircle2 size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-900 truncate leading-none">
                          {verificationResult.data.usuario || verificationResult.data.nome || 'Localizada'}
                        </p>
                        <p className="text-[8px] text-emerald-700/70 truncate">{verificationResult.searchedEmail}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 shrink-0">
                        <AlertCircle size={12} />
                      </div>
                      <p className="text-[9px] text-rose-900 leading-tight">
                        Não encontrada: <span className="font-bold">{verificationResult.searchedEmail}</span>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Global Sync */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between gap-3">
            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <RefreshCw size={14} />
              Sincronização
            </h3>
            <button
              onClick={async () => {
                if (isQuotaExceeded()) {
                  await showAlert('Limite diário de cota excedido. Não é possível realizar operações de escrita no momento.', 'Aviso de Cota');
                  return;
                }
                const confirmMsg = `AVISO DE COTA FIRESTORE:\n\nEsta operação irá comparar e atualizar TODOS os usuários cadastrados. \nDependendo do número de usuários, isso pode consumir centenas de "WRITES" da sua cota diária.\n\nDeseja realmente continuar?`;
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
              className="w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl border border-indigo-200 text-[10px] font-black transition-all disabled:opacity-50 uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Sincronizar Geral
            </button>
          </div>

          {/* Regular Search */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Search size={14} />
              Filtrar Lista
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Buscar na lista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#512da8]/10 focus:border-[#512da8] transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <button 
                onClick={fetchUsers}
                disabled={refreshing}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-500 transition-all disabled:opacity-50"
                title="Recarregar"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={onBack}
                className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg border border-red-200 transition-all flex items-center justify-center shadow-sm active:scale-95 shrink-0"
                title="Fechar"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Role Change Requests Section */}
      {roleRequests.some(r => r.status === 'pending') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 ml-1">
            <RefreshCw className="text-purple-600" size={20} />
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Solicitações de Categoria Pendentes</h3>
            <span className="bg-purple-100 text-purple-600 text-[10px] font-black px-2 py-0.5 rounded-full">
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
                className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-sm text-gray-900 uppercase tracking-tight">{request.userName || 'Usuário'}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{formatDate(request.createdAt)}</p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
                    <Fingerprint size={20} />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                  <div className="flex-1 text-center">
                    <p className="text-[9px] text-gray-400 font-black uppercase">Atual</p>
                    <p className="text-[10px] font-bold text-gray-600 uppercase truncate">{request.currentRole.replace('_', ' ')}</p>
                  </div>
                  <div className="text-purple-300">→</div>
                  <div className="flex-1 text-center font-black">
                    <p className="text-[9px] text-purple-400 uppercase">Solicitada</p>
                    <p className="text-[11px] text-purple-700 uppercase truncate">{request.requestedRole.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                  <Phone size={14} className="text-emerald-600" />
                  <span className="text-xs font-black text-emerald-700">{request.phoneNumber}</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleApproveRequest(request)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest shadow-md shadow-emerald-100"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest"
                  >
                    Recusar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>Nota:</strong> Se você excluiu um usuário do Firebase Auth, ele ainda aparecerá aqui até que seus dados sejam removidos manualmente. Contas marcadas como <span className="text-red-700 font-bold">DUPLICADO</span> indicam que o mesmo Número Pessoal está em dois perfis diferentes. 
            </p>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              As datas de criação e último login são sincronizadas a partir do Firebase Authentication quando o usuário realiza login.
            </p>
          </div>
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
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 bg-gray-100 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#512da8]/10 flex items-center justify-center text-[#512da8] overflow-hidden border border-[#512da8]/5 flex-shrink-0">
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
                          <p className="text-xs font-bold text-gray-900 leading-tight truncate">{user.nome}</p>
                          <p className="text-[10px] text-gray-500 font-medium truncate">{user.email}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {user.role === 'admin' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black uppercase border border-amber-200">
                                <ShieldCheck size={8} />
                                Administrador
                              </span>
                            )}
                            {user.role === 'viajante' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[8px] font-black uppercase border border-blue-200">
                                <Globe size={8} />
                                Viajante
                              </span>
                            )}
                            {user.role === 'pioneiro_especial' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[8px] font-black uppercase border border-purple-200">
                                <Sparkles size={8} />
                                Pioneiro Especial
                              </span>
                            )}
                            {user.role === 'pioneiro_regular' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase border border-emerald-200">
                                <UserIcon size={8} />
                                Pioneiro Regular
                              </span>
                            )}
                            {user.role === 'secretaria' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[8px] font-black uppercase border border-rose-200">
                                <ShieldCheck size={8} />
                                Secretaria (TJSec)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          users.filter(u => u.numeroPessoal === user.numeroPessoal && u.numeroPessoal !== '---').length > 1
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-[#512da8]/5 text-[#512da8]'
                        }`}>
                          {user.numeroPessoal}
                        </span>
                        {users.filter(u => u.numeroPessoal === user.numeroPessoal && u.numeroPessoal !== '---').length > 1 && (
                          <span className="text-[8px] text-red-500 font-black uppercase tracking-tighter">Duplicado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <Calendar size={12} className="text-gray-400" />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <Clock size={12} className="text-gray-400" />
                        {formatDate(user.lastLogin)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleInactive(user)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border shadow-sm w-full max-w-[70px] mx-auto ${
                          user.isInactive 
                            ? 'bg-gray-100 text-gray-400 border-gray-200' 
                            : 'bg-emerald-500 text-white border-emerald-400'
                        }`}
                      >
                        {user.isInactive ? 'OFFLINE' : 'ATIVO'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setUserToEditRole(user)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Alterar Categoria"
                        >
                          <Fingerprint size={16} />
                        </button>
                        {auth.currentUser?.uid !== user.id && (
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Alterar Categoria</h3>
                  <button onClick={() => setUserToEditRole(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{userToEditRole.nome}</p>
                    <p className="text-xs text-gray-500">ID: {userToEditRole.numeroPessoal}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase ml-1">Selecione a Categoria</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: 'viajante', label: 'Viajante', icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { value: 'pioneiro_especial', label: 'Pioneiro Especial', icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50' },
                      { value: 'pioneiro_regular', label: 'Pioneiro Regular', icon: UserIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { value: 'secretaria', label: 'Secretaria (TJSec)', icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50' },
                      { value: 'user', label: 'Usuário Comum', icon: UserIcon, color: 'text-gray-600', bg: 'bg-gray-50' }
                    ].map((role) => (
                      <button
                        key={role.value}
                        onClick={() => handleUpdateRole(userToEditRole.id, role.value)}
                        disabled={isUpdatingRole}
                        className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all group ${
                          userToEditRole.role === role.value 
                            ? 'border-indigo-500 bg-indigo-50/50' 
                            : 'border-gray-100 hover:border-indigo-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role.bg} ${role.color}`}>
                            <role.icon size={18} />
                          </div>
                          <span className={`text-sm font-bold ${userToEditRole.role === role.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {role.label}
                          </span>
                        </div>
                        {userToEditRole.role === role.value && (
                          <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                            <Check size={12} strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setUserToEditRole(null)}
                  className="w-full py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-all"
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
