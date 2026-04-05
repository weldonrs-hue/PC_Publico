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
    return list.reduce((acc, curr) => acc + (parseFloat(curr.replace(',', '.')) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
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
  const percentage = pubAtivosNum > 0 ? Math.round((difference / pubAtivosNum) * 100) : 0;

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
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // Add a class to ensure print-specific styles are applied if needed
      element.classList.add('pdf-capture');
      
      // Convert element to PNG image
      // html-to-image is much better at handling modern CSS like oklch
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2, // High resolution
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      element.classList.remove('pdf-capture');

      // Create a temporary PDF to get image properties
      const tempPdf = new jsPDF();
      const imgProps = tempPdf.getImageProperties(dataUrl);
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Create the final PDF with dynamic height to avoid cutting
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-2xl shadow-md border-l-8 border-[#512da8] print:hidden gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
            title="Voltar ao Painel"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Análise das atividades</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={handleSavePDF} 
            disabled={generating}
            className="flex-1 sm:flex-none py-2.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 font-bold text-sm shadow-sm disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={18} className="animate-spin text-[#512da8]" />
            ) : (
              <FileDown size={18} className="text-[#512da8]" />
            )}
            <span>{generating ? 'Gerando...' : 'Salvar PDF'}</span>
          </button>
          <button 
            onClick={() => window.print()} 
            className="flex-1 sm:flex-none py-2.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 font-bold text-sm shadow-sm"
          >
            <Printer size={18} className="text-[#512da8]" /> 
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div id="activity-analysis-form" className="min-w-[800px] space-y-6 bg-white p-[8mm] shadow-2xl border border-gray-200 print:shadow-none print:border-none print:p-0 print:space-y-4 font-sans text-gray-900 overflow-hidden leading-tight print:min-w-0">
        <style jsx global>{`
          @media print {
            @page {
              margin: 0;
              size: A4;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background-color: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #activity-analysis-form {
              padding: 8mm !important;
              background-color: white !important;
              height: 297mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
          }
          
          /* Fix for html2canvas oklch color error and preserve colors */
          .pdf-capture {
            background-color: #ffffff !important;
            color: #1a1a1a !important;
          }
          .pdf-capture * {
            border-color: #e5e7eb !important;
            /* Force standard color space for capture */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .pdf-capture .bg-indigo-50\/50 {
            background-color: #f0f4ff !important;
          }
          .pdf-capture .bg-teal-50\/30 {
            background-color: #f0fdfa !important;
          }
          .pdf-capture .bg-white {
            background-color: #ffffff !important;
          }
          .pdf-capture .bg-gradient-to-r {
            background: #4a7c74 !important; /* Fallback to solid hex */
            color: #ffffff !important;
          }
          .pdf-capture .text-\[\#512da8\] {
            color: #512da8 !important;
          }
          .pdf-capture .bg-\[\#512da8\] {
            background-color: #512da8 !important;
          }
          .pdf-capture .bg-orange-100 {
            background-color: #ffedd5 !important;
          }
          .pdf-capture .bg-teal-100 {
            background-color: #ccfbf1 !important;
          }
          .pdf-capture .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          .pdf-capture .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
          .pdf-capture .text-emerald-600 {
            color: #059669 !important;
          }
          .pdf-capture .text-red-600 {
            color: #dc2626 !important;
          }
          .pdf-capture .text-amber-600 {
            color: #d97706 !important;
          }
        `}</style>
        
        {/* Document Title - Visible only in PDF/Print */}
        <div className="hidden print:block text-center pt-2 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-[#512da8]">Análise das Atividades</h1>
          <p className="text-lg text-gray-500 font-medium">{data.congregacao} — {data.dataVisita}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Info */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="text-sm font-bold text-[#512da8] uppercase mb-1 block tracking-tight">Congregação</label>
              <div className="p-3 bg-indigo-50/50 rounded-xl font-bold text-gray-800 border border-indigo-100 text-xl">
                {data.congregacao}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-[#512da8] uppercase mb-1 block tracking-tight">Pub. Ativos</label>
              <input 
                type="number"
                value={data.pubAtivos}
                onChange={(e) => {
                  setIsDirty(true);
                  setData({...data, pubAtivos: e.target.value});
                }}
                className="w-full p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 focus:border-[#512da8] focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-center text-2xl text-[#512da8]"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#512da8] uppercase mb-1 block tracking-tight">Data da visita</label>
              <div className="p-3 bg-indigo-50/50 rounded-xl font-bold text-gray-800 border border-indigo-100 text-center text-xl">
                {data.dataVisita}
              </div>
            </div>
          </div>

          {/* Ministry Activities */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#4a7c74] to-[#5a8c84] p-4 text-white flex items-center gap-2">
              <Users size={20} />
              <h3 className="font-bold text-lg uppercase tracking-widest">Atividades Gerais do Ministério (média mensal)</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-left font-bold text-gray-600">CATEGORIA</th>
                    <th className="p-4 text-center font-bold text-gray-600 w-36">Nº RELATANDO</th>
                    <th className="p-4 text-center font-bold text-gray-600 w-36">Nº DE ESTUDOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { id: 'publicadores', label: 'PUBLICADORES', bg: 'bg-white' },
                    { id: 'pioneirosAuxiliares', label: 'PIONEIROS AUXILIARES', bg: 'bg-teal-50/30' },
                    { id: 'pioneirosRegulares', label: 'PIONEIROS REGULARES', bg: 'bg-white' },
                    { id: 'pioneirosEspeciais', label: 'PIONEIROS ESPECIAIS', bg: 'bg-teal-50/30' }
                  ].map((item) => (
                    <tr key={item.id} className={`${item.bg} hover:bg-teal-50/50 transition-colors`}>
                      <td className="p-4 font-bold text-gray-700 text-lg">{item.label}</td>
                      <td className="p-2">
                        <div className="relative flex items-center bg-white rounded-xl border border-gray-200 shadow-sm focus-within:border-[#512da8] focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
                          <input 
                            type="number"
                            value={data.ministério[item.id as keyof AnalysisData['ministério']].relatando}
                            onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'relatando', e.target.value)}
                            className="w-full p-2.5 bg-transparent text-center font-bold outline-none text-xl text-gray-800"
                          />
                          <button 
                            onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'relatando', `${item.label} - Relatando`)}
                            className="absolute right-1.5 p-1.5 text-gray-400 hover:text-[#512da8] hover:bg-indigo-50 rounded-lg transition-all"
                            title="Calcular média"
                          >
                            <Calculator size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="relative flex items-center bg-white rounded-xl border border-gray-200 shadow-sm focus-within:border-[#512da8] focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
                          <input 
                            type="number"
                            value={data.ministério[item.id as keyof AnalysisData['ministério']].estudos}
                            onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'estudos', e.target.value)}
                            className="w-full p-2.5 bg-transparent text-center font-bold outline-none text-xl text-gray-800"
                          />
                          <button 
                            onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'estudos', `${item.label} - Estudos`)}
                            className="absolute right-1.5 p-1.5 text-gray-400 hover:text-[#512da8] hover:bg-indigo-50 rounded-lg transition-all"
                            title="Calcular média"
                          >
                            <Calculator size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Congregation Stats */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#4a7c74] to-[#5a8c84] p-4 text-white flex items-center gap-2">
              <BarChart3 size={20} />
              <h3 className="font-bold text-lg uppercase tracking-widest">Estatísticas da Congregação</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-left font-bold text-gray-600">DESCRIÇÃO</th>
                    <th className="p-4 text-center font-bold text-gray-600 w-44">QUANTIDADE</th>
                    <th className="p-4 text-center font-bold text-gray-600 w-32">PORCENTAGEM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { id: 'mediaEstudos', label: 'Média mensal de Estudos Bíblicos', color: 'text-gray-700', isAuto: true },
                    { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos', color: 'text-gray-700' },
                    { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES desde a última visita', color: 'text-emerald-600' },
                    { id: 'reativados', label: 'Quantos foram REATIVADOS desde a última visita', color: 'text-emerald-600' },
                    { id: 'readmitidos', label: 'Quantos foram READMITIDOS desde a última visita', color: 'text-emerald-600' },
                    { id: 'batizados', label: 'Quantos foram BATIZADOS desde a última visita', color: 'text-amber-600' },
                    { id: 'irregulares', label: 'Número de IRREGULARES desde a última visita', color: 'text-red-600' },
                    { id: 'inativos', label: 'Quantos ficaram INATIVOS desde a última visita', color: 'text-red-600' },
                    { id: 'removidos', label: 'Quantos ficaram REMOVIDOS desde a última visita', color: 'text-red-600' },
                    { id: 'anciaos', label: 'Número de ANCIÃOS', color: 'text-[#512da8]' },
                    { id: 'servos', label: 'Números de SERVOS MINISTERIAIS', color: 'text-[#512da8]' }
                  ].map((item, idx) => {
                    const val = item.id === 'mediaEstudos' ? totalEstudos : data.estatisticas[item.id as keyof AnalysisData['estatisticas']];
                    const perc = pubAtivosNum > 0 ? Math.round((val / pubAtivosNum) * 100) : 0;
                    return (
                      <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-indigo-50/30 transition-colors`}>
                        <td className={`p-4 font-normal text-lg ${item.color}`}>{item.label}</td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-4 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                            <button 
                              onClick={() => !item.isAuto && updateEstatistica(item.id as keyof AnalysisData['estatisticas'], -1)}
                              disabled={item.isAuto}
                              className={`p-1.5 rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-600 hover:text-white transition-all active:scale-90 ${item.isAuto ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="font-bold text-2xl min-w-[40px] text-center text-gray-800">{val}</span>
                            <button 
                              onClick={() => !item.isAuto && updateEstatistica(item.id as keyof AnalysisData['estatisticas'], 1)}
                              disabled={item.isAuto}
                              className={`p-1.5 rounded-lg bg-teal-100 text-teal-600 hover:bg-teal-600 hover:text-white transition-all active:scale-90 ${item.isAuto ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold text-xl text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                            {perc}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Donations */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#4a7c74] to-[#5a8c84] p-4 text-white flex items-center gap-2">
              <DollarSign size={20} />
              <h3 className="font-bold text-lg uppercase tracking-widest">Donativos</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase text-center block tracking-widest">Congregação</label>
                  {data.donativos.congregacao.map((v, i) => (
                    <input 
                      key={i}
                      value={v}
                      onChange={(e) => updateTable('donativos', 'congregacao', i, e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center text-xl font-bold outline-none focus:border-[#512da8] focus:bg-white transition-all"
                      placeholder="0,00"
                    />
                  ))}
                  <div className="pt-3 border-t-2 border-dashed border-gray-100 flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-400 tracking-widest">TOTAL</span>
                    <span className="font-bold text-2xl text-[#512da8]">R$ {calculateTotalDonativos(data.donativos.congregacao)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase text-center block tracking-widest">Obra Mundial</label>
                  {data.donativos.obraMundial.map((v, i) => (
                    <input 
                      key={i}
                      value={v}
                      onChange={(e) => updateTable('donativos', 'obraMundial', i, e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center text-xl font-bold outline-none focus:border-[#512da8] focus:bg-white transition-all"
                      placeholder="0,00"
                    />
                  ))}
                  <div className="pt-3 border-t-2 border-dashed border-gray-100 flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-400 tracking-widest">TOTAL</span>
                    <span className="font-bold text-2xl text-[#512da8]">R$ {calculateTotalDonativos(data.donativos.obraMundial)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meetings */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#4a7c74] to-[#5a8c84] p-4 text-white flex items-center gap-2">
              <Users size={18} />
              <h3 className="font-bold text-base uppercase tracking-widest">Reuniões</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase text-center block tracking-widest">Meio de Semana</label>
                  {data.reunioes.meioSemana.map((v, i) => (
                    <input 
                      key={i}
                      type="number"
                      value={v}
                      onChange={(e) => updateTable('reunioes', 'meioSemana', i, e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center text-sm font-bold outline-none focus:border-[#512da8] focus:bg-white transition-all"
                    />
                  ))}
                  <div className="pt-3 border-t-2 border-dashed border-gray-100 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Média</span>
                    <span className="font-bold text-base text-teal-600">{avgMeioSemana}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase text-center block tracking-widest">Fim de Semana</label>
                  {data.reunioes.fimSemana.map((v, i) => (
                    <input 
                      key={i}
                      type="number"
                      value={v}
                      onChange={(e) => updateTable('reunioes', 'fimSemana', i, e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center text-sm font-bold outline-none focus:border-[#512da8] focus:bg-white transition-all"
                    />
                  ))}
                  <div className="pt-3 border-t-2 border-dashed border-gray-100 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Média</span>
                    <span className="font-bold text-base text-teal-600">{avgFimSemana}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-indigo-500 text-center space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Diferença entre publicadores e média de Fim de Semana</label>
              <div className={`text-2xl font-bold ${difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {difference > 0 ? `+${difference}` : difference}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-indigo-500 text-center space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Porcentagem sobre nº de publicadores (Fim de Semana)</label>
              <div className="text-2xl font-bold text-[#512da8]">
                {percentage > 0 ? `+${percentage}%` : `${percentage}%`}
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-indigo-50 p-6 rounded-2xl text-[11px] text-indigo-900 leading-relaxed italic border border-indigo-100 shadow-inner">
            Os dados registrados aqui somam as estatísticas do circuito que pode ser acessada na página inicial. Esses dados podem ser úteis para reunião Especial com os Pioneiros ou outras necessidades do circuito.
          </div>
        </div>
      </div>
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
                  <Calculator size={18} /> Calcular Média
                </h3>
                <button onClick={() => setCalcModal(null)} className="hover:bg-white/20 p-1 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
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
