'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Loader2,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  Printer,
  FileDown,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { createCircuitFolderStructure } from '@/utils/fileSystem';

interface CircuitStatisticsViewProps {
  userId: string;
  personalData?: any;
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
  updatedAt?: string;
}

export default function CircuitStatisticsView({ userId, personalData, onBack }: CircuitStatisticsViewProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [congCount, setCongCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'activity_analysis'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        console.log(`[CircuitStatistics] Fetched ${querySnapshot.size} documents for userId: ${userId}`);

        const analysesByCong: { [key: string]: AnalysisData } = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as AnalysisData;
          const cong = data.congregacao;
          
          if (!cong) {
            console.warn(`[CircuitStatistics] Document ${doc.id} has no congregation name.`);
            return;
          }

          if (!analysesByCong[cong]) {
            analysesByCong[cong] = data;
          } else {
            const currentLatest = analysesByCong[cong];
            const currentDate = parseDate(currentLatest.dataVisita);
            const newDataDate = parseDate(data.dataVisita);
            
            if (newDataDate > currentDate) {
              analysesByCong[cong] = data;
            } else if (newDataDate.getTime() === currentDate.getTime()) {
              if (data.updatedAt && currentLatest.updatedAt) {
                if (new Date(data.updatedAt) > new Date(currentLatest.updatedAt)) {
                  analysesByCong[cong] = data;
                }
              }
            }
          }
        });

        const congregations = Object.values(analysesByCong);
        console.log(`[CircuitStatistics] Aggregated ${congregations.length} unique congregation analyses.`);
        setCongCount(congregations.length);

        const totals = {
          pubAtivos: 0,
          ministério: {
            publicadores: { relatando: 0, estudos: 0 },
            pioneirosAuxiliares: { relatando: 0, estudos: 0 },
            pioneirosRegulares: { relatando: 0, estudos: 0 },
            pioneirosEspeciais: { relatando: 0, estudos: 0 },
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
          reunioes: {
            meioSemana: 0,
            fimSemana: 0,
          },
          donativos: {
            congregacao: 0,
            obraMundial: 0,
          }
        };

        congregations.forEach(cong => {
          if (!cong || !cong.congregacao) return;
          
          totals.pubAtivos += parseInt(cong.pubAtivos) || 0;
          
          if (cong.ministério) {
            Object.keys(cong.ministério).forEach(key => {
              const k = key as keyof AnalysisData['ministério'];
              if (cong.ministério[k]) {
                totals.ministério[k].relatando += parseInt(cong.ministério[k].relatando) || 0;
                totals.ministério[k].estudos += parseInt(cong.ministério[k].estudos) || 0;
              }
            });
          }

          if (cong.estatisticas) {
            Object.keys(cong.estatisticas).forEach(key => {
              const k = key as keyof AnalysisData['estatisticas'];
              totals.estatisticas[k] += (cong.estatisticas[k] as number) || 0;
            });
          }

          if (cong.reunioes) {
            totals.reunioes.meioSemana += calculateAverage(cong.reunioes.meioSemana || []);
            totals.reunioes.fimSemana += calculateAverage(cong.reunioes.fimSemana || []);
          }

          if (cong.donativos) {
            totals.donativos.congregacao += calculateTotalDonativos(cong.donativos.congregacao || []);
            totals.donativos.obraMundial += calculateTotalDonativos(cong.donativos.obraMundial || []);
          }
        });

        setStats(totals);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'activity_analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  const parseDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return new Date(0);
    return new Date(year, month - 1, day);
  };

  const calculateAverage = (list: string[]) => {
    if (!list || !Array.isArray(list)) return 0;
    const validValues = list.map(v => parseInt(v)).filter(v => !isNaN(v));
    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, curr) => acc + curr, 0);
    return sum / validValues.length;
  };

  const calculateTotalDonativos = (list: string[]) => {
    if (!list || !Array.isArray(list)) return 0;
    return list.reduce((acc, curr) => acc + (parseFloat(String(curr).replace(',', '.')) || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-[#512da8]" size={48} />
        <p className="text-gray-500 font-medium">Calculando estatísticas do circuito...</p>
      </div>
    );
  }

  if (!stats || congCount === 0) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-md border-l-8 border-[#512da8]">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack} 
              className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
              title="Voltar ao Painel"
            >
              <ChevronLeft size={28} strokeWidth={3} />
            </button>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Estatísticas do Circuito</h2>
          </div>
        </div>
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
          <BarChart3 className="mx-auto text-gray-300" size={64} />
          <p className="text-gray-500 font-medium">Nenhuma análise de atividade encontrada para as congregações.</p>
          <button onClick={onBack} className="px-6 py-2 bg-[#512da8] text-white rounded-xl font-bold hover:bg-[#4527a0] transition-all">
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  const crescimento = stats.estatisticas.novosPublicadores + stats.estatisticas.reativados + stats.estatisticas.readmitidos;
  const decrescimo = stats.estatisticas.inativos + stats.estatisticas.removidos;
  const percCrescimento = stats.pubAtivos > 0 ? ((crescimento / stats.pubAtivos) * 100).toFixed(1) : '0.0';
  const percDecrescimo = stats.pubAtivos > 0 ? ((decrescimo / stats.pubAtivos) * 100).toFixed(1) : '0.0';

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSavePDF = async () => {
    const element = document.getElementById('circuit-stats-form');
    if (!element) return;

    const circuitName = personalData?.circuito || 'NOVO';
    const opt = {
      margin: 0,
      filename: `Circuito ${circuitName} - Estatísticas.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

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

      const filename = `Circuito ${circuitName} - Estatísticas.pdf`;

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
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none print:shadow-none print:bg-white">
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
          #circuit-stats-form {
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
        .pdf-capture .bg-\[\#e9ecef\] {
          background-color: #e9ecef !important;
        }
        .pdf-capture .bg-\[\#f2f2f2\] {
          background-color: #f2f2f2 !important;
        }
        .pdf-capture .bg-\[\#fdf5e6\] {
          background-color: #fdf5e6 !important;
        }
        .pdf-capture .bg-\[\#a9d08e\] {
          background-color: #a9d08e !important;
        }
        .pdf-capture .bg-\[\#f4b084\] {
          background-color: #f4b084 !important;
        }
        .pdf-capture .text-\[\#002060\] {
          color: #002060 !important;
        }
        .pdf-capture .text-white {
          color: #ffffff !important;
        }
        .pdf-capture h1, .pdf-capture h2, .pdf-capture h3 {
          color: #000000 !important;
        }
        .pdf-capture .bg-white {
          background-color: #ffffff !important;
        }
        .pdf-capture .bg-gray-50 {
          background-color: #f9fafb !important;
        }
        .pdf-capture .bg-gray-100 {
          background-color: #f3f4f6 !important;
        }
      `}</style>
      {/* Header - Hidden in Print */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl shadow-md border-l-8 border-[#512da8] print:hidden gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
            title="Voltar ao Painel"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Estatísticas do Circuito</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={handleSavePDF} 
            className="flex-1 sm:flex-none py-2.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 font-bold text-sm shadow-sm"
          >
            <FileDown size={18} className="text-[#512da8]" /> 
            <span>Salvar PDF</span>
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

      {/* A4 Document Container */}
      <div className="overflow-x-auto pb-4">
        <div id="circuit-stats-form" className="min-w-[800px] space-y-6 bg-white p-[8mm] shadow-2xl border border-gray-200 print:shadow-none print:border-none print:p-0 print:space-y-4 font-sans text-gray-900 overflow-hidden leading-tight print:min-w-0">
        
        {/* Document Title - Visible only in PDF/Print */}
        <div className="hidden print:block text-center pt-2 pb-4">
          <h1 className="text-4xl font-bold tracking-tight text-[#512da8]">Estatísticas do Circuito</h1>
        </div>

        {/* Summary Line */}
        <div className="flex items-center justify-center gap-2 text-[24px] font-normal py-4">
          <span className="italic">Total de publicadores ativos do circuito em</span>
          <span className="bg-[#e9ecef] px-3 py-1 rounded font-bold text-gray-900 border border-gray-300">
            {congCount}
          </span>
          <span className="italic">congregações:</span>
          <span className="bg-[#e9ecef] px-4 py-1 rounded font-bold text-[32px] text-[#002060] border border-gray-300 ml-2 min-w-[80px] text-center">
            {stats.pubAtivos}
          </span>
        </div>

        {/* Section 1: Ministry Averages */}
        <div className="space-y-0">
          <div className="grid grid-cols-[1fr_120px_120px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[22px]">MÉDIAS DO CIRCUITO NO MINISTÉRIO</h3>
            <span className="text-[14px] font-normal text-gray-500 uppercase text-center">Média mensal</span>
            <span className="text-[14px] font-normal text-gray-500 uppercase text-center">Média mensal</span>
          </div>
          <div className="divide-y divide-gray-200">
            {[
              { id: 'publicadores', label: 'PUBLICADORES' },
              { id: 'pioneirosAuxiliares', label: 'PIONEIROS AUXILIARES' },
              { id: 'pioneirosRegulares', label: 'PIONEIROS REGULARES' },
              { id: 'pioneirosEspeciais', label: 'PIONEIROS ESPECIAIS' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1 bg-white">
                <span className="font-bold text-gray-800 text-[20px] uppercase pl-1">{item.label}</span>
                <div className="text-center font-normal text-[28px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{Math.round(stats.ministério[item.id].relatando)}</div>
                <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{Math.round(stats.ministério[item.id].estudos)}</div>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_120px_120px] items-center py-1.5 bg-[#fdf5e6]">
              <span className="font-normal text-gray-800 text-[20px] uppercase pl-1">Média mensal de <span className="font-bold">ESTUDOS BÍBLICOS:</span></span>
              <div className="text-center font-bold text-[28px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{Math.round(stats.estatisticas.mediaEstudos)}</div>
              <div className="text-center font-bold text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">
                {stats.pubAtivos > 0 ? (stats.estatisticas.mediaEstudos / stats.pubAtivos).toFixed(1).replace('.', ',') : '0,0'} / Pub
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Spiritual Situation */}
        <div className="space-y-0 pt-2">
          <div className="grid grid-cols-[1fr_120px_120px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[22px]">SITUAÇÃO ESPIRITUAL DOS PUBLICADORES</h3>
            <span className="text-[14px] font-normal text-gray-500 uppercase text-center">Média / 6 meses</span>
            <span className="text-[14px] font-normal text-gray-500 uppercase text-center">Porcentagem</span>
          </div>
          <div className="divide-y divide-gray-200">
            {[
              { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos' },
              { id: 'irregulares', label: 'Número de PUBLICADORES IRREGULARES desde a última visita:' },
              { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES desde a última visita:' },
              { id: 'reativados', label: 'Quantos foram REATIVADOS desde a última visita:' },
              { id: 'readmitidos', label: 'Quantos foram READMITIDOS desde a última visita:' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1 bg-white">
                <span className="text-[20px] text-gray-800 pl-1">
                  {item.label.includes(':') ? 
                    <><span className="font-normal">{item.label.split(':')[0]}</span><span className="font-bold">:{item.label.split(':')[1]}</span></> : 
                    <><span className="font-normal">{item.label.split('DIRIGEM')[0]}</span><span className="font-bold">DIRIGEM</span><span className="font-normal">{item.label.split('DIRIGEM')[1]}</span></>
                  }
                </span>
                <div className="text-center font-normal text-[28px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{stats.estatisticas[item.id]}</div>
                <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%</div>
              </div>
            ))}
            
            {/* Growth Bar */}
            <div className="grid grid-cols-[1fr_120px_120px] items-center py-1 bg-[#a9d08e] border-y border-white">
              <span className="font-bold text-white text-[20px] uppercase tracking-wider text-right pr-4">Crescimento de publicadores:</span>
              <div className="text-center font-bold text-[28px] text-white">{crescimento}</div>
              <div className="text-center font-bold text-[28px] text-white">{percCrescimento.replace('.', ',')}%</div>
            </div>

            {[
              { id: 'inativos', label: 'Quantos ficaram INATIVOS desde a última visita:' },
              { id: 'removidos', label: 'Quantos foram DESASSOCIADOS desde a última visita:' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1 bg-white">
                <span className="text-[20px] text-gray-800 pl-1"><span className="font-normal">{item.label.split(':')[0]}</span><span className="font-bold">:{item.label.split(':')[1]}</span></span>
                <div className="text-center font-normal text-[28px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{stats.estatisticas[item.id]}</div>
                <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%</div>
              </div>
            ))}

            {/* Decrease Bar */}
            <div className="grid grid-cols-[1fr_120px_120px] items-center py-1 bg-[#f4b084] border-y border-white">
              <span className="font-bold text-white text-[20px] uppercase tracking-wider text-right pr-4">Decréscimo de Publicadores:</span>
              <div className="text-center font-bold text-[28px] text-white">{decrescimo}</div>
              <div className="text-center font-bold text-[28px] text-white">{percDecrescimo.replace('.', ',')}%</div>
            </div>

            {[
              { id: 'batizados', label: 'Quantos foram BATIZADOS desde a última visita:' },
              { id: 'anciaos', label: 'Número de ANCIÃOS:' },
              { id: 'servos', label: 'Números de SERVOS MINISTERIAIS:' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1 bg-white">
                <span className="text-[20px] text-gray-800 pl-1"><span className="font-normal">{item.label.split(':')[0]}</span><span className="font-bold">:{item.label.split(':')[1]}</span></span>
                <div className="text-center font-normal text-[28px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{stats.estatisticas[item.id]}</div>
                <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Meeting Attendance */}
        <div className="space-y-0 pt-2">
          <div className="grid grid-cols-[1fr_240px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[22px]">REUNIÕES CONGREGACIONAIS</h3>
            <span className="text-[14px] font-normal text-gray-500 uppercase text-center">Assistência mensal</span>
          </div>
          <div className="divide-y divide-gray-200">
            <div className="grid grid-cols-[1fr_240px] items-center py-1 bg-white">
              <span className="text-[20px] font-normal text-gray-800 uppercase pl-1">Reunião de <span className="font-bold">MEIO DE SEMANA</span></span>
              <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{Math.round(stats.reunioes.meioSemana)}</div>
            </div>
            <div className="grid grid-cols-[1fr_240px] items-center py-1 bg-white">
              <span className="text-[20px] font-normal text-gray-800 uppercase pl-1">Reunião de <span className="font-bold">FIM DE SEMANA</span></span>
              <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{Math.round(stats.reunioes.fimSemana)}</div>
            </div>
            <div className="grid grid-cols-[1fr_120px_120px] items-center py-1.5 bg-[#fdf5e6]">
              <span className="font-normal text-gray-800 text-[20px] uppercase pl-1">Média dos que assistem a reunião e <span className="font-bold">NÃO SÃO</span> Publicadores:</span>
              <div className="text-center font-normal text-[28px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">
                {Math.max(0, Math.round(stats.reunioes.fimSemana) - stats.pubAtivos).toFixed(1).replace('.', ',')}
              </div>
              <div className="text-center font-bold text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">
                {stats.pubAtivos > 0 ? (Math.max(0, Math.round(stats.reunioes.fimSemana) - stats.pubAtivos) / stats.pubAtivos * 100).toFixed(1).replace('.', ',') : '0,0'}%
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Donations */}
        <div className="space-y-0 pt-2">
          <div className="grid grid-cols-[1fr_240px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[22px]">DONATIVOS DO CIRCUITO</h3>
            <span className="text-[14px] font-normal text-gray-500 uppercase text-center">Média / 6 meses</span>
          </div>
          <div className="divide-y divide-gray-200">
            <div className="grid grid-cols-[1fr_240px] items-center py-1 bg-white">
              <span className="text-[20px] font-normal text-gray-800 uppercase pl-1">Donativos para a <span className="font-bold">OBRA MUNDIAL</span></span>
              <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{formatCurrency(stats.donativos.obraMundial)}</div>
            </div>
            <div className="grid grid-cols-[1fr_240px] items-center py-1 bg-white">
              <span className="text-[20px] font-normal text-gray-800 uppercase pl-1">Donativos para a <span className="font-bold">CONGREGAÇÃO</span></span>
              <div className="text-center font-normal text-[28px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{formatCurrency(stats.donativos.congregacao)}</div>
            </div>
          </div>
        </div>

        {/* Footer Info - Hidden in Print or very small */}
        <div className="pt-2 flex justify-between items-end border-t border-gray-100 text-[10px] text-gray-300 font-medium print:pt-1">
          <div>Relatório gerado em: {new Date().toLocaleDateString('pt-BR')}</div>
          <div className="uppercase tracking-widest">ProgCir Web</div>
        </div>
      </div>
    </div>
  </div>
);
}
