'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Printer, 
  CloudDownload, 
  Trash2, 
  Calendar, 
  Lock, 
  Users,
  FolderPlus,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserX,
  X,
  ShieldCheck,
  ExternalLink,
  UserPlus,
  Mail,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { 
  collection,
  query,
  where,
  getDocs,
  doc, 
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  addDoc,
  onSnapshot,
  limit,
  updateDoc
} from 'firebase/firestore';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword,
  deleteUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { createCircuitFolderStructure } from '@/utils/fileSystem';

interface SettingsViewProps {
  userId: string;
  onBack: () => void;
  onViewChange: (view: string) => void;
  isAdmin?: boolean;
  appConfig?: { 
    reportEnabledForAll: boolean;
    textEditorEnabledForAll: boolean;
    congregationImportEnabledForAll: boolean;
  };
}

const settingsButtons = [
  {
    id: 'pioneer_access',
    icon: UserPlus,
    title: 'COLABORADORES',
    subtitle: 'ACESSO ESCOLA PIONEIROS',
    color: '#37616b',
    gradient: 'from-[#37616b] to-[#2c4d55]'
  },
  {
    id: 'pastas',
    icon: FolderPlus,
    title: 'CRIAR ESTRUTURA',
    subtitle: 'DE PASTAS DO CIRCUITO',
    color: '#6c40bd',
    gradient: 'from-[#6c40bd] to-[#5a35a0]'
  },
  {
    id: 'usuarios',
    icon: Users,
    title: 'EXIBIR USUÁRIOS',
    subtitle: 'USUÁRIOS DO SISTEMA',
    color: '#4C1D95',
    gradient: 'from-[#4C1D95] to-[#2E1065]'
  },
  {
    id: 'senha',
    icon: Lock,
    title: 'ALTERAR SENHA',
    subtitle: 'SEGURANÇA DA CONTA',
    color: '#8B5CF6',
    gradient: 'from-[#8B5CF6] to-[#7C3AED]'
  },
  {
    id: 'formatar',
    icon: Trash2,
    title: 'FORMATAR CONTA',
    subtitle: 'LIMPAR TODOS OS DADOS',
    color: '#4C1D95',
    gradient: 'from-[#4C1D95] to-[#5B21B6]'
  },
  {
    id: 'privacidade',
    icon: ShieldCheck,
    title: 'PRIVACIDADE',
    subtitle: 'PROTEÇÃO DE DADOS (LGPD)',
    color: '#6c40bd',
    gradient: 'from-[#6c40bd] to-[#5a35a0]'
  }
];

