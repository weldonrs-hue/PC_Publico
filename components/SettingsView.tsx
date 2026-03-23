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
  UserX
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
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword,
  deleteUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface SettingsViewProps {
  userId: string;
  onBack: () => void;
  onViewChange: (view: string) => void;
}

const settingsButtons = [
  {
    id: 'resgatar',
    icon: RefreshCw,
    title: 'RESGATAR DADOS',
    subtitle: 'DA PLANILHA ANTERIOR',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'impressora',
    icon: Printer,
    title: 'ESCOLHER E',
    subtitle: 'CONFIGURAR IMPRESSORA',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'baixar',
    icon: CloudDownload,
    title: 'BAIXAR',
    subtitle: 'CARTAS E PROGRAMAÇÕES',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'apagar',
    icon: Trash2,
    title: 'APAGAR TUDO',
    subtitle: '(Formatar Programa)',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'seguranca',
    icon: Lock,
    title: 'ALTERAR SENHA',
    subtitle: '',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'usuarios',
    icon: Users,
    title: 'CONTAS',
    subtitle: 'DE USUÁRIOS',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'pastas',
    icon: FolderPlus,
    title: 'CRIAR PASTAS',
    subtitle: 'PARA O CIRCUITO',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'excluir',
    icon: UserX,
    title: 'EXCLUIR CONTA',
    subtitle: 'E TODOS OS DADOS',
    color: 'bg-red-600'
  }
];

