'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3, 
  ArrowRight,
  TrendingDown,
  Minus,
  Info,
  ArrowLeft,
  DollarSign
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface CongregationStatisticsViewProps {
  userId: string;
  onBack: () => void;
}

interface AnalysisData {
  id: string;
  congregacao: string;
  dataVisita: string;
  pubAtivos: string;
  ministério: {
    publicadores: { relatando: string; estudos: string };
    pioneirosRegulares: { relatando: string; estudos: string };
    pioneirosAuxiliares: { relatando: string; estudos: string };
    pioneirosEspeciais: { relatando: string; estudos: string };
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

export default function CongregationStatisticsView({ userId, onBack }: CongregationStatisticsViewProps) {
  const [loading, setLoading] = useState(true);
  const [congregations, setCongregations] = useState<string[]>([]);
  const [selectedCong, setSelectedCong] = useState<string>('');
  const [visitHistory, setVisitHistory] = useState<AnalysisData[]>([]);

  useEffect(() => {
    const fetchCongregations = async () => {
      try {
        const q = query(collection(db, 'congregations'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        const names = querySnapshot.docs.map(doc => doc.data().nome).sort();
        setCongregations(names);
        if (names.length > 0) {
          setSelectedCong(names[0]);
        }
      } catch (error) {
        console.error('Error fetching congregations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCongregations();
  }, [userId]);

  useEffect(() => {
    if (!selectedCong) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'activity_analysis'),
          where('userId', '==', userId),
          where('congregacao', '==', selectedCong)
        );
        
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AnalysisData[];

        // Custom sort by date DD/MM/YYYY
        const sortedData = data.sort((a, b) => {
          const parseDate = (d: string) => {
            const [day, month, year] = d.split('/').map(Number);
            return new Date(year, month - 1, day).getTime();
          };
          return parseDate(b.dataVisita) - parseDate(a.dataVisita);
        }).slice(0, 4);

        setVisitHistory(sortedData.reverse()); // Oldest first to show trend
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'activity_analysis');
      }
    };

    fetchHistory();
  }, [selectedCong, userId]);

  const calculateAverage = (list: string[]) => {
    if (!list || !Array.isArray(list)) return 0;
    const validValues = list.map(v => parseInt(v)).filter(v => !isNaN(v));
    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / validValues.length);
  };

  const getTrend = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp size={16} className="text-emerald-500" />;
    if (current < previous) return <TrendingDown size={16} className="text-rose-500" />;
    return <Minus size={16} className="text-gray-300" />;
  };