export default function SettingsView({ userId, onBack, onViewChange, isAdmin, appConfig }: SettingsViewProps) {
  const [pastaCircuito, setPastaCircuito] = useState<string>('Não configurada');
  const [circuito, setCircuito] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [creationStep, setCreationStep] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isFormattingAccount, setIsFormattingAccount] = useState(false);
  const [isShowingPrivacy, setIsShowingPrivacy] = useState(false);
  const [isManagingPioneerAccess, setIsManagingPioneerAccess] = useState(false);
  const [pioneerInvites, setPioneerInvites] = useState<any[]>([]);
  const [receivedPioneerInvites, setReceivedPioneerInvites] = useState<any[]>([]);
  const [personalData, setPersonalData] = useState<any>(null);
  const [inviteNumber, setInviteNumber] = useState('');
  const [inviteTurma, setInviteTurma] = useState<'1' | '2' | '3' | 'all'>('1');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [formatStep, setFormatStep] = useState<'confirm' | 'formatting' | 'success'>('confirm');
  const [formatPassword, setFormatPassword] = useState('');
  const [formatError, setFormatError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'reauth' | 'deleting' | 'success'>('confirm');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detect if running in an iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

    // Detect if desktop
    const checkDesktop = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsDesktop(!isMobile);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPersonalData(data);
          if (data.pastaCircuito) {
            setPastaCircuito(data.pastaCircuito);
          }
          if (data.circuito) {
            setCircuito(data.circuito);
          }
        }

        // Fetch current user role
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setCurrentUserRole(userDocSnap.data().role || 'user');
        }
      } catch (error) {
        console.error('Erro ao buscar configurações:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Listen for invitations sent by this user
    const qSent = query(collection(db, 'pioneer_school_invitations'), where('ownerId', '==', userId));
    const unsubscribeSent = onSnapshot(qSent, (snap) => {
      setPioneerInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen for invitations received by this user
    const qReceived = query(collection(db, 'pioneer_school_invitations'), where('collaboratorId', '==', userId));
    const unsubscribeReceived = onSnapshot(qReceived, (snap) => {
      setReceivedPioneerInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      window.removeEventListener('resize', checkDesktop);
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, [userId]);

  const handleCreateFolders = async () => {
    console.log('handleCreateFolders: Iniciando...', { isIframe });
    setIsCreatingFolders(true);
    setError(null);
    setCreationStep('Verificando permissões...');

    try {
      // Check if API is available
      if (!(window as any).showDirectoryPicker) {
        console.warn('handleCreateFolders: showDirectoryPicker não disponível');
        if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
          setError('Em dispositivos móveis, a criação de pastas é feita através da pasta Documentos do sistema. Por favor, use um computador para criar a estrutura completa automaticamente ou salve os arquivos individualmente.');
        } else {
          setError('Seu navegador não suporta a criação de pastas diretamente. Por favor, use um navegador moderno como Chrome ou Edge.');
        }
        return;
      }

      if (isIframe) {
        console.warn('handleCreateFolders: Bloqueado por iframe');
        setError('O navegador bloqueia a criação de pastas quando o aplicativo está dentro de um quadro (iframe). Por favor, abra o aplicativo em uma nova aba para usar esta função.');
        return;
      }

      setCreationStep('Aguardando seleção de pasta...');

      // 1. Pick root directory
      const rootHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      // 2. Create Structure using utility
      const circuitFolderName = circuito || 'CIRCUITO-NOVO';
      setCreationStep(`Criando estrutura em: ${circuitFolderName}...`);
      await createCircuitFolderStructure(rootHandle, circuitFolderName, userId);

      setCreationStep('Estrutura criada com sucesso!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
      setIsCreatingFolders(false);
    } catch (err: any) {
      console.error('Erro ao criar pastas:', err);
      if (err.name !== 'AbortError') {
        setError(err.message || 'Erro desconhecido ao criar pastas');
        // Keep isCreatingFolders true so the error overlay stays visible
        return;
      }
      setIsCreatingFolders(false);
    } finally {
      // Only close automatically if there was no error
      // If there's an error, the user must close it manually via the button
    }
  };

  const handleButtonClick = (id: string) => {
    if (id === 'pastas') {
      handleCreateFolders();
    } else if (id === 'usuarios') {
      onViewChange('users');
    } else if (id === 'senha') {
      setIsChangingPassword(true);
    } else if (id === 'pioneer_access') {
      setIsManagingPioneerAccess(true);
    } else if (id === 'formatar') {
      setIsFormattingAccount(true);
      setFormatStep('confirm');
      setFormatPassword('');
      setFormatError(null);
    } else if (id === 'privacidade') {
      setIsShowingPrivacy(true);
    } else {
      alert(`Função "${id}" em desenvolvimento para o ProgCir Web.`);
    }
  };

  const handleToggleReportVisibility = async () => {
    if (!isAdmin) return;
    try {
      const configRef = doc(db, 'config', 'app_settings');
      await setDoc(configRef, { 
        reportEnabledForAll: !appConfig?.reportEnabledForAll 
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao atualizar configuração global:', err);
      alert('Erro ao atualizar configuração. Verifique suas permissões.');
    }
  };

  const handleToggleTextEditorVisibility = async () => {
    if (!isAdmin) return;
    try {
      const configRef = doc(db, 'config', 'app_settings');
      await setDoc(configRef, { 
        textEditorEnabledForAll: !appConfig?.textEditorEnabledForAll 
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao atualizar configuração global:', err);
      alert('Erro ao atualizar configuração. Verifique suas permissões.');
    }
  };

  const handleToggleImportVisibility = async () => {
    if (!isAdmin) return;
    try {
      const configRef = doc(db, 'config', 'app_settings');
      await setDoc(configRef, { 
        congregationImportEnabledForAll: !appConfig?.congregationImportEnabledForAll 
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao atualizar configuração global:', err);
      alert('Erro ao atualizar configuração. Verifique suas permissões.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('Usuário não autenticado');

      const credential = EmailAuthProvider.credential(user.email, passwordForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.new);

      setPasswordSuccess(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setPasswordSuccess(false);
        setIsChangingPassword(false);
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      if (err.code === 'auth/wrong-password') {
        setPasswordError('Senha atual incorreta');
      } else {
        setPasswordError(err.message || 'Erro ao alterar senha');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleInviteInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteNumber.trim() || inviteLoading) return;
    
    setInviteLoading(true);
    try {
      const q = query(collection(db, 'personal_data'), where('numeroPessoal', '==', inviteNumber.trim()), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert('Usuário não encontrado com este número pessoal.');
        setInviteLoading(false);
        return;
      }
      
      const instructorData = snap.docs[0].data();
      const instructorId = instructorData.userId;
      
      if (instructorId === auth.currentUser?.uid) {
        alert('Você não pode convidar a si mesmo.');
        setInviteLoading(false);
        return;
      }

      // Check if already invited for this turma
      const existing = pioneerInvites.find(inv => inv.collaboratorId === instructorId && inv.turma === inviteTurma);
      if (existing) {
        alert('Este usuário já possui um convite pendente ou ativo para esta turma.');
        setInviteLoading(false);
        return;
      }

      await addDoc(collection(db, 'pioneer_school_invitations'), {
        ownerId: auth.currentUser?.uid,
        ownerName: personalData?.nome || 'Instrutor',
        collaboratorId: instructorId,
        collaboratorNumber: inviteNumber.trim(),
        turma: inviteTurma,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setInviteNumber('');
      alert('Convite enviado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'pioneer_school_invitations');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'pioneer_school_invitations', inviteId), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'pioneer_school_invitations');
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'pioneer_school_invitations', inviteId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'pioneer_school_invitations');
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    if (!confirm('Tem certeza que deseja remover este acesso/convite?')) return;
    try {
      await deleteDoc(doc(db, 'pioneer_school_invitations', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'pioneer_school_invitations');
    }
  };

  const handleFormatAccount = async () => {
    if (!formatPassword) {
      setFormatError('Por favor, insira sua senha para confirmar.');
      return;
    }

    setFormatStep('formatting');
    setFormatError(null);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('Usuário não autenticado');

      // Re-authenticate user before formatting
      const credential = EmailAuthProvider.credential(user.email, formatPassword);
      await reauthenticateWithCredential(user, credential);

      const collectionsToClear = [
        'congregations',
        'substitutes',
        'itineraries',
        'activity_analysis',
        's303_reports'
      ];

      for (const collName of collectionsToClear) {
        const q = query(collection(db, collName), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }

        // Special case for activity_analysis and s303_reports which might use custom IDs starting with userId
        if (collName === 'activity_analysis' || collName === 's303_reports') {
          // We can't query by ID prefix easily in Firestore without a range query, 
          // but usually they have userId field too. 
          // If they don't, we'd need to fetch and filter or use a range query.
          // Based on rules, they should have userId or start with userId.
        }
      }

      // Also clear personal_data
      const pdDocRef = doc(db, 'personal_data', userId);
      const pdDoc = await getDoc(pdDocRef);
      if (pdDoc.exists()) {
        await deleteDoc(pdDocRef);
      }

      setFormatStep('success');
      setTimeout(() => {
        setIsFormattingAccount(false);
        window.location.reload(); // Reload to reset app state
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao formatar conta:', err);
      if (err.code === 'auth/wrong-password') {
        setFormatError('Senha incorreta. Por favor, tente novamente.');
      } else {
        setFormatError(err.message || 'Erro ao formatar conta');
      }
      setFormatStep('confirm');
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8 relative"
      >
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Ajustes do Sistema</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {settingsButtons
          .filter(btn => {
            if (btn.id === 'usuarios' && currentUserRole !== 'admin') return false;
            return true;
          })
          .map((btn, index) => {
            const isDisabled = isCreatingFolders;
            return (
              <motion.div
                key={btn.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => !isDisabled && handleButtonClick(btn.id)}
                className={`relative group h-28 ${
                  isDisabled 
                    ? 'cursor-not-allowed grayscale-[0.8] opacity-60' 
                    : 'cursor-pointer'
                }`}
              >
                {/* Background Glow */}
                {!isDisabled && (
                  <div 
                    className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-[2rem]"
                    style={{ backgroundColor: btn.color }}
                  />
                )}
                
                <div className="relative flex bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
                  <div className={`w-2 h-full bg-gradient-to-b ${btn.gradient} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                  <div className="flex-1 flex items-center px-6 gap-6">
                    <div 
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 ${
                        isDisabled 
                          ? 'bg-gray-100 text-gray-400' 
                          : `bg-gradient-to-br ${btn.gradient} group-hover:scale-110 group-hover:rotate-3`
                      }`}
                    >
                      <btn.icon size={30} strokeWidth={2.5} className={`${isDisabled ? 'text-gray-300' : 'text-white drop-shadow-md'}`} />
                    </div>
                    <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                      <div className={`font-black text-xs md:text-sm leading-tight uppercase mb-1 transition-colors ${isDisabled ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                        {btn.title}
                      </div>
                      <div className={`text-[9px] font-bold uppercase tracking-widest transition-opacity ${isDisabled ? 'text-gray-300' : 'text-gray-400 opacity-80 group-hover:opacity-100'}`}>
                        {btn.subtitle}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>

     {isAdmin && (
        <section className="space-y-6 pt-10 border-t border-gray-100">
           <div className="flex items-center gap-3">
             <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
               <ShieldCheck size={20} />
             </div>
             <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Configurações Globais (Admin)</h3>
           </div>

           <div className="space-y-4">
             <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
               <div className="flex items-center justify-between gap-4">
                 <div className="space-y-1">
                   <h4 className="font-bold text-gray-900">Relatório de Pregação</h4>
                   <p className="text-xs text-gray-500 max-w-md">
                     Ao ativar esta opção, o Relatório de Pregação ficará visível e utilizável por todos os usuários do circuito. 
                     Enquanto desativado, apenas administradores têm acesso.
                   </p>
                 </div>
                 
                 <button 
                   onClick={handleToggleReportVisibility}
                   className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-amber-200 ${appConfig?.reportEnabledForAll ? 'bg-amber-500' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${appConfig?.reportEnabledForAll ? 'translate-x-7' : 'translate-x-0'} shadow-md`} />
                 </button>
               </div>
             </div>

             <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
               <div className="flex items-center justify-between gap-4">
                 <div className="space-y-1">
                   <h4 className="font-bold text-gray-900">Editor de Texto</h4>
                   <p className="text-xs text-gray-500 max-w-md">
                     Ao ativar esta opção, o Editor de Texto ficará visível e utilizável por todos os usuários do circuito. 
                     Enquanto desativado, apenas administradores têm acesso.
                   </p>
                 </div>
                 
                 <button 
                   onClick={handleToggleTextEditorVisibility}
                   className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-amber-200 ${appConfig?.textEditorEnabledForAll ? 'bg-amber-500' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${appConfig?.textEditorEnabledForAll ? 'translate-x-7' : 'translate-x-0'} shadow-md`} />
                 </button>
               </div>
             </div>

             <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
               <div className="flex items-center justify-between gap-4">
                 <div className="space-y-1">
                   <h4 className="font-bold text-gray-900">Importação em Massa</h4>
                   <p className="text-xs text-gray-500 max-w-md">
                     Ao ativar esta opção, o botão de Importação em Massa na Gestão de Congregações ficará visível e utilizável por todos os usuários. 
                     Enquanto desativado, apenas administradores têm acesso.
                   </p>
                 </div>
                 
                 <button 
                   onClick={handleToggleImportVisibility}
                   className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-amber-200 ${appConfig?.congregationImportEnabledForAll ? 'bg-amber-500' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${appConfig?.congregationImportEnabledForAll ? 'translate-x-7' : 'translate-x-0'} shadow-md`} />
                 </button>
               </div>
             </div>
           </div>
        </section>
      )}
    </motion.div>

    {/* Pioneer Access Management Modal */}
      <AnimatePresence>
        {isManagingPioneerAccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-50 rounded-[2.5rem] w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden min-h-[500px] max-h-[95vh]"
            >
              {/* Left Sidebar: Form to Invite */}
              <div className="w-full md:w-80 bg-white p-8 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col items-center">
                <div className="w-16 h-16 bg-[#37616b]/10 rounded-2xl flex items-center justify-center mb-6">
                  <UserPlus className="text-[#37616b]" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Convidar Instrutor</h3>
                <p className="text-xs text-gray-500 mb-8 text-center italic">
                  Dê acesso a outro instrutor para gerenciar uma turma da Escola de Pioneiros com você.
                </p>

                <form onSubmit={handleInviteInstructor} className="w-full space-y-6">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Turma Escolhida</label>
                    <div className="grid grid-cols-4 gap-2">
                       {['1', '2', '3', 'all'].map((t) => (
                         <button
                           key={t}
                           type="button"
                           onClick={() => setInviteTurma(t as any)}
                           className={`py-2 rounded-xl text-xs font-black transition-all ${
                             inviteTurma === t 
                               ? 'bg-[#37616b] text-white shadow-lg shadow-[#37616b]/20 scale-105' 
                               : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                           }`}
                         >
                           {t === 'all' ? 'TODAS' : `T${t}`}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Código de Usuário (B)</label>
                    <input 
                      type="text"
                      required
                      value={inviteNumber}
                      onChange={(e) => setInviteNumber(e.target.value)}
                      placeholder="Ex: 2283701"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#37616b] focus:ring-2 focus:ring-[#37616b]/10 outline-none transition-all text-sm font-bold"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={inviteLoading || !inviteNumber.trim()}
                    className="w-full py-4 bg-[#37616b] text-white font-black rounded-2xl hover:bg-[#2c4d55] transition-all shadow-xl shadow-[#37616b]/20 flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest"
                  >
                    {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Enviar Convite
                  </button>
                </form>

                <button 
                  onClick={() => setIsManagingPioneerAccess(false)}
                  className="mt-6 w-full py-3 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-gray-600 transition-colors"
                >
                   Voltar
                </button>
              </div>

              {/* Right Content: Lists of Invites */}
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-10">
                   {/* Received Invites Section */}
                   <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                        <UserCheck size={20} />
                      </div>
                      <h4 className="font-black text-sm text-gray-800 uppercase tracking-widest">Convites Recebidos</h4>
                    </div>

                    {receivedPioneerInvites.length === 0 ? (
                      <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 border-dashed">
                        <Mail size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum convite recebido</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {receivedPioneerInvites.map((inv) => (
                          <div key={inv.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-[#37616b] transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-[#37616b]">
                                T{inv.turma}
                              </div>
                              <div>
                                <div className="text-sm font-black text-gray-800">C.O. {inv.ownerName}</div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 
                                    inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {inv.status === 'accepted' ? 'Aceito' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                               {inv.status === 'pending' && (
                                 <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                   <button 
                                     onClick={() => handleAcceptInvite(inv.id)}
                                     className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                                   >
                                     Aceitar
                                   </button>
                                   <button 
                                     onClick={() => handleRejectInvite(inv.id)}
                                     className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                                   >
                                     Recusar
                                   </button>
                                 </div>
                               )}
                               {inv.status === 'accepted' && (
                                 <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                   <button 
                                      onClick={() => onViewChange(`pioneer_school_guest:${inv.ownerId}:${inv.turma}`)}
                                      className="flex-1 sm:flex-none px-4 py-2 bg-[#37616b] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2c4d55] transition-all"
                                   >
                                      Acessar Turma
                                   </button>
                                   <button 
                                     onClick={() => handleRemoveInvite(inv.id)}
                                     className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                     title="Remover Acesso"
                                   >
                                     <Trash2 size={16} />
                                   </button>
                                 </div>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                   </section>

                   {/* Sent Invites Section */}
                   <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                        <Mail size={20} />
                      </div>
                      <h4 className="font-black text-sm text-gray-800 uppercase tracking-widest">Convites Enviados</h4>
                    </div>

                    {pioneerInvites.length === 0 ? (
                      <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 border-dashed">
                        <Users size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum convite enviado</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {pioneerInvites.map((inv) => (
                          <div key={inv.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400">
                                T{inv.turma}
                              </div>
                              <div>
                                <div className="text-sm font-black text-gray-800">Para: C.O. {inv.collaboratorNumber}</div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 
                                    inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                               <button 
                                 onClick={() => handleRemoveInvite(inv.id)}
                                 className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                 title="Remover Acesso"
                               >
                                 <Trash2 size={20} />
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                   </section>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    {/* Format Account Modal */}
      <AnimatePresence>
        {isFormattingAccount && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Formatar Conta</h3>
                <button 
                  onClick={() => !isProcessing && setIsFormattingAccount(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {formatStep === 'success' ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="font-bold text-green-600">Conta formatada com sucesso!</p>
                  <p className="text-sm text-gray-500 text-center">Reiniciando o sistema...</p>
                </div>
              ) : formatStep === 'formatting' ? (
                <div className="text-center py-8 space-y-4">
                  <Loader2 size={48} className="text-[#6c40bd] animate-spin mx-auto" />
                  <p className="font-bold text-gray-700">Formatando dados...</p>
                  <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                    <div className="space-y-1">
                      <p className="font-bold text-red-900 text-sm">Atenção!</p>
                      <p className="text-red-700 text-xs leading-relaxed">
                        Esta ação apagará <strong>todos os seus dados</strong> (congregações, itinerários, relatórios, etc). 
                        Sua conta de acesso continuará existindo, mas estará vazia como se fosse o primeiro acesso.
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 font-medium text-center">
                    Tem certeza que deseja formatar sua conta?
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Confirme sua Senha</label>
                      <input 
                        type="password"
                        required
                        value={formatPassword}
                        onChange={(e) => setFormatPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all"
                      />
                    </div>

                    {formatError && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {formatError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleFormatAccount}
                        className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg flex items-center justify-center gap-2"
                      >
                        <Trash2 size={20} />
                        Sim, Formatar Tudo
                      </button>
                      <button 
                        onClick={() => setIsFormattingAccount(false)}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    {/* Password Change Modal */}
      <AnimatePresence>
        {isChangingPassword && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Alterar Senha</h3>
                <button 
                  onClick={() => setIsChangingPassword(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {passwordSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="font-bold text-green-600">Senha alterada com sucesso!</p>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Senha Atual</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#6c40bd] focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nova Senha</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#6c40bd] focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Confirmar Nova Senha</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#6c40bd] focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                      <AlertCircle size={16} />
                      {passwordError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full py-3 bg-[#6c40bd] text-white font-bold rounded-xl hover:bg-[#5a35a0] transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {passwordLoading ? <Loader2 size={20} className="animate-spin" /> : 'Atualizar Senha'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    {/* Creation Overlay */}
      <AnimatePresence>
        {isCreatingFolders && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6">
              <div className="w-20 h-20 bg-[#f3e5f5] rounded-full flex items-center justify-center mx-auto">
                <Loader2 size={40} className="text-[#6c40bd] animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">
                  {error ? 'Ação Necessária' : 'Criando Estrutura'}
                </h3>
                <p className={`${error ? 'text-red-500' : 'text-gray-500'} text-sm`}>
                  {error || creationStep}
                </p>
              </div>
              {!error && (
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 10, ease: "linear" }}
                    className="bg-[#6c40bd] h-full"
                  />
                </div>
              )}
              {error && (
                <div className="flex flex-col gap-3 w-full">
                  {isIframe && (
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="w-full py-3 bg-[#6c40bd] text-white font-bold rounded-xl hover:bg-[#5a35a0] transition-colors shadow-lg"
                    >
                      Abrir em Nova Aba
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setIsCreatingFolders(false);
                      setError(null);
                    }}
                    className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Privacy Modal */}
      <AnimatePresence>
        {isShowingPrivacy && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between sticky top-0 bg-white pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-xl text-green-600">
                    <ShieldCheck size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Privacidade e LGPD</h3>
                </div>
                <button 
                  onClick={() => setIsShowingPrivacy(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
                <section className="space-y-2">
                  <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Compromisso com a Privacidade</h4>
                  <p>
                    O ProgCir Web está comprometido com a proteção dos dados pessoais processados no sistema, em total conformidade com a 
                    <strong> Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Finalidade do Processamento</h4>
                  <p>
                    Os dados coletados (como nomes de congregações, oradores, itinerários e relatórios de serviço) são utilizados exclusivamente para 
                    fins de organização e gestão das atividades do circuito. Não compartilhamos esses dados com terceiros para fins comerciais.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Seus Direitos</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Acesso:</strong> Você tem total acesso aos dados que insere no sistema.</li>
                    <li><strong>Correção:</strong> Você pode editar qualquer informação a qualquer momento através das telas de gestão.</li>
                    <li><strong>Exclusão:</strong> Você pode apagar todos os seus dados permanentemente usando a função "Formatar Conta" nestes Ajustes.</li>
                    <li><strong>Portabilidade:</strong> Você pode exportar seus dados através das funções de impressão e geração de PDF.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Segurança</h4>
                  <p>
                    Utilizamos a infraestrutura do Google Firebase para armazenamento seguro, com criptografia em trânsito e em repouso. 
                    O acesso aos dados é restrito ao seu usuário autenticado via Google Auth.
                  </p>
                </section>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium">Para mais informações sobre a lei vigente:</span>
                  <button 
                    onClick={() => window.open('https://www.gov.br/esporte/pt-br/acesso-a-informacao/lgpd', '_blank')}
                    className="flex items-center gap-1 text-[#6c40bd] font-bold text-xs hover:underline"
                  >
                    Portal LGPD <ExternalLink size={14} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setIsShowingPrivacy(false)}
                  className="w-full py-3 bg-[#6c40bd] text-white font-bold rounded-xl hover:bg-[#5a35a0] transition-colors shadow-lg"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] bg-[#37616b] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 size={24} />
            <div>
              <p className="font-bold">Estrutura Criada!</p>
              <p className="text-xs opacity-90">As pastas foram organizadas em: {circuito || 'Circuito'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
