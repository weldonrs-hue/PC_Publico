'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3, 
  TrendingDown, 
  Minus, 
  Info, 
  ArrowLeft, 
  DollarSign,
  ChevronDown,
  Search,
  BookOpen,
  UserCheck,
  UserPlus,
  UserX,
  AlertTriangle,
  Award,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface CongregationStatisticsViewProps {
  userId: string;
  onBack: () => void;
  initialCongregation?: string;
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

export default function CongregationStatisticsView({ userId, onBack, initialCongregation }: CongregationStatisticsViewProps) {
  const [loading, setLoading] = useState(true);
  const [congregations, setCongregations] = useState<string[]>([]);
  const [selectedCong, setSelectedCong] = useState<string>(initialCongregation || '');
  const [visitHistory, setVisitHistory] = useState<AnalysisData[]>([]);
  
  // Dropdown de congregação
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtro de categoria no mobile
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'ministerio' | 'espiritual' | 'reunioes'>('all');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    const fetchCongregations = async () => {
      try {
        const q = query(collection(db, 'congregations'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        const names = querySnapshot.docs.map(doc => doc.data().nome).sort();
        setCongregations(names);
        
        if (!selectedCong && names.length > 0) {
          setSelectedCong(names[0]);
        } else if (initialCongregation && names.includes(initialCongregation)) {
          setSelectedCong(initialCongregation);
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
            if (!d) return 0;
            const parts = d.split('/').map(Number);
            if (parts.length < 3) return 0;
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
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

  const renderTrend = (current: number, previous: number, isNegativeMetric = false) => {
    if (current === previous) {
      return (
        <span title="Sem alteração">
          <Minus size={15} className="text-typography-400 shrink-0" />
        </span>
      );
    }
    
    if (current > previous) {
      return isNegativeMetric ? (
        <span title="Aumento (Atenção)">
          <TrendingUp size={15} className="text-rose-500 shrink-0" />
        </span>
      ) : (
        <span title="Aumento positivo">
          <TrendingUp size={15} className="text-emerald-500 shrink-0" />
        </span>
      );
    }
    
    return isNegativeMetric ? (
      <span title="Redução positiva">
        <TrendingDown size={15} className="text-emerald-500 shrink-0" />
      </span>
    ) : (
      <span title="Queda">
        <TrendingDown size={15} className="text-rose-500 shrink-0" />
      </span>
    );
  };

  const metrics = useMemo(() => [
    // MINISTÉRIO
    {
      id: 'pubAtivos',
      label: 'Publicadores Ativos',
      category: 'ministerio' as const,
      icon: Users,
      iconColor: 'text-primary-200',
      iconBg: 'bg-primary-200/10',
      getValue: (v: AnalysisData) => parseInt(v.pubAtivos) || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'pioneirosRegulares',
      label: 'Pioneiros Regulares',
      category: 'ministerio' as const,
      icon: Award,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-500/10',
      getValue: (v: AnalysisData) => parseInt(v.ministério?.pioneirosRegulares?.relatando) || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'batizados',
      label: 'Batizados',
      category: 'ministerio' as const,
      icon: Sparkles,
      iconColor: 'text-sky-500',
      iconBg: 'bg-sky-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.batizados || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'mediaEstudos',
      label: 'Média de Estudos Bíblicos',
      category: 'ministerio' as const,
      icon: BookOpen,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.mediaEstudos || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'dirigemEstudos',
      label: 'Dirigem Estudos Bíblicos',
      category: 'ministerio' as const,
      icon: UserCheck,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.dirigemEstudos || 0,
      format: (val: number) => val.toString(),
    },

    // SITUAÇÃO ESPIRITUAL
    {
      id: 'novosPublicadores',
      label: 'Novos Publicadores',
      category: 'espiritual' as const,
      icon: UserPlus,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.novosPublicadores || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'reativados',
      label: 'Reativados',
      category: 'espiritual' as const,
      icon: TrendingUp,
      iconColor: 'text-teal-500',
      iconBg: 'bg-teal-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.reativados || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'readmitidos',
      label: 'Readmitidos',
      category: 'espiritual' as const,
      icon: UserCheck,
      iconColor: 'text-cyan-500',
      iconBg: 'bg-cyan-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.readmitidos || 0,
      format: (val: number) => val.toString(),
    },
    {
      id: 'irregulares',
      label: 'Irregulares',
      category: 'espiritual' as const,
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.irregulares || 0,
      format: (val: number) => val.toString(),
      isNegativeMetric: true,
    },
    {
      id: 'inativos',
      label: 'Inativos',
      category: 'espiritual' as const,
      icon: UserX,
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.inativos || 0,
      format: (val: number) => val.toString(),
      isNegativeMetric: true,
    },
    {
      id: 'removidos',
      label: 'Removidos',
      category: 'espiritual' as const,
      icon: UserX,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      getValue: (v: AnalysisData) => v.estatisticas?.removidos || 0,
      format: (val: number) => val.toString(),
      isNegativeMetric: true,
    },

    // REUNIÕES E DONATIVOS
    {
      id: 'meioSemana',
      label: 'Assistência Meio de Semana',
      category: 'reunioes' as const,
      icon: Calendar,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      getValue: (v: AnalysisData) => calculateAverage(v.reunioes?.meioSemana),
      format: (val: number) => val.toString(),
    },
    {
      id: 'fimSemana',
      label: 'Assistência Fim de Semana',
      category: 'reunioes' as const,
      icon: Calendar,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
      getValue: (v: AnalysisData) => calculateAverage(v.reunioes?.fimSemana),
      format: (val: number) => val.toString(),
    },
    {
      id: 'donativos',
      label: 'Donativos Totais',
      category: 'reunioes' as const,
      icon: DollarSign,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      getValue: (v: AnalysisData) => calculateTotalDonativosValue(v.donativos),
      format: (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isCurrency: true,
    },
  ], []);

  const filteredCongregations = congregations.filter(c => 
    c.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  const filteredMetrics = metrics.filter(m => 
    selectedCategory === 'all' || m.category === selectedCategory
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-typography-600">Carregando estatísticas...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16">
      {/* CARD PRINCIPAL COM CABEÇALHO */}
      <div className="bg-surface-100 border border-surface-300 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-surface-300 bg-surface-200/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Título e Ação de Voltar */}
            <div className="flex items-center gap-3">
              <button 
                onClick={onBack}
                className="p-2 sm:p-2.5 rounded-xl border border-surface-300 hover:bg-surface-200 text-typography-700 hover:text-typography-900 transition-colors shadow-2xs cursor-pointer group"
                title="Voltar ao Painel"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div className="p-2.5 bg-primary-200/10 text-primary-200 border border-primary-200/20 rounded-2xl shadow-2xs">
                <BarChart3 size={22} />
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-black text-typography-900 tracking-tight">
                  Comparativo de Visitas
                </h2>
                <p className="text-xs text-typography-500 font-medium">
                  Evolução das últimas 4 visitas da congregação
                </p>
              </div>
            </div>

            {/* SELETOR CUSTOMIZADO DE CONGREGAÇÃO */}
            <div ref={dropdownRef} className="relative w-full md:w-72">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-2.5 sm:p-3 rounded-xl border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 outline-none transition-all bg-surface-100 text-typography-900 text-sm font-bold flex items-center justify-between gap-2 cursor-pointer shadow-2xs hover:border-primary-200/50"
              >
                <span className="truncate">
                  {selectedCong || 'Selecione uma congregação...'}
                </span>
                <ChevronDown 
                  size={16} 
                  className={`text-typography-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-primary-200' : ''}`} 
                />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 left-0 top-full mt-1.5 z-50 bg-surface-100 border border-surface-300 rounded-2xl shadow-xl overflow-hidden p-2 space-y-1.5"
                  >
                    {/* Campo de Busca Rápida */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                      <input
                        type="text"
                        placeholder="Buscar congregação..."
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-200/70 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:border-primary-200 outline-none"
                        autoFocus
                      />
                    </div>

                    {/* Lista com scroll */}
                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
                      {filteredCongregations.length > 0 ? (
                        filteredCongregations.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setSelectedCong(c);
                              setIsDropdownOpen(false);
                              setDropdownSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              selectedCong === c
                                ? 'bg-primary-200 text-white shadow-2xs'
                                : 'text-typography-700 hover:bg-surface-200 hover:text-typography-900'
                            }`}
                          >
                            {c}
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-typography-400">
                          Nenhuma congregação encontrada
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* FILTROS DE CATEGORIA PARA NAVEGAÇÃO MOBILE */}
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 mt-3 border-t border-surface-300 -mx-1 px-1">
            {[
              { id: 'all', label: 'Todas as Métricas' },
              { id: 'ministerio', label: 'Ministério' },
              { id: 'espiritual', label: 'Situação Espiritual' },
              { id: 'reunioes', label: 'Reuniões e Donativos' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-primary-200 text-white shadow-2xs'
                    : 'bg-surface-100 text-typography-600 border border-surface-300 hover:bg-surface-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL: VISÃO DESKTOP (TABELA MODERNA) */}
        {visitHistory.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-200/50 border-b border-surface-300">
                    <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-typography-500 w-1/3">
                      Indicador
                    </th>
                    {visitHistory.map((visit, idx) => (
                      <th key={visit.id} className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black uppercase text-primary-200 tracking-wider">
                            Visita {visitHistory.length - idx}
                          </span>
                          <span className="text-xs font-bold text-typography-800 mt-0.5">
                            {visit.dataVisita || '—'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-300">
                  {filteredMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <tr 
                        key={metric.id}
                        className="hover:bg-surface-200/40 transition-colors"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl ${metric.iconBg} ${metric.iconColor} flex items-center justify-center shrink-0`}>
                              <Icon size={16} />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-typography-800">
                              {metric.label}
                            </span>
                          </div>
                        </td>

                        {visitHistory.map((visit, idx) => {
                          const currentVal = metric.getValue(visit);
                          const prevVal = idx > 0 ? metric.getValue(visitHistory[idx - 1]) : currentVal;

                          return (
                            <td key={visit.id} className="px-6 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className={`font-black text-typography-900 ${metric.isCurrency ? 'text-xs' : 'text-base'}`}>
                                  {metric.format(currentVal)}
                                </span>
                                {idx > 0 && renderTrend(currentVal, prevVal, metric.isNegativeMetric)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISÃO MOBILE: CARDS SEM SCROLL LATERAL E 100% PREENCHIDOS */}
            <div className="block md:hidden p-4 space-y-2.5">
              {filteredMetrics.map((metric) => {
                const Icon = metric.icon;
                const hasMultiple = visitHistory.length > 1;
                const latestVisit = visitHistory[visitHistory.length - 1];
                const latestVal = metric.getValue(latestVisit);
                const prevVal = hasMultiple ? metric.getValue(visitHistory[visitHistory.length - 2]) : latestVal;

                return (
                  <div
                    key={metric.id}
                    className="p-3.5 bg-surface-200/50 border border-surface-300 rounded-2xl space-y-3 shadow-2xs"
                  >
                    {/* Linha Principal da Métrica */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl ${metric.iconBg} ${metric.iconColor} flex items-center justify-center shrink-0`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-typography-900 truncate">
                            {metric.label}
                          </h4>
                          {!hasMultiple && (
                            <p className="text-[10px] font-medium text-typography-500 mt-0.5">
                              {latestVisit.dataVisita ? `Visita: ${latestVisit.dataVisita}` : 'Última visita'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-black text-typography-900 ${metric.isCurrency ? 'text-xs' : 'text-base'}`}>
                          {metric.format(latestVal)}
                        </span>
                        {hasMultiple && renderTrend(latestVal, prevVal, metric.isNegativeMetric)}
                      </div>
                    </div>

                    {/* Histórico em pills quando há mais de 1 visita (distribuído 100% na largura) */}
                    {hasMultiple && (
                      <div className="flex gap-2 [&>*]:flex-1 pt-1 border-t border-surface-300/60">
                        {visitHistory.map((visit, idx) => {
                          const currentVal = metric.getValue(visit);
                          const prev = idx > 0 ? metric.getValue(visitHistory[idx - 1]) : currentVal;
                          const isLatest = idx === visitHistory.length - 1;

                          return (
                            <div
                              key={visit.id}
                              className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                                isLatest
                                  ? 'bg-surface-100 border-primary-200/40 ring-1 ring-primary-200/20'
                                  : 'bg-surface-100/70 border-surface-300'
                              }`}
                            >
                              <span className="text-[9px] font-bold uppercase tracking-wider text-typography-400">
                                {visit.dataVisita || `V${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`font-black text-typography-900 ${metric.isCurrency ? 'text-[10px]' : 'text-xs'}`}>
                                  {metric.format(currentVal)}
                                </span>
                                {idx > 0 && renderTrend(currentVal, prev, metric.isNegativeMetric)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-12 text-center space-y-2">
            <Info size={32} className="mx-auto text-typography-400" />
            <h4 className="text-sm font-bold text-typography-800">
              Nenhuma análise de atividade encontrada
            </h4>
            <p className="text-xs text-typography-500 max-w-sm mx-auto">
              Esta congregação ainda não possui relatórios de análise de atividade cadastrados para comparar.
            </p>
          </div>
        )}

        {/* RODAPÉ INFORMATIVO */}
        {visitHistory.length > 0 && (
          <div className="p-4 bg-surface-200/50 border-t border-surface-300 flex items-center justify-center gap-2">
            <Info size={14} className="text-typography-400" />
            <p className="text-[11px] text-typography-500 font-medium">
              Exibindo histórico de {visitHistory.length} visita{visitHistory.length > 1 ? 's' : ''} (máximo de 4).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
