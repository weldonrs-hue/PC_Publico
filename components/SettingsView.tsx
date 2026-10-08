'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  RefreshCw, 
  Printer, 
  CloudDownload, 
  Trash2, 
  Calendar, 
  CalendarDays,
  Lock, 
  Users,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserX,
  X,
  ShieldCheck,
  ExternalLink,
  UserPlus,
  Mail,
  UserCheck,
  Landmark,
  Coffee,
  MailCheck,
  Eye,
  Sparkles,
  Check,
  Key,
  Fingerprint,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import MicrosoftConnectionSettings from '@/components/MicrosoftConnectionSettings';
import WebAuthnSettings from '@/components/WebAuthnSettings';
import { cn } from '@/lib/utils';
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
import { useDialog } from '@/hooks/useDialog';
import { createCircuitFolderStructure } from '@/utils/fileSystem';
import Logo from '@/components/Logo';
const RoleChangeRequestModal = dynamic(() => import('@/components/RoleChangeRequestModal'), { ssr: false });

interface SettingsViewProps {
  userId: string;
  onBack: () => void;
  onViewChange: (view: string) => void;
  isAdmin?: boolean;
  appConfig?: { 
    reportEnabledForAll: boolean;
    congregationImportEnabledForAll: boolean;
    allowESPUploadForAll: boolean;
    allowEMRUploadForAll: boolean;
    allowCongressoUploadForAll: boolean;
    allowAssembleiasUploadForAll: boolean;
    allowProgramacoesUploadForAll: boolean;
    allowPSSUploadForAll: boolean;
    whatsNew?: {
      title: string;
      content: string;
      version: string;
      active: boolean;
    };
  };
}

