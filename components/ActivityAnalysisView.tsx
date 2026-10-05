'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Save, 
  Plus, 
  Minus, 
  Loader2,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  Calculator,
  X,
  FileDown,
  Printer,
  Trash2,
  LayoutList,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDialog } from '@/hooks/useDialog';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface ActivityAnalysisViewProps {
  userId: string;
  congregationName: string;
  congregationId?: string;
  visitDate: string;
  onBack: () => void;
}

interface MinistryActivity {
  relatando: string;
  estudos: string;
}

interface IndividualPioneer {
  id: string;
  nome: string;
  horas: string[];
  totalHoras: number;
  metaTotal: number;
  diferenca: number;
  mensal: {
    mes: number;
    horas: number;
    meta: number;
    diferenca: number;
  }[];
}

interface AnalysisData {
  congregacao: string;
  congregacaoId?: string;
  dataVisita: string;
  pubAtivos: string;
  ministério: {
    publicadores: MinistryActivity;
    pioneirosAuxiliares: MinistryActivity;
    pioneirosRegulares: MinistryActivity;
    pioneirosEspeciais: MinistryActivity;
  };
  pioneirosIndividuais?: IndividualPioneer[];
  estatisticas: {
    mediaEstudos: number;
    dirigemEstudos: number;
    pioneirosAuxiliaresDiferentes: number;
    irregulares: number;
    novosPublicadores: number;
    reativados: number;
    readmitidos: number;
    inativos: number;
    removidos: number;
    batizados: number;
    anciaos: number;
    servos: number;
  };
  observacoes?: string;
  donativos: {
    congregacao: string[];
    obraMundial: string[];
  };
  reunioes: {
    meioSemana: string[];
    fimSemana: string[];
  };
}

const defaultData: AnalysisData = {
  congregacao: '',
  congregacaoId: '',
  dataVisita: '',
  pubAtivos: '',
  ministério: {
    publicadores: { relatando: '', estudos: '' },
    pioneirosAuxiliares: { relatando: '', estudos: '' },
    pioneirosRegulares: { relatando: '', estudos: '' },
    pioneirosEspeciais: { relatando: '', estudos: '' },
  },
  pioneirosIndividuais: [],
  estatisticas: {
    mediaEstudos: 0,
    dirigemEstudos: 0,
    pioneirosAuxiliaresDiferentes: 0,
    novosPublicadores: 0,
    reativados: 0,
    readmitidos: 0,
    batizados: 0,
    irregulares: 0,
    inativos: 0,
    removidos: 0,
    anciaos: 0,
    servos: 0,
  },
  observacoes: '',
  donativos: {
    congregacao: ['', '', '', '', '', ''],
    obraMundial: ['', '', '', '', '', ''],
  },
  reunioes: {
    meioSemana: ['', '', '', '', '', ''],
    fimSemana: ['', '', '', '', '', ''],
  },
};

