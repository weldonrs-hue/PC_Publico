'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Printer, 
  CloudDownload, 
  Trash2, 
  Calendar, 
  Lock, 
  Sparkles, 
  FolderPlus,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle
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
  setDoc 
} from 'firebase/firestore';

interface SettingsViewProps {
  userId: string;
  onBack: () => void;
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
    id: 'itinerarios',
    icon: Calendar,
    title: 'INICIAR',
    subtitle: 'ITINERÁRIOS NO CIRCUITO',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'seguranca',
    icon: Lock,
    title: 'SEGURANÇA',
    subtitle: '',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'atualizacoes',
    icon: Sparkles,
    title: 'PROCURAR',
    subtitle: 'POR NOVAS ATUALIZAÇÕES',
    color: 'bg-[#6c40bd]'
  },
  {
    id: 'pastas',
    icon: FolderPlus,
    title: 'CRIAR PASTAS',
    subtitle: 'PARA O CIRCUITO',
    color: 'bg-[#6c40bd]'
  }
];

export default function SettingsView({ userId, onBack }: SettingsViewProps) {
  const [pastaCircuito, setPastaCircuito] = useState<string>('Não configurada');
  const [circuito, setCircuito] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [creationStep, setCreationStep] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    // Detect if running in an iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

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
      } catch (error) {
        console.error('Erro ao buscar configurações:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
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

      // Save path to Firestore
      const pathString = `${rootHandle.name} > ${circuitFolderName}`;
      setPastaCircuito(pathString);
      
      try {
        const docRef = doc(db, 'personal_data', userId);
        await setDoc(docRef, { 
          pastaCircuito: pathString,
          userId: userId 
        }, { merge: true });
        console.log('Path saved to Firestore:', pathString);
      } catch (dbErr) {
        console.error('Erro ao salvar caminho no Firestore:', dbErr);
      }

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
    } else {
      alert(`Função "${id}" em desenvolvimento para o ProgCir Web.`);
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
        {settingsButtons.map((btn, index) => (
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
    </>
  );
}
