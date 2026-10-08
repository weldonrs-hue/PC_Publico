'use client';

import { useDialog } from '@/hooks/useDialog';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  ChevronLeft,
  FileDown,
  FileText,
  LayoutDashboard,
  Loader2,
  PieChart as PieChartIcon,
  Printer,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

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
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [congCount, setCongCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'folha'>('dashboard');
  const [showCharts, setShowCharts] = useState(true);
  const [showComposition, setShowComposition] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);

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
            differenceSum: 0, // Sum of differences for congregations with attendance data
            pubsWithAttendanceSum: 0, // Sum of publishers for congregations with attendance data
          },
          donativos: {
            congregacao: 0,
            obraMundial: 0,
          }
        };

        congregations.forEach(cong => {
          if (!cong || !cong.congregacao) return;
          
          const congPubs = parseInt(cong.pubAtivos) || 0;
          totals.pubAtivos += congPubs;
          
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
            const avgMeio = calculateAverage(cong.reunioes.meioSemana || []);
            const avgFim = calculateAverage(cong.reunioes.fimSemana || []);
            
            totals.reunioes.meioSemana += avgMeio;
            totals.reunioes.fimSemana += avgFim;

            // Only aggregate for difference if there is attendance data
            if (avgFim > 0) {
              totals.reunioes.differenceSum += (avgFim - congPubs);
              totals.reunioes.pubsWithAttendanceSum += congPubs;
            }
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
        <div className="w-8 h-8 border-4 border-primary-200 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-typography-600">Calculando estatísticas do circuito...</p>
      </div>
    );
  }

  if (!stats || congCount === 0) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between bg-surface-100 border border-surface-300 p-4 sm:p-5 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="p-2 sm:p-2.5 rounded-xl border border-surface-300 hover:bg-surface-200 text-typography-700 hover:text-typography-900 transition-colors shadow-2xs cursor-pointer group"
              title="Voltar ao Painel"
            >
              <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">Estatísticas do Circuito</h2>
          </div>
        </div>
        <div className="bg-surface-100 border border-surface-300 p-12 rounded-3xl shadow-sm text-center space-y-4">
          <BarChart3 className="mx-auto text-typography-400" size={56} />
          <p className="text-sm text-typography-600 font-medium">Nenhuma análise de atividade encontrada para as congregações.</p>
          <button onClick={onBack} className="px-6 py-2.5 bg-primary-200 hover:bg-primary-300 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer">
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  const circuitDifferenceVal = Math.round(stats.reunioes.differenceSum);
  const circuitPercentageRaw = stats.reunioes.pubsWithAttendanceSum > 0 ? (circuitDifferenceVal / stats.reunioes.pubsWithAttendanceSum) * 100 : 0;
  const circuitPercentageFormatted = circuitPercentageRaw.toFixed(1).replace('.', ',');
  const circuitSign = circuitDifferenceVal >= 0 ? '+' : '';

  const crescimento = stats.estatisticas.novosPublicadores + stats.estatisticas.reativados + stats.estatisticas.readmitidos;
  const decrescimo = stats.estatisticas.inativos + stats.estatisticas.removidos;
  const percCrescimento = stats.pubAtivos > 0 ? ((crescimento / stats.pubAtivos) * 100).toFixed(1) : '0.0';
  const percDecrescimo = stats.pubAtivos > 0 ? ((decrescimo / stats.pubAtivos) * 100).toFixed(1) : '0.0';

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSavePDF = async () => {
    const element = document.getElementById('circuit-stats-form');
    if (!element) return;

    setGenerating(true);

    const circuitName = personalData?.circuito || 'NOVO';

    try {
      // Import libraries
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // Add a class to ensure print-specific styles are applied if needed
      element.classList.add('pdf-capture');
      
      // Convert element to PNG image
      // html-to-image is much better at handling modern CSS like oklch
      const dataUrl = await toPng(element, {
        quality: 0.85,
        pixelRatio: 1.5, // Sufficient resolution
        backgroundColor: '#ffffff',
        cacheBust: true,
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
        format: [pdfWidth, pdfHeight],
        compress: true
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
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

        /* Support for PDF capture styles */
        .pdf-capture {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
        .pdf-capture * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `}</style>
      {/* Header - Hidden in Print */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-surface-100 border border-surface-300 p-4 sm:p-5 rounded-3xl shadow-sm print:hidden gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 sm:p-2.5 rounded-xl border border-surface-300 hover:bg-surface-200 text-typography-700 hover:text-typography-900 transition-colors shadow-2xs cursor-pointer group"
            title="Voltar ao Painel"
          >
            <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">Estatísticas do Circuito</h2>
            <p className="text-xs text-typography-500 font-medium">Consolidado de {congCount} congregações</p>
          </div>
        </div>

        {/* Seletor de Modo e Ações */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Seletor de Visão */}
          <div className="flex bg-surface-200 p-1 rounded-2xl border border-surface-300">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'dashboard'
                  ? 'bg-surface-100 text-primary-200 shadow-2xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
            >
              <LayoutDashboard size={14} />
              Painel Geral
            </button>
            <button
              type="button"
              onClick={() => setViewMode('folha')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'folha'
                  ? 'bg-surface-100 text-primary-200 shadow-2xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
            >
              <FileText size={14} />
              Folha Oficial (A4)
            </button>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSavePDF} 
              disabled={generating}
              className="flex-1 sm:flex-initial py-2 px-3.5 bg-primary-200 hover:bg-primary-300 text-white rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {generating ? (
                <Loader2 size={15} className="animate-spin text-white" />
              ) : (
                <FileDown size={15} className="text-white" />
              )}
              <span>{generating ? 'Gerando...' : 'PDF'}</span>
            </button>
            <button 
              onClick={() => window.print()} 
              className="flex-1 sm:flex-initial py-2 px-3.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold text-xs cursor-pointer whitespace-nowrap"
            >
              <Printer size={15} /> 
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODO 1: DASHBOARD INTERATIVO MODERNO E 100% RESPONSIVO */}
      {viewMode === 'dashboard' && (
        <div className="space-y-6 print:hidden">
          {/* CARDS PRINCIPAIS DE DESTAQUE (KPIs) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Publicadores Ativos */}
            <div className="p-4 sm:p-5 bg-surface-100 border border-surface-300 rounded-3xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Publicadores Ativos
                </span>
                <div className="w-8 h-8 rounded-xl bg-primary-200/10 text-primary-200 flex items-center justify-center">
                  <Users size={16} />
                </div>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-typography-900 tracking-tight">
                  {stats.pubAtivos}
                </span>
                <p className="text-xs text-typography-500 mt-0.5">
                  Em {congCount} congregações
                </p>
              </div>
            </div>

            {/* KPI 2: Média de Estudos */}
            <div className="p-4 sm:p-5 bg-surface-100 border border-surface-300 rounded-3xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Estudos Bíblicos
                </span>
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-typography-900 tracking-tight">
                  {Math.round(stats.estatisticas.mediaEstudos)}
                </span>
                <p className="text-xs text-typography-500 mt-0.5">
                  {stats.pubAtivos > 0 ? (stats.estatisticas.mediaEstudos / stats.pubAtivos).toFixed(1).replace('.', ',') : '0,0'} / publicador
                </p>
              </div>
            </div>

            {/* KPI 3: Assistência Média */}
            <div className="p-4 sm:p-5 bg-surface-100 border border-surface-300 rounded-3xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Assistência Fim de Semana
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Activity size={16} />
                </div>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-typography-900 tracking-tight">
                  {Math.round(stats.reunioes.fimSemana)}
                </span>
                <p className="text-xs text-typography-500 mt-0.5">
                  Meio de sem: {Math.round(stats.reunioes.meioSemana)}
                </p>
              </div>
            </div>

            {/* KPI 4: Saldo Espiritual */}
            <div className="p-4 sm:p-5 bg-surface-100 border border-surface-300 rounded-3xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Balanço Espiritual
                </span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    +{crescimento}
                  </span>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
                    -{decrescimo}
                  </span>
                </div>
                <p className="text-xs text-typography-500 mt-1">
                  Saldo Líquido: <strong className="text-typography-800">{crescimento - decrescimo >= 0 ? `+${crescimento - decrescimo}` : `${crescimento - decrescimo}`}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* GRÁFICOS DINÂMICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico 1: Composição do Circuito */}
            <div className="bg-surface-100 p-5 rounded-3xl shadow-2xs border border-surface-300 flex flex-col h-[340px]">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-primary-200/10 text-primary-200 rounded-xl">
                  <PieChartIcon size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-typography-900">
                    Composição dos Publicadores
                  </h3>
                  <p className="text-[11px] text-typography-500">Distribuição no ministério</p>
                </div>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Publicadores', value: Math.round(stats.ministério.publicadores.relatando) },
                        { name: 'Pio. Regulares', value: Math.round(stats.ministério.pioneirosRegulares.relatando) },
                        { name: 'Pio. Especiais', value: Math.round(stats.ministério.pioneirosEspeciais.relatando) },
                        { name: 'Pio. Auxiliares', value: Math.round(stats.ministério.pioneirosAuxiliares.relatando) },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981'].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--color-surface-100)', 
                        borderColor: 'var(--color-surface-300)', 
                        color: 'var(--color-typography-900)', 
                        borderRadius: '14px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)' 
                      }}
                    />
                    <Legend verticalAlign="bottom" height={32}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Assistência às Reuniões */}
            <div className="bg-surface-100 p-5 rounded-3xl shadow-2xs border border-surface-300 flex flex-col h-[340px]">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-typography-900">
                    Assistência às Reuniões
                  </h3>
                  <p className="text-[11px] text-typography-500">Média presencial e virtual</p>
                </div>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Meio de Semana', valor: Math.round(stats.reunioes.meioSemana) },
                      { name: 'Fim de Semana', valor: Math.round(stats.reunioes.fimSemana) },
                      { name: 'Não Publicadores', valor: Math.max(0, circuitDifferenceVal) },
                    ]}
                    margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-300)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-typography-600)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-typography-600)' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'var(--color-surface-100)', borderColor: 'var(--color-surface-300)', color: 'var(--color-typography-900)', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                    <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                      <Cell fill="#8B5CF6" />
                      <Cell fill="#3B82F6" />
                      <Cell fill="#10B981" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* SEÇÃO 1: MÉDIAS DO CIRCUITO NO MINISTÉRIO */}
          <div className="bg-surface-100 border border-surface-300 rounded-3xl p-5 md:p-6 shadow-2xs space-y-4">
            <div className="border-b border-surface-300 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-typography-900">
                  Médias do Circuito no Ministério
                </h3>
                <p className="text-xs text-typography-500">Atividade mensal dividida por categoria</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2.5 py-1 rounded-full border border-primary-200/20">
                Ministério
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'publicadores', label: 'Publicadores', color: 'border-blue-500/20 bg-blue-500/5' },
                { id: 'pioneirosAuxiliares', label: 'Pioneiros Auxiliares', color: 'border-emerald-500/20 bg-emerald-500/5' },
                { id: 'pioneirosRegulares', label: 'Pioneiros Regulares', color: 'border-purple-500/20 bg-purple-500/5' },
                { id: 'pioneirosEspeciais', label: 'Pioneiros Especiais', color: 'border-amber-500/20 bg-amber-500/5' },
              ].map(cat => (
                <div key={cat.id} className={`p-4 rounded-2xl border ${cat.color} space-y-3`}>
                  <h4 className="text-xs font-bold uppercase text-typography-800">{cat.label}</h4>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-surface-300/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-typography-400">Relatando</span>
                      <p className="text-lg font-black text-typography-900 mt-0.5">
                        {Math.round(stats.ministério[cat.id]?.relatando || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-typography-400">Estudos</span>
                      <p className="text-lg font-black text-typography-900 mt-0.5">
                        {Math.round(stats.ministério[cat.id]?.estudos || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-surface-200/60 rounded-2xl border border-surface-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-typography-800">
                Média mensal de Estudos Bíblicos do Circuito:
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-typography-900">
                  {Math.round(stats.estatisticas.mediaEstudos)} estudos
                </span>
                <span className="text-xs font-bold text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20">
                  {stats.pubAtivos > 0 ? (stats.estatisticas.mediaEstudos / stats.pubAtivos).toFixed(1).replace('.', ',') : '0,0'} / Publicador
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: SITUAÇÃO ESPIRITUAL DOS PUBLICADORES */}
          <div className="bg-surface-100 border border-surface-300 rounded-3xl p-5 md:p-6 shadow-2xs space-y-4">
            <div className="border-b border-surface-300 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-typography-900">
                  Situação Espiritual dos Publicadores
                </h3>
                <p className="text-xs text-typography-500">Movimentação nos últimos 6 meses</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                Espiritualidade
              </span>
            </div>

            {/* Destaques de Crescimento e Decréscimo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Crescimento de Publicadores
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
                      +{crescimento}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      (+{percCrescimento.replace('.', ',')}%)
                    </span>
                  </div>
                </div>
                <UserPlus size={28} className="text-emerald-500/80" />
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    Decréscimo de Publicadores
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-rose-800 dark:text-rose-300">
                      -{decrescimo}
                    </span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      (-{percDecrescimo.replace('.', ',')}%)
                    </span>
                  </div>
                </div>
                <UserX size={28} className="text-rose-500/80" />
              </div>
            </div>

            {/* Grid de Itens Detalhados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {[
                { label: 'Dirigem Estudos', val: stats.estatisticas.dirigemEstudos, icon: UserCheck, color: 'text-blue-500' },
                { label: 'Novos Publicadores', val: stats.estatisticas.novosPublicadores, icon: Sparkles, color: 'text-emerald-500' },
                { label: 'Reativados', val: stats.estatisticas.reativados, icon: TrendingUp, color: 'text-teal-500' },
                { label: 'Readmitidos', val: stats.estatisticas.readmitidos, icon: UserCheck, color: 'text-cyan-500' },
                { label: 'Batizados', val: stats.estatisticas.batizados, icon: Award, color: 'text-sky-500' },
                { label: 'Irregulares', val: stats.estatisticas.irregulares, icon: AlertTriangle, color: 'text-amber-500', isAlert: true },
                { label: 'Inativos', val: stats.estatisticas.inativos, icon: UserX, color: 'text-rose-500', isAlert: true },
                { label: 'Desassociados / Remov.', val: stats.estatisticas.removidos, icon: UserX, color: 'text-red-500', isAlert: true },
                { label: 'Anciãos', val: stats.estatisticas.anciaos, icon: Users, color: 'text-indigo-500' },
                { label: 'Servos Ministeriais', val: stats.estatisticas.servos, icon: Users, color: 'text-violet-500' },
              ].map(item => {
                const Icon = item.icon;
                const percent = stats.pubAtivos > 0 ? ((item.val / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0';
                return (
                  <div key={item.label} className="p-3 bg-surface-200/50 border border-surface-300 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className={item.color} />
                      <span className="text-[11px] font-bold text-typography-700 truncate">{item.label}</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className={`text-lg font-black ${item.isAlert ? 'text-rose-600 dark:text-rose-400' : 'text-typography-900'}`}>
                        {item.val}
                      </span>
                      <span className="text-[10px] font-bold text-typography-400">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO 3: REUNIÕES & DONATIVOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reuniões Congregacionais */}
            <div className="bg-surface-100 border border-surface-300 rounded-3xl p-5 shadow-2xs space-y-3">
              <div className="border-b border-surface-300 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-typography-900">
                  Reuniões Congregacionais
                </h3>
                <p className="text-[11px] text-typography-500">Médias de assistência</p>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-surface-200/50 rounded-xl flex items-center justify-between border border-surface-300">
                  <span className="text-xs font-bold text-typography-700">Meio de Semana</span>
                  <span className="text-base font-black text-typography-900">
                    {Math.round(stats.reunioes.meioSemana)}
                  </span>
                </div>
                <div className="p-3 bg-surface-200/50 rounded-xl flex items-center justify-between border border-surface-300">
                  <span className="text-xs font-bold text-typography-700">Fim de Semana</span>
                  <span className="text-base font-black text-typography-900">
                    {Math.round(stats.reunioes.fimSemana)}
                  </span>
                </div>
                <div className="p-3 bg-primary-200/5 rounded-xl flex items-center justify-between border border-primary-200/20">
                  <span className="text-xs font-bold text-primary-200">Não Publicadores Presentes</span>
                  <span className="text-sm font-black text-primary-200">
                    {circuitSign}{circuitDifferenceVal} ({circuitSign}{circuitPercentageFormatted}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Donativos do Circuito */}
            <div className="bg-surface-100 border border-surface-300 rounded-3xl p-5 shadow-2xs space-y-3">
              <div className="border-b border-surface-300 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-typography-900">
                  Donativos do Circuito
                </h3>
                <p className="text-[11px] text-typography-500">Média dos últimos 6 meses</p>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-surface-200/50 rounded-xl flex items-center justify-between border border-surface-300">
                  <span className="text-xs font-bold text-typography-700">Obra Mundial</span>
                  <span className="text-sm font-black text-typography-900">
                    {formatCurrency(stats.donativos.obraMundial)}
                  </span>
                </div>
                <div className="p-3 bg-surface-200/50 rounded-xl flex items-center justify-between border border-surface-300">
                  <span className="text-xs font-bold text-typography-700">Congregação</span>
                  <span className="text-sm font-black text-typography-900">
                    {formatCurrency(stats.donativos.congregacao)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2 OU EXPORTAÇÃO: FOLHA OFICIAL A4 */}
      <div className={viewMode === 'dashboard' ? 'fixed -left-[9999px] top-0 pointer-events-none print:static print:pointer-events-auto print:block' : 'space-y-4'}>
        {viewMode === 'folha' && (
          <div className="p-3.5 bg-primary-200/5 border border-primary-200/20 rounded-2xl flex items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary-200 shrink-0" />
              <p className="text-xs text-typography-700">
                Esta é a visualização exata do formulário impresso em papel A4 e do arquivo PDF.
              </p>
            </div>
            <button
              onClick={() => setViewMode('dashboard')}
              className="text-xs font-bold text-primary-200 hover:underline shrink-0 cursor-pointer"
            >
              Voltar ao Painel Geral
            </button>
          </div>
        )}

        <div className="overflow-x-auto pb-6">
          <div id="circuit-stats-form" className="min-w-[800px] max-w-[850px] bg-white p-[8mm] shadow-xl rounded-3xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:rounded-none font-sans text-slate-900 overflow-hidden mx-auto flex flex-col justify-between space-y-4">
          
            {/* Cabeçalho Executivo do A4 */}
            <div className="border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
                    Circuito {personalData?.circuito || 'Circuito'}
                  </span>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
                    Estatísticas do Circuito
                  </h1>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Emissão</span>
                  <p className="text-xs font-bold text-slate-700">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Faixa de Resumo de Publicadores Ativos */}
              <div className="mt-3 bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                    Total de Publicadores Ativos do Circuito
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                    {congCount} congregações
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-950 px-3 py-0.5 bg-white border border-slate-200 rounded-xl min-w-[70px] text-center shadow-2xs">
                  {stats.pubAtivos}
                </div>
              </div>
            </div>

            {/* Seção 1: Médias do Ministério */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_120px_120px] items-center border-b-2 border-slate-900 pb-1">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">
                  MÉDIAS DO CIRCUITO NO MINISTÉRIO
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Relatando</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Estudos</span>
              </div>
              
              <div className="divide-y divide-slate-100">
                {[
                  { id: 'publicadores', label: 'PUBLICADORES' },
                  { id: 'pioneirosAuxiliares', label: 'PIONEIROS AUXILIARES' },
                  { id: 'pioneirosRegulares', label: 'PIONEIROS REGULARES' },
                  { id: 'pioneirosEspeciais', label: 'PIONEIROS ESPECIAIS' }
                ].map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1">
                    <span className="font-bold text-slate-800 text-xs uppercase pl-1">{item.label}</span>
                    <div className="text-center font-extrabold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {Math.round(stats.ministério[item.id].relatando)}
                    </div>
                    <div className="text-center font-extrabold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {Math.round(stats.ministério[item.id].estudos)}
                    </div>
                  </div>
                ))}

                {/* Destaque: Média Mensal de Estudos Bíblicos */}
                <div className="grid grid-cols-[1fr_120px_120px] items-center py-1.5 px-1 bg-amber-50/70 border border-amber-200/70 rounded-xl mt-1">
                  <span className="font-bold text-amber-950 text-xs uppercase pl-1">
                    Média mensal de <strong className="font-black">ESTUDOS BÍBLICOS:</strong>
                  </span>
                  <div className="text-center font-black text-xs text-amber-950 bg-white py-1 mx-1 rounded-lg border border-amber-200/90">
                    {Math.round(stats.estatisticas.mediaEstudos)}
                  </div>
                  <div className="text-center font-black text-xs text-amber-950 bg-white py-1 mx-1 rounded-lg border border-amber-200/90">
                    {stats.pubAtivos > 0 ? (stats.estatisticas.mediaEstudos / stats.pubAtivos).toFixed(1).replace('.', ',') : '0,0'} / Pub
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Situação Espiritual dos Publicadores */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_120px_120px] items-center border-b-2 border-slate-900 pb-1">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">
                  SITUAÇÃO ESPIRITUAL DOS PUBLICADORES
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Média / 6m</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Porcentagem</span>
              </div>

              <div className="divide-y divide-slate-100">
                {[
                  { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos' },
                  { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES desde a última visita:' },
                  { id: 'reativados', label: 'Quantos foram REATIVADOS desde a última visita:' },
                  { id: 'readmitidos', label: 'Quantos foram READMITIDOS desde a última visita:' }
                ].map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1">
                    <span className="text-xs text-slate-800 pl-1">
                      {item.label.includes(':') ? 
                        <><span className="font-medium">{item.label.split(':')[0]}</span><span className="font-black">:{item.label.split(':')[1]}</span></> : 
                        <><span className="font-medium">{item.label.split('DIRIGEM')[0]}</span><span className="font-black">DIRIGEM</span><span className="font-medium">{item.label.split('DIRIGEM')[1]}</span></>
                      }
                    </span>
                    <div className="text-center font-bold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {stats.estatisticas[item.id]}
                    </div>
                    <div className="text-center font-bold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%
                    </div>
                  </div>
                ))}
                
                {/* Faixa de Crescimento */}
                <div className="grid grid-cols-[1fr_120px_120px] items-center py-1.5 px-1 bg-emerald-600 text-white rounded-xl my-1 shadow-2xs">
                  <span className="font-black text-white text-xs uppercase tracking-wider pl-1">
                    Crescimento de publicadores:
                  </span>
                  <div className="text-center font-black text-xs text-white bg-emerald-700/60 py-0.5 mx-1 rounded-md">
                    +{crescimento}
                  </div>
                  <div className="text-center font-black text-xs text-white bg-emerald-700/60 py-0.5 mx-1 rounded-md">
                    +{percCrescimento.replace('.', ',')}%
                  </div>
                </div>

                {[
                  { id: 'irregulares', label: 'Número de PUBLICADORES IRREGULARES desde a última visita:' },
                  { id: 'inativos', label: 'Quantos ficaram INATIVOS desde a última visita:' },
                  { id: 'removidos', label: 'Quantos foram DESASSOCIADOS desde a última visita:' }
                ].map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1">
                    <span className="text-xs text-slate-800 pl-1">
                      <span className="font-medium">{item.label.split(':')[0]}</span><span className="font-black">:{item.label.split(':')[1]}</span>
                    </span>
                    <div className="text-center font-bold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {stats.estatisticas[item.id]}
                    </div>
                    <div className="text-center font-bold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%
                    </div>
                  </div>
                ))}

                {/* Faixa de Decréscimo */}
                <div className="grid grid-cols-[1fr_120px_120px] items-center py-1.5 px-1 bg-rose-600 text-white rounded-xl my-1 shadow-2xs">
                  <span className="font-black text-white text-xs uppercase tracking-wider pl-1">
                    Decréscimo de publicadores:
                  </span>
                  <div className="text-center font-black text-xs text-white bg-rose-700/60 py-0.5 mx-1 rounded-md">
                    -{decrescimo}
                  </div>
                  <div className="text-center font-black text-xs text-white bg-rose-700/60 py-0.5 mx-1 rounded-md">
                    -{percDecrescimo.replace('.', ',')}%
                  </div>
                </div>

                {[
                  { id: 'batizados', label: 'Quantos foram BATIZADOS desde a última visita:' },
                  { id: 'anciaos', label: 'Número de ANCIÃOS:' },
                  { id: 'servos', label: 'Números de SERVOS MINISTERIAIS:' }
                ].map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_120px_120px] items-center py-1">
                    <span className="text-xs text-slate-800 pl-1">
                      <span className="font-medium">{item.label.split(':')[0]}</span><span className="font-black">:{item.label.split(':')[1]}</span>
                    </span>
                    <div className="text-center font-bold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {stats.estatisticas[item.id]}
                    </div>
                    <div className="text-center font-bold text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                      {stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção 3: Reuniões Congregacionais */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_240px] items-center border-b-2 border-slate-900 pb-1">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">
                  REUNIÕES CONGREGACIONAIS
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Assistência mensal</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-[1fr_240px] items-center py-1">
                  <span className="text-xs text-slate-800 pl-1 uppercase font-medium">Reunião de <strong className="font-black">MEIO DE SEMANA</strong></span>
                  <div className="text-center font-black text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                    {Math.round(stats.reunioes.meioSemana)}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_240px] items-center py-1">
                  <span className="text-xs text-slate-800 pl-1 uppercase font-medium">Reunião de <strong className="font-black">FIM DE SEMANA</strong></span>
                  <div className="text-center font-black text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                    {Math.round(stats.reunioes.fimSemana)}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_240px] items-center py-1.5 px-1 bg-indigo-50/70 border border-indigo-200/70 rounded-xl mt-1">
                  <span className="font-bold text-indigo-950 text-xs pl-1">
                    Média dos que assistem à reunião e <strong className="font-black">NÃO SÃO</strong> Publicadores:
                  </span>
                  <div className="text-center font-black text-xs text-indigo-950 bg-white py-1 mx-1 rounded-lg border border-indigo-200/90">
                    {circuitSign}{circuitDifferenceVal} ({circuitSign}{circuitPercentageFormatted}%)
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 4: Donativos do Circuito */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_240px] items-center border-b-2 border-slate-900 pb-1">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">
                  DONATIVOS DO CIRCUITO
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Média / 6 meses</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-[1fr_240px] items-center py-1">
                  <span className="text-xs text-slate-800 pl-1 uppercase font-medium">Donativos para a <strong className="font-black">OBRA MUNDIAL</strong></span>
                  <div className="text-center font-black text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                    {formatCurrency(stats.donativos.obraMundial)}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_240px] items-center py-1">
                  <span className="text-xs text-slate-800 pl-1 uppercase font-medium">Donativos para a <strong className="font-black">CONGREGAÇÃO</strong></span>
                  <div className="text-center font-black text-xs bg-slate-100/90 text-slate-900 py-1 mx-1 rounded-lg border border-slate-200/60">
                    {formatCurrency(stats.donativos.congregacao)}
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé Elegante do A4 */}
            <div className="pt-2 flex justify-between items-center border-t border-slate-200 text-[10px] text-slate-400 font-semibold print:pt-1">
              <div>Emitido via ProgCir Web</div>
              <div className="uppercase tracking-widest">Documento Oficial do Circuito</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
