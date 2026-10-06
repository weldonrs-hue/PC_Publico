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
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import MicrosoftConnectionSettings from '@/components/MicrosoftConnectionSettings';
import WebAuthnSettings from '@/components/WebAuthnSettings';
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
    title: 'INSTRUTOR B (ESP)',
    subtitle: 'ACESSO ESCOLA PIONEIROS',
    color: '#37616b',
    gradient: 'from-[#37616b] to-[#2c4d55]'
  },
  {
    id: 'congress_access',
    icon: UserCheck,
    title: 'ASSISTENTE DO CONGRESSO',
    subtitle: 'ACESSO AO CONGRESSO',
    color: '#512da8',
    gradient: 'from-[#512da8] to-[#4527a0]'
  },
  {
    id: 'invites',
    icon: Mail,
    title: 'CONVITES',
    subtitle: 'GERENCIAR ACESSOS',
    color: '#3b82f6',
    gradient: 'from-[#3b82f6] to-[#2563eb]'
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
    id: 'role_change',
    icon: RefreshCw,
    title: 'ALTERAR CATEGORIA',
    subtitle: 'SOLICITAR MUDANÇA AO ADMIN',
    color: '#6c40bd',
    gradient: 'from-[#6c40bd] to-[#4c1d95]'
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
    id: 'tjsec_accounts',
    icon: Landmark,
    title: 'CONTAS TJSEC',
    subtitle: 'CONTAS DAS CONGREGAÇÕES',
    color: '#059669',
    gradient: 'from-[#059669] to-[#047857]'
  },
  {
    id: 'microsoft',
    icon: MailCheck,
    title: 'CONTA MICROSOFT',
    subtitle: 'CONEXÃO JW / OAUTH',
    color: '#2b579a',
    gradient: 'from-[#2b579a] to-[#1e3a63]'
  },
  {
    id: 'passkeys',
    icon: Key,
    title: 'CHAVES DE ACESSO',
    subtitle: 'PASSKEYS / BIOMETRIA',
    color: '#6366f1',
    gradient: 'from-[#6366f1] to-[#4f46e5]'
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
  },
  {
    id: 'donations',
    icon: Coffee,
    title: 'APOIO',
    subtitle: 'APOIE O PROJETO',
    color: '#8b5cf6',
    gradient: 'from-[#8b5cf6] to-[#7c3aed]'
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
          userEmail === 'weldonrs@gmail.com' || 
          userEmail === '2283701@progcir.app' ||
          userEmail === '2283701@progcir.com';
        
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef).catch(err => {
          console.warn('SettingsView: Failed to fetch user profile, using email for role check:', err);
          return null;
        });

        if (userDocSnap && userDocSnap.exists()) {
          const data = userDocSnap.data();
          setCurrentUserRole(isAdminEmail ? 'admin' : (data.role || 'user'));
        } else {
          setCurrentUserRole(isAdminEmail ? 'admin' : 'user');
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
        className="space-y-8 relative"
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Ajustes do Sistema</h2>
          <button 
            onClick={onBack}
            className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl border border-red-100 transition-all flex items-center justify-center shadow-lg active:scale-95 shrink-0"
            title="Fechar"
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {settingsButtons
            .filter(btn => {
              if ((btn.id === 'usuarios' || btn.id === 'tjsec_accounts') && currentUserRole !== 'admin') return false;
              
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => !isDisabled && handleButtonClick(btn.id)}
                  className={`relative group h-20 ${
                    isDisabled 
                      ? 'cursor-not-allowed grayscale-[0.8] opacity-60' 
                      : 'cursor-pointer'
                  }`}
                >
                  {/* Background Glow */}
                  {!isDisabled && (
                    <div 
                      className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl"
                      style={{ backgroundColor: btn.color }}
                    />
                  )}
                  
                  <div className="relative flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
                    <div className={`w-1.5 h-full bg-gradient-to-b ${btn.gradient} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                    <div className="flex-1 flex items-center px-4 gap-4">
                      <div 
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 ${
                          isDisabled 
                            ? 'bg-gray-100 text-gray-400' 
                            : `bg-gradient-to-br ${btn.gradient} group-hover:scale-105 group-hover:rotate-2`
                        }`}
                      >
                        <btn.icon size={22} strokeWidth={2.5} className={`${isDisabled ? 'text-gray-300' : 'text-white drop-shadow-md'}`} />
                      </div>
                      <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                        <div className={`font-black text-[10px] md:text-xs leading-tight uppercase mb-0.5 transition-colors ${isDisabled ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                          {btn.title}
                        </div>
                        <div className={`text-[8px] font-bold uppercase tracking-widest transition-opacity ${isDisabled ? 'text-gray-300' : 'text-gray-400 opacity-60 group-hover:opacity-100'}`}>
                          {btn.subtitle}
                        </div>
                        {btn.id === 'tjsec_accounts' && activeTjSecCount !== null && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight">{activeTjSecCount} Contas Ativas</span>
                          </div>
                        )}
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
              <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-gray-900">Gerenciar Novidades</h4>
                    <p className="text-xs text-gray-500 max-w-md">Configure a mensagem que os usuários verão ao abrir o app pela primeira vez após uma atualização.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => setShowNewsPreview(true)}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Eye size={14} />
                      Visualizar
                    </button>
                    <button 
                      onClick={() => setIsManagingNews(true)}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
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
                <div key={toggle.id} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-900">{toggle.label}</h4>
                      <p className="text-xs text-gray-500 max-w-md">{toggle.desc}</p>
                    </div>
                    
                    <button 
                      onClick={() => toggle.toggleFn ? toggle.toggleFn() : handleToggleUploadPermission(toggle.id, toggle.value)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-amber-200 ${toggle.value ? 'bg-amber-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${toggle.value ? 'translate-x-7' : 'translate-x-0'} shadow-md`} />
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsManagingNews(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl sm:rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] my-auto border border-amber-200/60"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleUpdateNews} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600 to-amber-500 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <AlertCircle size={22} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black uppercase tracking-widest leading-none">Configurar Novidades</h2>
                      <p className="text-[10px] text-amber-100/90 font-bold uppercase tracking-wider mt-0.5">Mensagem exibida aos usuários após atualizações</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsManagingNews(false)} 
                    className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer text-white/90 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Form fields with independent scrolling */}
                <div className="overflow-y-auto custom-scrollbar flex-1 p-5 sm:p-6 space-y-5 bg-white overscroll-contain">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Título da Novidade</label>
                    <input 
                      type="text" 
                      value={newsForm.title}
                      onChange={(e) => setNewsForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Nova Função Adicionada!"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-amber-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Conteúdo da Mensagem</label>
                    <textarea 
                      value={newsForm.content}
                      onChange={(e) => setNewsForm(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Descreva as novidades aqui..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-500 outline-none transition-all min-h-[120px] max-h-[220px] resize-y"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Versão / ID Único</label>
                    <input 
                      type="text" 
                      value={newsForm.version}
                      onChange={(e) => setNewsForm(prev => ({ ...prev, version: e.target.value }))}
                      placeholder="Ex: v1.1.0 ou reuniao-especial"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-amber-500 outline-none transition-all"
                    />
                    <p className="text-[10px] text-gray-400 font-medium ml-1">Mude este ID para que a mensagem reapareça para quem já viu a versão anterior.</p>
                  </div>

                  <div className="flex items-center justify-between bg-amber-50/70 p-4 rounded-2xl border border-amber-200/60">
                    <div className="space-y-0.5 pr-4">
                      <p className="text-[11px] font-black uppercase tracking-wider text-amber-950">Exibir Mensagem (Ativa)</p>
                      <p className="text-[10px] font-medium text-amber-800/80 leading-tight">Define se a janela de novidades será exibida automaticamente no app.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewsForm(prev => ({ ...prev, active: !prev.active }))}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer ${newsForm.active ? 'bg-amber-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${newsForm.active ? 'translate-x-6' : 'translate-x-0'} shadow-sm`} />
                    </button>
                  </div>
                </div>

                {/* Sticky Footer Action Bar */}
                <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowNewsPreview(true)}
                    className="px-4 py-2.5 bg-white hover:bg-gray-100 active:scale-95 text-amber-800 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={15} />
                    <span className="hidden sm:inline">Visualizar</span> Prévia
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setIsManagingNews(false)}
                      className="px-4 py-2.5 bg-white hover:bg-gray-100 active:scale-95 text-gray-600 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-200 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={newsLoading}
                      className="px-5 sm:px-6 py-2.5 bg-amber-600 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
              className="bg-white rounded-3xl sm:rounded-[2rem] shadow-2xl max-w-lg w-full flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden border border-amber-200/80 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-amber-600 p-4 sm:p-5 text-white relative shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md shadow-sm shrink-0">
                      <Sparkles size={22} className="text-amber-100" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest leading-none">
                          Novidades!
                        </h2>
                        {newsForm.version && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-amber-50 border border-white/30 truncate max-w-[120px]">
                            {newsForm.version}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/20 text-amber-100">
                          Prévia
                        </span>
                      </div>
                      <p className="text-amber-100/90 font-bold uppercase tracking-wider text-[10px] mt-0.5 truncate">
                        Confira o que há de novo no aplicativo
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNewsPreview(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0 text-white/90 hover:text-white cursor-pointer active:scale-95"
                    title="Fechar Prévia"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-white overscroll-contain">
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-snug">
                    {newsForm.title || 'Título da Novidade'}
                  </h3>
                  <div className="w-10 h-1 bg-amber-500 rounded-full" />
                </div>
                
                <div className="text-gray-700 font-medium text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-amber-50/40 p-3.5 sm:p-4 rounded-2xl border border-amber-100/70">
                  {newsForm.content || 'Nenhum conteúdo inserido ainda. Escreva o texto no formulário para visualizar.'}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  onClick={() => setShowNewsPreview(false)}
                  className="px-4 py-2.5 sm:py-3 bg-white hover:bg-gray-100 active:scale-95 text-gray-600 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-200 transition-all cursor-pointer"
                >
                  Fechar Prévia
                </button>
                <button
                  onClick={() => setShowNewsPreview(false)}
                  className="flex-1 sm:flex-initial px-6 py-2.5 sm:py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
              className="bg-gray-50 rounded-[2.5rem] w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden min-h-[600px] max-h-[95vh]"
            >
              {/* Modal Header/Tabs */}
              <div className="bg-white px-8 pt-8 border-b border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Gerenciar Convites</h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Controle de acessos e colaborações</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsManagingInvites(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setInviteView('pioneer')}
                    className={`pb-4 px-3 sm:px-4 text-xs font-black uppercase tracking-widest transition-all relative shrink-0 ${
                      inviteView === 'pioneer' ? 'text-[#37616b]' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Instrutor B (ESP)
                    {inviteView === 'pioneer' && (
                      <motion.div layoutId="inviteTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#37616b] rounded-t-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setInviteView('congress')}
                    className={`pb-4 px-3 sm:px-4 text-xs font-black uppercase tracking-widest transition-all relative shrink-0 ${
                      inviteView === 'congress' ? 'text-[#512da8]' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Assistente do Congresso
                    {inviteView === 'congress' && (
                      <motion.div layoutId="inviteTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#512da8] rounded-t-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setInviteView('caco')}
                    className={`pb-4 px-3 sm:px-4 text-xs font-black uppercase tracking-widest transition-all relative shrink-0 ${
                      inviteView === 'caco' ? 'text-amber-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Assistente CAco
                    {inviteView === 'caco' && (
                      <motion.div layoutId="inviteTab" className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600 rounded-t-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setInviteView('cabr')}
                    className={`pb-4 px-3 sm:px-4 text-xs font-black uppercase tracking-widest transition-all relative shrink-0 ${
                      inviteView === 'cabr' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Assistente CAbr
                    {inviteView === 'cabr' && (
                      <motion.div layoutId="inviteTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {inviteView === 'pioneer' ? (
                  <>
                    <div className="w-full md:w-80 bg-white p-8 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col items-center">
                      <div className="w-16 h-16 bg-[#37616b]/10 rounded-2xl flex items-center justify-center mb-6">
                        <UserPlus className="text-[#37616b]" size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2 text-center uppercase">Instrutor B (ESP)</h3>
                      
                      {(personalData?.role === 'viajante' || isAdmin) ? (
                        <>
                          <p className="text-[10px] text-gray-500 mb-8 text-center leading-relaxed">
                            Conceda acesso a outro instrutor. <br/>
                            <span className="font-bold text-[#37616b]">Importante:</span> O convidado deve primeiro cadastrar seu <span className="font-bold">Número Pessoal</span> na seção "Dados Pessoais" para ser encontrado.
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
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-500 mb-8 text-center leading-relaxed">
                          Você pode gerenciar os convites que recebeu para atuar como Instrutor B na Escola de Pioneiros.
                        </p>
                      )}
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                      <div className="space-y-10">
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
                                            onClick={() => {
                                              setIsManagingInvites(false);
                                              onViewChange(`pioneer_school_guest:${inv.ownerId}:${inv.turma}`);
                                            }}
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
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-black text-[#37616b] text-xs">
                                      T{inv.turma}
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-gray-800">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                        inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 
                                        inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                      }`}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveInvite(inv.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
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
                    <div className="w-full md:w-80 bg-white p-8 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col items-center">
                      <div className="w-16 h-16 bg-[#512da8]/10 rounded-2xl flex items-center justify-center mb-6">
                        <UserCheck className="text-[#512da8]" size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2 text-center uppercase">Assistente do Congresso</h3>
                      
                      {(personalData?.role === 'viajante' || isAdmin) ? (
                        <>
                          <p className="text-[10px] text-gray-500 mb-8 text-center leading-relaxed">
                            Conceda acesso a um assistente para ajudar no gerenciamento do congresso.
                          </p>

                          <form onSubmit={handleInviteCongressAssistant} className="w-full space-y-6">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Número Pessoal do Assistente</label>
                              <input 
                                type="text"
                                required
                                value={inviteCongressNumber}
                                onChange={(e) => setInviteCongressNumber(e.target.value)}
                                placeholder="Ex: 2283701"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#512da8] focus:ring-2 focus:ring-[#512da8]/10 outline-none transition-all text-sm font-bold"
                              />
                            </div>

                            <button 
                              type="submit"
                              disabled={inviteCongressLoading || !inviteCongressNumber.trim()}
                              className="w-full py-4 bg-[#512da8] text-white font-black rounded-2xl hover:bg-[#4527a0] transition-all shadow-xl shadow-[#512da8]/20 flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest"
                            >
                              {inviteCongressLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                              Enviar Convite
                            </button>
                          </form>
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-500 mb-8 text-center leading-relaxed">
                          Você pode gerenciar os convites que recebeu para atuar como Assistente no Congresso Regional.
                        </p>
                      )}
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                      <div className="space-y-10">
                        <section>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                              <UserCheck size={20} />
                            </div>
                            <h4 className="font-black text-sm text-gray-800 uppercase tracking-widest">Convites Recebidos</h4>
                          </div>

                          {receivedCongressInvites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 border-dashed">
                              <Mail size={32} className="mx-auto mb-3 opacity-20" />
                              <p className="text-xs font-bold uppercase tracking-widest">Nenhum convite recebido</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4">
                              {receivedCongressInvites.map((inv) => (
                                <div key={inv.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-[#512da8] transition-all">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-[#512da8]">
                                      <Landmark size={24} />
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
                                           onClick={() => handleAcceptCongressInvite(inv.id)}
                                           className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                                         >
                                           Aceitar
                                         </button>
                                         <button 
                                           onClick={() => handleRejectCongressInvite(inv.id)}
                                           className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
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
                                            className="flex-1 sm:flex-none px-4 py-2 bg-[#512da8] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4527a0] transition-all"
                                         >
                                            Acessar Congresso
                                         </button>
                                         <button 
                                           onClick={() => handleRemoveCongressInvite(inv.id)}
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

                        <section>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                              <Mail size={20} />
                            </div>
                            <h4 className="font-black text-sm text-gray-800 uppercase tracking-widest">Convites Enviados</h4>
                          </div>

                          {congressInvites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 border-dashed">
                              <Users size={32} className="mx-auto mb-3 opacity-20" />
                              <p className="text-xs font-bold uppercase tracking-widest">Nenhum convite enviado</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4">
                              {congressInvites.map((inv) => (
                                <div key={inv.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-black text-[#512da8] text-xs">
                                      <Landmark size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-gray-800">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                        inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 
                                        inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                      }`}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCongressInvite(inv.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
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
                    <div className="w-full md:w-80 bg-white p-8 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col items-center">
                      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                        <CalendarDays className="text-amber-600" size={32} />
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-2 text-center">Assistente CAco</h3>
                      <p className="text-xs text-gray-400 text-center mb-8">Convide um irmão para colaborar na Assembleia com o Superintendente de Circuito.</p>

                      <form onSubmit={handleInviteCacoAssistant} className="w-full space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nº Pessoal do Assistente</label>
                          <input 
                            type="text"
                            value={inviteCacoNumber}
                            onChange={(e) => setInviteCacoNumber(e.target.value)}
                            placeholder="Ex: 123456"
                            className="w-full h-12 bg-gray-50 border border-gray-200 rounded-2xl px-4 text-xs font-bold text-gray-700 outline-none focus:border-amber-600 focus:bg-white transition-all text-center tracking-wider"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={inviteCacoLoading || !inviteCacoNumber.trim()}
                          className="w-full h-12 bg-amber-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {inviteCacoLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                          Enviar Convite
                        </button>
                      </form>
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto max-h-[500px]">
                      <div className="max-w-2xl mx-auto space-y-8">
                        {/* Received CAco Invites */}
                        <section>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Convites Recebidos (CAco)</h4>
                          {receivedCacoInvites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 text-center text-xs text-gray-400 font-bold">
                              Nenhum convite recebido para a Assembleia com o SC.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {receivedCacoInvites.map((inv) => (
                                <div key={inv.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black text-xs">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-gray-800">Convidado por: {inv.ownerName || 'Superintendente'}</div>
                                      <div className="text-[10px] font-bold text-gray-400">Assembleia de Circuito (CAco)</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {inv.status === 'pending' ? (
                                      <>
                                        <button 
                                          onClick={() => handleAcceptCacoInvite(inv.id)}
                                          className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                          Aceitar
                                        </button>
                                        <button 
                                          onClick={() => handleRejectCacoInvite(inv.id)}
                                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
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
                                        className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                      >
                                        <CalendarDays size={14} />
                                        Acessar CAco
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">Recusado</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>

                        {/* Sent CAco Invites */}
                        <section>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Convites Enviados (CAco)</h4>
                          {cacoInvites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 text-center text-xs text-gray-400 font-bold">
                              Você ainda não enviou nenhum convite para a Assembleia com o SC.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {cacoInvites.map((inv) => (
                                <div key={inv.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-black text-amber-600 text-xs">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-gray-800">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                        inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 
                                        inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                      }`}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCacoInvite(inv.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
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
                    <div className="w-full md:w-80 bg-white p-8 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col items-center">
                      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                        <CalendarDays className="text-emerald-600" size={32} />
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-2 text-center">Assistente CAbr</h3>
                      <p className="text-xs text-gray-400 text-center mb-8">Convide um irmão para colaborar na Assembleia com Representante de Betel.</p>

                      <form onSubmit={handleInviteCabrAssistant} className="w-full space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nº Pessoal do Assistente</label>
                          <input 
                            type="text"
                            value={inviteCabrNumber}
                            onChange={(e) => setInviteCabrNumber(e.target.value)}
                            placeholder="Ex: 123456"
                            className="w-full h-12 bg-gray-50 border border-gray-200 rounded-2xl px-4 text-xs font-bold text-gray-700 outline-none focus:border-emerald-600 focus:bg-white transition-all text-center tracking-wider"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={inviteCabrLoading || !inviteCabrNumber.trim()}
                          className="w-full h-12 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {inviteCabrLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                          Enviar Convite
                        </button>
                      </form>
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto max-h-[500px]">
                      <div className="max-w-2xl mx-auto space-y-8">
                        {/* Received CAbr Invites */}
                        <section>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Convites Recebidos (CAbr)</h4>
                          {receivedCabrInvites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 text-center text-xs text-gray-400 font-bold">
                              Nenhum convite recebido para a Assembleia com Betel.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {receivedCabrInvites.map((inv) => (
                                <div key={inv.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xs">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-gray-800">Convidado por: {inv.ownerName || 'Superintendente'}</div>
                                      <div className="text-[10px] font-bold text-gray-400">Assembleia de Circuito (CAbr)</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {inv.status === 'pending' ? (
                                      <>
                                        <button 
                                          onClick={() => handleAcceptCabrInvite(inv.id)}
                                          className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                          Aceitar
                                        </button>
                                        <button 
                                          onClick={() => handleRejectCabrInvite(inv.id)}
                                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
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
                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                      >
                                        <CalendarDays size={14} />
                                        Acessar CAbr
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">Recusado</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>

                        {/* Sent CAbr Invites */}
                        <section>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Convites Enviados (CAbr)</h4>
                          {cabrInvites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 text-center text-xs text-gray-400 font-bold">
                              Você ainda não enviou nenhum convite para a Assembleia com Betel.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {cabrInvites.map((inv) => (
                                <div key={inv.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between shadow-xs">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-black text-emerald-600 text-xs">
                                      <CalendarDays size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-gray-800">Usuário: {inv.collaboratorNumber}</div>
                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                        inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 
                                        inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                      }`}>
                                        {inv.status === 'accepted' ? 'Ativo' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCabrInvite(inv.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
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
        {isFormattingAccount && (          <motion.div 
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
              className="bg-gray-50 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Conexão Microsoft</h3>
                  <button 
                    onClick={() => setIsManagingMicrosoft(false)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                <MicrosoftConnectionSettings />

                <button
                  onClick={() => setIsManagingMicrosoft(false)}
                  className="w-full py-4 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
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
              className="bg-white w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixo do Modal */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 shrink-0 bg-white">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
                  <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">Chaves de acesso (Passkeys)</h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 truncate">Acesse sua conta sem senha com biometria ou PIN</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManagingPasskeys(false)}
                  className="p-1.5 sm:p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-colors shrink-0"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Conteúdo com rolagem suave */}
              <div className="p-3 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain bg-gray-50/50">
                <WebAuthnSettings isInsideModal={true} />
              </div>

              {/* Rodapé fixo do Modal */}
              <div className="px-4 sm:px-6 py-3 bg-white border-t border-gray-100 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setIsManagingPasskeys(false)}
                  className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all active:scale-95 shadow-sm"
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
            <div className="bg-white rounded-3xl p-8 max-sm w-full shadow-2xl text-center space-y-6">
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