const settingsButtons = [
  {
    id: 'pioneer_access',
    icon: UserPlus,
    title: 'Instrutor B (ESP)',
    subtitle: 'Acesso à Escola de Pioneiros',
    badge: 'Acesso',
    color: '#37616b',
    iconBorder: 'border-teal-500/40 dark:border-teal-400/50',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'congress_access',
    icon: UserCheck,
    title: 'Assistente do Congresso',
    subtitle: 'Acesso às comissões do congresso',
    badge: 'Acesso',
    color: '#512da8',
    iconBorder: 'border-purple-500/40 dark:border-purple-400/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'invites',
    icon: Mail,
    title: 'Gerenciar Convites',
    subtitle: 'Controle de acessos e colaborações',
    badge: 'Convites',
    color: '#3b82f6',
    iconBorder: 'border-blue-500/40 dark:border-blue-400/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'pastas',
    icon: FolderPlus,
    title: 'Pastas do Circuito',
    subtitle: 'Criar estrutura de pastas organizada',
    badge: 'Arquivos',
    color: '#6c40bd',
    iconBorder: 'border-indigo-500/40 dark:border-indigo-400/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'role_change',
    icon: RefreshCw,
    title: 'Alterar Categoria',
    subtitle: 'Solicitar mudança de perfil ao admin',
    badge: 'Perfil',
    color: '#6c40bd',
    iconBorder: 'border-violet-500/40 dark:border-violet-400/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'usuarios',
    icon: Users,
    title: 'Usuários do Sistema',
    subtitle: 'Listagem e controle de membros',
    badge: 'Admin',
    color: '#4C1D95',
    iconBorder: 'border-purple-600/40 dark:border-purple-400/50',
    iconColor: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'tjsec_accounts',
    icon: Landmark,
    title: 'Contas TJSec',
    subtitle: 'Acessos das congregações do circuito',
    badge: 'Secretaria',
    color: '#059669',
    iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'microsoft',
    icon: MailCheck,
    title: 'Conta Microsoft',
    subtitle: 'Conexão JW / OAuth para envio de S-302',
    badge: 'Conexão',
    color: '#2b579a',
    iconBorder: 'border-sky-500/40 dark:border-sky-400/50',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'passkeys',
    icon: Key,
    title: 'Chaves de Acesso',
    subtitle: 'Login biométrico rápido sem senha',
    badge: 'Segurança',
    color: '#6366f1',
    iconBorder: 'border-indigo-500/40 dark:border-indigo-400/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'senha',
    icon: Lock,
    title: 'Alterar Senha',
    subtitle: 'Atualizar senha de acesso da conta',
    badge: 'Segurança',
    color: '#8B5CF6',
    iconBorder: 'border-violet-500/40 dark:border-violet-400/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'formatar',
    icon: Trash2,
    title: 'Formatar Conta',
    subtitle: 'Limpar todos os registros e dados',
    badge: 'Zona de Perigo',
    color: '#dc2626',
    iconBorder: 'border-red-500/40 dark:border-red-400/50',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  {
    id: 'privacidade',
    icon: ShieldCheck,
    title: 'Privacidade e LGPD',
    subtitle: 'Diretrizes de proteção e termos de uso',
    badge: 'Conformidade',
    color: '#059669',
    iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'donations',
    icon: Coffee,
    title: 'Apoie o Projeto',
    subtitle: 'Contribua para a manutenção do ProgCir',
    badge: 'Apoio',
    color: '#f59e0b',
    iconBorder: 'border-amber-500/40 dark:border-amber-400/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
  }
];

export default function SettingsView({ userId, onBack, onViewChange, isAdmin, appConfig }: SettingsViewProps) {
  const { showAlert, showConfirm } = useDialog();
  const [pastaCircuito, setPastaCircuito] = useState<string>('Não configurada');
  const [circuito, setCircuito] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [creationStep, setCreationStep] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [isManagingMicrosoft, setIsManagingMicrosoft] = useState(false);
  const [isManagingPasskeys, setIsManagingPasskeys] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isFormattingAccount, setIsFormattingAccount] = useState(false);
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [isShowingPrivacy, setIsShowingPrivacy] = useState(false);
  const [isManagingInvites, setIsManagingInvites] = useState(false);
  const [isManagingNews, setIsManagingNews] = useState(false);
  const [showNewsPreview, setShowNewsPreview] = useState(false);
  const [activeTjSecCount, setActiveTjSecCount] = useState<number | null>(null);
  const [newsForm, setNewsForm] = useState({
    title: '',
    content: '',
    version: '',
    active: false
  });
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (appConfig?.whatsNew) {
      setNewsForm(appConfig.whatsNew);
    }
  }, [appConfig?.whatsNew]);

  const handleUpdateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setNewsLoading(true);
    try {
      const configRef = doc(db, 'config', 'app_settings');
      await setDoc(configRef, { 
        whatsNew: {
          ...newsForm,
          version: newsForm.version || Date.now().toString()
        }
      }, { merge: true });
      await showAlert('Novidades atualizadas com sucesso!', 'Sucesso');
      setIsManagingNews(false);
    } catch (err) {
      console.error('Erro ao atualizar novidades:', err);
      await showAlert('Erro ao atualizar novidades.', 'Erro');
    } finally {
      setNewsLoading(false);
    }
  };

  const [inviteView, setInviteView] = useState<'pioneer' | 'congress' | 'caco' | 'cabr'>('pioneer');
  const [pioneerInvites, setPioneerInvites] = useState<any[]>([]);
  const [receivedPioneerInvites, setReceivedPioneerInvites] = useState<any[]>([]);
  const [congressInvites, setCongressInvites] = useState<any[]>([]);
  const [receivedCongressInvites, setReceivedCongressInvites] = useState<any[]>([]);
  const [cacoInvites, setCacoInvites] = useState<any[]>([]);
  const [receivedCacoInvites, setReceivedCacoInvites] = useState<any[]>([]);
  const [cabrInvites, setCabrInvites] = useState<any[]>([]);
  const [receivedCabrInvites, setReceivedCabrInvites] = useState<any[]>([]);
  const [personalData, setPersonalData] = useState<any>(null);
  const [inviteNumber, setInviteNumber] = useState('');
  const [inviteCongressNumber, setInviteCongressNumber] = useState('');
  const [inviteCacoNumber, setInviteCacoNumber] = useState('');
  const [inviteCabrNumber, setInviteCabrNumber] = useState('');
  const [inviteTurma, setInviteTurma] = useState<'1' | '2' | '3' | 'all'>('1');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCongressLoading, setInviteCongressLoading] = useState(false);
  const [inviteCacoLoading, setInviteCacoLoading] = useState(false);
  const [inviteCabrLoading, setInviteCabrLoading] = useState(false);
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
        // Fetch active TjSec accounts count
        if (isAdmin) {
          const userEmail = auth.currentUser?.email || '';
          const isCircuitAdmin = userEmail.endsWith('@progcir.app');
          const isSystemAdmin = ['weldonrs@gmail.com', '2283701@progcir.app', '2283701@progcir.com'].includes(userEmail);
          
          const [pubsSnap, congsSnap] = await Promise.all([
            getDocs(collection(db, 'publishers')),
            getDocs(collection(db, 'congregations'))
          ]);

          let targetCongregationIds: string[] = [];
          
          if (isSystemAdmin) {
            // System Admins see everything
            targetCongregationIds = congsSnap.docs.map(d => d.id);
          } else if (isCircuitAdmin) {
            // Filter congregations by this circuit overseer
            targetCongregationIds = congsSnap.docs
              .filter(d => d.data().circuitOverseerEmail === userEmail)
              .map(d => d.id);
          } else {
            // For regular users, try to find their congregation first
            const myPub = pubsSnap.docs.find(d => d.data().email === userEmail);
            if (myPub) {
              targetCongregationIds = [myPub.data().userId];
            }
          }

          const activePubsWithAccess = pubsSnap.docs.filter(d => {
            const data = d.data();
            return targetCongregationIds.includes(data.userId) && 
                   data.status === 'Ativo' && 
                   data.hasAppAccess === true;
          }).length;

          setActiveTjSecCount(activePubsWithAccess);
        }

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
        const userEmail = auth.currentUser?.email;
        const isAdminEmail = 
          isAdmin ||
          userId === '2283701' ||
          userEmail === 'weldonrs@gmail.com' || 
          userEmail === '2283701@progcir.app' ||
          userEmail === '2283701@progcir.com' ||
          userEmail === '2283701@gmail.com';
        
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef).catch(err => {
          console.warn('SettingsView: Failed to fetch user profile, using email for role check:', err);
          return null;
        });

        if (userDocSnap && userDocSnap.exists()) {
          const data = userDocSnap.data();
          setCurrentUserRole((isAdmin || isAdminEmail || data.role === 'admin') ? 'admin' : (data.role || 'user'));
        } else {
          setCurrentUserRole((isAdmin || isAdminEmail) ? 'admin' : 'user');
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
    }, (error) => {
      console.warn('Settings: Error listening to sent invites:', error);
    });

    // Listen for invitations received by this user
    const qReceived = query(collection(db, 'pioneer_school_invitations'), where('collaboratorId', '==', userId));
    const unsubscribeReceived = onSnapshot(qReceived, (snap) => {
      setReceivedPioneerInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to received invites:', error);
    });

    // Congress Invitations
    const qCongressSent = query(collection(db, 'regional_convention_invitations'), where('ownerId', '==', userId));
    const unsubscribeCongressSent = onSnapshot(qCongressSent, (snap) => {
      setCongressInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to sent congress invites:', error);
    });

    const qCongressReceived = query(collection(db, 'regional_convention_invitations'), where('collaboratorId', '==', userId));
    const unsubscribeCongressReceived = onSnapshot(qCongressReceived, (snap) => {
      setReceivedCongressInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to received congress invites:', error);
    });

    // CAco Invitations (Assembleia com SC)
    const qCacoSent = query(collection(db, 'circuit_assembly_supt_invitations'), where('ownerId', '==', userId));
    const unsubscribeCacoSent = onSnapshot(qCacoSent, (snap) => {
      setCacoInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to sent CAco invites:', error);
    });

    const qCacoReceived = query(collection(db, 'circuit_assembly_supt_invitations'), where('collaboratorId', '==', userId));
    const unsubscribeCacoReceived = onSnapshot(qCacoReceived, (snap) => {
      setReceivedCacoInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to received CAco invites:', error);
    });

    // CAbr Invitations (Assembleia com Betel)
    const qCabrSent = query(collection(db, 'circuit_assembly_branch_invitations'), where('ownerId', '==', userId));
    const unsubscribeCabrSent = onSnapshot(qCabrSent, (snap) => {
      setCabrInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to sent CAbr invites:', error);
    });

    const qCabrReceived = query(collection(db, 'circuit_assembly_branch_invitations'), where('collaboratorId', '==', userId));
    const unsubscribeCabrReceived = onSnapshot(qCabrReceived, (snap) => {
      setReceivedCabrInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Settings: Error listening to received CAbr invites:', error);
    });

    return () => {
      window.removeEventListener('resize', checkDesktop);
      unsubscribeSent();
      unsubscribeReceived();
      unsubscribeCongressSent();
      unsubscribeCongressReceived();
      unsubscribeCacoSent();
      unsubscribeCacoReceived();
      unsubscribeCabrSent();
      unsubscribeCabrReceived();
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
    } else if (id === 'tjsec_accounts') {
      onViewChange('tjsec_accounts');
    } else if (id === 'microsoft') {
      setIsManagingMicrosoft(true);
    } else if (id === 'passkeys') {
      setIsManagingPasskeys(true);
    } else if (id === 'senha') {
      setIsChangingPassword(true);
    } else if (id === 'invites') {
      setIsManagingInvites(true);
    } else if (id === 'formatar') {
      setIsFormattingAccount(true);
      setFormatStep('confirm');
      setFormatPassword('');
      setFormatError(null);
    } else if (id === 'privacidade') {
      setIsShowingPrivacy(true);
    } else if (id === 'donations') {
      onViewChange('donations');
    } else if (id === 'role_change') {
      setShowRoleChangeModal(true);
    } else {
      showAlert(`Função "${id}" em desenvolvimento para o ProgCir Web.`, 'Em Desenvolvimento');
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
      await showAlert('Erro ao atualizar configuração. Verifique suas permissões.', 'Erro');
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
      await showAlert('Erro ao atualizar configuração. Verifique suas permissões.', 'Erro');
    }
  };

  const handleToggleUploadPermission = async (field: string, currentValue: boolean) => {
    if (!isAdmin) return;
    try {
      const configRef = doc(db, 'config', 'app_settings');
      await setDoc(configRef, { 
        [field]: !currentValue 
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao atualizar configuração global:', err);
      await showAlert('Erro ao atualizar configuração. Verifique suas permissões.', 'Erro');
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

    // Check if user has permission (viajante)
    if (personalData?.role !== 'viajante' && !isAdmin) {
      await showAlert('Apenas viajantes podem enviar convites para Instrutor B.', 'Permissão Negada');
      return;
    }
    
    setInviteLoading(true);
    try {
      const q = query(collection(db, 'personal_data'), where('numeroPessoal', '==', inviteNumber.trim()), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        await showAlert('Usuário não encontrado com este número pessoal.', 'Não Encontrado');
        setInviteLoading(false);
        return;
      }
      
      const instructorData = snap.docs[0].data();
      const instructorId = instructorData.userId;
      
      if (instructorId === auth.currentUser?.uid) {
        await showAlert('Você não pode convidar a si mesmo.', 'Aviso');
        setInviteLoading(false);
        return;
      }
 
      // Check if already invited for this turma
      const existing = pioneerInvites.find(inv => inv.collaboratorId === instructorId && inv.turma === inviteTurma);
      if (existing) {
        await showAlert('Este usuário já possui um convite pendente ou ativo para esta turma.', 'Aviso');
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
      await showAlert('Convite enviado com sucesso!', 'Sucesso');
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

  const handleInviteCongressAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCongressNumber.trim() || inviteCongressLoading) return;
 
    if (personalData?.role !== 'viajante' && !isAdmin) {
      await showAlert('Apenas viajantes podem enviar convites para Assistente de Congresso.', 'Permissão Negada');
      return;
    }
    
    setInviteCongressLoading(true);
    try {
      const q = query(collection(db, 'personal_data'), where('numeroPessoal', '==', inviteCongressNumber.trim()), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        await showAlert('Usuário não encontrado com este número pessoal.', 'Não Encontrado');
        setInviteCongressLoading(false);
        return;
      }
      
      const assistantData = snap.docs[0].data();
      const assistantId = assistantData.userId;
      
      if (assistantId === auth.currentUser?.uid) {
        await showAlert('Você não pode convidar a si mesmo.', 'Aviso');
        setInviteCongressLoading(false);
        return;
      }
 
      const existing = congressInvites.find(inv => inv.collaboratorId === assistantId);
      if (existing) {
        await showAlert('Este usuário já possui um convite pendente ou ativo para o congresso.', 'Aviso');
        setInviteCongressLoading(false);
        return;
      }
 
      await addDoc(collection(db, 'regional_convention_invitations'), {
        ownerId: auth.currentUser?.uid,
        ownerName: personalData?.nome || 'Viajante',
        collaboratorId: assistantId,
        collaboratorNumber: inviteCongressNumber.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setInviteCongressNumber('');
      await showAlert('Convite enviado com sucesso!', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'regional_convention_invitations');
    } finally {
      setInviteCongressLoading(false);
    }
  };

  const handleAcceptCongressInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'regional_convention_invitations', inviteId), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'regional_convention_invitations');
    }
  };

  const handleRejectCongressInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'regional_convention_invitations', inviteId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'regional_convention_invitations');
    }
  };

  const handleRemoveCongressInvite = async (inviteId: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja remover este acesso/convite?', 'Remover Acesso');
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'regional_convention_invitations', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'regional_convention_invitations');
    }
  };

  const handleInviteCacoAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCacoNumber.trim()) return;

    setInviteCacoLoading(true);
    try {
      const q = query(
        collection(db, 'personal_data'), 
        where('numeroPessoal', '==', inviteCacoNumber.trim())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        await showAlert('Nenhum usuário encontrado com este Número Pessoal. Certifique-se de que o assistente já cadastrou seus Dados Pessoais.', 'Usuário não encontrado');
        setInviteCacoLoading(false);
        return;
      }
      
      const assistantData = snap.docs[0].data();
      const assistantId = assistantData.userId;
      
      if (assistantId === auth.currentUser?.uid) {
        await showAlert('Você não pode convidar a si mesmo.', 'Aviso');
        setInviteCacoLoading(false);
        return;
      }
 
      const existing = cacoInvites.find(inv => inv.collaboratorId === assistantId);
      if (existing) {
        await showAlert('Este usuário já possui um convite pendente ou ativo para a assembleia (CAco).', 'Aviso');
        setInviteCacoLoading(false);
        return;
      }
 
      await addDoc(collection(db, 'circuit_assembly_supt_invitations'), {
        ownerId: auth.currentUser?.uid,
        ownerName: personalData?.nome || 'Viajante',
        collaboratorId: assistantId,
        collaboratorNumber: inviteCacoNumber.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setInviteCacoNumber('');
      await showAlert('Convite para assistente da CAco enviado com sucesso!', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'circuit_assembly_supt_invitations');
    } finally {
      setInviteCacoLoading(false);
    }
  };

  const handleAcceptCacoInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'circuit_assembly_supt_invitations', inviteId), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'circuit_assembly_supt_invitations');
    }
  };

  const handleRejectCacoInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'circuit_assembly_supt_invitations', inviteId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'circuit_assembly_supt_invitations');
    }
  };

  const handleRemoveCacoInvite = async (inviteId: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja remover este acesso/convite?', 'Remover Acesso');
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'circuit_assembly_supt_invitations', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'circuit_assembly_supt_invitations');
    }
  };

  const handleInviteCabrAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCabrNumber.trim()) return;

    setInviteCabrLoading(true);
    try {
      const q = query(
        collection(db, 'personal_data'), 
        where('numeroPessoal', '==', inviteCabrNumber.trim())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        await showAlert('Nenhum usuário encontrado com este Número Pessoal. Certifique-se de que o assistente já cadastrou seus Dados Pessoais.', 'Usuário não encontrado');
        setInviteCabrLoading(false);
        return;
      }
      
      const assistantData = snap.docs[0].data();
      const assistantId = assistantData.userId;
      
      if (assistantId === auth.currentUser?.uid) {
        await showAlert('Você não pode convidar a si mesmo.', 'Aviso');
        setInviteCabrLoading(false);
        return;
      }
 
      const existing = cabrInvites.find(inv => inv.collaboratorId === assistantId);
      if (existing) {
        await showAlert('Este usuário já possui um convite pendente ou ativo para a assembleia (CAbr).', 'Aviso');
        setInviteCabrLoading(false);
        return;
      }
 
      await addDoc(collection(db, 'circuit_assembly_branch_invitations'), {
        ownerId: auth.currentUser?.uid,
        ownerName: personalData?.nome || 'Viajante',
        collaboratorId: assistantId,
        collaboratorNumber: inviteCabrNumber.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setInviteCabrNumber('');
      await showAlert('Convite para assistente da CAbr enviado com sucesso!', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'circuit_assembly_branch_invitations');
    } finally {
      setInviteCabrLoading(false);
    }
  };

  const handleAcceptCabrInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'circuit_assembly_branch_invitations', inviteId), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'circuit_assembly_branch_invitations');
    }
  };

  const handleRejectCabrInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'circuit_assembly_branch_invitations', inviteId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'circuit_assembly_branch_invitations');
    }
  };

  const handleRemoveCabrInvite = async (inviteId: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja remover este acesso/convite?', 'Remover Acesso');
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'circuit_assembly_branch_invitations', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'circuit_assembly_branch_invitations');
    }
  };
 
  const handleRemoveInvite = async (inviteId: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja remover este acesso/convite?', 'Remover Acesso');
    if (!confirmed) return;
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
        className="space-y-8 relative pb-20"
      >
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-transparent border border-primary-200/40 dark:border-primary-200/50 text-primary-200 flex items-center justify-center shrink-0">
                <Settings size={20} strokeWidth={1.8} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
                Ajustes
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-typography-500 pl-12">
              Configurações da conta, permissões, ferramentas e integrações do sistema.
            </p>
          </div>
          <button 
            onClick={onBack}
            className="self-start sm:self-center p-2 sm:p-2.5 bg-surface-100 hover:bg-surface-200 text-typography-700 hover:text-typography-900 rounded-2xl border border-surface-300 shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-2 text-xs font-bold"
            title="Fechar Ajustes"
          >
            <X size={18} strokeWidth={2.5} />
            <span className="sm:hidden">Fechar</span>
          </button>
        </div>

        {/* Grid de Opções */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {settingsButtons
            .filter(btn => {
              if ((btn.id === 'usuarios' || btn.id === 'tjsec_accounts') && currentUserRole !== 'admin' && !isAdmin) return false;
              
              if (btn.id === 'pioneer_access' || btn.id === 'congress_access') return false;

              const role = personalData?.role || 'viajante';
              
              if ((role === 'pioneiro_especial' || role === 'pioneiro_regular') && btn.id === 'pastas') {
                return false;
              }
              
              return true;
            })
            .map((btn, index) => {
              const isDisabled = isCreatingFolders;
              return (
                <motion.div
                  key={btn.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => !isDisabled && handleButtonClick(btn.id)}
                  className={cn(
                    "group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-surface-100 border border-surface-300 shadow-xs overflow-hidden transition-all duration-300",
                    isDisabled 
                      ? "opacity-50 cursor-not-allowed grayscale" 
                      : "cursor-pointer hover:border-primary-200 hover:shadow-md hover:-translate-y-0.5"
                  )}
                >
                  {/* Brilho decorativo no canto */}
                  <div 
                    className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                    style={{ backgroundColor: btn.color }}
                  />

                  {/* Barra superior de destaque em gradiente */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundImage: `linear-gradient(to right, ${btn.color}, transparent)` }}
                  />

                  <div className="space-y-4">
                    {/* Top Row: Icon + Badge / Counter */}
                    <div className="flex items-center justify-between">
                      <div 
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 border",
                          btn.iconBorder,
                          btn.iconColor
                        )}
                      >
                        <btn.icon size={22} strokeWidth={1.8} />
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {btn.id === 'tjsec_accounts' && activeTjSecCount !== null && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {activeTjSecCount} ativas
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-500 border border-surface-300">
                          {btn.badge}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-bold text-typography-900 group-hover:text-primary-200 transition-colors">
                        {btn.title}
                      </h3>
                      <p className="text-xs text-typography-500 leading-relaxed line-clamp-2">
                        {btn.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row / Action indicator */}
                  <div className="mt-4 pt-3 border-t border-surface-300/60 flex items-center justify-between text-xs font-semibold text-typography-500 group-hover:text-primary-200 transition-colors">
                    <span>Gerenciar</span>
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.div>
              );
            })}
        </div>

        {isAdmin && (
          <section className="space-y-6 pt-10 border-t border-surface-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-typography-900 tracking-tight">Configurações Globais (Admin)</h3>
                <p className="text-xs text-typography-500">Controles de novidades e permissões para todos os usuários</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-100 p-6 rounded-3xl shadow-xs border border-surface-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-typography-900">Gerenciar Novidades</h4>
                    <p className="text-xs text-typography-500 max-w-md">Configure a mensagem que os usuários verão ao abrir o app pela primeira vez após uma atualização.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => setShowNewsPreview(true)}
                      className="px-4 py-2.5 bg-surface-200 hover:bg-surface-300 text-typography-700 border border-surface-300 font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Eye size={14} />
                      Visualizar
                    </button>
                    <button 
                      onClick={() => setIsManagingNews(true)}
                      className="px-5 py-2.5 bg-primary-200 hover:bg-primary-300 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      Configurar
                    </button>
                  </div>
                </div>
              </div>

              {[
                { id: 'reportEnabledForAll', label: 'Relatório de Pregação', desc: 'Ao ativar esta opção, o Relatório de Pregação ficará visível e utilizável por todos os usuários do circuito. Enquanto desativado, apenas administradores têm acesso.', toggleFn: handleToggleReportVisibility, value: appConfig?.reportEnabledForAll },
                { id: 'congregationImportEnabledForAll', label: 'Importação em Massa', desc: 'Ao ativar esta opção, o botão de Importação em Massa na Gestão de Congregações ficará visível e utilizável por todos os usuários. Enquanto desativado, apenas administradores têm acesso.', toggleFn: handleToggleImportVisibility, value: appConfig?.congregationImportEnabledForAll },
                { id: 'allowESPUploadForAll', label: 'Upload Cartas ESP', desc: 'Permite que usuários enviem novos templates para Cartas ESP. Enquanto desativado, apenas administradores podem gerenciar templates.', value: (appConfig as any)?.allowESPUploadForAll },
                { id: 'allowEMRUploadForAll', label: 'Upload Cartas EMR', desc: 'Permite que usuários enviem novos templates para Cartas EMR. Enquanto desativado, apenas administradores podem gerenciar templates.', value: (appConfig as any)?.allowEMRUploadForAll },
                { id: 'allowCongressoUploadForAll', label: 'Upload Cartas Congresso', desc: 'Permite que usuários enviem novos templates para Cartas Congresso. Enquanto desativado, apenas administradores podem gerenciar templates.', value: (appConfig as any)?.allowCongressoUploadForAll },
                { id: 'allowAssembleiasUploadForAll', label: 'Upload Cartas Assembleias', desc: 'Permite que usuários enviem novos templates para Cartas Assembleias. Enquanto desativado, apenas administradores podem gerenciar templates.', value: (appConfig as any)?.allowAssembleiasUploadForAll },
                { id: 'allowProgramacoesUploadForAll', label: 'Upload Programações', desc: 'Permite que usuários enviem novos templates para Programações. Enquanto desativado, apenas administradores podem gerenciar templates.', value: (appConfig as any)?.allowProgramacoesUploadForAll },
                { id: 'allowPSSUploadForAll', label: 'Upload Workshops PSS', desc: 'Permite que usuários enviem novos templates para Workshops PSS. Enquanto desativado, apenas administradores podem gerenciar templates.', value: (appConfig as any)?.allowPSSUploadForAll },
              ].map((toggle) => (
                <div key={toggle.id} className="bg-surface-100 p-5 sm:p-6 rounded-3xl shadow-xs border border-surface-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-typography-900 text-sm sm:text-base">{toggle.label}</h4>
                      <p className="text-xs text-typography-500 max-w-md">{toggle.desc}</p>
                    </div>
                    
                    <button 
                      onClick={() => toggle.toggleFn ? toggle.toggleFn() : handleToggleUploadPermission(toggle.id, toggle.value)}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-200/50",
                        toggle.value ? "bg-primary-200" : "bg-surface-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm",
                        toggle.value ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pt-10 flex flex-col items-center justify-center space-y-2 opacity-30 select-none no-print">
          <Logo iconSize="w-6 h-6" textSize="text-sm" showText={true} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">v1.5.0</p>
        </div>
      </motion.div>
      
      {/* Manage News Modal */}
      <AnimatePresence>
        {isManagingNews && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsManagingNews(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-surface-100 rounded-3xl sm:rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] my-auto border border-surface-300"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleUpdateNews} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Header */}
                <div className="bg-surface-100 border-b border-surface-300 p-4 sm:p-5 text-typography-900 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-none">Configurar Novidades</h2>
                      <p className="text-[10px] text-typography-500 font-bold uppercase tracking-wider mt-1">Mensagem exibida aos usuários após atualizações</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsManagingNews(false)} 
                    className="hover:bg-surface-200 p-2 rounded-full transition-colors cursor-pointer text-typography-500 hover:text-typography-900"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Form fields with independent scrolling */}
                <div className="overflow-y-auto custom-scrollbar flex-1 p-5 sm:p-6 space-y-5 bg-surface-100 overscroll-contain">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-typography-500 ml-1">Título da Novidade</label>
                    <input 
                      type="text" 
                      value={newsForm.title}
                      onChange={(e) => setNewsForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Nova Função Adicionada!"
                      className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-typography-500 ml-1">Conteúdo da Mensagem</label>
                    <textarea 
                      value={newsForm.content}
                      onChange={(e) => setNewsForm(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Descreva as novidades aqui..."
                      className="w-full px-4 py-3 bg-surface-200 border border-surface-300 rounded-xl text-sm font-medium text-typography-900 placeholder:text-typography-400 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all min-h-[120px] max-h-[220px] resize-y"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-typography-500 ml-1">Versão / ID Único</label>
                    <input 
                      type="text" 
                      value={newsForm.version}
                      onChange={(e) => setNewsForm(prev => ({ ...prev, version: e.target.value }))}
                      placeholder="Ex: v1.1.0 ou reuniao-especial"
                      className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all"
                    />
                    <p className="text-[10px] text-typography-400 font-medium ml-1">Mude este ID para que a mensagem reapareça para quem já viu a versão anterior.</p>
                  </div>

                  <div className="flex items-center justify-between bg-surface-200/60 p-4 rounded-2xl border border-surface-300">
                    <div className="space-y-0.5 pr-4">
                      <p className="text-[11px] font-black uppercase tracking-wider text-typography-900">Exibir Mensagem (Ativa)</p>
                      <p className="text-[10px] font-medium text-typography-500 leading-tight">Define se a janela de novidades será exibida automaticamente no app.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewsForm(prev => ({ ...prev, active: !prev.active }))}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer",
                        newsForm.active ? "bg-primary-200" : "bg-surface-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm",
                        newsForm.active ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>

                {/* Sticky Footer Action Bar */}
                <div className="p-3.5 sm:p-4 bg-surface-100 border-t border-surface-300 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowNewsPreview(true)}
                    className="px-4 py-2.5 bg-surface-200 hover:bg-surface-300 active:scale-95 text-typography-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-surface-300 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={15} />
                    <span className="hidden sm:inline">Visualizar</span> Prévia
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setIsManagingNews(false)}
                      className="px-4 py-2.5 bg-surface-200 hover:bg-surface-300 active:scale-95 text-typography-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-surface-300 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={newsLoading}
                      className="px-5 sm:px-6 py-2.5 bg-primary-200 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-md hover:bg-primary-300 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {newsLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                      <span>Salvar Novidades</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview News Modal */}
      <AnimatePresence>
        {showNewsPreview && (
          <div 
            className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowNewsPreview(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-surface-100 rounded-3xl sm:rounded-[2rem] shadow-2xl max-w-lg w-full flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden border border-surface-300 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-surface-100 border-b border-surface-300 p-4 sm:p-5 text-typography-900 relative shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-200/10 border border-primary-200/30 text-primary-200 flex items-center justify-center shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-typography-900 tracking-tight leading-none">
                          Novidades!
                        </h2>
                        {newsForm.version && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-200 text-typography-700 border border-surface-300 truncate max-w-[120px]">
                            {newsForm.version}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/20">
                          Prévia
                        </span>
                      </div>
                      <p className="text-typography-500 font-bold uppercase tracking-wider text-[10px] mt-1 truncate">
                        Confira o que há de novo no aplicativo
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNewsPreview(false)}
                    className="p-2 hover:bg-surface-200 rounded-full transition-colors shrink-0 text-typography-500 hover:text-typography-900 cursor-pointer active:scale-95"
                    title="Fechar Prévia"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-surface-100 overscroll-contain">
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-snug">
                    {newsForm.title || 'Título da Novidade'}
                  </h3>
                  <div className="w-10 h-1 bg-primary-200 rounded-full" />
                </div>
                
                <div className="text-typography-700 font-medium text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-surface-200/50 p-3.5 sm:p-4 rounded-2xl border border-surface-300">
                  {newsForm.content || 'Nenhum conteúdo inserido ainda. Escreva o texto no formulário para visualizar.'}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-3.5 sm:p-4 bg-surface-100 border-t border-surface-300 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  onClick={() => setShowNewsPreview(false)}
                  className="px-4 py-2.5 sm:py-3 bg-surface-200 hover:bg-surface-300 active:scale-95 text-typography-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-surface-300 transition-all cursor-pointer"
                >
                  Fechar Prévia
                </button>
                <button
                  onClick={() => setShowNewsPreview(false)}
                  className="flex-1 sm:flex-initial px-6 py-2.5 sm:py-3 bg-primary-200 hover:bg-primary-300 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check size={16} strokeWidth={3} />
                  <span>Entendido</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invites Management Modal */}
      <AnimatePresence>
        {isManagingInvites && (
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
              className="bg-surface-100 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden min-h-[600px] max-h-[95vh] border border-surface-300"
            >
              {/* Modal Header/Tabs */}
              <div className="bg-surface-100 px-6 sm:px-8 pt-6 sm:pt-8 border-b border-surface-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-200/10 border border-primary-200/30 text-primary-200 flex items-center justify-center shrink-0">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-typography-900 tracking-tight">Gerenciar Convites</h2>
                      <p className="text-[10px] font-bold text-typography-500 uppercase tracking-widest mt-0.5">Controle de acessos e colaborações</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsManagingInvites(false)}
                    className="p-2 hover:bg-surface-200 rounded-full transition-colors text-typography-500 hover:text-typography-900"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'pioneer', label: 'Instrutor B (ESP)' },
                    { id: 'congress', label: 'Assistente do Congresso' },
                    { id: 'caco', label: 'Assistente CAco' },
                    { id: 'cabr', label: 'Assistente CAbr' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setInviteView(tab.id as any)}
                      className={cn(
                        "pb-4 px-3 sm:px-4 text-xs font-black uppercase tracking-wider transition-all relative shrink-0",
                        inviteView === tab.id ? "text-primary-200" : "text-typography-500 hover:text-typography-900"
                      )}
                    >
                      {tab.label}
                      {inviteView === tab.id && (
                        <motion.div layoutId="inviteTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-200 rounded-t-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-surface-100">
                {inviteView === 'pioneer' ? (
                  <>
                    <div className="w-full md:w-80 bg-surface-100 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-surface-300 flex flex-col items-center">
                      <div className="w-14 h-14 bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mb-5 shrink-0">
                        <UserPlus size={26} />
                      </div>
                      <h3 className="text-base font-bold text-typography-900 mb-2 text-center">Instrutor B (ESP)</h3>
                      
                      {(personalData?.role === 'viajante' || isAdmin) ? (
                        <>
                          <p className="text-xs text-typography-500 mb-6 text-center leading-relaxed">
                            Conceda acesso a outro instrutor. O convidado deve ter seu <span className="font-bold text-typography-900">Número Pessoal</span> preenchido em Dados Pessoais.
                          </p>

                          <form onSubmit={handleInviteInstructor} className="w-full space-y-5">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-typography-500 uppercase tracking-widest ml-1">Turma Escolhida</label>
                              <div className="grid grid-cols-4 gap-2">
                                {['1', '2', '3', 'all'].map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setInviteTurma(t as any)}
                                    className={cn(
                                      "py-2 rounded-xl text-xs font-black transition-all",
                                      inviteTurma === t 
                                        ? "bg-primary-200 text-white shadow-xs scale-105" 
                                        : "bg-surface-200 text-typography-500 hover:bg-surface-300 hover:text-typography-900"
                                    )}
                                  >
                                    {t === 'all' ? 'TODAS' : `T${t}`}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-typography-500 uppercase tracking-widest ml-1">Código de Usuário (B)</label>
                              <input 
                                type="text"
                                required
                                value={inviteNumber}
                                onChange={(e) => setInviteNumber(e.target.value)}
                                placeholder="Ex: 2283701"
                                className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400"
                              />
                            </div>

                            <button 
                              type="submit"
                              disabled={inviteLoading || !inviteNumber.trim()}
                              className="w-full py-3 bg-primary-200 text-white font-bold rounded-2xl hover:bg-primary-300 transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
                            >
                              {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                              Enviar Convite
                            </button>
                          </form>
                        </>
                      ) : (
                        <p className="text-xs text-typography-500 mb-8 text-center leading-relaxed">
                          Você pode gerenciar os convites que recebeu para atuar como Instrutor B na Escola de Pioneiros.
                        </p>
                      )}
                    </div>

                    <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-surface-200/30">
                      <div className="space-y-8">
                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <UserCheck size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Recebidos</h4>
                          </div>

                          {receivedPioneerInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <Mail size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite recebido</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {receivedPioneerInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-primary-200 text-sm">
                                      T{inv.turma}
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-typography-900">C.O. {inv.ownerName}</div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={cn(
                                          "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                                          inv.status === 'accepted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                                          inv.status === 'rejected' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : 
                                          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        )}>
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
                                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                          Aceitar
                                        </button>
                                        <button 
                                          onClick={() => handleRejectInvite(inv.id)}
                                          className="px-4 py-2 bg-surface-200 hover:bg-surface-300 text-typography-700 rounded-xl text-xs font-bold transition-all border border-surface-300"
                                        >
                                          Recusar
                                        </button>
                                      </div>
                                    )}
                                    {inv.status === 'accepted' && (
                                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                        <button 
                                          onClick={() => {
                                            setIsManagingInvites(false);
                                            onViewChange(`pioneer_school_guest:${inv.ownerId}:${inv.turma}`);
                                          }}
                                          className="flex-1 sm:flex-none px-4 py-2 bg-primary-200 hover:bg-primary-300 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                          Acessar Turma
                                        </button>
                                        <button 
                                          onClick={() => handleRemoveInvite(inv.id)}
                                          className="p-2 text-typography-400 hover:text-red-500 transition-colors"
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

                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Mail size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Enviados</h4>
                          </div>

                          {pioneerInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <Users size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite enviado</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {pioneerInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-300 flex items-center justify-between">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-primary-200 text-xs">
                                      T{inv.turma}
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-typography-900">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={cn(
                                        "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border mt-0.5 inline-block",
                                        inv.status === 'accepted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                                        inv.status === 'rejected' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : 
                                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      )}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveInvite(inv.id)}
                                    className="p-2 text-typography-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  </>
                ) : inviteView === 'congress' ? (
                  <>
                    <div className="w-full md:w-80 bg-surface-100 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-surface-300 flex flex-col items-center">
                      <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-5 shrink-0">
                        <UserCheck size={26} />
                      </div>
                      <h3 className="text-base font-bold text-typography-900 mb-2 text-center">Assistente do Congresso</h3>
                      
                      {(personalData?.role === 'viajante' || isAdmin) ? (
                        <>
                          <p className="text-xs text-typography-500 mb-6 text-center leading-relaxed">
                            Conceda acesso a um assistente para colaborar no gerenciamento do congresso.
                          </p>

                          <form onSubmit={handleInviteCongressAssistant} className="w-full space-y-5">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-typography-500 uppercase tracking-widest ml-1">Número Pessoal do Assistente</label>
                              <input 
                                type="text"
                                required
                                value={inviteCongressNumber}
                                onChange={(e) => setInviteCongressNumber(e.target.value)}
                                placeholder="Ex: 2283701"
                                className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400"
                              />
                            </div>

                            <button 
                              type="submit"
                              disabled={inviteCongressLoading || !inviteCongressNumber.trim()}
                              className="w-full py-3 bg-primary-200 text-white font-bold rounded-2xl hover:bg-primary-300 transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
                            >
                              {inviteCongressLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                              Enviar Convite
                            </button>
                          </form>
                        </>
                      ) : (
                        <p className="text-xs text-typography-500 mb-8 text-center leading-relaxed">
                          Você pode gerenciar os convites recebidos para atuar como Assistente no Congresso Regional.
                        </p>
                      )}
                    </div>

                    <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-surface-200/30">
                      <div className="space-y-8">
                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <UserCheck size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Recebidos</h4>
                          </div>

                          {receivedCongressInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <Mail size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite recebido</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {receivedCongressInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-primary-200">
                                      <Landmark size={20} />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-typography-900">C.O. {inv.ownerName}</div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={cn(
                                          "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                                          inv.status === 'accepted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                                          inv.status === 'rejected' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : 
                                          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        )}>
                                          {inv.status === 'accepted' ? 'Aceito' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 w-full sm:w-auto">
                                    {inv.status === 'pending' && (
                                      <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                        <button 
                                          onClick={() => handleAcceptCongressInvite(inv.id)}
                                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                          Aceitar
                                        </button>
                                        <button 
                                          onClick={() => handleRejectCongressInvite(inv.id)}
                                          className="px-4 py-2 bg-surface-200 hover:bg-surface-300 text-typography-700 rounded-xl text-xs font-bold transition-all border border-surface-300"
                                        >
                                          Recusar
                                        </button>
                                      </div>
                                    )}
                                    {inv.status === 'accepted' && (
                                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                        <button 
                                          onClick={() => {
                                            setIsManagingInvites(false);
                                            onViewChange(`regional_convention_guest:${inv.ownerId}`);
                                          }}
                                          className="flex-1 sm:flex-none px-4 py-2 bg-primary-200 hover:bg-primary-300 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                          Acessar Congresso
                                        </button>
                                        <button 
                                          onClick={() => handleRemoveCongressInvite(inv.id)}
                                          className="p-2 text-typography-400 hover:text-red-500 transition-colors"
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

                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Mail size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Enviados</h4>
                          </div>

                          {congressInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <Users size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite enviado</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {congressInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-300 flex items-center justify-between">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-primary-200 text-xs">
                                      <Landmark size={18} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-typography-900">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={cn(
                                        "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border mt-0.5 inline-block",
                                        inv.status === 'accepted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                                        inv.status === 'rejected' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : 
                                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      )}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCongressInvite(inv.id)}
                                    className="p-2 text-typography-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  </>
                ) : inviteView === 'caco' ? (
                  <>
                    <div className="w-full md:w-80 bg-surface-100 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-surface-300 flex flex-col items-center">
                      <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-5 shrink-0">
                        <CalendarDays size={26} />
                      </div>
                      <h3 className="text-base font-bold text-typography-900 mb-2 text-center">Assistente CAco</h3>
                      <p className="text-xs text-typography-500 text-center mb-6 leading-relaxed">Convide um irmão para colaborar na Assembleia com o Superintendente de Circuito.</p>

                      <form onSubmit={handleInviteCacoAssistant} className="w-full space-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-typography-500 uppercase tracking-widest ml-1">Nº Pessoal do Assistente</label>
                          <input 
                            type="text"
                            value={inviteCacoNumber}
                            onChange={(e) => setInviteCacoNumber(e.target.value)}
                            placeholder="Ex: 123456"
                            className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400 text-center"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={inviteCacoLoading || !inviteCacoNumber.trim()}
                          className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {inviteCacoLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                          Enviar Convite
                        </button>
                      </form>
                    </div>

                    <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-surface-200/30">
                      <div className="space-y-8">
                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <CalendarDays size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Recebidos (CAco)</h4>
                          </div>

                          {receivedCacoInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite recebido</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {receivedCacoInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-amber-600 dark:text-amber-400">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-typography-900">Convidado por: {inv.ownerName || 'Superintendente'}</div>
                                      <div className="text-xs text-typography-500">Assembleia de Circuito (CAco)</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {inv.status === 'pending' ? (
                                      <>
                                        <button 
                                          onClick={() => handleAcceptCacoInvite(inv.id)}
                                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                          Aceitar
                                        </button>
                                        <button 
                                          onClick={() => handleRejectCacoInvite(inv.id)}
                                          className="px-3.5 py-1.5 bg-surface-200 hover:bg-surface-300 text-typography-700 border border-surface-300 rounded-xl text-xs font-bold transition-all"
                                        >
                                          Recusar
                                        </button>
                                      </>
                                    ) : inv.status === 'accepted' ? (
                                      <button 
                                        onClick={() => {
                                          setIsManagingInvites(false);
                                          onViewChange(`circuit_assembly_supt_guest:${inv.ownerId}`);
                                        }}
                                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                      >
                                        <CalendarDays size={14} />
                                        Acessar CAco
                                      </button>
                                    ) : (
                                      <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-lg">Recusado</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>

                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Mail size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Enviados (CAco)</h4>
                          </div>

                          {cacoInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <Users size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite enviado</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {cacoInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-amber-600 dark:text-amber-400">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-typography-900">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={cn(
                                        "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border mt-0.5 inline-block",
                                        inv.status === 'accepted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                                        inv.status === 'rejected' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : 
                                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      )}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCacoInvite(inv.id)}
                                    className="p-2 text-typography-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full md:w-80 bg-surface-100 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-surface-300 flex flex-col items-center">
                      <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-5 shrink-0">
                        <CalendarDays size={26} />
                      </div>
                      <h3 className="text-base font-bold text-typography-900 mb-2 text-center">Assistente CAbr</h3>
                      <p className="text-xs text-typography-500 text-center mb-6 leading-relaxed">Convide um irmão para colaborar na Assembleia com Representante de Betel.</p>

                      <form onSubmit={handleInviteCabrAssistant} className="w-full space-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-typography-500 uppercase tracking-widest ml-1">Nº Pessoal do Assistente</label>
                          <input 
                            type="text"
                            value={inviteCabrNumber}
                            onChange={(e) => setInviteCabrNumber(e.target.value)}
                            placeholder="Ex: 123456"
                            className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400 text-center"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={inviteCabrLoading || !inviteCabrNumber.trim()}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {inviteCabrLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                          Enviar Convite
                        </button>
                      </form>
                    </div>

                    <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-surface-200/30">
                      <div className="space-y-8">
                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CalendarDays size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Recebidos (CAbr)</h4>
                          </div>

                          {receivedCabrInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite recebido</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {receivedCabrInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-typography-900">Convidado por: {inv.ownerName || 'Superintendente'}</div>
                                      <div className="text-xs text-typography-500">Assembleia de Circuito (CAbr)</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {inv.status === 'pending' ? (
                                      <>
                                        <button 
                                          onClick={() => handleAcceptCabrInvite(inv.id)}
                                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                          Aceitar
                                        </button>
                                        <button 
                                          onClick={() => handleRejectCabrInvite(inv.id)}
                                          className="px-3.5 py-1.5 bg-surface-200 hover:bg-surface-300 text-typography-700 border border-surface-300 rounded-xl text-xs font-bold transition-all"
                                        >
                                          Recusar
                                        </button>
                                      </>
                                    ) : inv.status === 'accepted' ? (
                                      <button 
                                        onClick={() => {
                                          setIsManagingInvites(false);
                                          onViewChange(`circuit_assembly_branch_guest:${inv.ownerId}`);
                                        }}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                      >
                                        <CalendarDays size={14} />
                                        Acessar CAbr
                                      </button>
                                    ) : (
                                      <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-lg">Recusado</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>

                        <section>
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Mail size={18} />
                            </div>
                            <h4 className="font-bold text-sm text-typography-900 uppercase tracking-wider">Convites Enviados (CAbr)</h4>
                          </div>

                          {cabrInvites.length === 0 ? (
                            <div className="bg-surface-100 rounded-3xl p-8 border border-surface-300 text-center text-typography-400 border-dashed">
                              <Users size={32} className="mx-auto mb-3 opacity-30" />
                              <p className="text-xs font-bold uppercase tracking-wider">Nenhum convite enviado</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {cabrInvites.map((inv) => (
                                <div key={inv.id} className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-typography-900">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={cn(
                                        "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border mt-0.5 inline-block",
                                        inv.status === 'accepted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                                        inv.status === 'rejected' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : 
                                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      )}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCabrInvite(inv.id)}
                                    className="p-2 text-typography-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  </>
                )}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-surface-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <h3 className="text-lg font-black text-typography-900 tracking-tight">Formatar Conta</h3>
                </div>
                <button 
                  onClick={() => !isProcessing && setIsFormattingAccount(false)}
                  className="p-2 hover:bg-surface-200 rounded-full transition-colors text-typography-500 hover:text-typography-900"
                >
                  <X size={20} />
                </button>
              </div>

              {formatStep === 'success' ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="font-bold text-emerald-600">Conta formatada com sucesso!</p>
                  <p className="text-sm text-typography-500 text-center">Reiniciando o sistema...</p>
                </div>
              ) : formatStep === 'formatting' ? (
                <div className="text-center py-8 space-y-4">
                  <Loader2 size={48} className="text-primary-200 animate-spin mx-auto" />
                  <p className="font-bold text-typography-900">Formatando dados...</p>
                  <p className="text-sm text-typography-500">Isso pode levar alguns segundos.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-1" size={20} />
                    <div className="space-y-1">
                      <p className="font-bold text-red-600 dark:text-red-400 text-sm">Atenção!</p>
                      <p className="text-typography-600 text-xs leading-relaxed">
                        Esta ação apagará <strong>todos os seus dados</strong> (congregações, itinerários, relatórios, etc). 
                        Sua conta de acesso continuará existindo, mas estará vazia como se fosse o primeiro acesso.
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-typography-600 font-medium text-center">
                    Tem certeza que deseja formatar sua conta?
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-typography-500 uppercase ml-1">Confirme sua Senha</label>
                      <input 
                        type="password"
                        required
                        value={formatPassword}
                        onChange={(e) => setFormatPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400"
                      />
                    </div>

                    {formatError && (
                      <div className="p-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle size={16} />
                        {formatError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleFormatAccount}
                        className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Trash2 size={18} />
                        Sim, Formatar Tudo
                      </button>
                      <button 
                        onClick={() => setIsFormattingAccount(false)}
                        className="w-full py-2.5 bg-surface-200 text-typography-700 font-bold rounded-xl hover:bg-surface-300 transition-colors border border-surface-300 cursor-pointer"
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

      {/* Microsoft Connection Modal */}
      <AnimatePresence>
        {isManagingMicrosoft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsManagingMicrosoft(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-100 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-surface-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <MailCheck size={18} />
                    </div>
                    <h3 className="text-lg font-black text-typography-900 tracking-tight">Conexão Microsoft</h3>
                  </div>
                  <button 
                    onClick={() => setIsManagingMicrosoft(false)}
                    className="p-2 hover:bg-surface-200 rounded-full transition-colors text-typography-500 hover:text-typography-900"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <MicrosoftConnectionSettings />

                <button
                  onClick={() => setIsManagingMicrosoft(false)}
                  className="w-full py-3 text-xs font-black text-typography-500 uppercase tracking-widest hover:text-typography-900 transition-colors bg-surface-200 hover:bg-surface-300 rounded-xl border border-surface-300 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WebAuthn / Passkeys Modal */}
      <AnimatePresence>
        {isManagingPasskeys && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsManagingPasskeys(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-100 w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-surface-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixo do Modal */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-surface-300 shrink-0 bg-surface-100">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-typography-900 tracking-tight truncate">Chaves de acesso (Passkeys)</h3>
                    <p className="text-[11px] sm:text-xs text-typography-500 truncate">Acesse sua conta sem senha com biometria ou PIN</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManagingPasskeys(false)}
                  className="p-1.5 sm:p-2 hover:bg-surface-200 text-typography-500 hover:text-typography-900 rounded-full transition-colors shrink-0"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Conteúdo com rolagem suave */}
              <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain bg-surface-200/30">
                <WebAuthnSettings isInsideModal={true} />
              </div>

              {/* Rodapé fixo do Modal */}
              <div className="px-5 sm:px-6 py-3.5 bg-surface-100 border-t border-surface-300 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setIsManagingPasskeys(false)}
                  className="px-5 py-2 text-xs font-bold text-typography-700 bg-surface-200 hover:bg-surface-300 rounded-xl transition-all active:scale-95 border border-surface-300 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-surface-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                    <Lock size={18} />
                  </div>
                  <h3 className="text-lg font-black text-typography-900 tracking-tight">Alterar Senha</h3>
                </div>
                <button 
                  onClick={() => setIsChangingPassword(false)}
                  className="p-2 hover:bg-surface-200 rounded-full transition-colors text-typography-500 hover:text-typography-900"
                >
                  <X size={20} />
                </button>
              </div>

              {passwordSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="font-bold text-emerald-600">Senha alterada com sucesso!</p>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-typography-500 uppercase ml-1">Senha Atual</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-typography-500 uppercase ml-1">Nova Senha</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-typography-500 uppercase ml-1">Confirmar Nova Senha</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 rounded-xl focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 outline-none transition-all text-sm font-bold text-typography-900 placeholder:text-typography-400"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle size={16} />
                      {passwordError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full py-3 bg-primary-200 text-white font-bold rounded-xl hover:bg-primary-300 transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {passwordLoading ? <Loader2 size={18} className="animate-spin" /> : 'Atualizar Senha'}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <div className="bg-surface-100 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6 border border-surface-300">
              <div className="w-16 h-16 bg-primary-200/10 border border-primary-200/30 rounded-2xl flex items-center justify-center mx-auto text-primary-200">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-typography-900">
                  {error ? 'Ação Necessária' : 'Criando Estrutura'}
                </h3>
                <p className={`${error ? 'text-red-500' : 'text-typography-500'} text-xs leading-relaxed`}>
                  {error || creationStep}
                </p>
              </div>
              {!error && (
                <div className="w-full bg-surface-200 h-2 rounded-full overflow-hidden border border-surface-300">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 10, ease: "linear" }}
                    className="bg-primary-200 h-full"
                  />
                </div>
              )}
              {error && (
                <div className="flex flex-col gap-3 w-full">
                  {isIframe && (
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="w-full py-2.5 bg-primary-200 text-white font-bold rounded-xl hover:bg-primary-300 transition-colors shadow-xs"
                    >
                      Abrir em Nova Aba
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setIsCreatingFolders(false);
                      setError(null);
                    }}
                    className="w-full py-2.5 bg-surface-200 text-typography-700 font-bold rounded-xl hover:bg-surface-300 transition-colors border border-surface-300"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-100 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar border border-surface-300"
            >
              <div className="flex items-center justify-between sticky top-0 bg-surface-100 pb-4 border-b border-surface-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-typography-900 tracking-tight">Privacidade e LGPD</h3>
                    <p className="text-[10px] text-typography-500 font-bold uppercase tracking-widest">Proteção e transparência de dados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsShowingPrivacy(false)}
                  className="p-2 hover:bg-surface-200 rounded-full transition-colors text-typography-500 hover:text-typography-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 text-xs sm:text-sm text-typography-600 leading-relaxed">
                <section className="space-y-1.5">
                  <h4 className="font-bold text-typography-900 uppercase tracking-wider text-xs">Compromisso com a Privacidade</h4>
                  <p>
                    O ProgCir Web está comprometido com a proteção dos dados pessoais processados no sistema, em total conformidade com a 
                    <strong> Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h4 className="font-bold text-typography-900 uppercase tracking-wider text-xs">Finalidade do Processamento</h4>
                  <p>
                    Os dados coletados (como nomes de congregações, oradores, itinerários e relatórios de serviço) são utilizados exclusivamente para 
                    fins de organização e gestão das atividades do circuito. Não compartilhamos esses dados com terceiros para fins comerciais.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h4 className="font-bold text-typography-900 uppercase tracking-wider text-xs">Seus Direitos</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Acesso:</strong> Você tem total acesso aos dados que insere no sistema.</li>
                    <li><strong>Correção:</strong> Você pode editar qualquer informação a qualquer momento através das telas de gestão.</li>
                    <li><strong>Exclusão:</strong> Você pode apagar todos os seus dados permanentemente usando a função "Formatar Conta" nestes Ajustes.</li>
                    <li><strong>Portabilidade:</strong> Você pode exportar seus dados através das funções de impressão e geração de PDF.</li>
                  </ul>
                </section>

                <section className="space-y-1.5">
                  <h4 className="font-bold text-typography-900 uppercase tracking-wider text-xs">Segurança</h4>
                  <p>
                    Utilizamos a infraestrutura do Google Firebase para armazenamento seguro, com criptografia em trânsito e em repouso. 
                    O acesso aos dados é restrito ao seu usuário autenticado via Google Auth.
                  </p>
                </section>

                <div className="p-4 bg-surface-200/60 rounded-2xl border border-surface-300 flex items-center justify-between">
                  <span className="text-xs text-typography-600 font-medium">Para mais informações sobre a lei vigente:</span>
                  <button 
                    onClick={() => window.open('https://www.gov.br/esporte/pt-br/acesso-a-informacao/lgpd', '_blank')}
                    className="flex items-center gap-1 text-primary-200 font-bold text-xs hover:underline"
                  >
                    Portal LGPD <ExternalLink size={14} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-300">
                <button 
                  onClick={() => setIsShowingPrivacy(false)}
                  className="w-full py-3 bg-primary-200 text-white font-bold rounded-xl hover:bg-primary-300 transition-colors shadow-xs cursor-pointer"
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

      <AnimatePresence>
        {showRoleChangeModal && (
          <RoleChangeRequestModal 
            userId={userId}
            currentRole={personalData?.role || 'viajante'}
            userName={personalData?.nome || ''}
            onClose={() => setShowRoleChangeModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