export default function ActivityAnalysisView({ userId, congregationName, congregationId, visitDate, onBack }: ActivityAnalysisViewProps) {
  const { showAlert, showConfirm, showDeleteConfirm } = useDialog();
  const [data, setData] = useState<AnalysisData>({
    ...defaultData,
    congregacao: congregationName,
    congregacaoId: congregationId || '',
    dataVisita: visitDate
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [calcModal, setCalcModal] = useState<{
    type: keyof AnalysisData['ministério'];
    field: keyof MinistryActivity;
    label: string;
  } | null>(null);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [editingPioneer, setEditingPioneer] = useState<IndividualPioneer | null>(null);
  const [pioneerName, setPioneerName] = useState('');
  const [pioneerHours, setPioneerHours] = useState<string[]>(Array(12).fill(''));
  const [calcValues, setCalcValues] = useState<string[]>(Array(12).fill(''));
  const [showSavedPioneers, setShowSavedPioneers] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'sheet'>('form');
  const [mobileTab, setMobileTab] = useState<'all' | 'ministerio' | 'estatisticas' | 'donativos' | 'reunioes' | 'observacoes'>('all');
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setViewMode('sheet');
    }
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const formWidth = 1137.33;
      
      // Calculate scale to fit the container with some padding
      // Minimum scale of 0.5 to keep it readable, max 1.0 (actual size)
      const newScale = Math.max(0.5, Math.min(1, (containerWidth - 32) / formWidth));
      setScale(newScale);
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    updateScale();

    return () => observer.disconnect();
  }, [viewMode]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const identifier = congregationId || congregationName;
        const docId = `${userId}_${identifier}_${visitDate.replace(/\//g, '-')}`;
        const docRef = doc(db, 'activity_analysis', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const fetchedData = docSnap.data();
          setData({
            ...defaultData,
            ...fetchedData,
            ministério: {
              ...defaultData.ministério,
              ...(fetchedData.ministério || {})
            },
            estatisticas: {
              ...defaultData.estatisticas,
              ...(fetchedData.estatisticas || {})
            },
            donativos: {
              ...defaultData.donativos,
              ...(fetchedData.donativos || {})
            },
            reunioes: {
              ...defaultData.reunioes,
              ...(fetchedData.reunioes || {})
            }
          } as AnalysisData);
        } else if (congregationId) {
          // Fallback to name for older data
          const oldDocId = `${userId}_${congregationName}_${visitDate.replace(/\//g, '-')}`;
          const oldDocRef = doc(db, 'activity_analysis', oldDocId);
          const oldDocSnap = await getDoc(oldDocRef);
          
          if (oldDocSnap.exists()) {
            const fetchedOldData = oldDocSnap.data();
            setData({
              ...defaultData,
              ...fetchedOldData,
              congregacaoId: congregationId,
              ministério: {
                ...defaultData.ministério,
                ...(fetchedOldData.ministério || {})
              },
              estatisticas: {
                ...defaultData.estatisticas,
                ...(fetchedOldData.estatisticas || {})
              },
              donativos: {
                ...defaultData.donativos,
                ...(fetchedOldData.donativos || {})
              },
              reunioes: {
                ...defaultData.reunioes,
                ...(fetchedOldData.reunioes || {})
              }
            } as AnalysisData);
            setIsDirty(true);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'activity_analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregationName, congregationId, visitDate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const identifier = congregationId || congregationName;
      const docId = `${userId}_${identifier}_${visitDate.replace(/\//g, '-')}`;
      await setDoc(doc(db, 'activity_analysis', docId), {
        ...data,
        congregacaoId: congregationId || '',
        estatisticas: {
          ...data.estatisticas,
          mediaEstudos: totalEstudos
        },
        userId,
        updatedAt: new Date().toISOString()
      });
      setIsDirty(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'activity_analysis');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowExitConfirmation(true);
    } else {
      onBack();
    }
  };

  const handleClearForm = async () => {
    const confirmed = await showConfirm(
      'Tem certeza de que deseja limpar todos os campos deste relatório? Todos os dados preenchidos serão apagados.',
      'Limpar formulário'
    );
    
    if (confirmed) {
      setData({
        ...defaultData,
        congregacao: congregationName,
        congregacaoId: congregationId || '',
        dataVisita: visitDate
      });
      setIsDirty(true);
    }
  };

  const updateEstatistica = (field: keyof AnalysisData['estatisticas'], delta: number) => {
    setIsDirty(true);
    setData(prev => ({
      ...prev,
      estatisticas: {
        ...prev.estatisticas,
        [field]: Math.max(0, (prev.estatisticas[field] || 0) + delta)
      }
    }));
  };

  const updateMinistry = (type: keyof AnalysisData['ministério'], field: keyof MinistryActivity, value: string) => {
    // Strip non-digit characters to strictly prevent negative values
    const sanitized = value.replace(/[^0-9]/g, '');
    setIsDirty(true);
    setData(prev => ({
      ...prev,
      ministério: {
        ...prev.ministério,
        [type]: {
          ...prev.ministério[type],
          [field]: sanitized
        }
      }
    }));
  };

  const formatCurrency = (value: string) => {
    if (!value || value.trim() === '') return '';
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    const num = Math.max(0, parseFloat(cleanValue) || 0);
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const updateTable = (section: 'donativos' | 'reunioes', field: string, index: number, value: string) => {
    let sanitized = value;
    if (section === 'reunioes') {
      // Strip negative signs and non-numeric characters for meeting attendance
      sanitized = value.replace(/[^0-9]/g, '');
    } else if (section === 'donativos') {
      // Allow only numbers, comma and dot for donations, preventing negative signs
      sanitized = value.replace(/[^0-9.,]/g, '');
    }
    setIsDirty(true);
    setData(prev => {
      const sectionData = { ...prev[section] };
      if (field in sectionData) {
        const list = [...(sectionData as any)[field]];
        list[index] = sanitized;
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [field]: list
          }
        };
      }
      return prev;
    });
  };

  const calculateTotalDonativos = (list: string[]) => {
    return list.reduce((acc, curr) => {
      const cleanValue = curr.replace(/\./g, '').replace(',', '.');
      return acc + (parseFloat(cleanValue) || 0);
    }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const calculateAverageReunioes = (list: string[]) => {
    const validValues = list.map(v => parseInt(v)).filter(v => !isNaN(v) && v > 0);
    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / validValues.length);
  };

  const avgFimSemana = calculateAverageReunioes(data.reunioes.fimSemana);
  const avgMeioSemana = calculateAverageReunioes(data.reunioes.meioSemana);
  const pubAtivosNum = parseInt(data.pubAtivos) || 0;

  // Only calculate publisher difference if weekend meetings have actually been entered
  const hasWeekendMeetings = data.reunioes.fimSemana.some(v => v && v.trim() !== '' && parseInt(v) > 0);
  const differenceVal = hasWeekendMeetings ? (avgFimSemana - pubAtivosNum) : 0;
  const percentageRaw = (hasWeekendMeetings && pubAtivosNum > 0) ? (differenceVal / pubAtivosNum) * 100 : 0;
  const percentageFormatted = Math.abs(percentageRaw).toFixed(1).replace('.', ',');
  const sign = differenceVal > 0 ? '+' : differenceVal < 0 ? '-' : '';
  const displayDiff = hasWeekendMeetings 
    ? `${sign}${Math.abs(differenceVal)} (${sign}${percentageFormatted}%)`
    : '0 (0,0%)';

  // Calculate sum of studies automatically
  const totalEstudos = Object.values(data.ministério).reduce((acc, curr) => acc + (parseInt(curr.estudos) || 0), 0);

  const handleSavePDF = async () => {
    const element = document.getElementById('activity-analysis-form');
    if (!element) return;

    setGenerating(true);

    // Format date for filename: (YYYY MM-DD)
    const formatDateForFilename = (dateStr: string) => {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = `20${y}`;
        return `${y} ${m}-${d}`;
      }
      // Handle range like "10 a 15/11/2025"
      const rangeMatch = dateStr.match(/(\d{1,2})\s+a\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (rangeMatch) {
        const d = rangeMatch[1].padStart(2, '0');
        const m = rangeMatch[3].padStart(2, '0');
        let y = rangeMatch[4];
        if (y.length === 2) y = `20${y}`;
        return `${y} ${m}-${d}`;
      }
      return dateStr.replace(/\//g, '-');
    };

    const formattedDate = formatDateForFilename(data.dataVisita);
    const filename = `Analise (${formattedDate}) ${data.congregacao}.pdf`;

    try {
      // Import libraries
      const { toJpeg } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // Add a class to ensure print-specific styles are applied if needed
      element.classList.add('pdf-capture');
      
      // Convert element to JPEG image
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 2, 
        backgroundColor: '#ffffff',
        width: 1137.33, // Match screen width exactly to avoid narrowing
        style: {
          margin: '0',
          padding: '8mm',
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      element.classList.remove('pdf-capture');

      // Create the final PDF with standard A4 format (S-303 Pattern)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Apply the 95% scale adjustment (S-303 Pattern)
      // This matches the browser's 95% print scale setting
      const scale = 0.95;
      const w = pageWidth * scale;
      const h = pageHeight * scale;
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;

      pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
      const pdfBlob = pdf.output('blob');

      // Standard download method (compatible with iframes)
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await showAlert('PDF gerado com sucesso! Verifique sua pasta de Downloads.', 'Sucesso');
      }
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      const msg = error?.message || 'Erro desconhecido';
      await showAlert(`Ocorreu um erro ao gerar o PDF: ${msg}. Tente novamente.`, 'Erro ao Gerar PDF');
    } finally {
      setGenerating(false);
    }
  };

  const openCalculator = (type: keyof AnalysisData['ministério'], field: keyof MinistryActivity, label: string) => {
    setCalcModal({ type, field, label });
    setCalcValues(['', '', '', '', '', '']);
  };

  const applyAverage = () => {
    if (!calcModal) return;
    const validValues = calcValues.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (validValues.length > 0) {
      const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      updateMinistry(calcModal.type, calcModal.field, Math.round(avg).toString());
    }
    setCalcModal(null);
  };

  const handleOpenPioneerCalculator = (pioneer?: IndividualPioneer) => {
    if (pioneer) {
      setEditingPioneer(pioneer);
      setPioneerName(pioneer.nome);
      setPioneerHours(pioneer.horas.length === 12 ? pioneer.horas : [...pioneer.horas, ...Array(12 - pioneer.horas.length).fill('')]);
    } else {
      setEditingPioneer(null);
      setPioneerName('');
      setPioneerHours(Array(12).fill(''));
    }
    setShowPioneerModal(true);
  };

  const handleSavePioneerRaw = async () => {
    if (!pioneerName.trim()) {
      await showAlert('Por favor, insira o nome do pioneiro.', 'Aviso');
      return;
    }

    const monthlyTarget = 50;
    const activeMonthsIndices = pioneerHours.map((h, i) => h.trim() !== '' ? i : -1).filter(i => i !== -1);
    const numActiveMonths = activeMonthsIndices.length;

    if (numActiveMonths === 0) {
      await showAlert('Por favor, insira horas em pelo menos um mês.', 'Aviso');
      return;
    }

    const hours = pioneerHours.map(h => parseFloat(h) || 0);
    const totalDone = hours.reduce((acc, curr) => acc + curr, 0);
    const totalTarget = numActiveMonths * monthlyTarget;

    const monthlyStats = pioneerHours.map((h, i) => ({
      mes: i + 1,
      horas: parseFloat(h) || 0,
      meta: h.trim() !== '' ? monthlyTarget : 0,
      diferenca: h.trim() !== '' ? (parseFloat(h) || 0) - monthlyTarget : 0
    })).filter(stat => stat.meta > 0);

    const newPioneer: IndividualPioneer = {
      id: editingPioneer?.id || Date.now().toString(),
      nome: pioneerName,
      horas: pioneerHours,
      totalHoras: totalDone,
      metaTotal: totalTarget,
      diferenca: totalDone - totalTarget,
      mensal: monthlyStats
    };

    setIsDirty(true);
    setData(prev => ({
      ...prev,
      pioneirosIndividuais: editingPioneer 
        ? (prev.pioneirosIndividuais || []).map(p => p.id === editingPioneer.id ? newPioneer : p)
        : [...(prev.pioneirosIndividuais || []), newPioneer]
    }));
    setShowPioneerModal(false);
  };

  const handleDeletePioneer = async (id: string) => {
    const confirmed = await showDeleteConfirm('Tem certeza que deseja excluir esta média individual?', 'Excluir Média');
    if (confirmed) {
      setIsDirty(true);
      setData(prev => ({
        ...prev,
        pioneirosIndividuais: (prev.pioneirosIndividuais || []).filter(p => p.id !== id)
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-primary-200" size={40} />
        <p className="text-typography-500 font-medium text-sm">Carregando análise...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 max-w-7xl mx-auto pb-12 px-2 sm:px-4">
        {/* Header - Navigation & Actions */}
        <header className="no-print w-full bg-surface-100 border border-surface-300 flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 py-4 rounded-2xl shadow-xs gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={handleBack}
              className="p-2 sm:p-2.5 rounded-xl border border-surface-300 hover:bg-surface-200 text-typography-700 hover:text-typography-900 transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Voltar ao Painel"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-black text-typography-900 tracking-tight">
                Análise das Atividades
              </div>
              <p className="text-xs text-typography-500 font-medium truncate">
                {data.congregacao} {data.dataVisita ? `• ${data.dataVisita}` : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <button 
              onClick={handleClearForm}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-surface-200 hover:bg-red-500/10 border border-surface-300 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer whitespace-nowrap"
              title="Limpar todos os campos"
            >
              <Trash2 size={15} />
              <span className="hidden sm:inline">Limpar Tudo</span>
            </button>
            <button 
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary-200 hover:bg-primary-300 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 shadow-xs cursor-pointer whitespace-nowrap"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Salvando...' : 'Salvar'}</span>
            </button>
            <button 
              onClick={handleSavePDF}
              disabled={generating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 rounded-xl font-bold text-xs transition-all disabled:opacity-50 shadow-2xs cursor-pointer whitespace-nowrap"
              title="Baixar PDF"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              <span className="hidden sm:inline">{generating ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>
            <button 
              onClick={() => window.print()}
              className="p-2.5 text-typography-700 hover:text-typography-900 bg-surface-200 hover:bg-surface-300 border border-surface-300 rounded-xl transition-all shadow-2xs cursor-pointer shrink-0"
              title="Imprimir"
            >
              <Printer size={16} />
            </button>
          </div>
        </header>

        {/* View Mode Toggle & Mobile Tab Selector */}
        <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Mode Selector */}
          <div className="flex items-center bg-surface-200/80 p-1 rounded-xl border border-surface-300 self-start shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('form')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'form' 
                  ? 'bg-surface-100 text-primary-200 shadow-2xs' 
                  : 'text-typography-600 hover:text-typography-900'
              }`}
            >
              <LayoutList size={14} />
              <span>Modo Formulário</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'sheet' 
                  ? 'bg-surface-100 text-primary-200 shadow-2xs' 
                  : 'text-typography-600 hover:text-typography-900'
              }`}
            >
              <FileText size={14} />
              <span>Folha A4</span>
            </button>
          </div>

          {/* Category Filter Pills (visible in form mode) */}
          {viewMode === 'form' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar-hide text-xs font-semibold">
              {[
                { id: 'all', label: 'Tudo' },
                { id: 'ministerio', label: 'Ministério' },
                { id: 'estatisticas', label: 'Estatísticas' },
                { id: 'donativos', label: 'Donativos' },
                { id: 'reunioes', label: 'Reuniões' },
                { id: 'observacoes', label: 'Observações' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${
                    mobileTab === tab.id
                      ? 'bg-primary-200 text-white shadow-2xs'
                      : 'bg-surface-100 hover:bg-surface-200 text-typography-600 border border-surface-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* MOBILE & RESPONSIVE FORM VIEW (Zero horizontal scrolling) */}
        {/* ======================================================== */}
        {viewMode === 'form' && (
          <div className="space-y-6 print:hidden">
            {/* Header Summary Card */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-300 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-typography-500 uppercase tracking-widest block">Congregação</span>
                  <h2 className="text-lg sm:text-xl font-black text-typography-900">{data.congregacao}</h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-typography-600">
                  <Calendar size={14} className="text-primary-200" />
                  <span>Data da Visita: <strong className="text-typography-900">{data.dataVisita}</strong></span>
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-surface-200/50 p-3 sm:p-4 rounded-xl border border-surface-300">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-typography-900">Publicadores Ativos</p>
                  <p className="text-[11px] text-typography-500">Total de publicadores ativos no período</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min="0"
                    value={data.pubAtivos}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                      setIsDirty(true);
                      setData({...data, pubAtivos: val});
                    }}
                    className="w-20 p-2 bg-surface-100 rounded-xl border border-surface-300 shadow-2xs font-bold text-xl text-primary-200 text-center focus:border-primary-200 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* 1. Atividades Gerais do Ministério */}
            {(mobileTab === 'all' || mobileTab === 'ministerio') && (
              <section className="space-y-3">
                <div className="flex items-center editorial-line pl-3">
                  <h3 className="text-sm font-bold text-typography-900 uppercase tracking-wider">
                    Atividades Gerais do Ministério <span className="text-typography-500 font-normal text-xs lowercase">(média mensal)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'publicadores', label: 'Publicadores' },
                    { id: 'pioneirosAuxiliares', label: 'Pioneiros Auxiliares' },
                    { id: 'pioneirosRegulares', label: 'Pioneiros Regulares' },
                    { id: 'pioneirosEspeciais', label: 'Pioneiros Especiais' }
                  ].map((item) => {
                    const itemData = data.ministério[item.id as keyof AnalysisData['ministério']];
                    const relatandoNum = parseInt(itemData.relatando) || 0;
                    const estudosNum = parseInt(itemData.estudos) || 0;
                    const avg = relatandoNum > 0 ? (estudosNum / relatandoNum).toFixed(1).replace('.', ',') : '0,0';

                    return (
                      <div key={item.id} className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-typography-900">{item.label}</h4>
                            {item.id === 'pioneirosRegulares' && (
                              <button 
                                onClick={() => handleOpenPioneerCalculator()}
                                className="px-2 py-0.5 bg-primary-200/10 text-primary-200 hover:bg-primary-200/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Médias Individuais de Pioneiros"
                              >
                                <Users size={12} />
                                <span>Individuais</span>
                              </button>
                            )}
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary-200/10 text-primary-200 border border-primary-200/20">
                            Média: {avg}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-typography-500 uppercase tracking-wider block">
                              Nº Relatando
                            </label>
                            <div className="relative flex items-center">
                              <input 
                                type="number"
                                min="0"
                                value={itemData.relatando}
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'relatando', e.target.value)}
                                className="w-full p-2.5 bg-surface-200/50 rounded-xl border border-surface-300 text-center font-bold text-primary-200 text-base focus:border-primary-200 outline-none"
                                placeholder="0"
                              />
                              <button 
                                onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'relatando', `${item.label} - Relatando`)}
                                className="absolute right-2 p-1 text-typography-400 hover:text-primary-200 transition-all cursor-pointer"
                                title="Calcular média"
                              >
                                <Calculator size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-typography-500 uppercase tracking-wider block">
                              Nº de Estudos
                            </label>
                            <div className="relative flex items-center">
                              <input 
                                type="number"
                                min="0"
                                value={itemData.estudos}
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'estudos', e.target.value)}
                                className="w-full p-2.5 bg-surface-200/50 rounded-xl border border-surface-300 text-center font-bold text-typography-900 text-base focus:border-primary-200 outline-none"
                                placeholder="0"
                              />
                              <button 
                                onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'estudos', `${item.label} - Estudos`)}
                                className="absolute right-2 p-1 text-typography-400 hover:text-primary-200 transition-all cursor-pointer"
                                title="Calcular média"
                              >
                                <Calculator size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Individual Pioneer Records on Mobile */}
                {data.pioneirosIndividuais && data.pioneirosIndividuais.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <button 
                      onClick={() => setShowSavedPioneers(!showSavedPioneers)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-100 border border-surface-300 rounded-xl hover:bg-surface-200 transition-all group cursor-pointer"
                    >
                      <h4 className="text-xs font-bold text-typography-600 uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} className="text-primary-200" /> Médias de Pioneiros Salvas ({data.pioneirosIndividuais.length})
                      </h4>
                      <div className={`transition-transform duration-300 ${showSavedPioneers ? 'rotate-180' : ''}`}>
                        <ChevronLeft className="-rotate-90" size={16} />
                      </div>
                    </button>
                    
                    <AnimatePresence>
                      {showSavedPioneers && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {data.pioneirosIndividuais.map(p => (
                              <div 
                                key={p.id} 
                                className="bg-surface-100 border border-surface-300 rounded-xl p-3 flex items-center justify-between shadow-2xs group hover:border-primary-200/50 transition-all"
                              >
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenPioneerCalculator(p)}>
                                  <p className="font-bold text-typography-900 text-xs truncate">{p.nome}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] bg-primary-200/10 text-primary-200 px-1.5 py-0.5 rounded-md font-bold">
                                      {p.totalHoras}h / {p.metaTotal}h
                                    </span>
                                    <span className={`text-[10px] font-bold ${p.diferenca >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {p.diferenca >= 0 ? '+' : ''}{p.diferenca}h
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    onClick={() => handleOpenPioneerCalculator(p)}
                                    className="p-1.5 text-typography-500 hover:text-primary-200 hover:bg-surface-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Calculator size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeletePioneer(p.id)}
                                    className="p-1.5 text-typography-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            )}

            {/* 2. Estatísticas da Congregação */}
            {(mobileTab === 'all' || mobileTab === 'estatisticas') && (
              <section className="space-y-3">
                <div className="flex items-center editorial-line pl-3">
                  <h3 className="text-sm font-bold text-typography-900 uppercase tracking-wider">
                    Estatísticas da Congregação
                  </h3>
                </div>

                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-3 shadow-xs space-y-2">
                  {[
                    { id: 'mediaEstudos', label: 'Média mensal de Estudos Bíblicos', color: 'text-typography-900', isAuto: true },
                    { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos', color: 'text-typography-900' },
                    { id: 'pioneirosAuxiliaresDiferentes', label: 'Pioneiros auxiliares diferentes*', color: 'text-primary-200' },
                    { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES*', color: 'text-primary-200' },
                    { id: 'reativados', label: 'Quantos foram REATIVADOS*', color: 'text-primary-200' },
                    { id: 'readmitidos', label: 'Quantos foram READMITIDOS*', color: 'text-primary-200' },
                    { id: 'batizados', label: 'Quantos foram BATIZADOS*', color: 'text-indigo-600 dark:text-indigo-400' },
                    { id: 'irregulares', label: 'Número de IRREGULARES*', color: 'text-rose-600 dark:text-rose-400' },
                    { id: 'inativos', label: 'Quantos ficaram INATIVOS*', color: 'text-rose-600 dark:text-rose-400' },
                    { id: 'removidos', label: 'Quantos ficaram REMOVIDOS*', color: 'text-rose-600 dark:text-rose-400' },
                    { id: 'anciaos', label: 'Número de ANCIÃOS', color: 'text-primary-200' },
                    { id: 'servos', label: 'Números de SERVOS MINISTERIAIS', color: 'text-primary-200' }
                  ].map((item) => {
                    const val = item.id === 'mediaEstudos' ? totalEstudos : (data.estatisticas[item.id as keyof AnalysisData['estatisticas']] || 0);
                    const perc = pubAtivosNum > 0 ? (val / pubAtivosNum * 100).toFixed(1).replace('.', ',') : '0,0';
                    const average = pubAtivosNum > 0 ? (val / pubAtivosNum).toFixed(1).replace('.', ',') + '/pub' : '0,0/pub';
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-200/40 border border-surface-300 rounded-xl gap-2">
                        <div className="min-w-0 pr-2">
                          <p className={`text-xs font-semibold ${item.color} leading-snug`}>{item.label}</p>
                          <span className="text-[10px] text-primary-200 font-bold block mt-0.5">
                            {item.id === 'mediaEstudos' ? average : `${perc}% dos pub.`}
                          </span>
                        </div>
                        <div className="shrink-0">
                          <div className="flex items-center gap-1.5 bg-surface-100 border border-surface-300 rounded-xl p-1 shadow-2xs">
                            {!item.isAuto ? (
                              <>
                                <button 
                                  onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], -1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-200 hover:bg-amber-500/15 text-amber-600 transition-all active:scale-95 cursor-pointer"
                                  title="Diminuir"
                                >
                                  <Minus size={14} strokeWidth={3} />
                                </button>
                                <span className="font-bold text-sm min-w-[28px] text-center text-typography-900">{val}</span>
                                <button 
                                  onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], 1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-200 hover:bg-emerald-500/15 text-emerald-600 transition-all active:scale-95 cursor-pointer"
                                  title="Aumentar"
                                >
                                  <Plus size={14} strokeWidth={3} />
                                </button>
                              </>
                            ) : (
                              <span className="font-bold text-sm min-w-[70px] text-center text-typography-900 py-1">{val}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-[10px] text-typography-500 italic pt-1 pl-1">* Desde a última visita</div>
                </div>
              </section>
            )}

            {/* 3. Donativos */}
            {(mobileTab === 'all' || mobileTab === 'donativos') && (
              <section className="space-y-3">
                <div className="flex items-center editorial-line pl-3">
                  <h3 className="text-sm font-bold text-typography-900 uppercase tracking-wider">Donativos</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Congregação */}
                  <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-typography-900">Congregação</h4>
                      <span className="text-xs font-black text-primary-200">
                        R$ {calculateTotalDonativos(data.donativos.congregacao)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {data.donativos.congregacao.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-typography-500 w-12">Mês {i + 1}</span>
                          <input 
                            value={v}
                            onChange={(e) => updateTable('donativos', 'congregacao', i, e.target.value)}
                            onBlur={(e) => updateTable('donativos', 'congregacao', i, formatCurrency(e.target.value))}
                            className="w-full p-2 bg-surface-200/50 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200"
                            placeholder="0,00"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Obra Mundial */}
                  <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-typography-900">Obra Mundial</h4>
                      <span className="text-xs font-black text-primary-200">
                        R$ {calculateTotalDonativos(data.donativos.obraMundial)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {data.donativos.obraMundial.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-typography-500 w-12">Mês {i + 1}</span>
                          <input 
                            value={v}
                            onChange={(e) => updateTable('donativos', 'obraMundial', i, e.target.value)}
                            onBlur={(e) => updateTable('donativos', 'obraMundial', i, formatCurrency(e.target.value))}
                            className="w-full p-2 bg-surface-200/50 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200"
                            placeholder="0,00"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 4. Reuniões */}
            {(mobileTab === 'all' || mobileTab === 'reunioes') && (
              <section className="space-y-3">
                <div className="flex items-center editorial-line pl-3">
                  <h3 className="text-sm font-bold text-typography-900 uppercase tracking-wider">Reuniões</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Meio de Semana */}
                  <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-typography-900">Meio de Semana</h4>
                      <span className="text-xs font-black text-primary-200">Média: {avgMeioSemana}</span>
                    </div>
                    <div className="space-y-2">
                      {data.reunioes.meioSemana.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-typography-500 w-12">Mês {i + 1}</span>
                          <input 
                            type="number"
                            min="0"
                            value={v}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => updateTable('reunioes', 'meioSemana', i, e.target.value)}
                            className="w-full p-2 bg-surface-200/50 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fim de Semana */}
                  <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-typography-900">Fim de Semana</h4>
                      <span className="text-xs font-black text-primary-200">Média: {avgFimSemana}</span>
                    </div>
                    <div className="space-y-2">
                      {data.reunioes.fimSemana.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-typography-500 w-12">Mês {i + 1}</span>
                          <input 
                            type="number"
                            min="0"
                            value={v}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => updateTable('reunioes', 'fimSemana', i, e.target.value)}
                            className="w-full p-2 bg-surface-200/50 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Banner Diferença */}
                <div className="bg-primary-200 p-4 rounded-2xl text-center text-white shadow-xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1 opacity-90">
                    Diferença do número de publicadores
                  </p>
                  <p className="font-[var(--font-manrope)] font-bold text-2xl">
                    {displayDiff}
                  </p>
                </div>
              </section>
            )}

            {/* 5. Observações */}
            {(mobileTab === 'all' || mobileTab === 'observacoes') && (
              <section className="space-y-2">
                <div className="flex items-center editorial-line pl-3">
                  <h3 className="text-sm font-bold text-typography-900 uppercase tracking-wider">Observações</h3>
                </div>
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-2xs">
                  <textarea 
                    value={data.observacoes || ''}
                    onChange={(e) => {
                      setIsDirty(true);
                      setData(prev => ({ ...prev, observacoes: e.target.value }));
                    }}
                    placeholder="Adicione observações ou anotações sobre a congregação..."
                    rows={4}
                    className="w-full p-3 bg-surface-200/50 rounded-xl border border-surface-300 text-sm text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 transition-all resize-y leading-relaxed"
                  />
                </div>
              </section>
            )}

            {/* Mobile Bottom Action Bar */}
            <div className="pt-2 pb-6">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="w-full py-3.5 bg-primary-200 hover:bg-primary-300 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{saving ? 'Salvando...' : isDirty ? 'Salvar Alterações' : 'Alterações Salvas'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* A4 SHEET VIEW (Desktop Paper Layout & PDF/Print Target)  */}
        {/* ======================================================== */}
        <div 
          ref={containerRef} 
          className={
            viewMode === 'sheet'
              ? "w-full overflow-x-auto pb-6 custom-scrollbar-wide"
              : "fixed -left-[9999px] top-0 pointer-events-none opacity-0 print:static print:opacity-100 print:pointer-events-auto"
          }
        >
          <div 
            style={{ 
              width: viewMode === 'sheet' ? `${1137.33 * scale}px` : '1137.33px',
              minWidth: 'min-content',
              margin: '0 auto',
              transition: 'width 0.2s ease-out'
            }}
          >
            <main 
              id="activity-analysis-form" 
              className="a4-page relative bg-surface-100 shadow-xl border border-surface-300 rounded-2xl print:shadow-none print:border-none print:rounded-none print:m-0 w-[1137.33px] shrink-0"
              style={{
                transform: viewMode === 'sheet' ? `scale(${scale})` : 'scale(1)',
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease-out'
              }}
            >
            <style jsx global>{`
              .a4-page {
                width: 1137.33px;
                min-height: 297mm;
                padding: 8mm;
              }
              .editorial-line {
                border-left: 4px solid var(--primary-color, #1a5c5a);
              }
              @media print {
                .a4-page {
                  width: 210mm;
                  height: 297mm;
                  padding: 8mm;
                  margin: 0;
                  border: none;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  background: white !important;
                  color: black !important;
                }
                .a4-page * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                @page {
                  size: A4;
                  margin: 0;
                }
              }
              /* PDF Capture Specifics - Matching Screen Appearance */
              .pdf-capture {
                width: 1137.33px !important;
                min-height: 297mm !important;
                padding: 8mm !important;
                margin: 0 !important;
                overflow: visible !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                background-color: #ffffff !important;
                color: black !important;
              }
              .pdf-capture * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .pdf-capture textarea {
                display: none !important;
              }
              .pdf-capture .pdf-observacoes-print {
                display: block !important;
              }
            `}</style>

            {/* Header Section */}
            <div className="text-center mb-8">
              <h1 className="text-xl font-black tracking-tight text-primary-200 mb-2 uppercase">
                Relatório de Estatísticas da Congregação
              </h1>
              <div className="w-full h-px bg-surface-300 mb-6"></div>
              
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-left border-r border-surface-300 pr-4">
                  <p className="text-[11px] text-typography-500 uppercase tracking-widest font-bold mb-1">Congregação</p>
                  <p className="font-bold text-lg text-typography-900 truncate">{data.congregacao}</p>
                </div>
                <div className="text-center border-r border-surface-300 px-4">
                  <p className="text-[11px] text-typography-500 uppercase tracking-widest font-bold mb-1">Pub. Ativos</p>
                  <div className="flex justify-center pt-1">
                    <input 
                      type="number"
                      min="0"
                      value={data.pubAtivos}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                        setIsDirty(true);
                        setData({...data, pubAtivos: val});
                      }}
                      className="w-20 p-1 bg-surface-200 rounded-xl border border-surface-300 shadow-2xs font-bold text-2xl text-primary-200 text-center focus:border-primary-200 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="text-right pl-4">
                  <p className="text-[11px] text-typography-500 uppercase tracking-widest font-bold mb-1">Data da Visita</p>
                  <p className="font-bold text-lg text-typography-900">{data.dataVisita}</p>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-[1.6fr_1fr] gap-8 mb-8">
              {/* Left Column: Activities & Statistics */}
              <div className="space-y-8">
                {/* Atividades Gerais Table */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="text-sm font-bold text-typography-900 uppercase tracking-wider">
                      Atividades Gerais do Ministério <span className="text-typography-500 font-normal text-xs lowercase">(média mensal)</span>
                    </h2>
                  </div>
                  <div className="bg-surface-200/40 overflow-hidden rounded-xl border border-surface-300">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-200 border-b border-surface-300">
                          <th className="py-3 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider">Categoria</th>
                          <th className="py-3 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider text-center">Nº Relatando</th>
                          <th className="py-3 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider text-center">Nº de Estudos</th>
                          <th className="py-3 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider text-center">Média</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium">
                        {[
                          { id: 'publicadores', label: 'Publicadores' },
                          { id: 'pioneirosAuxiliares', label: 'Pioneiros Auxiliares' },
                          { id: 'pioneirosRegulares', label: 'Pioneiros Regulares' },
                          { id: 'pioneirosEspeciais', label: 'Pioneiros Especiais' }
                        ].map((item, idx) => {
                          const itemData = data.ministério[item.id as keyof AnalysisData['ministério']];
                          const relatandoNum = parseInt(itemData.relatando) || 0;
                          const estudosNum = parseInt(itemData.estudos) || 0;
                          const avg = relatandoNum > 0 ? (estudosNum / relatandoNum).toFixed(1).replace('.', ',') : '0,0';

                          return (
                            <tr key={item.id} className={`border-b border-surface-300/40 ${idx % 2 === 1 ? 'bg-surface-200/20' : ''}`}>
                              <td className="py-3 px-4 text-typography-900 font-semibold">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{item.label}</span>
                                  {item.id === 'pioneirosRegulares' && (
                                    <button 
                                      onClick={() => handleOpenPioneerCalculator()}
                                      className="p-1 text-primary-200 hover:bg-primary-200/10 rounded-lg transition-all print:hidden flex items-center gap-1 text-[10px] cursor-pointer"
                                      title="Médias Individuais"
                                    >
                                      <Users size={14} />
                                      <Plus size={10} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <div className="relative flex items-center justify-center group">
                                  <input 
                                    type="number"
                                    min="0"
                                    value={itemData.relatando}
                                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'relatando', e.target.value)}
                                    className="w-20 p-1.5 bg-surface-100 rounded-xl border border-surface-300 shadow-2xs focus:border-primary-200 text-center font-bold text-primary-200 outline-none transition-all"
                                  />
                                  <button 
                                    onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'relatando', `${item.label} - Relatando`)}
                                    className="absolute right-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-typography-400 hover:text-primary-200 transition-all print:hidden cursor-pointer"
                                  >
                                    <Calculator size={18} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <div className="relative flex items-center justify-center group">
                                  <input 
                                    type="number"
                                    min="0"
                                    value={itemData.estudos}
                                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'estudos', e.target.value)}
                                    className="w-20 p-1.5 bg-surface-100 rounded-xl border border-surface-300 shadow-2xs focus:border-primary-200 text-center font-bold text-typography-900 outline-none transition-all"
                                  />
                                  <button 
                                    onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'estudos', `${item.label} - Estudos`)}
                                    className="absolute right-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-typography-400 hover:text-primary-200 transition-all print:hidden cursor-pointer"
                                  >
                                    <Calculator size={18} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-typography-900">{avg}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Individual Pioneer Records List - Only visible on screen */}
                  {data.pioneirosIndividuais && data.pioneirosIndividuais.length > 0 && (
                    <div className="mt-4 space-y-2 print:hidden">
                      <button 
                        onClick={() => setShowSavedPioneers(!showSavedPioneers)}
                        className="w-full flex items-center justify-between px-4 py-2 bg-surface-100 border border-surface-300 rounded-xl hover:bg-surface-200 transition-all group cursor-pointer"
                      >
                        <h3 className="text-[10px] font-bold text-typography-500 uppercase tracking-widest flex items-center gap-2">
                          <Users size={14} className="text-primary-200" /> Médias de Pioneiros Salvas
                        </h3>
                        <div className={`transition-transform duration-300 ${showSavedPioneers ? 'rotate-180' : ''}`}>
                          <ChevronLeft className="-rotate-90" size={16} />
                        </div>
                      </button>
                      
                      <AnimatePresence>
                        {showSavedPioneers && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              {data.pioneirosIndividuais.map(p => (
                                <div 
                                  key={p.id} 
                                  className="bg-surface-100 border border-surface-300 rounded-xl p-3 flex items-center justify-between shadow-2xs group hover:border-primary-200/50 transition-all"
                                >
                                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenPioneerCalculator(p)}>
                                    <p className="font-bold text-typography-900 text-xs truncate">{p.nome}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] bg-primary-200/10 text-primary-200 px-1.5 py-0.5 rounded-md font-bold">
                                        {p.totalHoras}h / {p.metaTotal}h
                                      </span>
                                      <span className={`text-[10px] font-bold ${p.diferenca >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {p.diferenca >= 0 ? '+' : ''}{p.diferenca}h
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button 
                                      onClick={() => handleOpenPioneerCalculator(p)}
                                      className="p-1.5 text-typography-400 hover:text-primary-200 transition-all cursor-pointer"
                                      title="Editar"
                                    >
                                      <Calculator size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeletePioneer(p.id)}
                                      className="p-1.5 text-typography-400 hover:text-red-600 transition-all cursor-pointer"
                                      title="Excluir"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </section>

                {/* Estatísticas da Congregação Table */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="text-sm font-bold text-typography-900 uppercase tracking-wider">Estatísticas da Congregação</h2>
                  </div>
                  <div className="border border-surface-300 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-200 border-b border-surface-300">
                          <th className="py-2.5 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider">Descrição</th>
                          <th className="py-2.5 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider text-center w-24">Qtd</th>
                          <th className="py-2.5 px-4 text-[11px] font-bold text-typography-600 uppercase tracking-wider text-center w-24">Perc.</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium">
                        {[
                          { id: 'mediaEstudos', label: 'Média mensal de Estudos Bíblicos', color: 'text-typography-900', isAuto: true },
                          { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos', color: 'text-typography-900' },
                          { id: 'pioneirosAuxiliaresDiferentes', label: 'Pioneiros auxiliares diferentes*', color: 'text-primary-200' },
                          { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES*', color: 'text-primary-200' },
                          { id: 'reativados', label: 'Quantos foram REATIVADOS*', color: 'text-primary-200' },
                          { id: 'readmitidos', label: 'Quantos foram READMITIDOS*', color: 'text-primary-200' },
                          { id: 'batizados', label: 'Quantos foram BATIZADOS*', color: 'text-indigo-600 dark:text-indigo-400' },
                          { id: 'irregulares', label: 'Número de IRREGULARES*', color: 'text-rose-600 dark:text-rose-400' },
                          { id: 'inativos', label: 'Quantos ficaram INATIVOS*', color: 'text-rose-600 dark:text-rose-400' },
                          { id: 'removidos', label: 'Quantos ficaram REMOVIDOS*', color: 'text-rose-600 dark:text-rose-400' },
                          { id: 'anciaos', label: 'Número de ANCIÃOS', color: 'text-primary-200' },
                          { id: 'servos', label: 'Números de SERVOS MINISTERIAIS', color: 'text-primary-200' }
                        ].map((item, idx) => {
                          const val = item.id === 'mediaEstudos' ? totalEstudos : (data.estatisticas[item.id as keyof AnalysisData['estatisticas']] || 0);
                          const perc = pubAtivosNum > 0 ? (val / pubAtivosNum * 100).toFixed(1).replace('.', ',') : '0,0';
                          const average = pubAtivosNum > 0 ? (val / pubAtivosNum).toFixed(1).replace('.', ',') + '/pub' : '0,0/pub';
                          
                          return (
                            <tr key={item.id} className={`border-b border-surface-300/40 ${idx % 2 === 1 ? 'bg-surface-200/20' : 'bg-surface-100'}`}>
                              <td className={`py-2 px-4 font-semibold ${item.color}`}>{item.label}</td>
                              <td className="py-1 px-2">
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center gap-2 bg-surface-100 border border-surface-300 rounded-xl px-1.5 py-0.5 shadow-2xs">
                                    {!item.isAuto ? (
                                      <>
                                        <button 
                                          onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], -1)}
                                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-surface-200 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 transition-all active:scale-90 print:hidden cursor-pointer"
                                        >
                                          <Minus size={12} strokeWidth={3} />
                                        </button>
                                        <span className="font-bold text-sm min-w-[24px] text-center text-typography-900">{val}</span>
                                        <button 
                                          onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], 1)}
                                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-surface-200 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 transition-all active:scale-90 print:hidden cursor-pointer"
                                        >
                                          <Plus size={12} strokeWidth={3} />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="font-bold text-sm min-w-[70px] text-center text-typography-900 py-0.5">{val}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-4 text-center">
                                <span className="font-bold text-[10px] text-primary-200 bg-primary-200/10 px-2 py-0.5 rounded-full border border-primary-200/20">
                                  {item.id === 'mediaEstudos' ? average : `${perc}%`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[10px] text-typography-500 italic">* Desde a última visita</div>
                </section>

                {/* Observações */}
                <section>
                  <div className="flex items-center mb-3 editorial-line pl-3">
                    <h2 className="text-sm font-bold text-typography-900 uppercase tracking-wider">Observações</h2>
                  </div>
                  <div className="bg-surface-200/40 border border-surface-300 rounded-xl p-3 shadow-2xs">
                    <textarea 
                      value={data.observacoes || ''}
                      onChange={(e) => {
                        setIsDirty(true);
                        setData(prev => ({ ...prev, observacoes: e.target.value }));
                      }}
                      placeholder="Adicione observações ou anotações sobre a congregação..."
                      rows={3}
                      className="w-full p-2.5 bg-surface-100 rounded-lg border border-surface-300 text-xs text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 transition-all resize-y font-normal leading-relaxed print:hidden"
                    />
                    <div className="hidden print:block pdf-observacoes-print whitespace-pre-wrap text-xs text-typography-900 font-normal leading-relaxed min-h-[48px] p-2.5 bg-surface-100 rounded-lg border border-surface-300">
                      {data.observacoes ? data.observacoes : <span className="text-typography-400 italic">Nenhuma observação informada.</span>}
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: Donations & Meetings */}
              <div className="space-y-8">
                {/* Donativos */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="font-[var(--font-manrope)] text-sm font-bold text-typography-900 uppercase tracking-wider">Donativos</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-surface-200/50 border border-surface-300 rounded-xl shadow-xs p-5">
                    {/* Congregação Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-typography-500 uppercase tracking-widest text-center mb-4">Congregação</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.donativos.congregacao.map((v, i) => (
                          <input 
                            key={i}
                            value={v}
                            onChange={(e) => updateTable('donativos', 'congregacao', i, e.target.value)}
                            onBlur={(e) => updateTable('donativos', 'congregacao', i, formatCurrency(e.target.value))}
                            className="w-full p-2.5 bg-surface-100 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200 focus:bg-surface-100 transition-all placeholder:text-typography-400"
                            placeholder="0,00"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-surface-300 text-center">
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-primary-200 leading-tight">
                          <span className="text-xs block mb-0.5 text-typography-500">R$</span>
                          {calculateTotalDonativos(data.donativos.congregacao)}
                        </p>
                      </div>
                    </div>

                    {/* Obra Mundial Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-typography-500 uppercase tracking-widest text-center mb-4">Obra Mundial</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.donativos.obraMundial.map((v, i) => (
                          <input 
                            key={i}
                            value={v}
                            onChange={(e) => updateTable('donativos', 'obraMundial', i, e.target.value)}
                            onBlur={(e) => updateTable('donativos', 'obraMundial', i, formatCurrency(e.target.value))}
                            className="w-full p-2.5 bg-surface-100 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200 focus:bg-surface-100 transition-all placeholder:text-typography-400"
                            placeholder="0,00"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-surface-300 text-center">
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-primary-200 leading-tight">
                          <span className="text-xs block mb-0.5 text-typography-500">R$</span>
                          {calculateTotalDonativos(data.donativos.obraMundial)}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Reuniões */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="font-[var(--font-manrope)] text-sm font-bold text-typography-900 uppercase tracking-wider">Reuniões</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-surface-200/50 border border-surface-300 rounded-xl shadow-xs p-5">
                    {/* Meio de Semana Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-typography-500 uppercase tracking-widest text-center mb-4">Meio de Semana</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.reunioes.meioSemana.map((v, i) => (
                          <input 
                            key={i}
                            type="number"
                            min="0"
                            value={v}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => updateTable('reunioes', 'meioSemana', i, e.target.value)}
                            className="w-full p-2.5 bg-surface-100 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200 focus:bg-surface-100 transition-all"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-surface-300 text-center">
                        <p className="text-[11px] font-bold text-typography-500 uppercase tracking-widest mb-1">Média</p>
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-primary-200">{avgMeioSemana}</p>
                      </div>
                    </div>

                    {/* Fim de Semana Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-typography-500 uppercase tracking-widest text-center mb-4">Fim de Semana</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.reunioes.fimSemana.map((v, i) => (
                          <input 
                            key={i}
                            type="number"
                            min="0"
                            value={v}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => updateTable('reunioes', 'fimSemana', i, e.target.value)}
                            className="w-full p-2.5 bg-surface-100 rounded-xl border border-surface-300 text-center text-sm font-bold text-typography-900 outline-none focus:border-primary-200 focus:bg-surface-100 transition-all"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-surface-300 text-center">
                        <p className="text-[11px] font-bold text-typography-500 uppercase tracking-widest mb-1">Média</p>
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-primary-200">{avgFimSemana}</p>
                      </div>
                    </div>

                    <div className="col-span-2 mt-4 bg-primary-200 p-3.5 rounded-xl text-center text-white shadow-xs">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-90">Diferença do número de publicadores</p>
                      <p className="font-[var(--font-manrope)] font-bold text-xl">
                        {displayDiff}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <footer className="mt-auto pt-8 border-t border-surface-300">
              <div className="flex justify-between items-start text-[10px] text-typography-500 leading-relaxed uppercase tracking-wider">
                <div className="max-w-md italic">
                </div>
                <div className="text-right space-y-1">
                  <p>Página 01 de 01</p>
                  <p>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </footer>
          </main>
          </div>
        </div>
      </div>

      {/* Average Calculator Modal */}
      <AnimatePresence>
        {showExitConfirmation && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Save size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-typography-900">Alterações não salvas</h3>
                  <p className="text-sm text-typography-600">
                    Você tem alterações que ainda não foram salvas na análise. Deseja salvar antes de sair?
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={async () => {
                      await handleSave();
                      onBack();
                    }}
                    className="w-full py-3 rounded-xl font-bold bg-primary-200 text-white hover:bg-primary-300 transition-all flex items-center justify-center gap-2 shadow-xs"
                  >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Salvar e Sair
                  </button>
                  <button 
                    onClick={onBack}
                    className="w-full py-3 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    Descartar e Sair
                  </button>
                  <button 
                    onClick={() => setShowExitConfirmation(false)}
                    className="w-full py-3 rounded-xl font-bold text-typography-500 hover:bg-surface-200 transition-all"
                  >
                    Continuar Editando
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Individual Pioneer Calculator Modal */}
      <AnimatePresence>
        {showPioneerModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-surface-200 border-b border-surface-300 px-5 py-4 text-typography-900 flex justify-between items-center shrink-0">
                <h3 className="font-bold flex items-center gap-2">
                  <Calculator size={22} className="text-primary-200" /> Média de Pioneiro Individual
                </h3>
                <button onClick={() => setShowPioneerModal(false)} className="text-typography-500 hover:text-typography-900 hover:bg-surface-300/50 p-1.5 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Identification */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-typography-500 uppercase tracking-widest block">Nome / Identificação</label>
                  <input 
                    type="text"
                    value={pioneerName}
                    onChange={(e) => setPioneerName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full p-3 bg-surface-200/50 border border-surface-300 rounded-xl font-bold text-typography-900 focus:border-primary-200 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400"
                  />
                </div>

                {/* 12 Months Input */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-typography-500 uppercase tracking-widest">Relatório Anual (12 Meses)</h4>
                    <span className="text-[10px] bg-primary-200/10 text-primary-200 border border-primary-200/20 px-2 py-0.5 rounded-full font-bold uppercase">Meta: 50h/mês</span>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {pioneerHours.map((val, idx) => {
                      const hNum = parseFloat(val) || 0;
                      const hasValue = val.trim() !== '';
                      const diff = hasValue ? hNum - 50 : 0;
                      return (
                        <div key={idx} className={`p-3 rounded-2xl border transition-all flex flex-col gap-1 ${hasValue ? 'bg-surface-100 border-primary-200/50 shadow-xs' : 'bg-surface-200/40 border-surface-300/40 opacity-70'}`}>
                          <label className="text-[9px] font-bold text-typography-400 uppercase tracking-widest text-center">Mês {idx + 1}</label>
                          <input 
                            type="number"
                            min="0"
                            value={val}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9]/g, '');
                              const newHours = [...pioneerHours];
                              newHours[idx] = sanitized;
                              setPioneerHours(newHours);
                            }}
                            className="w-full p-1 bg-transparent rounded-lg text-center font-bold text-primary-200 outline-none text-sm"
                            placeholder="0"
                          />
                          {hasValue && (
                            <div className={`text-[9px] font-bold text-center ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {diff >= 0 ? '+' : ''}{diff}h
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-surface-200/50 p-5 rounded-2xl border border-surface-300 flex flex-col sm:flex-row gap-6 sm:items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-typography-400 uppercase tracking-widest mb-1">Total Acumulado</p>
                    <div className="flex items-baseline gap-2">
                       {(() => {
                        const total = pioneerHours.map(h => parseFloat(h) || 0).reduce((a, b) => a + b, 0);
                        const count = pioneerHours.filter(h => h.trim() !== '').length;
                        const target = count * 50;
                        return (
                          <>
                            <span className="text-3xl font-black text-primary-200">{total}h</span>
                            <span className="text-sm font-bold text-typography-400">/ {target}h ({count} meses)</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="h-px sm:h-12 w-full sm:w-px bg-surface-300"></div>
                  
                  <div className="text-right sm:text-right">
                    <p className="text-[10px] font-bold text-typography-400 uppercase tracking-widest mb-1">Diferença Total</p>
                    {(() => {
                      const total = pioneerHours.map(h => parseFloat(h) || 0).reduce((a, b) => a + b, 0);
                      const count = pioneerHours.filter(h => h.trim() !== '').length;
                      const diff = count > 0 ? total - (count * 50) : 0;
                      return (
                        <span className={`text-2xl font-black ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {diff >= 0 ? '+' : ''}{diff}h
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <p className="text-[10px] text-typography-400 italic text-center">
                  * A meta anual é de 600 horas, o que equivale a 50 horas mensais para pioneiros regulares.
                </p>
              </div>

              <div className="p-5 bg-surface-200/40 border-t border-surface-300 flex gap-3 shrink-0">
                <button 
                  onClick={() => setShowPioneerModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-typography-600 hover:bg-surface-300/50 border border-surface-300 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSavePioneerRaw}
                  className="flex-[2] py-2.5 rounded-xl font-bold bg-primary-200 text-white hover:bg-primary-300 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Save size={18} /> {editingPioneer ? 'Salvar Alterações' : 'Salvar Média Individual'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {calcModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="bg-surface-200 border-b border-surface-300 px-5 py-4 text-typography-900 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <Calculator size={22} className="text-primary-200" /> Calcular Média
                </h3>
                <button onClick={() => setCalcModal(null)} className="text-typography-500 hover:text-typography-900 hover:bg-surface-300/50 p-1.5 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-center">
                  <div className="w-14 h-14 bg-primary-200/10 text-primary-200 rounded-2xl flex items-center justify-center shadow-xs">
                    <Calculator size={30} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-typography-500 uppercase tracking-wider">Categoria</p>
                  <p className="font-bold text-typography-900">{calcModal.label}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {calcValues.map((val, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 block text-center">Mês {idx + 1}</label>
                      <input 
                        type="number"
                        min="0"
                        value={val}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/[^0-9]/g, '');
                          const newVals = [...calcValues];
                          newVals[idx] = sanitized;
                          setCalcValues(newVals);
                        }}
                        className="w-full p-2 bg-surface-200/50 border border-surface-300 rounded-xl text-center font-bold text-typography-900 focus:border-primary-200 focus:bg-surface-100 outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setCalcModal(null)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-typography-600 hover:bg-surface-200 border border-surface-300 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={applyAverage}
                    className="flex-1 py-2.5 rounded-xl font-bold bg-primary-200 text-white hover:bg-primary-300 transition-all shadow-xs"
                  >
                    Aplicar Média
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
