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
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

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
        const q = query(collection(db, 'activity_analysis'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        const analysesByCong: { [key: string]: AnalysisData } = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as AnalysisData;
          const cong = data.congregacao;
          
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
          totals.pubAtivos += parseInt(cong.pubAtivos) || 0;
          
          Object.keys(cong.ministério).forEach(key => {
            const k = key as keyof AnalysisData['ministério'];
            totals.ministério[k].relatando += parseInt(cong.ministério[k].relatando) || 0;
            totals.ministério[k].estudos += parseInt(cong.ministério[k].estudos) || 0;
          });

          Object.keys(cong.estatisticas).forEach(key => {
            const k = key as keyof AnalysisData['estatisticas'];
            totals.estatisticas[k] += cong.estatisticas[k] || 0;
          });

          totals.reunioes.meioSemana += calculateAverage(cong.reunioes.meioSemana);
          totals.reunioes.fimSemana += calculateAverage(cong.reunioes.fimSemana);

          totals.donativos.congregacao += calculateTotalDonativos(cong.donativos.congregacao);
          totals.donativos.obraMundial += calculateTotalDonativos(cong.donativos.obraMundial);
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
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const calculateAverage = (list: string[]) => {
    const validValues = list.map(v => parseInt(v)).filter(v => !isNaN(v));
    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, curr) => acc + curr, 0);
    return sum / validValues.length;
  };

  const calculateTotalDonativos = (list: string[]) => {
    return list.reduce((acc, curr) => acc + (parseFloat(curr.replace(',', '.')) || 0), 0);
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
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-gray-50 shadow-sm">
              <ChevronLeft size={24} />
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

  return (
    <div className="space-y-6 max-w-[210mm] mx-auto pb-12 print:p-0 print:m-0 print:max-w-none">
      {/* Header - Hidden in Print */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-md border-l-8 border-[#512da8] print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-gray-50 shadow-sm">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Estatísticas do Circuito</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2 px-4 font-bold text-sm">
            <Printer size={18} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* A4 Document Container */}
      <div className="bg-white p-[8mm] shadow-2xl border border-gray-200 space-y-2 print:shadow-none print:border-none print:p-0 print:space-y-1 font-sans text-gray-900 overflow-hidden leading-tight">
        
        {/* Document Title */}
        <div className="text-center pt-2 pb-1">
          <h1 className="text-4xl font-normal tracking-tight">Estatísticas do Circuito</h1>
        </div>

        {/* Summary Line */}
        <div className="flex items-center justify-center gap-2 text-[12px] font-normal py-3">
          <span className="italic">Total de publicadores ativos do circuito em</span>
          <span className="bg-[#e9ecef] px-3 py-1 rounded font-bold text-gray-900 border border-gray-300">
            {congCount}
          </span>
          <span className="italic">congregações:</span>
          <span className="bg-[#e9ecef] px-8 py-1 rounded font-bold text-2xl text-[#002060] border border-gray-300 ml-2 min-w-[100px] text-center">
            {stats.pubAtivos}
          </span>
        </div>

        {/* Section 1: Ministry Averages */}
        <div className="space-y-0">
          <div className="grid grid-cols-[1fr_100px_100px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[12px]">MÉDIAS DO CIRCUITO NO MINISTÉRIO</h3>
            <span className="text-[9px] font-normal text-gray-500 uppercase text-center">Média mensal</span>
            <span className="text-[9px] font-normal text-gray-500 uppercase text-center">Média mensal</span>
          </div>
          <div className="divide-y divide-gray-200">
            {[
              { id: 'publicadores', label: 'PUBLICADORES' },
              { id: 'pioneirosAuxiliares', label: 'PIONEIROS AUXILIARES' },
              { id: 'pioneirosRegulares', label: 'PIONEIROS REGULARES' },
              { id: 'pioneirosEspeciais', label: 'PIONEIROS ESPECIAIS' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_100px] items-center py-0.5 bg-white">
                <span className="font-bold text-gray-800 text-[11px] uppercase pl-1">{item.label}</span>
                <div className="text-center font-normal text-[14px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{Math.round(stats.ministério[item.id].relatando)}</div>
                <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{Math.round(stats.ministério[item.id].estudos)}</div>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_100px_100px] items-center py-1 bg-[#fdf5e6]">
              <span className="font-normal text-gray-800 text-[11px] uppercase pl-1">Média mensal de <span className="font-bold">ESTUDOS BÍBLICOS:</span></span>
              <div className="text-center font-bold text-[14px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{Math.round(stats.estatisticas.mediaEstudos)}</div>
              <div className="text-center font-bold text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">
                {stats.pubAtivos > 0 ? (stats.estatisticas.mediaEstudos / stats.pubAtivos).toFixed(1).replace('.', ',') : '0,0'} / Pub
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Spiritual Situation */}
        <div className="space-y-0 pt-1">
          <div className="grid grid-cols-[1fr_100px_100px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[12px]">SITUAÇÃO ESPIRITUAL DOS PUBLICADORES</h3>
            <span className="text-[9px] font-normal text-gray-500 uppercase text-center">Média / 6 meses</span>
            <span className="text-[9px] font-normal text-gray-500 uppercase text-center">Porcentagem</span>
          </div>
          <div className="divide-y divide-gray-200">
            {[
              { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos' },
              { id: 'irregulares', label: 'Número de PUBLICADORES IRREGULARES desde a última visita:' },
              { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES desde a última visita:' },
              { id: 'reativados', label: 'Quantos foram REATIVADOS desde a última visita:' },
              { id: 'readmitidos', label: 'Quantos foram READMITIDOS desde a última visita:' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_100px] items-center py-0.5 bg-white">
                <span className="text-[11px] text-gray-800 pl-1">
                  {item.label.includes(':') ? 
                    <><span className="font-normal">{item.label.split(':')[0]}</span><span className="font-bold">:{item.label.split(':')[1]}</span></> : 
                    <><span className="font-normal">{item.label.split('DIRIGEM')[0]}</span><span className="font-bold">DIRIGEM</span><span className="font-normal">{item.label.split('DIRIGEM')[1]}</span></>
                  }
                </span>
                <div className="text-center font-normal text-[14px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{stats.estatisticas[item.id]}</div>
                <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%</div>
              </div>
            ))}
            
            {/* Growth Bar */}
            <div className="grid grid-cols-[1fr_100px_100px] items-center py-0.5 bg-[#a9d08e] border-y border-white">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider text-right pr-4">Crescimento de publicadores:</span>
              <div className="text-center font-bold text-[14px] text-white">{crescimento}</div>
              <div className="text-center font-bold text-[14px] text-white">{percCrescimento.replace('.', ',')}%</div>
            </div>

            {[
              { id: 'inativos', label: 'Quantos ficaram INATIVOS desde a última visita:' },
              { id: 'removidos', label: 'Quantos foram DESASSOCIADOS desde a última visita:' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_100px] items-center py-0.5 bg-white">
                <span className="text-[11px] text-gray-800 pl-1"><span className="font-normal">{item.label.split(':')[0]}</span><span className="font-bold">:{item.label.split(':')[1]}</span></span>
                <div className="text-center font-normal text-[14px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{stats.estatisticas[item.id]}</div>
                <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%</div>
              </div>
            ))}

            {/* Decrease Bar */}
            <div className="grid grid-cols-[1fr_100px_100px] items-center py-0.5 bg-[#f4b084] border-y border-white">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider text-right pr-4">Decréscimo de Publicadores:</span>
              <div className="text-center font-bold text-[14px] text-white">{decrescimo}</div>
              <div className="text-center font-bold text-[14px] text-white">{percDecrescimo.replace('.', ',')}%</div>
            </div>

            {[
              { id: 'batizados', label: 'Quantos foram BATIZADOS desde a última visita:' },
              { id: 'anciaos', label: 'Número de ANCIÃOS:' },
              { id: 'servos', label: 'Números de SERVOS MINISTERIAIS:' }
            ].map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_100px] items-center py-0.5 bg-white">
                <span className="text-[11px] text-gray-800 pl-1"><span className="font-normal">{item.label.split(':')[0]}</span><span className="font-bold">:{item.label.split(':')[1]}</span></span>
                <div className="text-center font-normal text-[14px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">{stats.estatisticas[item.id]}</div>
                <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{stats.pubAtivos > 0 ? ((stats.estatisticas[item.id] / stats.pubAtivos) * 100).toFixed(1).replace('.', ',') : '0,0'}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Meeting Attendance */}
        <div className="space-y-0 pt-1">
          <div className="grid grid-cols-[1fr_200px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[12px]">REUNIÕES CONGREGACIONAIS</h3>
            <span className="text-[9px] font-normal text-gray-500 uppercase text-center">Assistência mensal</span>
          </div>
          <div className="divide-y divide-gray-200">
            <div className="grid grid-cols-[1fr_200px] items-center py-0.5 bg-white">
              <span className="text-[11px] font-normal text-gray-800 uppercase pl-1">Reunião de <span className="font-bold">MEIO DE SEMANA</span></span>
              <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{Math.round(stats.reunioes.meioSemana)}</div>
            </div>
            <div className="grid grid-cols-[1fr_200px] items-center py-0.5 bg-white">
              <span className="text-[11px] font-normal text-gray-800 uppercase pl-1">Reunião de <span className="font-bold">FIM DE SEMANA</span></span>
              <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{Math.round(stats.reunioes.fimSemana)}</div>
            </div>
            <div className="grid grid-cols-[1fr_100px_100px] items-center py-1 bg-[#fdf5e6]">
              <span className="font-normal text-gray-800 text-[11px] uppercase pl-1">Média dos que assistem a reunião e <span className="font-bold">NÃO SÃO</span> Publicadores:</span>
              <div className="text-center font-normal text-[14px] bg-[#f2f2f2] py-1 mx-1 rounded-sm">
                {Math.max(0, Math.round(stats.reunioes.fimSemana) - stats.pubAtivos).toFixed(1).replace('.', ',')}
              </div>
              <div className="text-center font-bold text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">
                {stats.pubAtivos > 0 ? (Math.max(0, Math.round(stats.reunioes.fimSemana) - stats.pubAtivos) / stats.pubAtivos * 100).toFixed(1).replace('.', ',') : '0,0'}%
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Donations */}
        <div className="space-y-0 pt-1">
          <div className="grid grid-cols-[1fr_200px] items-end border-b border-[#002060] pb-0.5">
            <h3 className="font-bold text-[#002060] uppercase text-[12px]">DONATIVOS DO CIRCUITO</h3>
            <span className="text-[9px] font-normal text-gray-500 uppercase text-center">Média / 6 meses</span>
          </div>
          <div className="divide-y divide-gray-200">
            <div className="grid grid-cols-[1fr_200px] items-center py-0.5 bg-white">
              <span className="text-[11px] font-normal text-gray-800 uppercase pl-1">Donativos para a <span className="font-bold">OBRA MUNDIAL</span></span>
              <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{formatCurrency(stats.donativos.obraMundial)}</div>
            </div>
            <div className="grid grid-cols-[1fr_200px] items-center py-0.5 bg-white">
              <span className="text-[11px] font-normal text-gray-800 uppercase pl-1">Donativos para a <span className="font-bold">CONGREGAÇÃO</span></span>
              <div className="text-center font-normal text-[14px] bg-[#e9ecef] py-1 mx-1 rounded-sm">{formatCurrency(stats.donativos.congregacao)}</div>
            </div>
          </div>
        </div>

        {/* Footer Info - Hidden in Print or very small */}
        <div className="pt-2 flex justify-between items-end border-t border-gray-100 text-[8px] text-gray-300 font-medium print:pt-1">
          <div>Relatório gerado em: {new Date().toLocaleDateString('pt-BR')}</div>
          <div className="uppercase tracking-widest">ProgCir Web</div>
        </div>
      </div>
    </div>
  );
}
