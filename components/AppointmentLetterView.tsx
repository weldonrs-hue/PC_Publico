'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2,
  Printer,
  FileDown,
  X,
  Image as ImageIcon,
  Trash2,
  Upload,
  Maximize2,
  Minimize2,
  RotateCcw,
  Edit3,
  FileText,
  UserPlus,
  UserMinus,
  Calendar,
  Building2,
  CheckCircle2,
  Shield,
  Sparkles,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import ImageCropper from './ImageCropper';
import DraggableSignature from './DraggableSignature';

interface AppointmentLetterViewProps {
  userId: string;
  congregation: {
    nome: string;
    numero: string;
    cidade: string;
    estado: string;
    endereco?: string;
    coordenador?: string;
    cep?: string;
  };
  visitDate: string;
  onBack: () => void;
}

interface LetterData {
  ancianosDesignados: string[];
  servosDesignados: string[];
  irmaosRemovidos: string[];
}

export default function AppointmentLetterView({ userId, congregation, visitDate, onBack }: AppointmentLetterViewProps) {
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [personalData, setPersonalData] = useState<any>(null);
  
  // Tab Switch: 'form' (Mobile/Editor) vs 'preview' (Folha A4)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('preview');
  // Auto-fit mode for mobile preview
  const [autoFit, setAutoFit] = useState(true);

  const [letterData, setLetterData] = useState<LetterData>({
    ancianosDesignados: ['', '', '', ''],
    servosDesignados: ['', '', '', ''],
    irmaosRemovidos: ['', '', '', '']
  });

  const [letterDate, setLetterDate] = useState<string>(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    return `${day} de ${month} de ${year}`;
  });

  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signaturePlacement, setSignaturePlacement] = useState<{ x: number, y: number, scale: number } | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scale, setScale] = useState(1);
  const [showScrollArrows, setShowScrollArrows] = useState(false);

  // Responsive scale calculation for A4 Portrait (794px / 210mm)
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const a4WidthPx = 794;
      
      if (autoFit) {
        const calculated = Math.min(1.2, (containerWidth - 24) / a4WidthPx);
        setScale(Math.max(0.3, calculated));
        setShowScrollArrows(false);
      } else {
        setScale(1);
        setShowScrollArrows(containerWidth < a4WidthPx);
      }
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    updateScale();

    return () => observer.disconnect();
  }, [autoFit, activeTab]);

  const scrollContainer = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = containerRef.current.offsetWidth * 0.8;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      try {
        if (!auth.currentUser) {
          let attempts = 0;
          while (!auth.currentUser && attempts < 15) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
          }
        }

        const pdRef = doc(db, 'personal_data', userId);
        const pdSnap = await getDoc(pdRef);
        if (pdSnap.exists()) {
          const data = pdSnap.data();
          setPersonalData(data);
          setSignatureName(data.nome || '');
          setSignatureImage(data.signatureImage || null);
        } else {
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setPersonalData(data);
            setSignatureName(data.nome || '');
            setSignatureImage(data.signatureImage || null);
          }
        }
      } catch (error) {
        console.error('Error in AppointmentLetter fetchData:', error);
      } finally {
        setLoading(false);
      }
    };

    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) return false;
        return prev;
      });
    }, 5000);

    fetchData();
    fetchSignaturePlacement();
    return () => clearTimeout(safetyTimeout);
  }, [userId]);

  const fetchSignaturePlacement = async () => {
    try {
      const placementId = `appointment_${userId}`;
      const docRef = doc(db, 'signature_placements', placementId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSignaturePlacement(docSnap.data() as any);
      } else {
        setSignaturePlacement({ x: 420, y: 920, scale: 1.2 });
      }
    } catch (error) {
      console.error('Error fetching signature placement:', error);
      setSignaturePlacement({ x: 450, y: 700, scale: 1 });
    }
  };

  const handleSignaturePlacementSave = async (settings: { x: number, y: number, scale: number }) => {
    setSignaturePlacement(settings);
    try {
      const placementId = `appointment_${userId}`;
      await setDoc(doc(db, 'signature_placements', placementId), settings);
    } catch (error) {
      console.error('Error saving signature placement:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const captureElement = document.getElementById('appointment-letter-container');
    if (!captureElement) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    
    const filename = `Carta_Designacao_${congregation.nome}_${dateStr}.pdf`;

    setGenerating(true);
    try {
      const { toJpeg } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const inputs = captureElement.querySelectorAll('input');
      const originalPlaceholders = new Map<HTMLInputElement, string>();
      inputs.forEach(input => {
        if (input.placeholder) {
          originalPlaceholders.set(input, input.placeholder);
          input.placeholder = '';
        }
      });

      window.getSelection()?.removeAllRanges();

      try {
        await document.fonts.load('16px "Dancing Script"');
        await document.fonts.ready;
      } catch (e) {
        console.warn('Erro ao carregar fontes:', e);
      }
      
      const images = captureElement.querySelectorAll('img');
      const imagePromises = Array.from(images).map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
      });
      await Promise.all(imagePromises);

      const originalTransform = captureElement.style.transform;
      const originalTransformOrigin = captureElement.style.transformOrigin;
      captureElement.style.transform = 'scale(1)';
      captureElement.style.transformOrigin = 'top left';

      await new Promise(resolve => setTimeout(resolve, 800));

      const dataUrl = await toJpeg(captureElement, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 793.7, 
        height: 1122.5,
        cacheBust: true,
        style: {
          transform: 'none',
          margin: '0',
          left: '0',
          top: '0'
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      pdf.save(filename);
      
      captureElement.style.transform = originalTransform;
      captureElement.style.transformOrigin = originalTransformOrigin;
      
      originalPlaceholders.forEach((value, input) => {
        input.placeholder = value;
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      showAlert('Erro ao gerar o PDF. Por favor, tente novamente.', 'Erro');
    } finally {
      setGenerating(false);
    }
  };

  const updateField = (type: keyof LetterData, index: number, value: string) => {
    setLetterData(prev => {
      const newData = { ...prev };
      newData[type][index] = value;
      return newData;
    });
  };

  const addLine = (type: keyof LetterData) => {
    setLetterData(prev => ({
      ...prev,
      [type]: [...prev[type], '']
    }));
  };

  const removeLine = (type: keyof LetterData, index: number) => {
    setLetterData(prev => {
      if (prev[type].length <= 1) {
        return {
          ...prev,
          [type]: ['']
        };
      }
      return {
        ...prev,
        [type]: prev[type].filter((_, i) => i !== index)
      };
    });
  };

  const saveSignature = async (image: string | null) => {
    if (!userId) return;
    try {
      if (image) {
        await setDoc(doc(db, 'personal_data', userId), {
          signatureImage: image
        }, { merge: true });
      } else {
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          delete data.signatureImage;
          await setDoc(docRef, data);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedImage: string) => {
    setSignatureImage(croppedImage);
    saveSignature(croppedImage);
    setImageToCrop(null);
  };

  const handleRemoveSignature = () => {
    setSignatureImage(null);
    saveSignature(null);
  };

  const setDateToday = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    setLetterDate(`${day} de ${month} de ${year}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-purple-600" size={42} />
        <p className="text-typography-500 font-medium text-sm">Carregando carta de designação...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header Unificado com Design System */}
      <div className="relative bg-surface-100 p-4 sm:p-5 rounded-2xl border border-surface-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden print:hidden">
        {/* Faixa Gradiente Superior */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-90"
          style={{ backgroundImage: 'linear-gradient(to right, #8B5CF6, #A855F7, transparent)' }}
        />

        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 cursor-pointer shrink-0"
            title="Voltar"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10 shrink-0">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-typography-900 tracking-tight truncate">
              Carta de Designação / Cancelamento
            </h2>
            <p className="text-xs text-typography-500 truncate flex items-center gap-1.5 mt-0.5">
              <span className="font-semibold text-typography-700">{congregation.nome}</span>
              <span>•</span>
              <span>Visita: {visitDate}</span>
            </p>
          </div>
        </div>

        {/* Controles de Abas e Ações */}
        <div className="flex flex-wrap items-center gap-2.5 justify-start md:justify-end">
          {/* Seletor de Modo: Formulário (Mobile) vs Folha A4 */}
          <div className="flex bg-surface-200 p-1 rounded-xl border border-surface-300/60 shrink-0">
            <button
              onClick={() => setActiveTab('form')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'form' 
                  ? 'bg-surface-100 text-typography-900 shadow-xs' 
                  : 'text-typography-500 hover:text-typography-900'
              }`}
              title="Modo Formulário"
            >
              <Edit3 size={14} />
              <span>Formulário</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'preview' 
                  ? 'bg-surface-100 text-typography-900 shadow-xs' 
                  : 'text-typography-500 hover:text-typography-900'
              }`}
              title="Visualizar Carta A4"
            >
              <FileText size={14} />
              <span>Carta A4</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportPDF}
              disabled={generating}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Baixar PDF da Carta"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              <span className="hidden sm:inline">{generating ? 'Gerando...' : 'Baixar PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button 
              onClick={handlePrint}
              className="bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Imprimir Carta"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* ABA 1: MODO FORMULÁRIO (100% RESPONSIVO & AMIGÁVEL PARA CELULAR) */}
      {activeTab === 'form' && (
        <motion.div 
          key="letter-form-view"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="space-y-5 max-w-4xl mx-auto"
        >
          {/* Card: Informações da Carta */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={14} className="text-purple-500" />
              <span>Data da Carta & Destinatário</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                    Data por Extenso
                  </label>
                  <button 
                    type="button"
                    onClick={setDateToday}
                    className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Usar data de hoje
                  </button>
                </div>
                <input 
                  type="text"
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-colors"
                  placeholder="Ex: 08 de outubro de 2026"
                />
              </div>

              <div className="bg-surface-200/50 p-3 rounded-xl border border-surface-300/50 space-y-1 text-xs">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Destinatário Oficial</span>
                <span className="font-bold text-typography-900 block truncate">Corpo de Anciãos — {congregation.nome}</span>
                <span className="text-typography-500 block truncate">{congregation.coordenador || 'Coordenador do Corpo de Anciãos'}</span>
                <span className="text-typography-500 block truncate">{congregation.cidade} - {congregation.estado}</span>
              </div>
            </div>
          </div>

          {/* Card: Anciãos Designados */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-typography-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={14} className="text-purple-500" />
                  <span>Ancião(s) Designado(s)</span>
                </h3>
                <p className="text-[11px] text-typography-500 mt-0.5">
                  Pode colocar vários nomes na mesma linha ou adicionar novas linhas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => addLine('ancianosDesignados')}
                className="self-start sm:self-auto px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Adicionar Linha</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {letterData.ancianosDesignados.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-surface-200 text-typography-500 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => updateField('ancianosDesignados', i, e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-colors"
                    placeholder={`Linha ${i + 1}: digite um ou mais nomes...`}
                  />
                  {letterData.ancianosDesignados.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine('ancianosDesignados', i)}
                      className="p-1.5 text-typography-400 hover:text-red-500 rounded-lg hover:bg-surface-200 transition-colors cursor-pointer"
                      title="Remover linha"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Card: Servos Ministeriais Designados */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-typography-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus size={14} className="text-purple-500" />
                  <span>Servo(s) Ministerial(is) Designado(s)</span>
                </h3>
                <p className="text-[11px] text-typography-500 mt-0.5">
                  Pode colocar vários nomes na mesma linha ou adicionar novas linhas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => addLine('servosDesignados')}
                className="self-start sm:self-auto px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Adicionar Linha</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {letterData.servosDesignados.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-surface-200 text-typography-500 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => updateField('servosDesignados', i, e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-colors"
                    placeholder={`Linha ${i + 1}: digite um ou mais nomes...`}
                  />
                  {letterData.servosDesignados.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine('servosDesignados', i)}
                      className="p-1.5 text-typography-400 hover:text-red-500 rounded-lg hover:bg-surface-200 transition-colors cursor-pointer"
                      title="Remover linha"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Card: Irmãos Removidos / Cancelados */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-typography-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserMinus size={14} className="text-rose-500" />
                  <span>Irmão(s) Removido(s) / Cancelamento(s)</span>
                </h3>
                <p className="text-[11px] text-typography-500 mt-0.5">
                  Pode colocar vários nomes na mesma linha ou adicionar novas linhas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => addLine('irmaosRemovidos')}
                className="self-start sm:self-auto px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Adicionar Linha</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {letterData.irmaosRemovidos.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-surface-200 text-typography-500 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => updateField('irmaosRemovidos', i, e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-colors"
                    placeholder={`Linha ${i + 1}: digite um ou mais nomes...`}
                  />
                  {letterData.irmaosRemovidos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine('irmaosRemovidos', i)}
                      className="p-1.5 text-typography-400 hover:text-red-500 rounded-lg hover:bg-surface-200 transition-colors cursor-pointer"
                      title="Remover linha"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Card: Assinatura */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-500" />
              <span>Assinatura do Superintendente</span>
            </h3>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                  Nome por Extenso
                </label>
                <input 
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-colors"
                  placeholder="Nome do superintendente"
                />
              </div>

              <div className="bg-surface-200/50 p-4 rounded-xl border border-surface-300/60 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-typography-600">
                  <span className="font-semibold block text-typography-900">
                    {signatureImage ? 'Assinatura digital carregada' : 'Assinatura cursiva padrão ativa'}
                  </span>
                  <span>{signatureImage ? 'A imagem posicionada será impressa na carta.' : 'Você também pode carregar uma foto da assinatura real se preferir.'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-surface-100 hover:bg-surface-200 border border-surface-300 text-typography-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>{signatureImage ? 'Trocar Imagem' : 'Carregar Foto'}</span>
                  </button>
                  {signatureImage && (
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Remover</span>
                    </button>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-surface-300/80 text-xs text-typography-500">
              <span>Todas as informações são atualizadas em tempo real na folha A4.</span>
              <button
                onClick={() => setActiveTab('preview')}
                className="text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Visualizar na folha oficial A4</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ABA 2: CARTA OFICIAL A4 (PREVIEW E IMPRESSÃO) */}
      <div 
        className={activeTab === 'form' ? 'opacity-0 pointer-events-none absolute -left-[9999px] top-0' : 'block'}
      >
        <div className="relative w-full max-w-7xl mx-auto space-y-4">
          {/* Barra de Ferramentas de Zoom da Folha */}
          <div className="flex items-center justify-between bg-surface-100 p-2.5 sm:p-3 rounded-xl border border-surface-300 shadow-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-typography-700">Visualização da Carta A4:</span>
              <button
                onClick={() => setAutoFit(!autoFit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  autoFit 
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' 
                    : 'bg-surface-200 text-typography-600 hover:bg-surface-300'
                }`}
                title="Ajustar automaticamente à largura da tela"
              >
                {autoFit ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{autoFit ? 'Ajustado à Tela' : 'Tamanho Real (100%)'}</span>
              </button>
            </div>
            <div className="text-xs text-typography-500 font-mono">
              Zoom: {Math.round(scale * 100)}%
            </div>
          </div>

          <AnimatePresence>
            {showScrollArrows && !autoFit && (
              <>
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => scrollContainer('left')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-surface-100/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-surface-300 text-typography-700 md:hidden"
                  aria-label="Rolar para esquerda"
                >
                  <ChevronLeft size={22} />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => scrollContainer('right')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-surface-100/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-surface-300 text-typography-700 md:hidden"
                  aria-label="Rolar para direita"
                >
                  <ChevronRight size={22} />
                </motion.button>
              </>
            )}
          </AnimatePresence>

          <div 
            ref={containerRef}
            className="bg-surface-200/50 shadow-inner rounded-2xl overflow-x-auto border border-surface-300 print:shadow-none print:border-none w-full print:max-w-none print:w-full print:m-0 print:p-0 flex justify-start sm:justify-center p-2 sm:p-6 custom-scrollbar scroll-smooth"
          >
            <div 
              style={{ 
                width: `${210 * scale}mm`, 
                height: `${297 * scale}mm`,
                minWidth: 'min-content',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0
              }}
              className="print:w-full print:h-auto"
            >
              <div 
                id="appointment-letter-container"
                className="bg-white print:min-h-0 text-black print:m-0 flex flex-col print:w-[210mm] print:h-[297mm] print:fixed print:top-0 print:left-0 print:z-[100] flex-shrink-0 relative shadow-lg print:shadow-none"
                style={{ 
                  fontFamily: "'Times New Roman', Times, serif",
                  padding: '12.7mm',
                  width: '210mm',
                  minWidth: '210mm',
                  height: '297mm',
                  overflow: 'visible',
                  boxSizing: 'border-box',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  transition: 'transform 0.15s ease-out'
                }}
              >
                <article 
                  ref={letterRef}
                  className="w-full h-full flex flex-col relative"
                >
                  <header className="text-center mb-4">
                    <h2 className="font-bold text-2xl mb-1">
                      {personalData?.nome || 'Nome do Viajante'} {personalData?.circuito || ''}
                    </h2>
                    <p className="text-[11px] uppercase tracking-tight">
                      {personalData?.endereco || ''}{personalData?.cidade ? `, ${personalData.cidade}` : ''}{personalData?.uf ? `-${personalData.uf}` : ''} CEP: {personalData?.cep || ''}
                    </p>
                  </header>

                  <div className="text-right mb-6">
                    <input 
                      type="text"
                      value={letterDate}
                      onChange={(e) => setLetterDate(e.target.value)}
                      className="text-[15px] text-right bg-transparent border-none outline-none w-full print:placeholder-transparent"
                      style={{ fontFamily: "'Times New Roman', Times, serif" }}
                      placeholder="Insira a data da carta"
                    />
                  </div>

                  <div className="grid grid-cols-2 mb-10">
                    <div className="space-y-0.5">
                      <p className="font-bold uppercase text-[15px]">CONGREGAÇÃO: {congregation.nome}</p>
                      <p className="text-[15px]">{congregation.coordenador || 'Coordenador do Corpo de Anciãos'}</p>
                      <p className="text-[15px]">{congregation.endereco || 'Endereço da congregação'}</p>
                      <p className="text-[15px]">{congregation.cidade} - {congregation.estado}</p>
                      <p className="text-[15px]">{congregation.cep || ''}</p>
                    </div>
                    <div className="text-left pt-0 pl-12">
                      <p className="font-bold text-[15px] uppercase">AO CORPO DE ANCIÃOS</p>
                      <p className="text-[15px] italic">Ref.: Designações e cancelamentos de anciãos e servos ministeriais</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-[17px] mt-[-26px]">Prezados Irmãos:</p>
                  </div>

                  <div className="space-y-2 text-[17px] leading-snug flex-1 mt-[-17px]">
                    <section>
                      <p className="mb-0.5">Confirmo que fiz a(s) seguinte(s) designação(ões) de <strong className="font-bold">ancião(s)</strong>:</p>
                      <div className="space-y-0">
                        {letterData.ancianosDesignados.map((name, i) => (
                          <div key={i} className="border-b border-dotted border-[#bbb] h-[1.5rem] w-full flex items-end">
                            <input 
                              type="text"
                              value={name}
                              onChange={(e) => updateField('ancianosDesignados', i, e.target.value)}
                              className="w-full bg-transparent outline-none text-[17px] font-bold border-none p-0 h-full placeholder:text-gray-300 print:placeholder:text-transparent"
                              placeholder=""
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-0.5 mt-2">Confirmo que fiz a(s) seguinte(s) designação(ões) de <strong className="font-bold">servo(s) ministerial(is)</strong>:</p>
                      <div className="space-y-0">
                        {letterData.servosDesignados.map((name, i) => (
                          <div key={i} className="border-b border-dotted border-[#bbb] h-[1.5rem] w-full flex items-end">
                            <input 
                              type="text"
                              value={name}
                              onChange={(e) => updateField('servosDesignados', i, e.target.value)}
                              className="w-full bg-transparent outline-none text-[17px] font-bold border-none p-0 h-full placeholder:text-gray-300 print:placeholder:text-transparent"
                              placeholder=""
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-0.5 mt-2">Confirmo que <strong className="font-bold">cancelei</strong> o(s) seguinte(s) irmão(s) de servir como ancião ou servo ministerial:</p>
                      <div className="space-y-0">
                        {letterData.irmaosRemovidos.map((name, i) => (
                          <div key={i} className="border-b border-dotted border-[#bbb] h-[1.5rem] w-full flex items-end">
                            <input 
                              type="text"
                              value={name}
                              onChange={(e) => updateField('irmaosRemovidos', i, e.target.value)}
                              className="w-full bg-transparent outline-none text-[17px] font-bold border-none p-0 h-full placeholder:text-gray-300 print:placeholder:text-transparent"
                              placeholder=""
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="text-[17px] mt-4">Aceitem meu cordial amor cristão.</p>
                    </section>
                  </div>

                  <div className="mt-8 relative group">
                    <div className="flex flex-col items-end mb-[58px] pr-[5mm]">
                      <div className="w-full max-w-[450px] px-4 text-center relative">
                        <p className="text-[17px] mt-0 mb-[18px] text-left">Seu irmão,</p>
                        <div className="inline-block relative w-full flex flex-col items-center overflow-visible">
                          <div className="h-[45px] flex items-center justify-center mb-[-10px] relative w-full overflow-visible">
                            {!signatureImage && (
                              <input 
                                type="text"
                                value={signatureName}
                                onChange={(e) => setSignatureName(e.target.value)}
                                className="font-signature text-[#004aad] leading-none mb-[-4px] text-center bg-transparent border-none outline-none w-full px-2"
                                style={{ 
                                  fontFamily: 'var(--font-signature), "Dancing Script", cursive',
                                  fontSize: signatureName.length > 25 ? '24px' : (signatureName.length > 18 ? '28px' : '32px')
                                }}
                              />
                            )}
                          </div>
                          <div className="border-t border-black w-full mx-auto mb-0"></div>
                          <p className="font-bold text-[11px] mt-[5px] uppercase tracking-wider mb-0 text-center bg-transparent border-none outline-none w-full">
                            {personalData?.nome || 'Nome do Viajante'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {signatureImage && signaturePlacement && (
                    <DraggableSignature 
                      image={signatureImage}
                      initialX={signaturePlacement.x}
                      initialY={signaturePlacement.y}
                      initialScale={signaturePlacement.scale}
                      onSave={handleSignaturePlacementSave}
                      containerRef={letterRef}
                    />
                  )}
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: A4 portrait;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 297mm !important;
            width: 210mm !important;
            overflow: hidden !important;
            background: white !important;
          }
          #appointment-letter-container {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 12.7mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            background: white !important;
            transform: scale(0.95) !important;
            transform-origin: top center !important;
          }
          body {
            background-color: white !important;
          }
          .print-hidden {
            display: none !important;
          }
          input::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }
          input {
            border: none !important;
          }
        }
      `}</style>

      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspect={6}
          cropShape="rect"
          lockAspect={false}
        />
      )}
    </div>
  );
}