export default function SettingsView({ userId, onBack, onViewChange }: SettingsViewProps) {
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
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
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

    return () => window.removeEventListener('resize', checkDesktop);
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
        setError('Seu navegador não suporta a criação de pastas diretamente. Por favor, use um navegador moderno como Chrome ou Edge.');
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

      // 2. Create Circuit Folder
      const circuitFolderName = circuito || 'CIRCUITO-NOVO';
      setCreationStep(`Criando pasta base: ${circuitFolderName}...`);
      const circuitHandle = await rootHandle.getDirectoryHandle(circuitFolderName, { create: true });

      // 3. Fetch congregations
      setCreationStep('Buscando congregações...');
      const q = query(collection(db, 'congregations'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const congregations = querySnapshot.docs.map(doc => doc.data().nome);

      // 4. Create Main Structure
      const mainFolders = ['CIRCUITO', 'ESCOLAS', 'EVENTOS', 'DIVERSOS'];
      
      for (const folder of mainFolders) {
        setCreationStep(`Criando pasta: ${folder}...`);
        const folderHandle = await circuitHandle.getDirectoryHandle(folder, { create: true });

        if (folder === 'CIRCUITO') {
          for (const cong of congregations) {
            setCreationStep(`Criando pasta congregação: ${cong}...`);
            await folderHandle.getDirectoryHandle(cong, { create: true });
          }
        }

        if (folder === 'ESCOLAS') {
          const subFolders = [
            '(ESP) Serviço de Pioneiro',
            '(Anciãos) Ministério do Reino',
            '(Servos) Ministério do Reino'
          ];
          for (const sub of subFolders) {
            await folderHandle.getDirectoryHandle(sub, { create: true });
          }
        }

        if (folder === 'EVENTOS') {
          const subFolders = [
            '(CO) Congresso Regional',
            '(CAco) Assembleia Viajante',
            '(CAbr) Assembleia Representante',
            '(S-312) Reunião Especial Pioneiros'
          ];
          for (const sub of subFolders) {
            await folderHandle.getDirectoryHandle(sub, { create: true });
          }
        }

        if (folder === 'DIVERSOS') {
          const subFolders = [
            'CARTAS ASSEMBLEIAS',
            'PROGRAMAÇÕES',
            'CARTAS ESP',
            'CARTAS EMR-ANCIÃOS',
            'CARTAS EMR-SERVOS'
          ];
          for (const sub of subFolders) {
            await folderHandle.getDirectoryHandle(sub, { create: true });
          }
        }
      }

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
    } else if (id === 'seguranca') {
      setIsChangingPassword(true);
    } else if (id === 'usuarios') {
      onViewChange('users');
    } else if (id === 'excluir') {
      setIsDeletingAccount(true);
      setDeleteStep('confirm');
      setDeleteError('');
    } else {
      alert(`Função "${id}" em desenvolvimento para o ProgCir Web.`);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsProcessing(true);
    setDeleteError('');

    try {
      // 1. Re-authenticate if it's a password user
      const providerId = user.providerData[0]?.providerId;
      if (providerId === 'password') {
        const credential = EmailAuthProvider.credential(user.email!, deletePassword);
        try {
          await reauthenticateWithCredential(user, credential);
        } catch (error: any) {
          setDeleteError('Senha incorreta. Por favor, tente novamente.');
          setIsProcessing(false);
          return;
        }
      }

      setDeleteStep('deleting');

      // 2. Delete all Firestore data
      const batch = writeBatch(db);
      const uid = user.uid;

      // Collections to clean up
      const collections = ['congregations', 'substitutes', 'itineraries', 'personal_data', 'users'];
      
      for (const collName of collections) {
        if (collName === 'users' || collName === 'personal_data') {
          // These use UID as document ID
          batch.delete(doc(db, collName, uid));
        } else {
          // These use auto-ID but have userId field
          const q = query(collection(db, collName), where('userId', '==', uid));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach((d) => {
            batch.delete(doc(db, collName, d.id));
          });
        }
      }

      await batch.commit();

      // 3. Delete Auth Account
      await deleteUser(user);
      
      setDeleteStep('success');
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        setDeleteStep('reauth');
      } else {
        setDeleteError('Ocorreu um erro ao excluir sua conta. Por favor, tente novamente mais tarde.');
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('As novas senhas não coincidem.');
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForm.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordForm.new);
      
      setPasswordSuccess(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setPasswordSuccess(false);
        setIsChangingPassword(false);
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      if (
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/user-not-found' ||
        errorMessage.includes('invalid-credential') ||
        errorMessage.includes('wrong-password')
      ) {
        setPasswordError('Senha atual incorreta.');
      } else if (errorCode === 'auth/too-many-requests') {
        setPasswordError('Muitas tentativas. Tente novamente mais tarde.');
      } else if (errorCode === 'auth/requires-recent-login') {
        setPasswordError('Sua sessão expirou. Por favor, saia e entre novamente no sistema.');
      } else {
        setPasswordError(errorMessage || 'Ocorreu um erro ao alterar a senha. Tente novamente.');
      }
    } finally {
      setPasswordLoading(false);
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
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Ajustes do Sistema</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsButtons
          .filter(btn => {
            if (btn.id === 'usuarios' && currentUserRole !== 'admin') return false;
            if (btn.id === 'pastas' && !isDesktop) return false;
            return true;
          })
          .map((btn, index) => (
            <button
              key={index}
              onClick={() => handleButtonClick(btn.id)}
              disabled={isCreatingFolders}
              className={`flex items-center bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group border border-gray-100 h-24 ${isCreatingFolders ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <div className="w-4 h-full bg-[#6c40bd] flex-shrink-0" />
            <div className="flex-1 flex items-center px-6 gap-6">
              <div className="text-[#6c40bd] group-hover:scale-110 transition-transform">
                <btn.icon size={32} />
              </div>
              <div className="text-left flex flex-col justify-center">
                <div className="font-extrabold text-[#6c40bd] text-sm leading-tight tracking-wider uppercase">
                  {btn.title}
                </div>
                {btn.subtitle && (
                  <div className="font-bold text-[#6c40bd] text-[10px] leading-tight tracking-wide uppercase opacity-80">
                    {btn.subtitle}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 space-y-3">
        <p className="font-bold text-gray-800 text-sm ml-2">Localização da pasta do Circuito:</p>
        <div className="bg-[#e9e4f5] p-4 rounded-2xl border border-[#d1c4e9] shadow-inner relative overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 text-[#311b92]">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm font-mono">Carregando...</span>
            </div>
          ) : (
            <p className="font-mono text-sm text-[#311b92] break-all">
              {pastaCircuito}
            </p>
          )}
        </div>
      </div>
    </motion.div>

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

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] bg-[#4CAF50] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 size={24} />
            <div>
              <p className="font-bold">Estrutura Criada!</p>
              <p className="text-xs opacity-90">As pastas foram organizadas em: {circuito || 'Circuito'}</p>
            </div>
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-[#f3e5f5] rounded-full flex items-center justify-center mx-auto mb-2">
                  <Lock size={32} className="text-[#6c40bd]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Alterar Senha</h3>
                <p className="text-gray-500 text-xs">Mantenha sua conta segura</p>
              </div>

              {passwordSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} className="text-emerald-600" />
                  </div>
                  <p className="text-emerald-600 font-bold">Senha alterada com sucesso!</p>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Senha Atual</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Nova Senha</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm"
                    />
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-2xl text-[11px] border border-red-100">
                      <AlertCircle size={14} className="shrink-0" />
                      <p>{passwordError}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full py-3 bg-[#6c40bd] text-white font-bold rounded-xl hover:bg-[#5a35a0] transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {passwordLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        'Confirmar Alteração'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordError(null);
                        setPasswordForm({ current: '', new: '', confirm: '' });
                      }}
                      className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {isDeletingAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                {deleteStep === 'confirm' && (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto">
                      <Trash2 size={32} />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-gray-900">Excluir Conta?</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Esta ação é irreversível. Todos os seus dados, congregações, substitutos e itinerários serão permanentemente removidos.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsDeletingAccount(false)}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          const providerId = auth.currentUser?.providerData[0]?.providerId;
                          if (providerId === 'password') {
                            setDeleteStep('reauth');
                          } else {
                            handleDeleteAccount();
                          }
                        }}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20"
                      >
                        Sim, Excluir
                      </button>
                    </div>
                  </div>
                )}

                {deleteStep === 'reauth' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-gray-900">Confirme sua Senha</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Para sua segurança, confirme sua senha antes de excluir a conta.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Sua Senha</label>
                        <input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Digite sua senha atual"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        />
                      </div>
                      {deleteError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
                          <AlertCircle size={14} />
                          {deleteError}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteStep('confirm')}
                        disabled={isProcessing}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isProcessing || !deletePassword}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" size={18} /> : 'Excluir Agora'}
                      </button>
                    </div>
                  </div>
                )}

                {deleteStep === 'deleting' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="animate-spin text-red-600" size={48} />
                    <p className="text-lg font-bold text-gray-900">Excluindo sua conta...</p>
                    <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
                  </div>
                )}

                {deleteStep === 'success' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                      <CheckCircle2 size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Conta Excluída</h3>
                    <p className="text-gray-500">Sua conta e todos os dados foram removidos com sucesso. Você será desconectado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
