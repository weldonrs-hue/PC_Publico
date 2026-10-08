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
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportHeight, setReportHeight] = useState(90);
  
  // Tab Switch: 'form' (Mobile/Editor) vs 'preview' (Folha A4)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  // Auto-fit mode for mobile preview
  const [autoFit, setAutoFit] = useState(true);

  const editableRef = useRef<HTMLDivElement>(null);
  const formEditableRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [personalData, setPersonalData] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showScrollArrows, setShowScrollArrows] = useState(false);

  const scrollContainer = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = containerRef.current.offsetWidth * 0.8;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Calculate Responsive Scale for A4 Landscape (1123px width)
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const a4WidthPx = 1123;
      
      if (autoFit) {
        // Allow scaling down on mobile to fit screen completely
        const calculated = Math.min(1.35, (containerWidth - 24) / a4WidthPx);
        setScale(Math.max(0.25, calculated));
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
        className="border-b border-black flex-grow h-[1.2em] px-2 font-medium whitespace-nowrap overflow-hidden"
        style={{ fontSize: `${fontSize}px`, lineHeight: '1.2em' }}
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

  // Sync contentEditable with state on load
  useEffect(() => {
    if (editableRef.current && reportText && !editableRef.current.innerHTML) {
      editableRef.current.innerHTML = reportText;
    }
    if (formEditableRef.current && reportText && !formEditableRef.current.innerHTML) {
      formEditableRef.current.innerHTML = reportText;
    }
  }, [loading, reportText]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        let attempts = 0;
        while ((!auth.currentUser || auth.currentUser.uid !== userId) && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!auth.currentUser || auth.currentUser.uid !== userId) return;
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
          color: textColor
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
    window.print();
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
    <div className="space-y-6 w-full pb-12">
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
      {activeTab === 'form' && (
        <motion.div 
          key="form-view"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="space-y-5 max-w-4xl mx-auto"
        >
          {/* Card de Resumo da Visita */}
          <div className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={14} className="text-indigo-500" />
              <span>Dados Oficiais da Visita</span>
            </h3>
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
          <div className="bg-surface-100 rounded-2xl border border-surface-300 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-surface-300/80 bg-surface-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-typography-900">
                  Conteúdo do Relatório
                </h3>
                <p className="text-xs text-typography-500 mt-0.5">
                  Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
                </p>
              </div>

              {/* Botões rápidos de formatação */}
              <div className="flex items-center gap-1 bg-surface-200 p-1 rounded-xl border border-surface-300/60 shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                  className="p-1.5 rounded-lg text-typography-700 hover:text-typography-900 hover:bg-surface-100 transition-colors"
                  title="Negrito"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
                  className="p-1.5 rounded-lg text-typography-700 hover:text-typography-900 hover:bg-surface-100 transition-colors"
                  title="Itálico"
                >
                  <Italic size={15} />
                </button>
                <div className="w-px h-4 bg-surface-300 mx-1" />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.max(8, prev - 1)); }}
                  className="p-1.5 rounded-lg text-typography-700 hover:bg-surface-100 transition-colors"
                  title="Diminuir tamanho da fonte"
                >
                  <Minus size={14} />
                </button>
                <span className="text-[11px] font-bold text-typography-700 px-1">{reportFontSize}pt</span>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.min(24, prev + 1)); }}
                  className="p-1.5 rounded-lg text-typography-700 hover:bg-surface-100 transition-colors"
                  title="Aumentar tamanho da fonte"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Área de Digitação do Formulário */}
            <div className="p-4 sm:p-5">
              <div 
                ref={formEditableRef}
                contentEditable
                onInput={() => handleTextChange('form')}
                className="w-full min-h-[260px] p-4 bg-surface-200/50 border border-surface-300 rounded-xl font-sans text-sm sm:text-base text-typography-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-typography-400"
                data-placeholder="Digite as considerações sobre o espírito da congregação e os conselhos dados..."
                style={{
                  fontFamily,
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
        </motion.div>
      )}

      {/* ABA 2: FOLHA OFICIAL A4 (PREVIEW E IMPRESSÃO) */}
      <div 
        className={activeTab === 'form' ? 'opacity-0 pointer-events-none absolute -left-[9999px] top-0' : 'block'}
      >
        <div className="relative w-full max-w-7xl mx-auto space-y-3">
          {/* Barra de Ferramentas de Zoom da Folha */}
          <div className="flex items-center justify-between bg-surface-100 p-2.5 sm:p-3 rounded-xl border border-surface-300 shadow-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-typography-700">Visualização da Folha A4:</span>
              <button
                onClick={() => setAutoFit(!autoFit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  autoFit 
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' 
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

          {/* Setas de rolagem quando necessário */}
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

          {/* Container da Folha Oficial */}
          <div 
            ref={containerRef}
            className="bg-surface-200/50 shadow-inner rounded-2xl overflow-x-auto border border-surface-300 print:shadow-none print:border-none w-full print:max-w-none print:w-full print:m-0 print:p-0 flex justify-start sm:justify-center p-2 sm:p-6 custom-scrollbar scroll-smooth"
          >
            <div 
              style={{ 
                width: `${297 * scale}mm`, 
                height: `${210 * scale}mm`,
                minWidth: 'min-content',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0
              }}
              className="print:w-full print:h-auto"
            >
              <div 
                id="s303-report-container" 
                className="bg-white print:min-h-0 text-black print:m-0 flex flex-col print:w-[297mm] print:h-[210mm] print:fixed print:top-0 print:left-0 print:z-[100] flex-shrink-0 shadow-lg print:shadow-none"
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
                <header className="mb-[5mm]">
                  <h1 className="text-center font-bold text-[19px] tracking-tight leading-tight uppercase w-full">
                    RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
                  </h1>
                </header>

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
                  style={{ height: '1px', marginTop: '2.5mm', marginBottom: '2.5mm' }}
                ></div>

                {/* Instruction Text */}
                <section className="w-full">
                  <p className="text-[16px] font-normal leading-tight">
                    Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
                  </p>
                </section>

                <div className="relative flex-grow">
                  {/* Toolbar Popup */}
                  {showToolbar && (
                    <motion.div 
                      ref={toolbarRef}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute -top-16 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 flex items-center gap-1 print:hidden"
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
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px] z-30">
                            {[
                              { name: 'Arimo', value: "Arimo" },
                              { name: 'Times New Roman', value: "Times New Roman" },
                              { name: 'Courier New', value: "Courier New" },
                              { name: 'Georgia', value: "Georgia" },
                              { name: 'Helvetica', value: "Helvetica" }
                            ].map(f => (
                              <button
                                key={f.name}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFontFamily(f.value);
                                  execCommand('fontName', f.value);
                                  setShowFontPicker(false);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-sm transition-all"
                                style={{ fontFamily: f.value }}
                              >
                                {f.name}
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
                          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl p-3 z-30 min-w-[240px]">
                            <div className="mb-2">
                              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Cores do Tema</h4>
                              <div className="flex gap-1">
                                {[
                                  ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'],
                                  ['#000000', '#7f7f7f', '#595959', '#3f3f3f', '#262626', '#0c0c0c'],
                                  ['#1f497d', '#c6d9f0', '#8db3e2', '#548dd4', '#17365d', '#0f243e'],
                                  ['#c0504d', '#f2dbdb', '#e6b8b7', '#d99694', '#953734', '#632423'],
                                  ['#9bbb59', '#ebf1de', '#d7e3bc', '#c3d69b', '#76923c', '#4f6128'],
                                ].map((column, colIdx) => (
                                  <div key={colIdx} className="flex flex-col gap-1">
                                    {column.map((c, rowIdx) => (
                                      <button
                                        key={rowIdx}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setTextColor(c);
                                          execCommand('foreColor', c);
                                          setShowColorPicker(false);
                                        }}
                                        className={`w-5 h-5 border border-gray-100 transition-all hover:scale-110 ${rowIdx === 0 ? 'mb-1' : ''}`}
                                        style={{ backgroundColor: c }}
                                      />
                                    ))}
                                  </div>
                                ))}
                              </div>
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
                        textAlign: 'justify',
                        paddingTop: '2mm',
                        marginTop: '9px',
                        height: `${reportHeight}mm`
                      }}
                      dangerouslySetInnerHTML={{ __html: reportText }}
                    />
                  </div>
                </div>

                <footer className="w-full" style={{ marginTop: '3mm' }}>
                  <div className="text-[16px] leading-[1.2] text-justify italic text-gray-800 mb-2">
                    (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
                    considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
                    para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
                  </div>
                  <div className="text-[15px] font-normal mb-10">
                    S-303-T 1/25
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

        @media print {
          @page {
            margin: 0;
            size: A4 landscape;
          }
          body * {
            visibility: hidden;
          }
          #s303-report-container, #s303-report-container * {
            visibility: visible !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 210mm !important;
            width: 297mm !important;
            overflow: hidden !important;
            background: white !important;
          }
          #s303-report-container {
            visibility: visible !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 15mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            background: white !important;
            transform: scale(0.95) !important;
            transform-origin: top center !important;
          }
          #s303-report-container * {
            visibility: visible !important;
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
