'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  Save, 
  Loader2,
  Printer,
  FileDown,
  Bold,
  Italic,
  Type,
  Palette,
  Plus,
  Minus,
  ChevronDown,
  Edit3,
  FileText,
  Maximize2,
  Minimize2,
  RotateCcw,
  CheckCircle2,
  Building2,
  Calendar,
  UserCheck,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const FONT_OPTIONS = [
  { name: 'Arimo', value: "'Arimo', Arial, Helvetica, sans-serif", label: 'Arimo (Padrão JW)' },
  { name: 'Arial', value: "Arial, Helvetica, sans-serif", label: 'Arial (Sem Serifa)' },
  { name: 'Times New Roman', value: "'Times New Roman', Times, serif", label: 'Times New Roman (Clássica)' },
  { name: 'Georgia', value: "Georgia, serif", label: 'Georgia (Elegante)' },
  { name: 'Calibri', value: "Calibri, Candara, 'Segoe UI', sans-serif", label: 'Calibri (Moderna)' },
  { name: 'Garamond', value: "Garamond, 'Baskerville', serif", label: 'Garamond (Editorial)' },
  { name: 'Verdana', value: "Verdana, Geneva, sans-serif", label: 'Verdana (Nítida)' },
  { name: 'Trebuchet MS', value: "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif", label: 'Trebuchet MS (Humanista)' },
  { name: 'Courier New', value: "'Courier New', Courier, monospace", label: 'Courier New (Monoespaçada)' },
  { name: 'Book Antiqua', value: "'Book Antiqua', Palatino, serif", label: 'Book Antiqua (Livro)' },
  { name: 'Century Gothic', value: "'Century Gothic', CenturyGothic, sans-serif", label: 'Century Gothic (Geométrica)' },
  { name: 'Tahoma', value: "Tahoma, Verdana, sans-serif", label: 'Tahoma (Compacta)' },
];

export const COLOR_PALETTE = [
  '#000000', // Preto clássico
  '#1f2937', // Cinza escuro
  '#4b5563', // Cinza neutro
  '#1e3a8a', // Azul marinho
  '#2563eb', // Azul real
  '#0284c7', // Ciano
  '#0f766e', // Verde azulado / Teal
  '#15803d', // Verde floresta
  '#b45309', // Âmbar escuro
  '#c2410c', // Laranja escuro
  '#b91c1c', // Vermelho escuro
  '#831843', // Vinho / Borgonha
  '#6b21a8', // Roxo
  '#3730a3', // Índigo
];

interface S303ReportViewProps {
  userId: string;
  congregation: {
    nome: string;
    numero: string;
    cidade: string;
    estado: string;
  };
  visitDate: string;
  substituteName?: string;
  onBack: () => void;
}