  const calculateTotalDonativosValue = (donativos: { congregacao: string[]; obraMundial: string[] }) => {
    if (!donativos) return 0;
    const sumList = (list: string[]) => {
      if (!list || !Array.isArray(list)) return 0;
      return list.reduce((acc, curr) => {
        if (!curr) return acc;
        const cleanValue = curr.replace(/\./g, '').replace(',', '.');
        return acc + (parseFloat(cleanValue) || 0);
      }, 0);
    };
    return sumList(donativos.congregacao) + sumList(donativos.obraMundial);
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-sky-50 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-sky-600 border border-transparent hover:border-sky-100 mr-2 md:mr-0 group"
              title="Voltar ao Painel Circuito"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="p-2.5 bg-sky-500 text-white rounded-2xl shadow-lg shadow-sky-200">
              <BarChart3 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-800 tracking-tight">Comparativo de Visitas</h3>
              <p className="text-sm text-gray-500 font-medium">Análise das últimas 4 visitas</p>
            </div>
          </div>
          
          <select
            value={selectedCong}
            onChange={(e) => setSelectedCong(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-bold text-gray-700 shadow-sm"
          >
            {congregations.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Indicador</th>
              {visitHistory.map((visit, idx) => (
                <th key={visit.id} className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-sky-600 tracking-tighter">Visita {visitHistory.length - idx}</span>
                    <span className="text-sm font-bold text-gray-800">{visit.dataVisita}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Publicadores Ativos */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                    <Users size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Publicadores Ativos</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = parseInt(visit.pubAtivos) || 0;
                const prev = idx > 0 ? parseInt(visitHistory[idx - 1].pubAtivos) || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-black text-gray-900">{current}</span>
                        {idx > 0 && getTrend(current, prev)}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Pioneiros Regulares */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Calendar size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Pioneiros Regulares</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = parseInt(visit.ministério.pioneirosRegulares?.relatando) || 0;
                const prev = idx > 0 ? parseInt(visitHistory[idx - 1].ministério.pioneirosRegulares?.relatando) || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Batizados */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Batizados</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.batizados || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.batizados || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Estudos Bíblicos Totais */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                    <BarChart3 size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Média mensal de Estudos Bíblicos</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.mediaEstudos || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.mediaEstudos || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Dirigem Estudos */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Users size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Quantos DIRIGEM Estudos Bíblicos</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.dirigemEstudos || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.dirigemEstudos || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Novos Publicadores */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Número de NOVOS PUBLICADORES*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.novosPublicadores || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.novosPublicadores || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Reativados */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Quantos foram REATIVADOS*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.reativados || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.reativados || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Readmitidos */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Quantos foram READMITIDOS*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.readmitidos || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.readmitidos || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Batizados */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Quantos foram BATIZADOS*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.batizados || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.batizados || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Irregulares */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                    <TrendingDown size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Número de IRREGULARES*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.irregulares || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.irregulares || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && (
                         current > prev ? <TrendingUp size={16} className="text-rose-500" /> : 
                         current < prev ? <TrendingDown size={16} className="text-emerald-500" /> : 
                         <Minus size={16} className="text-gray-300" />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Inativos */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                    <TrendingDown size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Quantos ficaram INATIVOS*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.inativos || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.inativos || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && (
                         current > prev ? <TrendingUp size={16} className="text-rose-500" /> : 
                         current < prev ? <TrendingDown size={16} className="text-emerald-500" /> : 
                         <Minus size={16} className="text-gray-300" />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Removidos */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                    <TrendingDown size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Quantos ficaram REMOVIDOS*</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = visit.estatisticas.removidos || 0;
                const prev = idx > 0 ? visitHistory[idx - 1].estatisticas.removidos || 0 : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && (
                         current > prev ? <TrendingUp size={16} className="text-rose-500" /> : 
                         current < prev ? <TrendingDown size={16} className="text-emerald-500" /> : 
                         <Minus size={16} className="text-gray-300" />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Donativos */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <DollarSign size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Donativos (Total)</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = calculateTotalDonativosValue(visit.donativos);
                const prev = idx > 0 ? calculateTotalDonativosValue(visitHistory[idx - 1].donativos) : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-gray-900">R$ {current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        {idx > 0 && getTrend(current, prev)}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Média Meio de Semana */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <Calendar size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Assit. Meio de Semana</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = calculateAverage(visit.reunioes.meioSemana);
                const prev = idx > 0 ? calculateAverage(visitHistory[idx - 1].reunioes.meioSemana) : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Média Fim de Semana */}
            <tr>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Calendar size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Assit. Fim de Semana</span>
                </div>
              </td>
              {visitHistory.map((visit, idx) => {
                const current = calculateAverage(visit.reunioes.fimSemana);
                const prev = idx > 0 ? calculateAverage(visitHistory[idx - 1].reunioes.fimSemana) : current;
                return (
                  <td key={visit.id} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-black text-gray-900">{current}</span>
                      {idx > 0 && getTrend(current, prev)}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {visitHistory.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-gray-400 font-medium">Nenhuma análise de atividade encontrada para esta congregação.</p>
        </div>
      )}

      {visitHistory.length > 0 && visitHistory.length < 4 && (
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2">
          <Info size={14} className="text-gray-400" />
          <p className="text-[11px] text-gray-400 italic">Mostrando {visitHistory.length} visitas (máximo de 4).</p>
        </div>
      )}
    </div>
  );
}
