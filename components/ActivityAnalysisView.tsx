'use client';

import { useState, useEffect } from 'react';
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
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface ActivityAnalysisViewProps {
  userId: string;
  congregationName: string;
  visitDate: string;
  onBack: () => void;
}

interface MinistryActivity {
  relatando: string;
  estudos: string;
}

interface AnalysisData {
  congregacao: string;
  dataVisita: string;
  pubAtivos: string;
  ministério: {
    publicadores: MinistryActivity;
    pioneirosAuxiliares: MinistryActivity;
    pioneirosRegulares: MinistryActivity;
    pioneirosEspeciais: MinistryActivity;
  };
  estatisticas: {
    mediaEstudos: number;
    dirigemEstudos: number;
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
  dataVisita: '',
  pubAtivos: '',
  ministério: {
    publicadores: { relatando: '', estudos: '' },
    pioneirosAuxiliares: { relatando: '', estudos: '' },
    pioneirosRegulares: { relatando: '', estudos: '' },
    pioneirosEspeciais: { relatando: '', estudos: '' },
  },
  estatisticas: {
    mediaEstudos: 0,
    dirigemEstudos: 0,
    irregulares: 0,
    novosPublicadores: 0,
    reativados: 0,
    readmitidos: 0,
    inativos: 0,
    removidos: 0,
    batizados: 0,
    anciaos: 0,
    servos: 0,
  },
  donativos: {
    congregacao: ['', '', '', '', '', ''],
    obraMundial: ['', '', '', '', '', ''],
  },
  reunioes: {
    meioSemana: ['', '', '', '', '', ''],
    fimSemana: ['', '', '', '', '', ''],
  },
};

export default function ActivityAnalysisView({ userId, congregationName, visitDate, onBack }: ActivityAnalysisViewProps) {
  const [data, setData] = useState<AnalysisData>({
    ...defaultData,
    congregacao: congregationName,
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
  const [calcValues, setCalcValues] = useState<string[]>(['', '', '', '', '', '']);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docId = `${userId}_${congregationName}_${visitDate.replace(/\//g, '-')}`;
        const docRef = doc(db, 'activity_analysis', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data() as AnalysisData);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'activity_analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregationName, visitDate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docId = `${userId}_${congregationName}_${visitDate.replace(/\//g, '-')}`;
      await setDoc(doc(db, 'activity_analysis', docId), {
        ...data,
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

  const updateEstatistica = (field: keyof AnalysisData['estatisticas'], delta: number) => {
    setIsDirty(true);
    setData(prev => ({
      ...prev,
      estatisticas: {
        ...prev.estatisticas,
        [field]: Math.max(0, prev.estatisticas[field] + delta)
      }
    }));
  };

  const updateMinistry = (type: keyof AnalysisData['ministério'], field: keyof MinistryActivity, value: string) => {
    setIsDirty(true);
    setData(prev => ({
      ...prev,
      ministério: {
        ...prev.ministério,
        [type]: {
          ...prev.ministério[type],
          [field]: value
        }
      }
    }));
  };

  const formatCurrency = (value: string) => {
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanValue) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const updateTable = (section: 'donativos' | 'reunioes', field: string, index: number, value: string) => {
    setIsDirty(true);
    setData(prev => {
      const sectionData = { ...prev[section] };
      if (field in sectionData) {
        const list = [...(sectionData as any)[field]];
        list[index] = value;
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
    const validValues = list.map(v => parseInt(v)).filter(v => !isNaN(v));
    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / validValues.length);
  };

  const avgFimSemana = calculateAverageReunioes(data.reunioes.fimSemana);
  const avgMeioSemana = calculateAverageReunioes(data.reunioes.meioSemana);
  const pubAtivosNum = parseInt(data.pubAtivos) || 0;
  const difference = avgFimSemana - pubAtivosNum;
  const percentageRaw = pubAtivosNum > 0 ? (difference / pubAtivosNum) * 100 : 0;
  const percentageFormatted = percentageRaw.toFixed(1).replace('.', ',');

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
        alert('PDF gerado com sucesso! Verifique sua pasta de Downloads.');
      }
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      const msg = error?.message || 'Erro desconhecido';
      alert(`Ocorreu um erro ao gerar o PDF: ${msg}. Tente novamente.`);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-[#512da8]" size={48} />
        <p className="text-gray-500 font-medium">Carregando análise...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 max-w-5xl mx-auto pb-12 font-[var(--font-inter)]">
        {/* Header - Navigation & Actions */}
        <header className="no-print w-full bg-[#f9f9ff] text-[#4f46e5] font-[var(--font-manrope)] antialiased tracking-tight border border-[#c7c4d8]/30 flex flex-col sm:flex-row justify-between items-center px-6 py-4 rounded-2xl shadow-sm gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-[#3525cd] border border-transparent hover:border-[#c7c4d8]/30"
              title="Voltar ao Painel"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <div className="text-xl font-extrabold tracking-tighter text-[#3525cd]">Análise das Atividades</div>
          </div>
          
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button 
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#3525cd] text-white rounded-xl font-bold text-sm hover:bg-[#2a1da3] transition-all disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{saving ? 'Salvando...' : 'Salvar'}</span>
            </button>
            <button 
              onClick={handleSavePDF}
              disabled={generating}
              className="p-2 text-[#464555] hover:text-[#3525cd] hover:bg-white rounded-full transition-all border border-transparent hover:border-[#c7c4d8]/30 disabled:opacity-50"
              title="Baixar PDF"
            >
              {generating ? <Loader2 size={20} className="animate-spin" /> : <FileDown size={20} />}
            </button>
            <button 
              onClick={() => window.print()}
              className="p-2 text-[#464555] hover:text-[#3525cd] hover:bg-white rounded-full transition-all border border-transparent hover:border-[#c7c4d8]/30"
              title="Imprimir"
            >
              <Printer size={20} />
            </button>
          </div>
        </header>

        <div className="overflow-x-auto pb-4 flex justify-center">
          <main id="activity-analysis-form" className="a4-page relative bg-white shadow-2xl border border-[#c7c4d8]/20 print:shadow-none print:border-none print:m-0 w-[1137.33px]">
            <style jsx global>{`
              .a4-page {
                width: 1137.33px;
                min-height: 297mm;
                padding: 8mm;
                background: white;
              }
              .editorial-line {
                border-left: 4px solid #712ae2;
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
              .pdf-capture .bg-\[\#f9f9ff\] {
                background-color: #f9f9ff !important;
              }
              .pdf-capture .bg-\[\#f0f3ff\] {
                background-color: #f0f3ff !important;
              }
              .pdf-capture .bg-\[\#4f46e5\] {
                background-color: #4f46e5 !important;
              }
              .pdf-capture .bg-\[\#fff2e0\] {
                background-color: #fff2e0 !important;
              }
              .pdf-capture .bg-\[\#d1fdf0\] {
                background-color: #d1fdf0 !important;
              }
              .pdf-capture .bg-\[\#dee8ff\] {
                background-color: #dee8ff !important;
              }
              .pdf-capture .bg-\[\#e7eeff\] {
                background-color: #e7eeff !important;
              }
            `}</style>

            {/* Header Section */}
            <div className="text-center mb-8">
              <h1 className="font-[var(--font-manrope)] text-xl font-extrabold tracking-tight text-[#3525cd] mb-2 uppercase">
                Relatório de Estatísticas da Congregação
              </h1>
              <div className="w-full h-px bg-[#c7c4d8]/30 mb-6"></div>
              
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-left border-r border-[#c7c4d8]/30 pr-4">
                  <p className="font-[var(--font-inter)] text-[11px] text-[#2d2d2d] uppercase tracking-widest font-bold mb-1">Congregação</p>
                  <p className="font-[var(--font-manrope)] font-bold text-lg text-[#111c2d] truncate">{data.congregacao}</p>
                </div>
                <div className="text-center border-r border-[#c7c4d8]/30 px-4">
                  <p className="font-[var(--font-inter)] text-[11px] text-[#2d2d2d] uppercase tracking-widest font-bold mb-1">Pub. Ativos</p>
                  <div className="flex justify-center">
                    <input 
                      type="number"
                      value={data.pubAtivos}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 3);
                        setIsDirty(true);
                        setData({...data, pubAtivos: val});
                      }}
                      className="w-20 font-[var(--font-manrope)] font-bold text-2xl text-[#3525cd] bg-transparent border-none p-0 text-center focus:ring-0 outline-none"
                    />
                  </div>
                </div>
                <div className="text-right pl-4">
                  <p className="font-[var(--font-inter)] text-[11px] text-[#2d2d2d] uppercase tracking-widest font-bold mb-1">Data da Visita</p>
                  <p className="font-[var(--font-manrope)] font-bold text-lg text-[#111c2d]">{data.dataVisita}</p>
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
                    <h2 className="font-[var(--font-manrope)] text-sm font-bold text-[#111c2d] uppercase tracking-wider">
                      Atividades Gerais do Ministério <span className="text-[#2d2d2d] font-normal text-xs lowercase">(média mensal)</span>
                    </h2>
                  </div>
                  <div className="bg-[#f0f3ff] overflow-hidden rounded-xl border border-[#c7c4d8]/40">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#dee8ff]">
                          <th className="py-3 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider">Categoria</th>
                          <th className="py-3 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider text-center">Nº Relatando</th>
                          <th className="py-3 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider text-center">Nº de Estudos</th>
                          <th className="py-3 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider text-center">Média</th>
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
                            <tr key={item.id} className={`border-b border-[#c7c4d8]/20 ${idx % 2 === 1 ? 'bg-[#f9f9ff]/50' : ''}`}>
                              <td className="py-3 px-4 text-[#111c2d] font-semibold">{item.label}</td>
                              <td className="py-2 px-2">
                                <div className="relative flex items-center justify-center group">
                                  <input 
                                    type="number"
                                    value={itemData.relatando}
                                    onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'relatando', e.target.value)}
                                    className="w-20 p-1.5 bg-white rounded-2xl border border-[#c7c4d8]/40 shadow-sm focus:border-[#3525cd] text-center font-bold text-[#3525cd] outline-none transition-all"
                                  />
                                  <button 
                                    onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'relatando', `${item.label} - Relatando`)}
                                    className="absolute right-0 opacity-0 group-hover:opacity-100 p-1 text-[#2d2d2d] hover:text-[#3525cd] transition-all print:hidden"
                                  >
                                    <Calculator size={18} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <div className="relative flex items-center justify-center group">
                                  <input 
                                    type="number"
                                    value={itemData.estudos}
                                    onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'estudos', e.target.value)}
                                    className="w-20 p-1.5 bg-white rounded-2xl border border-[#c7c4d8]/40 shadow-sm focus:border-[#3525cd] text-center font-bold text-[#111c2d] outline-none transition-all"
                                  />
                                  <button 
                                    onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'estudos', `${item.label} - Estudos`)}
                                    className="absolute right-0 opacity-0 group-hover:opacity-100 p-1 text-[#2d2d2d] hover:text-[#3525cd] transition-all print:hidden"
                                  >
                                    <Calculator size={18} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-[#111c2d]">{avg}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Estatísticas da Congregação Table */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="font-[var(--font-manrope)] text-sm font-bold text-[#111c2d] uppercase tracking-wider">Estatísticas da Congregação</h2>
                  </div>
                  <div className="border border-[#c7c4d8]/40 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#e7eeff]">
                          <th className="py-2.5 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider">Descrição</th>
                          <th className="py-2.5 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider text-center w-24">Qtd</th>
                          <th className="py-2.5 px-4 font-[var(--font-manrope)] text-[11px] font-bold text-[#2d2d2d] uppercase tracking-wider text-center w-24">Perc.</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium">
                        {[
                          { id: 'mediaEstudos', label: 'Média mensal de Estudos Bíblicos', color: 'text-[#111c2d]', isAuto: true },
                          { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos', color: 'text-[#111c2d]' },
                          { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES*', color: 'text-[#3525cd]' },
                          { id: 'reativados', label: 'Quantos foram REATIVADOS*', color: 'text-[#3525cd]' },
                          { id: 'readmitidos', label: 'Quantos foram READMITIDOS*', color: 'text-[#3525cd]' },
                          { id: 'batizados', label: 'Quantos foram BATIZADOS*', color: 'text-[#712ae2]' },
                          { id: 'irregulares', label: 'Número de IRREGULARES*', color: 'text-[#ba1a1a]' },
                          { id: 'inativos', label: 'Quantos ficaram INATIVOS*', color: 'text-[#ba1a1a]' },
                          { id: 'removidos', label: 'Quantos ficaram REMOVIDOS*', color: 'text-[#ba1a1a]' },
                          { id: 'anciaos', label: 'Número de ANCIÃOS', color: 'text-[#3525cd]' },
                          { id: 'servos', label: 'Números de SERVOS MINISTERIAIS', color: 'text-[#3525cd]' }
                        ].map((item, idx) => {
                          const val = item.id === 'mediaEstudos' ? totalEstudos : data.estatisticas[item.id as keyof AnalysisData['estatisticas']];
                          const perc = pubAtivosNum > 0 ? (val / pubAtivosNum * 100).toFixed(1).replace('.', ',') : '0,0';
                          const average = pubAtivosNum > 0 ? (val / pubAtivosNum).toFixed(1).replace('.', ',') + '/pub' : '0,0/pub';
                          
                          return (
                            <tr key={item.id} className={`border-b border-[#c7c4d8]/20 ${idx % 2 === 1 ? 'bg-[#f9f9ff]/50' : 'bg-white'}`}>
                              <td className={`py-2 px-4 font-semibold ${item.color}`}>{item.label}</td>
                              <td className="py-1 px-2">
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center gap-3 bg-white border border-[#c7c4d8]/40 rounded-2xl px-2 py-1 shadow-sm">
                                    {!item.isAuto ? (
                                      <>
                                        <button 
                                          onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], -1)}
                                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#fff2e0] text-[#ff6b00] hover:bg-[#ff6b00] hover:text-white transition-all active:scale-90 print:hidden"
                                        >
                                          <Minus size={14} strokeWidth={3} />
                                        </button>
                                        <span className="font-bold text-base min-w-[28px] text-center text-[#111c2d]">{val}</span>
                                        <button 
                                          onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], 1)}
                                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#d1fdf0] text-[#00a68e] hover:bg-[#00a68e] hover:text-white transition-all active:scale-90 print:hidden"
                                        >
                                          <Plus size={14} strokeWidth={3} />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="font-bold text-base min-w-[80px] text-center text-[#111c2d] py-1">{val}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-4 text-center">
                                <span className="font-bold text-[10px] text-[#3525cd] bg-[#e2dfff] px-2 py-0.5 rounded-full border border-[#c7c4d8]/40">
                                  {item.id === 'mediaEstudos' ? average : `${perc}%`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[10px] text-[#2d2d2d] italic">* Desde a última visita</div>
                </section>
              </div>

              {/* Right Column: Donations & Meetings */}
              <div className="space-y-8">
                {/* Donativos */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="font-[var(--font-manrope)] text-sm font-bold text-[#111c2d] uppercase tracking-wider">Donativos</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-white border border-[#c7c4d8]/40 rounded-xl shadow-sm p-5">
                    {/* Congregação Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest text-center mb-4">Congregação</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.donativos.congregacao.map((v, i) => (
                          <input 
                            key={i}
                            value={v}
                            onChange={(e) => updateTable('donativos', 'congregacao', i, e.target.value)}
                            onBlur={(e) => updateTable('donativos', 'congregacao', i, formatCurrency(e.target.value))}
                            className="w-full p-2.5 bg-[#f9f9ff] rounded-xl border border-[#c7c4d8]/20 text-center text-sm font-bold outline-none focus:border-[#3525cd] focus:bg-white transition-all"
                            placeholder="0,00"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-[#c7c4d8]/50 text-center">
                        <p className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest mb-1">Total</p>
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-[#3525cd] leading-tight">
                          <span className="text-xs block mb-0.5">R$</span>
                          {calculateTotalDonativos(data.donativos.congregacao)}
                        </p>
                      </div>
                    </div>

                    {/* Obra Mundial Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest text-center mb-4">Obra Mundial</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.donativos.obraMundial.map((v, i) => (
                          <input 
                            key={i}
                            value={v}
                            onChange={(e) => updateTable('donativos', 'obraMundial', i, e.target.value)}
                            onBlur={(e) => updateTable('donativos', 'obraMundial', i, formatCurrency(e.target.value))}
                            className="w-full p-2.5 bg-[#f9f9ff] rounded-xl border border-[#c7c4d8]/20 text-center text-sm font-bold outline-none focus:border-[#3525cd] focus:bg-white transition-all"
                            placeholder="0,00"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-[#c7c4d8]/50 text-center">
                        <p className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest mb-1">Total</p>
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-[#512da8] leading-tight">
                          <span className="text-xs block mb-0.5">R$</span>
                          {calculateTotalDonativos(data.donativos.obraMundial)}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Reuniões */}
                <section>
                  <div className="flex items-center mb-4 editorial-line pl-3">
                    <h2 className="font-[var(--font-manrope)] text-sm font-bold text-[#111c2d] uppercase tracking-wider">Reuniões</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-white border border-[#c7c4d8]/40 rounded-xl shadow-sm p-5">
                    {/* Meio de Semana Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest text-center mb-4">Meio de Semana</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.reunioes.meioSemana.map((v, i) => (
                          <input 
                            key={i}
                            type="number"
                            value={v}
                            onChange={(e) => updateTable('reunioes', 'meioSemana', i, e.target.value)}
                            className="w-full p-2.5 bg-[#f9f9ff] rounded-xl border border-[#c7c4d8]/20 text-center text-sm font-bold outline-none focus:border-[#3525cd] focus:bg-white transition-all"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-[#c7c4d8]/50 text-center">
                        <p className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest mb-1">Média</p>
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-[#3525cd]">{avgMeioSemana}</p>
                      </div>
                    </div>

                    {/* Fim de Semana Column */}
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest text-center mb-4">Fim de Semana</h3>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {data.reunioes.fimSemana.map((v, i) => (
                          <input 
                            key={i}
                            type="number"
                            value={v}
                            onChange={(e) => updateTable('reunioes', 'fimSemana', i, e.target.value)}
                            className="w-full p-2.5 bg-[#f9f9ff] rounded-xl border border-[#c7c4d8]/20 text-center text-sm font-bold outline-none focus:border-[#3525cd] focus:bg-white transition-all"
                          />
                        ))}
                      </div>
                      <div className="pt-4 border-t border-dashed border-[#c7c4d8]/50 text-center">
                        <p className="text-[11px] font-bold text-[#2d2d2d] uppercase tracking-widest mb-1">Média</p>
                        <p className="font-[var(--font-manrope)] font-bold text-xl text-[#3525cd]">{avgFimSemana}</p>
                      </div>
                    </div>

                    <div className="col-span-2 mt-4 bg-[#4f46e5] p-3 rounded-xl text-center text-white shadow-md shadow-indigo-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Porcentagem sobre nº de Publicadores</p>
                      <p className="font-[var(--font-manrope)] font-bold text-xl">
                        {percentageRaw > 0 ? `+${percentageFormatted}%` : `${percentageFormatted}%`}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <footer className="mt-auto pt-8 border-t border-[#c7c4d8]/50">
              <div className="flex justify-between items-start text-[10px] text-[#2d2d2d] leading-relaxed uppercase tracking-wider">
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

      {/* Average Calculator Modal */}
      <AnimatePresence>
        {showExitConfirmation && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Save size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Alterações não salvas</h3>
                  <p className="text-gray-600">
                    Você tem alterações que ainda não foram salvas na análise. Deseja salvar antes de sair?
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={async () => {
                      await handleSave();
                      onBack();
                    }}
                    className="w-full py-3 rounded-xl font-bold bg-[#512da8] text-white hover:bg-[#4527a0] transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar e Sair
                  </button>
                  <button 
                    onClick={onBack}
                    className="w-full py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-all"
                  >
                    Descartar e Sair
                  </button>
                  <button 
                    onClick={() => setShowExitConfirmation(false)}
                    className="w-full py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                  >
                    Continuar Editando
                  </button>
                </div>
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
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="bg-[#512da8] p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <Calculator size={24} /> Calcular Média
                </h3>
                <button onClick={() => setCalcModal(null)} className="hover:bg-white/20 p-1 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-indigo-50 text-[#512da8] rounded-2xl flex items-center justify-center shadow-sm">
                    <Calculator size={36} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categoria</p>
                  <p className="font-bold text-gray-800">{calcModal.label}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {calcValues.map((val, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block text-center">Mês {idx + 1}</label>
                      <input 
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const newVals = [...calcValues];
                          newVals[idx] = e.target.value;
                          setCalcValues(newVals);
                        }}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:border-[#512da8] outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setCalcModal(null)}
                    className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={applyAverage}
                    className="flex-1 py-3 rounded-xl font-bold bg-[#512da8] text-white hover:bg-[#4527a0] transition-all shadow-lg shadow-indigo-100"
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