export default function S303ReportView({ userId, congregation, visitDate, substituteName, onBack }: S303ReportViewProps) {
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [initialReportText, setInitialReportText] = useState('');
  const [reportFontSize, setReportFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("'Arimo', Arial, Helvetica, sans-serif");
  const [textColor, setTextColor] = useState('#000000');
  const [showToolbar, setShowToolbar] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showFormFontPicker, setShowFormFontPicker] = useState(false);
  const [showFormColorPicker, setShowFormColorPicker] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportHeight, setReportHeight] = useState(90);
  
  // Tab Switch: 'form' (Mobile/Editor) vs 'preview' (Folha A4)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('preview');
  // Auto-fit mode for preview (estilo leitor de PDF)
  const [autoFit, setAutoFit] = useState(true);
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  const editableRef = useRef<HTMLDivElement>(null);
  const formEditableRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [personalData, setPersonalData] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showScrollArrows, setShowScrollArrows] = useState(false);

  const checkScrollState = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < maxScroll - 5);
    setShowScrollArrows(maxScroll > 15);
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = Math.max(200, containerRef.current.clientWidth * 0.6);
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
    setTimeout(checkScrollState, 150);
  };

  // Cálculo da Escala Ideal para Ajustar à Tela (Focus PURAMENTE na LARGURA HORIZONTAL)
  const calculateAutoFitScale = () => {
    if (!containerRef.current) return 1;
    const containerWidth = containerRef.current.clientWidth;
    // Largura útil disponível com margens confortáveis
    const availableWidth = Math.max(240, containerWidth - 32);
    const a4WidthPx = 1123; // 297mm em 96dpi (297 / 25.4 * 96)
    
    // Ajuste perfeito focado na LARGURA (HORIZONTAL)
    const calculated = availableWidth / a4WidthPx;
    
    return Math.max(0.35, Number(calculated.toFixed(3)));
  };

  // Observador de Redimensionamento e Ajuste Automático
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      if (autoFit) {
        const newScale = calculateAutoFitScale();
        setScale(newScale);
        setShowScrollArrows(false);
      } else {
        setTimeout(checkScrollState, 50);
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    handleResize();

    const timer = setTimeout(handleResize, 100);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [autoFit, activeTab, scale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => checkScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    checkScrollState();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scale, autoFit, activeTab]);

  const ZOOM_STEPS = [0.35, 0.5, 0.65, 0.75, 0.85, 1.0, 1.15, 1.25, 1.5, 1.75, 2.0];

  const handleZoomIn = () => {
    setAutoFit(false);
    setScale(prev => {
      const next = ZOOM_STEPS.find(s => s > prev + 0.04);
      return next ? next : Math.min(2.5, Number((prev + 0.15).toFixed(2)));
    });
    setShowZoomMenu(false);
  };

  const handleZoomOut = () => {
    setAutoFit(false);
    setScale(prev => {
      const prevStep = [...ZOOM_STEPS].reverse().find(s => s < prev - 0.04);
      return prevStep ? prevStep : Math.max(0.25, Number((prev - 0.15).toFixed(2)));
    });
    setShowZoomMenu(false);
  };

  const handleSetZoom = (newScale: number) => {
    setAutoFit(false);
    setScale(newScale);
    setShowZoomMenu(false);
  };

  const handleToggleAutoFit = () => {
    if (autoFit) {
      // Se já estava em autoFit, alterna para tamanho real 100%
      setAutoFit(false);
      setScale(1.0);
    } else {
      // Se estava em zoom manual, ativa o ajuste automático à tela
      setAutoFit(true);
      const fitScale = calculateAutoFitScale();
      setScale(fitScale);
    }
    setShowZoomMenu(false);
  };

  const isDirty = reportText !== initialReportText;

  const AutoScalingHeaderData = ({ text, baseFontSize = 18 }: { text: string, baseFontSize?: number }) => {
    const containerElRef = useRef<HTMLDivElement>(null);
    const [fontSize, setFontSize] = useState(baseFontSize);

    useEffect(() => {
      if (!containerElRef.current) return;
      
      const container = containerElRef.current;
      let currentSize = baseFontSize;
      container.style.fontSize = `${currentSize}px`;
      
      const timer = setTimeout(() => {
        while (container.scrollWidth > container.clientWidth && currentSize > 8) {
          currentSize -= 0.5;
          container.style.fontSize = `${currentSize}px`;
        }
        setFontSize(currentSize);
      }, 0);
      
      return () => clearTimeout(timer);
    }, [text, baseFontSize]);

    return (
      <div 
        ref={containerElRef}
        className="border-b border-black flex-grow h-[1.2em] px-2 font-medium whitespace-nowrap overflow-hidden print:border-b print:border-black"
        style={{ fontSize: `${fontSize}px`, lineHeight: '1.2em', borderBottom: '1px solid #000000' }}
      >
        {text}
      </div>
    );
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0 && 
        (editableRef.current?.contains(selection.anchorNode) || formEditableRef.current?.contains(selection.anchorNode));
      setShowToolbar(!!hasSelection);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Sync contentEditable elements with state reliably whenever data is loaded or activeTab changes
  useEffect(() => {
    if (editableRef.current && editableRef.current.innerHTML !== reportText) {
      editableRef.current.innerHTML = reportText || '';
    }
    if (formEditableRef.current && formEditableRef.current.innerHTML !== reportText) {
      formEditableRef.current.innerHTML = reportText || '';
    }
  }, [loading, reportText, activeTab]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      // Aguarda de forma não-bloqueante se o auth do Firebase ainda estiver inicializando,
      // mas continua mesmo em login por chave de acesso (passkey) sem travar no loop de loading.
      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        let attempts = 0;
        while ((!auth.currentUser || auth.currentUser.uid !== userId) && attempts < 5) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }

      try {
        const pdRef = doc(db, 'personal_data', userId);
        const pdSnap = await getDoc(pdRef);
        if (pdSnap.exists()) {
          setPersonalData(pdSnap.data());
        } else {
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setPersonalData(snap.docs[0].data());
          }
        }

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const adminEmails = ["weldonrs@gmail.com", "2283701@progcir.app", "2283701@progcir.com"];
          const userEmail = userData.email?.toLowerCase();
          setIsAdmin(userData.role === 'admin' || adminEmails.includes(userEmail));
        }

        const reportId = `${userId}_${congregation.nome}_${visitDate.replace(/\//g, '-')}`;
        const reportRef = doc(db, 's303_reports', reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) {
          const data = reportSnap.data();
          const text = data.relatorio || '';
          setReportText(text);
          setInitialReportText(text);
          
          if (data.reportHeight) setReportHeight(data.reportHeight);
          
          if (data.textStyles) {
            if (data.textStyles.fontSize) setReportFontSize(data.textStyles.fontSize);
            if (data.textStyles.color) setTextColor(data.textStyles.color);
            if (data.textStyles.fontFamily) setFontFamily(data.textStyles.fontFamily);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 's303_report');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregation.nome, visitDate]);

  useEffect(() => {
    const editable = editableRef.current;
    if (!editable) return;

    const adjustFontSize = () => {
      const isOverflowing = editable.scrollHeight > editable.clientHeight;
      
      if (isOverflowing) {
        if (reportFontSize > 8) {
          setReportFontSize(prev => Math.max(8, prev - 0.4));
        }
      } else if (reportFontSize < 14) {
        const estimatedLineHeight = reportFontSize * 1.6;
        if (editable.clientHeight - editable.scrollHeight > estimatedLineHeight) {
          setReportFontSize(prev => Math.min(14, prev + 0.4));
        }
      }
    };

    const timeoutId = setTimeout(adjustFontSize, 50);
    return () => clearTimeout(timeoutId);
  }, [reportText, reportFontSize]);

  const handleTextChange = (source: 'preview' | 'form') => {
    let newContent = '';
    if (source === 'preview' && editableRef.current) {
      newContent = editableRef.current.innerHTML;
      if (formEditableRef.current && formEditableRef.current.innerHTML !== newContent) {
        formEditableRef.current.innerHTML = newContent;
      }
    } else if (source === 'form' && formEditableRef.current) {
      newContent = formEditableRef.current.innerHTML;
      if (editableRef.current && editableRef.current.innerHTML !== newContent) {
        editableRef.current.innerHTML = newContent;
      }
    }
    setReportText(newContent);
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (activeTab === 'preview') {
      handleTextChange('preview');
      editableRef.current?.focus();
    } else {
      handleTextChange('form');
      formEditableRef.current?.focus();
    }
  };

  const handleApplyFont = (fontValue: string) => {
    setFontFamily(fontValue);
    execCommand('fontName', fontValue);
    setShowFontPicker(false);
    setShowFormFontPicker(false);
  };

  const handleApplyColor = (colorHex: string) => {
    setTextColor(colorHex);
    execCommand('foreColor', colorHex);
    setShowColorPicker(false);
    setShowFormColorPicker(false);
  };

  const handleSave = async (shouldExit = false) => {
    setSaving(true);
    try {
      const reportId = `${userId}_${congregation.nome}_${visitDate.replace(/\//g, '-')}`;
      await setDoc(doc(db, 's303_reports', reportId), {
        userId,
        congregacao: congregation.nome,
        dataVisita: visitDate,
        relatorio: reportText,
        reportHeight,
        updatedAt: new Date().toISOString(),
        textStyles: {
          fontSize: reportFontSize,
          color: textColor,
          fontFamily
        }
      });
      setInitialReportText(reportText);
      showAlert('Relatório S-303 salvo com sucesso.', 'Sucesso');
      if (shouldExit) {
        onBack();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 's303_report_save');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    if (isDirty) {
      await handleSave(true);
    } else {
      onBack();
    }
  };

  const handlePrint = () => {
    if (activeTab === 'form' && formEditableRef.current) {
      const content = formEditableRef.current.innerHTML;
      setReportText(content);
      if (editableRef.current) editableRef.current.innerHTML = content;
    }
    setActiveTab('preview');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getFormattedFilename = () => {
    let secondDate = visitDate;
    if (visitDate.includes(' - ')) {
      const parts = visitDate.split(' - ');
      secondDate = parts[1] || parts[0];
    }
    return `S-303 (${secondDate}) ${congregation.nome}.pdf`;
  };

  const handleSavePDF = async () => {
    if (activeTab === 'form' && formEditableRef.current) {
      const content = formEditableRef.current.innerHTML;
      setReportText(content);
      if (editableRef.current) editableRef.current.innerHTML = content;
    }
    setActiveTab('preview');
    await new Promise(resolve => setTimeout(resolve, 150));
    const element = document.getElementById('s303-report-container');
    if (!element) return;

    const filename = getFormattedFilename();

    setGenerating(true);
    try {
      const dataUrl = await toJpeg(element, {
        quality: 0.9,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 1122.5,
        height: 793.7,
        style: {
          margin: '0',
          boxShadow: 'none',
          borderRadius: '0',
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfScale = 0.95;
      const w = 297 * pdfScale;
      const h = 210 * pdfScale;
      const x = (297 - w) / 2;
      const y = (210 - h) / 2;

      pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showAlert('Ocorreu um erro ao gerar o arquivo PDF.', 'Erro');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-primary-200" size={42} />
        <p className="text-typography-500 font-medium text-sm">Carregando relatório S-303...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-x-hidden pb-12">
      {/* Header Unificado com Design System */}
      <div className="relative bg-surface-100 p-4 sm:p-5 rounded-2xl border border-surface-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden print:hidden">
        {/* Faixa Gradiente Superior */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-90"
          style={{ backgroundImage: 'linear-gradient(to right, #6366F1, #8B5CF6, transparent)' }}
        />

        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 cursor-pointer shrink-0"
            title="Voltar"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 shrink-0">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-typography-900 tracking-tight truncate">
              S-303 Relatório sobre a Visita
            </h2>
            <p className="text-xs text-typography-500 truncate flex items-center gap-1.5 mt-0.5">
              <span className="font-semibold text-typography-700">{congregation.nome}</span>
              <span>•</span>
              <span>Visita: {visitDate}</span>
            </p>
          </div>
        </div>

        {/* Controles de Ação & Abas */}
        <div className="flex flex-wrap items-center gap-2.5 justify-start md:justify-end">
          {/* Seletor de Modo: Formulário (Mobile Friendly) vs Folha Oficial */}
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
              title="Visualizar Folha A4"
            >
              <FileText size={14} />
              <span>Folha A4</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleSave(false)}
              disabled={saving}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isDirty 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse' 
                  : 'bg-surface-200 hover:bg-surface-300 text-typography-700 border border-surface-300'
              }`}
              title="Salvar alterações"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Salvando...' : 'Salvar'}</span>
            </button>

            <button 
              onClick={handleSavePDF}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Baixar em formato PDF"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              <span className="hidden sm:inline">{generating ? 'Gerando...' : 'Baixar PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button 
              onClick={handlePrint}
              className="bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Imprimir documento"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <span>⚠️</span>
          <div className="flex-grow">{error}</div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <Plus size={18} className="rotate-45" />
          </button>
        </div>
      )}

      {/* ABA 1: MODO FORMULÁRIO (100% RESPONSIVO & AMIGÁVEL PARA CELULAR) */}
      <div 
        className={activeTab === 'form' ? 'space-y-5 max-w-4xl mx-auto block' : 'hidden'}
      >
          {/* Card de Resumo da Visita */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-surface-200/60 p-2.5 rounded-xl border border-surface-300/40">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Congregação</span>
                <span className="font-bold text-typography-900 truncate block">{congregation.nome}</span>
                <span className="text-[10px] text-typography-500 font-mono">Nº {congregation.numero}</span>
              </div>
              <div className="bg-surface-200/60 p-2.5 rounded-xl border border-surface-300/40">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Cidade / UF</span>
                <span className="font-bold text-typography-900 truncate block">{congregation.cidade} - {congregation.estado}</span>
              </div>
              <div className="bg-surface-200/60 p-2.5 rounded-xl border border-surface-300/40">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Datas da Visita</span>
                <span className="font-bold text-typography-900 truncate block">{visitDate}</span>
              </div>
              <div className="bg-surface-200/60 p-2.5 rounded-xl border border-surface-300/40">
                <span className="text-[10px] text-typography-400 font-semibold block uppercase">Sup. Circuito</span>
                <span className="font-bold text-typography-900 truncate block">
                  {substituteName ? `${substituteName} (SCS)` : (personalData?.nome || 'Viajante')}
                </span>
                <span className="text-[10px] text-typography-500">{personalData?.circuito || 'Circuito'}</span>
              </div>
            </div>
          </div>

          {/* Card do Editor de Texto */}
          <div className="bg-surface-100 rounded-2xl border border-surface-300 shadow-xs overflow-visible">
            <div className="p-4 sm:p-5 border-b border-surface-300/80 bg-surface-100/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="max-w-md">
                <p className="text-xs text-typography-600 dark:text-typography-400 font-medium leading-relaxed">
                  Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
                </p>
              </div>

              {/* Barra completa de formatação da fonte */}
              <div className="flex flex-wrap items-center gap-1.5 bg-surface-200 p-1.5 rounded-xl border border-surface-300/60 shrink-0">
                {/* 1. Mudar a Fonte (12 fontes disponíveis) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowFormFontPicker(!showFormFontPicker); setShowFormColorPicker(false); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-100 hover:bg-surface-300/60 text-typography-800 rounded-lg text-xs font-semibold border border-surface-300/60 transition-all cursor-pointer shadow-2xs"
                    title="Mudar a fonte do relatório"
                  >
                    <Type size={14} className="text-indigo-500" />
                    <span className="max-w-[110px] truncate">
                      {fontFamily.split(',')[0].replace(/'/g, '')}
                    </span>
                    <ChevronDown size={13} className="text-typography-400" />
                  </button>

                  {showFormFontPicker && (
                    <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1.5 bg-surface-100 border border-surface-300 rounded-xl shadow-xl py-1.5 min-w-[220px] max-h-72 overflow-y-auto z-40 divide-y divide-surface-200">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-typography-400">
                        Família de Fonte (12 Opções)
                      </div>
                      <div className="py-1">
                        {FONT_OPTIONS.map((f) => (
                          <button
                            key={f.name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleApplyFont(f.value);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-indigo-500/10 text-xs transition-all flex items-center justify-between cursor-pointer ${
                              fontFamily.includes(f.name) ? 'bg-indigo-500/15 font-bold text-indigo-600 dark:text-indigo-400' : 'text-typography-800'
                            }`}
                            style={{ fontFamily: f.value }}
                          >
                            <span>{f.label}</span>
                            {fontFamily.includes(f.name) && <span className="text-[11px] text-indigo-500 font-bold">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-px h-5 bg-surface-300 mx-0.5" />

                {/* 2. Negrito & Itálico */}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                  className="p-1.5 rounded-lg text-typography-700 hover:text-typography-900 hover:bg-surface-100 transition-colors cursor-pointer"
                  title="Negrito"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
                  className="p-1.5 rounded-lg text-typography-700 hover:text-typography-900 hover:bg-surface-100 transition-colors cursor-pointer"
                  title="Itálico"
                >
                  <Italic size={14} />
                </button>

                <div className="w-px h-5 bg-surface-300 mx-0.5" />

                {/* 3. Tamanho da Fonte */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.max(8, prev - 1)); }}
                    className="p-1.5 rounded-lg text-typography-700 hover:bg-surface-100 transition-colors cursor-pointer"
                    title="Diminuir tamanho da fonte"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="text-[11px] font-bold text-typography-800 px-1 min-w-[28px] text-center">
                    {reportFontSize}pt
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.min(24, prev + 1)); }}
                    className="p-1.5 rounded-lg text-typography-700 hover:bg-surface-100 transition-colors cursor-pointer"
                    title="Aumentar tamanho da fonte"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div className="w-px h-5 bg-surface-300 mx-0.5" />

                {/* 4. Alterar Cor da Fonte */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowFormColorPicker(!showFormColorPicker); setShowFormFontPicker(false); }}
                    className="p-1.5 bg-surface-100 hover:bg-surface-300/60 rounded-lg transition-all flex items-center gap-1.5 border border-surface-300/60 cursor-pointer shadow-2xs"
                    title="Alterar cor da fonte"
                  >
                    <Palette size={14} style={{ color: textColor }} />
                    <div className="w-3.5 h-3.5 rounded-full border border-surface-300 shadow-2xs" style={{ backgroundColor: textColor }} />
                    <ChevronDown size={11} className="text-typography-400" />
                  </button>

                  {showFormColorPicker && (
                    <div className="absolute top-full right-0 mt-1.5 bg-surface-100 border border-surface-300 rounded-xl shadow-xl p-3 z-40 min-w-[230px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-typography-400">Cor da Fonte</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-semibold text-typography-600">{textColor}</span>
                          <label className="relative cursor-pointer">
                            <span className="text-[10px] px-1.5 py-0.5 bg-surface-200 hover:bg-surface-300 rounded text-typography-700 font-semibold border border-surface-300">
                              Personalizada
                            </span>
                            <input
                              type="color"
                              value={textColor}
                              onChange={(e) => handleApplyColor(e.target.value)}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleApplyColor(c);
                            }}
                            className={`w-6 h-6 rounded-lg border transition-transform hover:scale-115 cursor-pointer flex items-center justify-center ${
                              textColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-indigo-500 ring-offset-1 border-white' : 'border-black/10'
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          >
                            {textColor.toLowerCase() === c.toLowerCase() && (
                              <span className="text-[10px] text-white drop-shadow-sm font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Área de Digitação do Formulário */}
            <div className="p-4 sm:p-5">
              <div 
                ref={formEditableRef}
                contentEditable
                onInput={() => handleTextChange('form')}
                className="w-full min-h-[260px] p-4 bg-surface-200/50 border border-surface-300 rounded-xl font-sans text-sm sm:text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-typography-400"
                data-placeholder="Digite as considerações sobre o espírito da congregação e os conselhos dados..."
                style={{
                  fontFamily,
                  color: textColor,
                  fontSize: `${Math.max(14, reportFontSize)}px`
                }}
              />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-surface-300/80 text-xs text-typography-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Texto sincronizado automaticamente com a folha oficial A4</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver como fica na folha oficial</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* ABA 2: FOLHA OFICIAL A4 (PREVIEW E IMPRESSÃO) */}
      <div 
        className={activeTab === 'form' ? 'opacity-0 pointer-events-none absolute -left-[9999px] top-0 print:opacity-100 print:pointer-events-auto print:static print:left-auto print:block' : 'block print:block w-full max-w-full min-w-0 overflow-x-hidden'}
      >
        <div className="relative w-full max-w-7xl mx-auto space-y-3 min-w-0 overflow-x-hidden">
          {/* Setas de rolagem quando necessário */}
          {/* Setas de rolagem quando a folha excede a tela */}
          <AnimatePresence>
            {showScrollArrows && !autoFit && (
              <>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: canScrollLeft ? 1 : 0.4, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => scrollContainer('left')}
                  disabled={!canScrollLeft}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-surface-100/95 dark:bg-surface-800/95 backdrop-blur-md p-2.5 rounded-full shadow-xl border border-surface-300 dark:border-surface-600 text-typography-700 dark:text-typography-200 hover:text-primary-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                  aria-label="Rolar para esquerda"
                  title="Rolar formulário para a esquerda"
                >
                  <ChevronLeft size={22} />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: canScrollRight ? 1 : 0.4, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => scrollContainer('right')}
                  disabled={!canScrollRight}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-surface-100/95 dark:bg-surface-800/95 backdrop-blur-md p-2.5 rounded-full shadow-xl border border-surface-300 dark:border-surface-600 text-typography-700 dark:text-typography-200 hover:text-primary-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                  aria-label="Rolar para direita"
                  title="Rolar formulário para a direita"
                >
                  <ChevronRight size={22} />
                </motion.button>
              </>
            )}
          </AnimatePresence>

          {/* Container da Folha Oficial estilo Leitor de PDF */}
          <div 
            ref={containerRef}
            className="bg-slate-200/50 dark:bg-slate-900/60 shadow-inner rounded-2xl overflow-x-auto overflow-y-auto border border-surface-300/80 print:shadow-none print:border-none w-full max-w-full min-w-0 print:max-w-none print:w-full print:m-0 print:p-0 block p-3 sm:p-6 md:p-8 custom-scrollbar scroll-smooth relative min-h-[500px]"
          >
            <div className="min-w-full w-max flex justify-center items-start mx-auto">
              <div 
                style={{ 
                  width: `${297 * scale}mm`, 
                  height: `${210 * scale}mm`,
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'width 0.15s ease-out, height 0.15s ease-out',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  minWidth: `${297 * scale}mm`
                }}
                className="print:w-full print:h-auto"
              >
                <div 
                  id="s303-report-container" 
                  className="bg-white print:min-h-0 text-black print:m-0 flex flex-col print:w-[297mm] print:h-[210mm] print:fixed print:top-0 print:left-0 print:right-0 print:bottom-0 print:m-auto print:z-[100] flex-shrink-0 shadow-[0_12px_45px_-8px_rgba(0,0,0,0.22)] print:shadow-none border border-slate-200/90 print:border-none"
                  style={{ 
                    fontFamily: "'Arimo', Arial, Helvetica, sans-serif",
                    padding: '15mm',
                    width: '297mm',
                    minWidth: '297mm',
                    height: '210mm',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.15s ease-out'
                  }}
                >
                <div 
                  data-s303-header="true"
                  className="s303-report-header mb-[5mm] block w-full print:block"
                  role="banner"
                >
                  <h1 className="text-center font-bold text-[19px] tracking-tight leading-tight uppercase w-full">
                    RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
                  </h1>
                </div>

                <section className="space-y-[5mm] text-[15px] w-full">
                  {/* Row 1 */}
                  <div className="flex items-baseline w-full">
                    <div className="flex items-baseline w-[45%]">
                      <span className="whitespace-nowrap pr-1 font-normal tracking-tight">Número da congregação:</span>
                      <AutoScalingHeaderData text={congregation.numero} />
                    </div>
                    <div className="flex items-baseline w-[55%] pl-8">
                      <span 
                        className="whitespace-nowrap pr-1 font-normal tracking-tight"
                        style={{ marginLeft: '-30px' }}
                      >Datas em que visitou:</span>
                      <AutoScalingHeaderData text={visitDate} />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="flex items-baseline w-full">
                    <div className="flex items-baseline w-[45%]">
                      <span className="whitespace-nowrap pr-1 font-normal tracking-tight">Nome da congregação:</span>
                      <AutoScalingHeaderData text={congregation.nome} />
                    </div>
                    <div className="flex items-baseline w-[55%] pl-8">
                      <div className="flex items-baseline w-[55%]">
                        <span 
                          className="whitespace-nowrap pr-1 font-normal tracking-tight"
                          style={{ marginLeft: '-30px' }}
                        >Cidade:</span>
                        <AutoScalingHeaderData text={congregation.cidade} />
                      </div>
                      <div className="flex items-baseline w-[45%] pl-4">
                        <span 
                          className="whitespace-nowrap pr-1 font-normal text-[16px] tracking-tighter"
                          style={{ marginLeft: '-12px' }}
                        >Província ou estado:</span>
                        <AutoScalingHeaderData text={congregation.estado} />
                      </div>
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="flex items-baseline w-full">
                    <div className="flex items-baseline w-[45%]">
                      <span className="whitespace-nowrap pr-1 font-normal tracking-tight">Sup. de circuito:</span>
                      <AutoScalingHeaderData text={substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '')} />
                    </div>
                    <div className="flex items-baseline w-[55%] pl-8">
                      <div className="flex items-baseline w-full">
                        <span 
                          className="whitespace-nowrap pr-1 font-normal tracking-tight"
                          style={{ marginLeft: '-30px' }}
                        >Número do circuito:</span>
                        <AutoScalingHeaderData text={personalData?.circuito || ''} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Main Divider */}
                <div 
                  className="border-b-[1.5px] border-black w-full"
                  style={{ height: '1px', marginTop: '2.5mm', marginBottom: '2.5mm', borderBottom: '1.5px solid #000000' }}
                ></div>

                {/* Instruction Text */}
                <section className="w-full">
                  <p className="text-[16px] font-normal leading-tight">
                    Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
                  </p>
                </section>

                <div className="relative flex-grow">
                  {/* Toolbar Popup - Escala compensada para que os botões e menus fiquem sempre no tamanho normal da tela */}
                  {showToolbar && (
                    <motion.div 
                      ref={toolbarRef}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      style={{
                        transform: `scale(${1 / scale})`,
                        transformOrigin: 'bottom left',
                      }}
                      className="absolute -top-16 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 flex items-center gap-1 print:hidden"
                    >
                      <div className="relative">
                        <button 
                          onClick={() => setShowFontPicker(!showFontPicker)}
                          className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-lg text-sm font-medium transition-all"
                        >
                          <span className="max-w-[80px] truncate">
                            {fontFamily.split(',')[0].replace(/'/g, '')}
                          </span>
                          <ChevronDown size={14} />
                        </button>
                        {showFontPicker && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[210px] max-h-72 overflow-y-auto z-30">
                            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Família de Fonte (12 Opções)
                            </div>
                            {FONT_OPTIONS.map(f => (
                              <button
                                key={f.name}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleApplyFont(f.value);
                                }}
                                className={`w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-xs transition-all flex items-center justify-between ${
                                  fontFamily.includes(f.name) ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-800'
                                }`}
                                style={{ fontFamily: f.value }}
                              >
                                <span>{f.label}</span>
                                {fontFamily.includes(f.name) && <span className="text-indigo-600 text-[11px]">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="w-px h-6 bg-gray-200 mx-1" />

                      <div className="flex items-center gap-0.5">
                        <button 
                          onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.max(8, prev - 0.5)); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                          title="Diminuir fonte"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-sm font-bold min-w-[32px] text-center">{parseFloat(reportFontSize.toFixed(1)).toString().replace('.', ',')}</span>
                        <button 
                          onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.min(24, prev + 0.5)); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                          title="Aumentar fonte"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="w-px h-6 bg-gray-200 mx-1" />

                      <button 
                        onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                        className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                        title="Negrito"
                      >
                        <Bold size={16} />
                      </button>
                      <button 
                        onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
                        className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                        title="Itálico"
                      >
                        <Italic size={16} />
                      </button>

                      <div className="w-px h-6 bg-gray-200 mx-1" />

                      <div className="relative">
                        <button 
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all flex flex-col items-center gap-0.5"
                          title="Cor do texto"
                        >
                          <Palette size={16} style={{ color: textColor }} />
                          <div className="w-3 h-0.5" style={{ backgroundColor: textColor }} />
                        </button>
                        {showColorPicker && (
                          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-30 min-w-[240px]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cor da Fonte</h4>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-gray-600">{textColor}</span>
                                <label className="relative cursor-pointer">
                                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-semibold border border-gray-200">
                                    Mais cores
                                  </span>
                                  <input
                                    type="color"
                                    value={textColor}
                                    onChange={(e) => handleApplyColor(e.target.value)}
                                    className="sr-only"
                                  />
                                </label>
                              </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1.5">
                              {COLOR_PALETTE.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleApplyColor(c);
                                  }}
                                  className={`w-6 h-6 rounded-md border transition-all hover:scale-115 flex items-center justify-center cursor-pointer ${
                                    textColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-indigo-500 ring-offset-1 border-white' : 'border-gray-200'
                                  }`}
                                  style={{ backgroundColor: c }}
                                  title={c}
                                >
                                  {textColor.toLowerCase() === c.toLowerCase() && (
                                    <span className="text-[10px] text-white drop-shadow font-bold">✓</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); setReportHeight(prev => Math.max(50, prev - 1)); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all text-gray-500"
                            title="Diminuir altura da caixa"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="flex flex-col items-center px-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-0.5">Altura</span>
                            <span className="text-xs font-bold text-indigo-600 tabular-nums">{reportHeight}mm</span>
                          </div>
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); setReportHeight(prev => Math.min(200, prev + 1)); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all text-gray-500"
                            title="Aumentar altura da caixa"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div 
                    className="report-content-wrapper w-full"
                    style={{ marginTop: '-14px' }}
                  >
                    <div 
                      ref={editableRef}
                      contentEditable
                      onInput={() => handleTextChange('preview')}
                      className="w-full p-0 border-none font-sans leading-[1.6] focus:outline-none focus:ring-0 print:hidden overflow-hidden empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                      data-placeholder="Digite o relatório aqui..."
                      style={{ 
                        fontFamily,
                        fontSize: `${reportFontSize}px`,
                        color: textColor,
                        textAlign: 'justify',
                        paddingTop: '2mm',
                        marginTop: '9px',
                        height: `${reportHeight}mm`
                      }}
                    />
                    <div 
                      className="hidden print:block leading-[1.6] overflow-hidden text-justify w-full"
                      style={{ 
                        fontFamily,
                        fontSize: `${reportFontSize}px`,
                        color: textColor,
                        textAlign: 'justify',
                        paddingTop: '2mm',
                        marginTop: '9px',
                        height: `${reportHeight}mm`
                      }}
                      dangerouslySetInnerHTML={{ __html: reportText }}
                    />
                  </div>
                </div>

                <div 
                  data-s303-footer="true"
                  className="s303-report-footer w-full block print:block" 
                  role="contentinfo"
                  style={{ marginTop: '3mm' }}
                >
                  <div className="text-[16px] leading-[1.2] text-justify italic text-gray-800 mb-2">
                    (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
                    considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
                    para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
                  </div>
                  <div className="text-[15px] font-normal mb-10">
                    S-303-T 1/25
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Flutuante Suspensa - Estilo Leitor de PDF integrada ao Tema */}
          <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-[1000] flex justify-center pointer-events-none print:hidden">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto bg-surface-100/95 dark:bg-surface-800/95 backdrop-blur-xl text-typography-800 dark:text-typography-100 border border-surface-300 dark:border-surface-600 shadow-2xl rounded-full px-2.5 sm:px-3.5 py-1.5 flex items-center gap-1 sm:gap-2 transition-all hover:shadow-primary-200/10"
            >
              {/* Indicador de Documento / Página */}
              <div className="flex items-center gap-1.5 px-2 py-1 text-typography-600 dark:text-typography-300 text-xs font-medium select-none">
                <FileText size={14} className="text-primary-200" />
                <span className="hidden sm:inline font-semibold">Folha A4</span>
                <span className="text-[11px] text-typography-500 font-mono">1/1</span>
              </div>

              <div className="w-px h-4 bg-surface-300 dark:bg-surface-600 mx-0.5" />

              {/* Botão Zoom Out (-) */}
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.25}
                className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 active:scale-95 rounded-full text-typography-700 dark:text-typography-200 hover:text-primary-200 dark:hover:text-primary-100 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Diminuir Zoom (-)"
              >
                <Minus size={15} />
              </button>

              {/* Seletor / Indicador de Porcentagem de Zoom */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowZoomMenu(!showZoomMenu)}
                  className="px-2 py-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-xs font-bold font-mono text-typography-800 dark:text-typography-100 transition-all flex items-center gap-1 cursor-pointer"
                  title="Opções de visualização de Zoom"
                >
                  <span className="min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                  <ChevronDown size={12} className="text-typography-500" />
                </button>

                {showZoomMenu && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-surface-100 dark:bg-surface-800 backdrop-blur-xl border border-surface-300 dark:border-surface-600 rounded-2xl shadow-2xl py-1.5 min-w-[200px] z-40 divide-y divide-surface-200 dark:divide-surface-700 text-xs text-typography-800 dark:text-typography-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-typography-500">
                      Nível de Zoom
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={handleToggleAutoFit}
                        className={`w-full text-left px-3 py-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center justify-between cursor-pointer ${
                          autoFit ? 'text-primary-200 font-bold bg-primary-50/50 dark:bg-primary-200/10' : 'text-typography-700 dark:text-typography-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Maximize2 size={13} className={autoFit ? 'text-primary-200' : 'text-typography-500'} />
                          Ajustar à Tela (Automático)
                        </span>
                        {autoFit && <Check size={13} className="text-primary-200" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetZoom(1.0)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center justify-between cursor-pointer ${
                          !autoFit && Math.round(scale * 100) === 100 ? 'text-primary-200 font-bold bg-primary-50/50 dark:bg-primary-200/10' : 'text-typography-700 dark:text-typography-200'
                        }`}
                      >
                        <span>100% (Tamanho Real)</span>
                        {!autoFit && Math.round(scale * 100) === 100 && <Check size={13} className="text-primary-200" />}
                      </button>
                    </div>
                    <div className="py-1">
                      {[0.5, 0.75, 1.25, 1.5, 2.0].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSetZoom(s)}
                          className={`w-full text-left px-3 py-1 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center justify-between cursor-pointer ${
                            !autoFit && Math.round(scale * 100) === Math.round(s * 100) ? 'text-primary-200 font-bold bg-primary-50/50 dark:bg-primary-200/10' : 'text-typography-700 dark:text-typography-300'
                          }`}
                        >
                          <span>{Math.round(s * 100)}%</span>
                          {!autoFit && Math.round(scale * 100) === Math.round(s * 100) && <Check size={13} className="text-primary-200" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botão Zoom In (+) */}
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 2.5}
                className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 active:scale-95 rounded-full text-typography-700 dark:text-typography-200 hover:text-primary-200 dark:hover:text-primary-100 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Aumentar Zoom (+)"
              >
                <Plus size={15} />
              </button>

              <div className="w-px h-4 bg-surface-300 dark:bg-surface-600 mx-0.5" />

              {/* Botão Ajustar à Tela (Alterna entre Automático ou Não) */}
              <button
                type="button"
                onClick={handleToggleAutoFit}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  autoFit 
                    ? 'bg-primary-200 hover:bg-primary-150 text-white shadow-primary-200/30' 
                    : 'bg-surface-200 hover:bg-surface-300 dark:bg-surface-700 dark:hover:bg-surface-600 text-typography-700 dark:text-typography-200'
                }`}
                title={autoFit ? 'Ajuste à tela está ATIVO (automático). Clique para tamanho real (100%)' : 'Clique para ajustar automaticamente à tela'}
              >
                {autoFit ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span className="hidden sm:inline">
                  {autoFit ? 'Ajustado' : 'Ajustar à tela'}
                </span>
                <span className="sm:hidden">
                  {autoFit ? 'Auto' : 'Ajustar'}
                </span>
                {autoFit && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

        @media print {
          @page {
            margin: 0;
            size: 297mm 210mm;
            size: A4 landscape;
          }
          body * {
            visibility: hidden;
          }
          #s303-report-container, 
          #s303-report-container * {
            visibility: visible !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 210mm !important;
            width: 297mm !important;
            overflow: hidden !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #s303-report-container {
            display: flex !important;
            flex-direction: column !important;
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            margin: auto !important;
            width: 297mm !important;
            height: 210mm !important;
            min-width: 297mm !important;
            min-height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            padding: 15mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            background: white !important;
            color: #000000 !important;
            /* Centralizado na proporção de 95% exatamente como a imagem do PDF gerado */
            transform: scale(0.95) !important;
            transform-origin: center center !important;
            z-index: 99999 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #s303-report-container header,
          #s303-report-container .s303-report-header {
            display: block !important;
            visibility: visible !important;
            margin-bottom: 5mm !important;
          }
          #s303-report-container footer,
          #s303-report-container .s303-report-footer {
            display: block !important;
            visibility: visible !important;
            margin-top: 3mm !important;
          }
          #s303-report-container section,
          #s303-report-container div,
          #s303-report-container h1,
          #s303-report-container p,
          #s303-report-container span {
            visibility: visible !important;
          }
          #s303-report-container .border-b,
          #s303-report-container [class*="border-b"] {
            border-bottom: 1px solid #000000 !important;
          }
          #s303-report-container .border-b-\[1\.5px\] {
            border-bottom: 1.5px solid #000000 !important;
          }
          .report-content-wrapper {
            overflow: hidden !important;
          }
          body {
            background-color: white !important;
          }
          .print\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
