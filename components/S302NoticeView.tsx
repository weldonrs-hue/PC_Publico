'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download, 
  Loader2,
  Printer,
  Calendar,
  MapPin,
  User,
  Hash,
  Upload,
  Trash2,
  Settings2,
  Save,
  Maximize2,
  Minimize2,
  Move,
  Type,
  Sparkles,
  PenTool,
  Edit3,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useDialog } from '@/hooks/useDialog';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import ImageCropper from './ImageCropper';
import SignaturePad from './SignaturePad';
import DraggableSignature from './DraggableSignature';
import CustomSelect from '@/components/CustomSelect';

interface ElementLayout {
  top: number;
  left: number;
  fontSize: number;
  width?: number;
}

interface S302Layout {
  header: ElementLayout;
  body: ElementLayout;
  congregation: ElementLayout;
  visitor: ElementLayout;
  visitDate: ElementLayout;
  signature: {
    bottom: number;
    right: number;
    fontSize: number;
    width: number;
    imageHeight?: number;
    imageOffset?: number;
    imageShiftX?: number;
  };
}

const DEFAULT_LAYOUT: S302Layout = {
  header: { top: 12, left: 0, fontSize: 15 },
  body: { top: 32, left: 15, fontSize: 15 },
  congregation: { top: 65, left: 29, fontSize: 16 },
  visitor: { top: 75, left: 29, fontSize: 16 },
  visitDate: { top: 85, left: 29, fontSize: 16 },
  signature: { 
    bottom: 24, 
    right: 15, 
    fontSize: 16, 
    width: 125,
    imageHeight: 15,
    imageOffset: 0,
    imageShiftX: 0
  }
};

interface Congregation {
  id?: string;
  nome: string;
  numero: string;
  cidade: string;
  estado: string;
  endereco: string;
  bairro: string;
  cep: string;
  telefone: string;
  email: string;
  reuniaoFimSemana: string;
  reuniaoMeioSemana: string;
}

interface S302Event {
  congregacao: Congregation;
  data: string;
  semana: string;
  substituteName?: string;
}

interface S302NoticeViewProps {
  events: S302Event[];
  initialIndex: number;
  userId: string;
  isAdmin: boolean;
  onBack: () => void;
}

export default function S302NoticeView({ events, initialIndex, userId, isAdmin, onBack }: S302NoticeViewProps) {
  const { showAlert } = useDialog();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentEvent = events[currentIndex] || events[0];
  const { congregacao, data, semana, substituteName } = currentEvent;

  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Tab Switch: 'form' (Mobile/Editor) vs 'preview' (Folha S-302)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('preview');
  // Auto-fit mode for mobile preview
  const [autoFit, setAutoFit] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showScrollArrows, setShowScrollArrows] = useState(false);

  // Design Mode States
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [layout, setLayout] = useState<S302Layout>(DEFAULT_LAYOUT);
  const [selectedElement, setSelectedElement] = useState<keyof S302Layout | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [signaturePlacement, setSignaturePlacement] = useState<{ x: number, y: number, scale: number } | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Signature States
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Responsive scale calculation for S-302 (width ~794px / 210mm)
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const s302WidthPx = 794; // 210mm in pixels at 96dpi
      
      if (autoFit) {
        const calculated = Math.min(1.2, (containerWidth - 24) / s302WidthPx);
        setScale(Math.max(0.3, calculated));
        setShowScrollArrows(false);
      } else {
        setScale(1);
        setShowScrollArrows(containerWidth < s302WidthPx);
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

  const removeImageBackground = () => {
    if (!signatureImage) return;
    
    setIsProcessing(true);
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = signatureImage;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const dataArr = imageData.data;
      const threshold = 230; 
      
      for (let i = 0; i < dataArr.length; i += 4) {
        const r = dataArr[i];
        const g = dataArr[i + 1];
        const b = dataArr[i + 2];
        
        if (r > threshold && g > threshold && b > threshold) {
          dataArr[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      const processedImage = canvas.toDataURL('image/png');
      setSignatureImage(processedImage);
      saveSignature(processedImage);
      setIsProcessing(false);
    };
    
    img.onerror = () => {
      console.error("Error loading image for background removal");
      setIsProcessing(false);
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const personalRef = doc(db, 'personal_data', userId);
        const layoutRef = doc(db, 's302_layouts', 'shared_layout');
        const placementRef = doc(db, 'signature_placements', `s302_${userId}`);
        
        const [personalSnap, layoutSnap, placementSnap] = await Promise.all([
          getDoc(personalRef),
          getDoc(layoutRef),
          getDoc(placementRef)
        ]);

        if (personalSnap.exists()) {
          const pData = personalSnap.data();
          setPersonalData(pData);
          if (!signatureName) setSignatureName(pData.nome || '');
          setSignatureImage(pData.signatureImage || null);
        }

        if (placementSnap.exists()) {
          setSignaturePlacement(placementSnap.data() as any);
        } else {
          setSignaturePlacement({ x: 500, y: 440, scale: 1 });
        }

        if (layoutSnap.exists()) {
          const remoteLayout = layoutSnap.data() as S302Layout;
          setLayout({
            header: { ...DEFAULT_LAYOUT.header, ...remoteLayout.header },
            body: { ...DEFAULT_LAYOUT.body, ...remoteLayout.body },
            congregation: { ...DEFAULT_LAYOUT.congregation, ...remoteLayout.congregation },
            visitor: { ...DEFAULT_LAYOUT.visitor, ...remoteLayout.visitor },
            visitDate: { ...DEFAULT_LAYOUT.visitDate, ...remoteLayout.visitDate },
            signature: { 
              ...DEFAULT_LAYOUT.signature, 
              ...remoteLayout.signature,
              imageHeight: remoteLayout.signature.imageHeight ?? DEFAULT_LAYOUT.signature.imageHeight,
              imageOffset: remoteLayout.signature.imageOffset ?? DEFAULT_LAYOUT.signature.imageOffset,
              imageShiftX: remoteLayout.signature.imageShiftX ?? DEFAULT_LAYOUT.signature.imageShiftX
            }
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleSaveLayout = async () => {
    if (!isAdmin) return;
    setIsSavingLayout(true);
    try {
      await setDoc(doc(db, 's302_layouts', 'shared_layout'), layout);
      setIsDesignMode(false);
      showAlert('Coordenadas de layout salvas com sucesso.', 'Sucesso');
    } catch (error) {
      console.error('Error saving layout:', error);
      showAlert('Erro ao salvar as posições do layout.', 'Erro');
    } finally {
      setIsSavingLayout(false);
    }
  };

  const updateLayout = (key: keyof S302Layout, field: string, value: number) => {
    setLayout(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const saveSignature = async (image: string | null) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'personal_data', userId), {
        signatureImage: image
      }, { merge: true });
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

  const handleSignaturePlacementSave = async (settings: { x: number, y: number, scale: number }) => {
    setSignaturePlacement(settings);
    try {
      await setDoc(doc(db, 'signature_placements', `s302_${userId}`), settings);
    } catch (error) {
      console.error('Error saving signature placement:', error);
    }
  };

  const handleSignaturePadSave = (signatureDataUrl: string) => {
    setSignatureImage(signatureDataUrl);
    saveSignature(signatureDataUrl);
    setShowSignaturePad(false);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('s302-print-container');
    if (!element) return;

    setGenerating(true);
    try {
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = 210;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      const pdfScale = 0.85;
      const imgWidth = pdfWidth * pdfScale;
      const imgScaledHeight = pdfHeight * pdfScale;
      const xOffset = (pdfWidth - imgWidth) / 2;
      const yOffset = 20;

      pdf.addImage(dataUrl, 'JPEG', xOffset, yOffset, imgWidth, imgScaledHeight, undefined, 'FAST');
      
      let formattedDate = semana.replace(/\//g, '-');
      const fullDateMatch = semana.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      
      if (fullDateMatch) {
        const day = fullDateMatch[1].padStart(2, '0');
        const month = fullDateMatch[2].padStart(2, '0');
        const year = fullDateMatch[3];
        formattedDate = `${year} ${month}-${day}`;
      } else {
        const numbers = semana.match(/\d+/g);
        if (numbers && numbers.length >= 3) {
          const year = numbers.find(n => n.length === 4);
          if (year) {
            const yearIndex = numbers.indexOf(year);
            const month = numbers[yearIndex - 1]?.padStart(2, '0');
            const day = numbers[0].padStart(2, '0');
            if (day && month && year) {
              formattedDate = `${year} ${month}-${day}`;
            }
          }
        }
      }

      const filename = `S-302 (${formattedDate}) ${congregacao.nome} — ${congregacao.cidade.toUpperCase()} ${congregacao.estado.toUpperCase()}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Erro ao gerar o PDF. Por favor, tente novamente.', 'Erro');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const visitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
  const fullCongName = (congregacao.cidade && congregacao.cidade.trim().toLowerCase() !== congregacao.nome.trim().toLowerCase())
    ? `${congregacao.nome}, ${congregacao.cidade}` 
    : congregacao.nome;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-amber-500" size={42} />
        <p className="text-typography-500 font-medium text-sm">Carregando formulário S-302...</p>
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
          style={{ backgroundImage: 'linear-gradient(to right, #EA580C, #F59E0B, transparent)' }}
        />

        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 cursor-pointer shrink-0"
            title="Voltar"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 shrink-0">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-typography-900 tracking-tight truncate">
              S-302 Aviso de Visitas
            </h2>
            <p className="text-xs text-typography-500 truncate flex items-center gap-1.5 mt-0.5">
              <span className="font-semibold text-typography-700">{congregacao.nome}</span>
              <span>•</span>
              <span>{data || semana}</span>
            </p>
          </div>
        </div>

        {/* Controles de Ação, Navegação e Abas */}
        <div className="flex flex-wrap items-center gap-2.5 justify-start md:justify-end">
          {/* Navegador de Congregações */}
          {events.length > 1 && (
            <div className="flex items-center bg-surface-200 p-1 rounded-xl border border-surface-300/60 shrink-0">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-typography-600 hover:text-typography-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Congregação anterior"
              >
                <ChevronsLeft size={16} />
              </button>
              <div className="px-2 text-[11px] font-bold text-typography-700 font-mono">
                {currentIndex + 1} / {events.length}
              </div>
              <button
                onClick={() => setCurrentIndex(prev => Math.min(events.length - 1, prev + 1))}
                disabled={currentIndex === events.length - 1}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-typography-600 hover:text-typography-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Próxima congregação"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          )}

          {/* Seletor de Modo: Formulário (Mobile) vs Aviso Oficial */}
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
              <span>Dados da Visita</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'preview' 
                  ? 'bg-surface-100 text-typography-900 shadow-xs' 
                  : 'text-typography-500 hover:text-typography-900'
              }`}
              title="Visualizar Folha S-302"
            >
              <FileText size={14} />
              <span>Aviso S-302</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button 
                onClick={() => {
                  setIsDesignMode(!isDesignMode);
                  if (!isDesignMode) setActiveTab('preview');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border ${
                  isDesignMode 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400' 
                    : 'bg-surface-200 hover:bg-surface-300 text-typography-700 border-surface-300'
                }`}
                title="Personalizar coordenadas de impressão"
              >
                <Settings2 size={15} />
                <span className="hidden sm:inline">{isDesignMode ? 'Sair do Design' : 'Design'}</span>
              </button>
            )}

            <button 
              onClick={handleDownloadPDF}
              disabled={generating}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Baixar PDF"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden sm:inline">{generating ? 'Gerando...' : 'Baixar PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button 
              onClick={handlePrint}
              className="bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Imprimir"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* ABA 1: MODO DADOS DA VISITA (100% RESPONSIVO & AMIGÁVEL PARA CELULAR) */}
      {activeTab === 'form' && (
        <motion.div 
          key="s302-form-view"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="space-y-5 max-w-4xl mx-auto"
        >
          {/* Card: Dados Oficiais da Visita */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-amber-500" />
                <span>Dados do Aviso de Visita</span>
              </h3>
              {events.length > 1 && (
                <span className="text-[11px] font-mono font-semibold text-typography-500 bg-surface-200 px-2 py-0.5 rounded-md">
                  Item {currentIndex + 1} de {events.length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-surface-200/60 p-3 rounded-xl border border-surface-300/40 space-y-1">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Congregação</span>
                <span className="font-bold text-typography-900 block">{congregacao.nome}</span>
                <span className="text-xs text-typography-500 block">{congregacao.cidade} - {congregacao.estado}</span>
              </div>

              <div className="bg-surface-200/60 p-3 rounded-xl border border-surface-300/40 space-y-1">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Superintendente</span>
                <span className="font-bold text-typography-900 block">{visitorName}</span>
                <span className="text-xs text-typography-500 block">
                  {substituteName ? 'Superintendente Substituto' : (personalData?.circuito || 'Circuito')}
                </span>
              </div>

              <div className="bg-surface-200/60 p-3 rounded-xl border border-surface-300/40 space-y-1">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Data Informada</span>
                <span className="font-bold text-typography-900 block">{data}</span>
                <span className="text-xs text-typography-500 block">Semana: {semana}</span>
              </div>

              <div className="bg-surface-200/60 p-3 rounded-xl border border-surface-300/40 space-y-1">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Número de Registro</span>
                <span className="font-bold text-typography-900 block font-mono">Nº {congregacao.numero || 'S/N'}</span>
                <span className="text-xs text-typography-500 block">Formulário Oficial S-302-T</span>
              </div>
            </div>
          </div>

          {/* Card: Assinatura do Superintendente */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
              <PenTool size={14} className="text-amber-500" />
              <span>Assinatura do Superintendente</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-typography-700 uppercase tracking-wider">
                  Nome por Extenso / Assinatura em Texto
                </label>
                <input 
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                  placeholder="Nome do superintendente que assina"
                />
              </div>

              {/* Assinatura Gráfica / Imagem */}
              <div className="bg-surface-200/50 p-4 rounded-xl border border-surface-300/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-typography-700">Assinatura Digital / Imagem:</span>
                  {signatureImage && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>Assinatura Ativa</span>
                    </span>
                  )}
                </div>

                {signatureImage ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-surface-300">
                    <div className="h-14 w-48 flex items-center justify-center border border-dashed border-gray-200 bg-gray-50/50 rounded-lg p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={signatureImage} 
                        alt="Assinatura" 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={removeImageBackground}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-typography-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Remover fundo branco da imagem"
                      >
                        {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>Remover Fundo</span>
                      </button>
                      <button
                        onClick={() => setShowSignaturePad(true)}
                        className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-typography-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <PenTool size={13} />
                        <span>Redesenhar</span>
                      </button>
                      <button
                        onClick={handleRemoveSignature}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => setShowSignaturePad(true)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={14} />
                      <span>Desenhar Assinatura na Tela</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={14} />
                      <span>Enviar Foto da Assinatura</span>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-surface-300/80 text-xs text-typography-500">
              <span>Os dados preenchidos são aplicados instantaneamente ao formulário oficial S-302.</span>
              <button
                onClick={() => setActiveTab('preview')}
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Visualizar na folha oficial</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ABA 2: AVISO OFICIAL S-302 (PREVIEW E DESIGN) */}
      <div 
        className={activeTab === 'form' ? 'opacity-0 pointer-events-none absolute -left-[9999px] top-0' : 'block'}
      >
        <div className="relative w-full max-w-7xl mx-auto space-y-4">
          {/* Barra de Ferramentas de Zoom da Folha */}
          <div className="flex items-center justify-between bg-surface-100 p-2.5 sm:p-3 rounded-xl border border-surface-300 shadow-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-typography-700">Visualização do S-302:</span>
              <button
                onClick={() => setAutoFit(!autoFit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  autoFit 
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
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

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Sidebar do Modo Design (Admin) */}
            {isDesignMode && isAdmin && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full lg:w-80 shrink-0 space-y-4 print:hidden"
              >
                <div className="bg-surface-100 rounded-2xl shadow-xs border border-surface-300 p-5 space-y-4">
                  <h3 className="text-sm font-bold text-typography-900 flex items-center gap-2">
                    <Settings2 size={18} className="text-amber-500" />
                    <span>Ajustar Coordenadas</span>
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-typography-600 uppercase mb-1.5 block">
                        Elemento para ajustar
                      </label>
                      <CustomSelect 
                        value={selectedElement || ''} 
                        onChange={(val) => setSelectedElement((val || null) as keyof S302Layout)}
                        options={[
                          { value: '', label: 'Selecione...' },
                          { value: 'header', label: 'Cabeçalho (Título)' },
                          { value: 'body', label: 'Texto de Instrução' },
                          { value: 'congregation', label: 'Campo Congregação' },
                          { value: 'visitor', label: 'Campo Superintendente' },
                          { value: 'visitDate', label: 'Campo Data' },
                          { value: 'signature', label: 'Assinatura / Nome' },
                        ]}
                        size="sm"
                        placeholder="Selecione..."
                      />
                    </div>

                    {selectedElement && (
                      <div className="space-y-4 pt-3 border-t border-surface-300/80">
                        <div>
                          <div className="flex justify-between items-center mb-1 text-xs">
                            <span className="font-semibold text-typography-700 flex items-center gap-1">
                              <Move size={13} /> Posição Vertical
                            </span>
                            <span className="font-mono font-bold text-amber-600">
                              {selectedElement === 'signature' ? (layout.signature as any).bottom : (layout as any)[selectedElement].top}mm
                            </span>
                          </div>
                          <input 
                            type="range" min="0" max="138" step="1"
                            value={selectedElement === 'signature' ? (layout.signature as any).bottom : (layout as any)[selectedElement].top}
                            onChange={(e) => updateLayout(
                              selectedElement, 
                              selectedElement === 'signature' ? 'bottom' : 'top', 
                              parseInt(e.target.value)
                            )}
                            className="w-full accent-amber-500"
                          />
                        </div>

                        {selectedElement !== 'header' && (
                          <div>
                            <div className="flex justify-between items-center mb-1 text-xs">
                              <span className="font-semibold text-typography-700 flex items-center gap-1">
                                <Move size={13} className="rotate-90" /> Posição Horizontal
                              </span>
                              <span className="font-mono font-bold text-amber-600">
                                {selectedElement === 'signature' ? (layout.signature as any).right : (layout as any)[selectedElement].left}mm
                              </span>
                            </div>
                            <input 
                              type="range" min="0" max="200" step="1"
                              value={selectedElement === 'signature' ? (layout.signature as any).right : (layout as any)[selectedElement].left}
                              onChange={(e) => updateLayout(
                                selectedElement, 
                                selectedElement === 'signature' ? 'right' : 'left', 
                                parseInt(e.target.value)
                              )}
                              className="w-full accent-amber-500"
                            />
                          </div>
                        )}

                        <div>
                          <div className="flex justify-between items-center mb-1 text-xs">
                            <span className="font-semibold text-typography-700 flex items-center gap-1">
                              <Type size={13} /> Tamanho da Fonte
                            </span>
                            <span className="font-mono font-bold text-amber-600">
                              {(layout as any)[selectedElement].fontSize}pt
                            </span>
                          </div>
                          <input 
                            type="range" min="8" max="24" step="1"
                            value={(layout as any)[selectedElement].fontSize}
                            onChange={(e) => updateLayout(selectedElement, 'fontSize', parseInt(e.target.value))}
                            className="w-full accent-amber-500"
                          />
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleSaveLayout}
                      disabled={isSavingLayout}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2 cursor-pointer"
                    >
                      {isSavingLayout ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      <span>Salvar Posições</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Visualização da Folha Oficial S-302 */}
            <div className="flex-1 space-y-4">
              <div 
                ref={containerRef}
                className="bg-surface-200/50 shadow-inner rounded-2xl overflow-x-auto border border-surface-300 print:shadow-none print:border-none w-full print:max-w-none print:w-full print:m-0 print:p-0 flex justify-start sm:justify-center p-2 sm:p-6 custom-scrollbar scroll-smooth"
              >
                <div 
                  style={{ 
                    width: `${210 * scale}mm`, 
                    height: `${138 * scale}mm`,
                    minWidth: 'min-content',
                    display: 'flex',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  className="print:w-full print:h-auto"
                >
                  <div 
                    id="s302-print-container"
                    ref={previewRef}
                    className="bg-white shadow-lg print:shadow-none min-w-[210mm] w-[210mm] h-[138mm] relative font-serif-document text-black border border-gray-400 shrink-0 overflow-hidden print:overflow-visible"
                    style={{ 
                      backgroundColor: 'white',
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      transition: 'transform 0.15s ease-out'
                    }}
                  >
                    {/* Header */}
                    <h1 
                      className={`absolute left-0 right-0 text-center font-bold tracking-wide uppercase cursor-pointer transition-all ${selectedElement === 'header' ? 'bg-amber-500/10 ring-2 ring-amber-500 ring-inset' : ''}`}
                      style={{ 
                        top: `${layout.header.top}mm`, 
                        fontSize: `${layout.header.fontSize}pt` 
                      }}
                      onClick={() => isDesignMode && setSelectedElement('header')}
                    >
                      AVISO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO
                    </h1>
      
                    {/* Body Content */}
                    <div 
                      className={`absolute cursor-pointer transition-all ${selectedElement === 'body' ? 'bg-amber-500/10 ring-2 ring-amber-500 ring-inset' : ''}`}
                      style={{ 
                        top: `${layout.body.top}mm`, 
                        left: `${layout.body.left}mm`,
                        right: '15mm',
                        fontSize: `${layout.body.fontSize}pt`,
                        lineHeight: '1.4'
                      }}
                      onClick={() => isDesignMode && setSelectedElement('body')}
                    >
                      <p className="mb-[8pt]">Prezados Irmãos:</p>
                      <p className="indent-[40pt] text-justify">
                        Por favor notem os seguintes arranjos para a próxima visita do supe- rintendente de circuito. 
                        Informe a congregação e depois coloque este aviso no quadro de anúncios.
                      </p>
                    </div>

                    <div 
                      className={`absolute flex items-end cursor-pointer transition-all ${selectedElement === 'congregation' ? 'bg-amber-500/10 ring-2 ring-amber-500 ring-inset' : ''}`}
                      style={{ 
                        top: `${layout.congregation.top}mm`,
                        left: `${layout.congregation.left}mm`, 
                        right: '15mm' 
                      }}
                      onClick={() => isDesignMode && setSelectedElement('congregation')}
                    >
                      <span className="whitespace-nowrap pr-2" style={{ fontSize: `${layout.congregation.fontSize}pt` }}>Congregação:</span>
                      <div className="flex-1 border-b border-black border-dotted font-bold px-3 min-h-[1.5em] flex items-end">
                        {fullCongName}
                      </div>
                    </div>

                    <div 
                      className={`absolute flex items-end cursor-pointer transition-all ${selectedElement === 'visitor' ? 'bg-amber-500/10 ring-2 ring-amber-500 ring-inset' : ''}`}
                      style={{ 
                        top: `${layout.visitor.top}mm`,
                        left: `${layout.visitor.left}mm`, 
                        right: '15mm' 
                      }}
                      onClick={() => isDesignMode && setSelectedElement('visitor')}
                    >
                      <span className="whitespace-nowrap pr-2" style={{ fontSize: `${layout.visitor.fontSize}pt` }}>Superintendente de circuito:</span>
                      <div className="flex-1 border-b border-black border-dotted font-bold px-3 min-h-[1.5em] flex items-end">
                        {visitorName}
                      </div>
                    </div>

                    <div 
                      className={`absolute flex items-end cursor-pointer transition-all ${selectedElement === 'visitDate' ? 'bg-amber-500/10 ring-2 ring-amber-500 ring-inset' : ''}`}
                      style={{ 
                        top: `${layout.visitDate.top}mm`,
                        left: `${layout.visitDate.left}mm`, 
                        right: '15mm' 
                      }}
                      onClick={() => isDesignMode && setSelectedElement('visitDate')}
                    >
                      <span className="whitespace-nowrap pr-2" style={{ fontSize: `${layout.visitDate.fontSize}pt` }}>Data da visita:</span>
                      <div className="flex-1 border-b border-black border-dotted font-bold px-3 min-h-[1.5em] flex items-end">
                        {data}
                      </div>
                    </div>
                    
                    {/* Signature Block */}
                    <div 
                      className={`absolute flex flex-col items-center cursor-pointer transition-all ${selectedElement === 'signature' ? 'bg-amber-500/10 ring-2 ring-amber-500 ring-inset' : ''}`}
                      style={{ 
                        bottom: `${layout.signature.bottom}mm`, 
                        right: `${layout.signature.right}mm`,
                        width: `${layout.signature.width}mm`
                      }}
                      onClick={() => isDesignMode && setSelectedElement('signature')}
                    >
                      <div className="w-full text-center mb-[4pt]" style={{ fontSize: `${layout.signature.fontSize}pt` }}>Seu irmão,</div>
                      
                      <div className="w-full relative flex flex-col items-center group">
                        <div 
                          className="w-full relative flex items-end justify-center transition-transform"
                          style={{ 
                            height: `${layout.signature.imageHeight || 12}mm`,
                            marginBottom: `${layout.signature.imageOffset || 0}mm`,
                            transform: `translateX(${layout.signature.imageShiftX || 0}mm)`
                          }}
                        >
                          {!signatureImage && (
                            <span className="font-signature text-[#004aad] text-2xl leading-none">{signatureName}</span>
                          )}
                        </div>
                        <div className="w-full border-b border-black"></div>
                      </div>
                    </div>

                    {signatureImage && signaturePlacement && (
                      <DraggableSignature 
                        image={signatureImage}
                        initialX={signaturePlacement.x}
                        initialY={signaturePlacement.y}
                        initialScale={signaturePlacement.scale}
                        onSave={handleSignaturePlacementSave}
                        containerRef={previewRef}
                      />
                    )}

                    <div className="absolute bottom-[0.8cm] left-[1.5cm] flex gap-[20pt] text-[11pt] font-sans">
                      <span>S-302-T</span>
                      <span>12/14</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad 
          initialName={personalData?.nome || signatureName}
          onSave={handleSignaturePadSave}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}

      {/* Image Cropper for Signature */}
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

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #s302-print-container, #s302-print-container * {
            visibility: visible !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #s302-print-container {
            display: block !important;
            position: absolute !important;
            top: 20mm !important;
            left: 0 !important;
            right: 0 !important;
            margin-left: auto !important;
            margin-right: auto !important;
            width: 210mm !important;
            height: 138mm !important;
            border: 0.5pt solid #000 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            z-index: 9999 !important;
            background: white !important;
            transform: scale(0.85) !important;
            transform-origin: top center !important;
          }
        }
      `}} />
    </div>
  );
}
