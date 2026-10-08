'use client';

import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Edit2,
  FileDown,
  FileText,
  LayoutGrid,
  LayoutList,
  Loader2,
  MapPin,
  Plus,
  Printer,
  Search,
  Table as TableIcon,
  Trash2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActivityAnalysisView from './ActivityAnalysisView';
import AppointmentLetterView from './AppointmentLetterView';
import S302NoticeView from './S302NoticeView';
import S303ReportView from './S303ReportView';
import VisitScheduleManagerView from './visit/VisitScheduleManagerView';

import { useDialog } from '@/hooks/useDialog';
import { auth, db } from '@/lib/firebase';
import { handleFirestoreError, isQuotaExceeded, OperationType, setQuotaExceededGlobal } from '@/utils/firestore';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

interface ItinerariesViewProps {
  userId: string;
  user?: any;
  onBack: () => void;
}

interface ItineraryItem {
  id?: string;
  semana: string;
  dataEvento: string;
  evento: string;
  tipoEvento?: string;
  observacoes: string;
  escritorioNotificado: boolean;
  congregacaoNotificada: boolean;
  ordem: number;
  // New fields
  dataInicialDia?: string;
  dataTerminoDia?: string;
  congregacao?: string;
  congregacaoId?: string;
  substituto?: string;
  grupo?: string;
  outroEvento?: string;
}

interface Congregation {
  id: string;
  nome: string;
  cidade: string;
  numero: string;
  estado: string;
  endereco?: string;
  coordenador?: string;
  cep?: string;
  grupos?: string[];
}

interface Substitute {
  id: string;
  nome: string;
}

const DIAS_SEMANA = [
  'Segunda-Feira',
  'Terça-Feira',
  'Quarta-Feira',
  'Quinta-Feira',
  'Sexta-Feira',
  'Sábado',
  'Domingo'
];

const TIPOS_EVENTO = [
  'Visita a Congregação',
  'Visita a Grupo',
  'Outros Eventos',
  'SEMANA DE PIONEIRO',
  'Recebendo visita de pastoreio',
  'SEMANA LIVRE'
];

const OUTROS_EVENTOS = [
  'Assembleia CA_Br',
  'Assembleia CA_Co',
  'AUSÊNCIA',
  'LICENÇA',
  'Congresso Regional',
  'Cursando Escola',
  'Escola de Pioneiros',
  'Escola para Anciãos',
  'Refeição Noturna do Senhor',
  'Reunião especial com os pioneiros'
];

const getLastMonday = () => {
  const today = new Date();
  const day = today.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.setDate(diff));
};

const isCurrentWeek = (semanaStr?: string) => {
  if (!semanaStr || !semanaStr.includes('/')) return false;
  try {
    const [day, month, year] = semanaStr.split('/').map(Number);
    if (!day || !month || !year) return false;
    const mondayDate = new Date(year, month - 1, day);
    const nextMonday = new Date(mondayDate);
    nextMonday.setDate(nextMonday.getDate() + 7);
    
    const now = new Date();
    return now >= mondayDate && now < nextMonday;
  } catch (e) {
    return false;
  }
};

const isWeekPast = (semanaStr?: string) => {
  if (!semanaStr || !semanaStr.includes('/')) return false;
  try {
    const [day, month, year] = semanaStr.split('/').map(Number);
    if (!day || !month || !year) return false;
    // Week runs Monday (day) to Sunday (day + 6)
    const sundayEnd = new Date(year, month - 1, day + 6, 23, 59, 59, 999);
    const now = new Date();
    return now > sundayEnd;
  } catch (e) {
    return false;
  }
};

const getSeriesRange = (date: Date) => {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  if (month >= 9 || month <= 2) {
    const startYear = month >= 9 ? year : year - 1;
    return {
      start: new Date(startYear, 8, 1),
      end: new Date(startYear + 1, 2, 0, 23, 59, 59, 999),
      label: `Set/${startYear} - Fev/${startYear + 1}`
    };
  } else {
    return {
      start: new Date(year, 2, 1),
      end: new Date(year, 8, 0, 23, 59, 59, 999),
      label: `Mar/${year} - Ago/${year}`
    };
  }
};

interface CustomDropdownOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  dot?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  placeholder?: string;
  className?: string;
}

function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  className = ''
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2.5 sm:p-3 rounded-xl border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 outline-none transition-all bg-surface-200 text-typography-900 text-sm font-medium flex items-center justify-between gap-2 cursor-pointer shadow-2xs hover:border-primary-200/50"
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption?.dot && (
            <span className={`w-2 h-2 rounded-full ${selectedOption.dot} shrink-0`} />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="text-typography-400 font-normal">{placeholder}</span>}
          </span>
          {selectedOption?.badge && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${selectedOption.badgeColor || 'bg-surface-300 text-typography-700'}`}>
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-typography-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-200' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 z-[2200] bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar p-1"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between gap-2 text-left cursor-pointer ${
                    isSelected 
                      ? 'bg-primary-200/10 text-primary-200 font-bold' 
                      : 'text-typography-800 hover:bg-surface-200/70 hover:text-typography-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    {opt.dot && (
                      <span className={`w-2 h-2 rounded-full ${opt.dot} shrink-0`} />
                    )}
                    <span className="truncate">{opt.label}</span>
                    {opt.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${opt.badgeColor || 'bg-surface-200 text-typography-600'}`}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-primary-200 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CongregationCustomSelectProps {
  value: string;
  onChange: (congId: string) => void;
  congregations: Congregation[];
  pendingCongregations: Congregation[];
  scheduledCongregations: (Congregation & { scheduledDate: string })[];
  pastVisitedCongregations: (Congregation & { visitDate: string })[];
  lastVisitMap: Map<string, { timestamp: number; formattedDate: string }>;
}

function CongregationCustomSelect({
  value,
  onChange,
  congregations,
  pendingCongregations,
  scheduledCongregations,
  pastVisitedCongregations,
  lastVisitMap
}: CongregationCustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedCong = congregations.find((c) => c.id === value);

  const filterCong = (c: Congregation) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.nome.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q);
  };

  const filteredPending = pendingCongregations.filter(filterCong);
  const filteredScheduled = scheduledCongregations.filter(filterCong);
  const filteredPast = pastVisitedCongregations.filter(filterCong);

  const isCategorized = pendingCongregations.length > 0 || scheduledCongregations.length > 0 || pastVisitedCongregations.length > 0;
  const filteredAll = !isCategorized ? congregations.filter(filterCong) : [];
  const hasAnyResults = isCategorized 
    ? (filteredPending.length > 0 || filteredScheduled.length > 0 || filteredPast.length > 0)
    : filteredAll.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className="w-full p-2.5 sm:p-3 rounded-xl border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 outline-none transition-all bg-surface-200 text-typography-900 text-sm font-medium flex items-center justify-between gap-2 cursor-pointer shadow-2xs hover:border-primary-200/50"
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <MapPin size={15} className={selectedCong ? 'text-primary-200 shrink-0' : 'text-typography-400 shrink-0'} />
          <span className="truncate">
            {selectedCong ? (
              <span className="font-semibold">{selectedCong.nome} - <span className="text-typography-500 font-normal">{selectedCong.cidade}</span></span>
            ) : (
              <span className="text-typography-400 font-normal">Selecione uma congregação...</span>
            )}
          </span>
        </div>
        <ChevronDown size={16} className={`text-typography-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-200' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 z-[2200] bg-surface-100 border border-surface-300 rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col"
          >
            {/* Search Box */}
            <div className="p-2 border-b border-surface-300 bg-surface-200/60 sticky top-0 z-10">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-typography-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome ou cidade..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-typography-900 placeholder:text-typography-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar p-1.5 space-y-2 flex-1">
              {!hasAnyResults && (
                <div className="text-center py-6 text-xs text-typography-400 italic">
                  Nenhuma congregação encontrada
                </div>
              )}

              {/* Group 1: Pendentes (Prioridade) */}
              {filteredPending.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>📍 Pendentes (Prioridade na Série)</span>
                    <span className="bg-amber-500/15 px-1.5 py-0.5 rounded font-mono text-[9px]">{filteredPending.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredPending.map((c) => {
                      const isSelected = c.id === value;
                      const lastInfo = lastVisitMap.get(c.id);
                      const lastStr = lastInfo ? `Última: ${lastInfo.formattedDate}` : 'Sem visita anterior';
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            onChange(c.id);
                            setIsOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected 
                              ? 'bg-primary-200/10 text-primary-200 font-bold' 
                              : 'text-typography-800 hover:bg-surface-200/70 hover:text-typography-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{c.nome} - <span className="text-typography-500 font-normal">{c.cidade}</span></div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate">{lastStr}</div>
                          </div>
                          {isSelected && <Check size={14} className="text-primary-200 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group 2: Programadas */}
              {filteredScheduled.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center justify-between pt-1 border-t border-surface-300/60">
                    <span>📅 Visitas Programadas</span>
                    <span className="bg-sky-500/15 px-1.5 py-0.5 rounded font-mono text-[9px]">{filteredScheduled.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredScheduled.map((c) => {
                      const isSelected = c.id === value;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            onChange(c.id);
                            setIsOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected 
                              ? 'bg-primary-200/10 text-primary-200 font-bold' 
                              : 'text-typography-800 hover:bg-surface-200/70 hover:text-typography-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{c.nome} - <span className="text-typography-500 font-normal">{c.cidade}</span></div>
                            <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium truncate">Programada para: {c.scheduledDate}</div>
                          </div>
                          {isSelected && <Check size={14} className="text-primary-200 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group 3: Já Visitadas */}
              {filteredPast.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between pt-1 border-t border-surface-300/60">
                    <span>✓ Já Visitadas</span>
                    <span className="bg-emerald-500/15 px-1.5 py-0.5 rounded font-mono text-[9px]">{filteredPast.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredPast.map((c) => {
                      const isSelected = c.id === value;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            onChange(c.id);
                            setIsOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected 
                              ? 'bg-primary-200/10 text-primary-200 font-bold' 
                              : 'text-typography-800 hover:bg-surface-200/70 hover:text-typography-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{c.nome} - <span className="text-typography-500 font-normal">{c.cidade}</span></div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">Visitada em: {c.visitDate}</div>
                          </div>
                          {isSelected && <Check size={14} className="text-primary-200 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fallback Group: Todas as Congregações (caso não haja dados da série) */}
              {!isCategorized && filteredAll.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-typography-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Todas as Congregações</span>
                    <span className="bg-surface-300 px-1.5 py-0.5 rounded font-mono text-[9px]">{filteredAll.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredAll.map((c) => {
                      const isSelected = c.id === value;
                      const lastInfo = lastVisitMap.get(c.id);
                      const lastStr = lastInfo ? `Última: ${lastInfo.formattedDate}` : 'Sem visita anterior';
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            onChange(c.id);
                            setIsOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected 
                              ? 'bg-primary-200/10 text-primary-200 font-bold' 
                              : 'text-typography-800 hover:bg-surface-200/70 hover:text-typography-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{c.nome} - <span className="text-typography-500 font-normal">{c.cidade}</span></div>
                            <div className="text-[10px] text-typography-400 font-medium truncate">{lastStr}</div>
                          </div>
                          {isSelected && <Check size={14} className="text-primary-200 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ItinerariesView({ userId, user, onBack }: ItinerariesViewProps) {
  const { showAlert } = useDialog();

  const [itineraries, setItineraries] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewDate, setViewDate] = useState(getLastMonday());
  const [initializing, setInitializing] = useState(false);
  const initializingRef = useRef(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisParams, setAnalysisParams] = useState<{congregacao: string, congregacaoId?: string, data: string} | null>(null);
  const [showS303, setShowS303] = useState(false);
  const [s303Params, setS303Params] = useState<{congregacao: Congregation, data: string, substituto?: string} | null>(null);
  const [showS302, setShowS302] = useState(false);
  const [s302Params, setS302Params] = useState<{events: any[], initialIndex: number} | null>(null);
  const [showAppointmentLetter, setShowAppointmentLetter] = useState(false);
  const [appointmentLetterParams, setAppointmentLetterParams] = useState<{congregacao: Congregation, data: string} | null>(null);
  const [showVisitSchedule, setShowVisitSchedule] = useState(false);
  const [visitScheduleParams, setVisitScheduleParams] = useState<{congregacaoId: string, congregacaoNome: string, periodo: string} | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('progcir_itineraries_view_mode') as 'table' | 'list' | null;
      if (savedMode === 'table' || savedMode === 'list') {
        setViewMode(savedMode);
      }
    }
  }, []);

  const handleViewModeChange = (mode: 'table' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('progcir_itineraries_view_mode', mode);
    }
  };
  
  // Data for selects
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  
  const sortedCongregations = useMemo(() => {
    if (!congregations.length) return [];
    
    const visitMap = new Map<string, number>();
    
    itineraries.forEach(item => {
      // If it has a congregation ID or name, and it's a visit type event
      const isVisit = item.tipoEvento === 'Visita a Congregação' || 
                      item.tipoEvento === 'Visita a Grupo' || 
                      item.evento?.toLowerCase().includes('visita') ||
                      (item.congregacaoId && !item.tipoEvento); // Fallback for older items

      if ((item.congregacaoId || item.congregacao) && isVisit) {
        try {
          const s = item.semana || '';
          const parts = s.split('/');
          if (parts.length === 3) {
            const [d, m, y] = parts.map(Number);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const date = new Date(y, m - 1, d).getTime();
              
              const targetId = item.congregacaoId || congregations.find(c => c.nome === item.congregacao)?.id;
              
              if (targetId) {
                const current = visitMap.get(targetId);
                if (current === undefined || date < current) {
                  visitMap.set(targetId, date);
                }
              }
            }
          }
        } catch (e) {}
      }
    });
    
    return [...congregations].sort((a, b) => {
      const dateA = visitMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const dateB = visitMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      
      if (dateA !== dateB) return dateA - dateB;
      return a.nome.localeCompare(b.nome);
    });
  }, [congregations, itineraries]);
  
  // Modal states
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);

  // Map of the most recent visit date for each congregation that has ALREADY OCCURRED (past date)
  const lastVisitMap = useMemo(() => {
    const map = new Map<string, { timestamp: number; formattedDate: string }>();
    if (!congregations.length) return map;

    itineraries.forEach(item => {
      // Do not count the visit currently being edited
      if (selectedItem && item.id === selectedItem.id) return;
      if (!item.semana || !item.semana.includes('/')) return;

      // Only past visits count as "already visited"
      if (!isWeekPast(item.semana)) return;

      const isVisit = item.tipoEvento === 'Visita a Congregação' || 
                      item.tipoEvento === 'Visita a Grupo' || 
                      item.evento?.toLowerCase().includes('visita') ||
                      (item.congregacaoId && !item.tipoEvento);
      if (!isVisit) return;

      const targetId = item.congregacaoId || congregations.find(c => c.nome === item.congregacao)?.id;
      if (!targetId) return;

      try {
        const parts = item.semana.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts.map(Number);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
            const date = new Date(y, m - 1, d);
            const time = date.getTime();
            const current = map.get(targetId);
            if (!current || time > current.timestamp) {
              map.set(targetId, {
                timestamp: time,
                formattedDate: item.semana
              });
            }
          }
        }
      } catch (e) {}
    });

    return map;
  }, [congregations, itineraries, selectedItem?.id]);

  // Visits and classification for the active series of the modal/selected week
  const seriesVisits = useMemo(() => {
    const referenceSemana = selectedItem?.semana || itineraries.find(i => isCurrentWeek(i.semana))?.semana;
    let range = { start: new Date(), end: new Date(), label: '' };
    if (referenceSemana && referenceSemana.includes('/')) {
      const [d, m, y] = referenceSemana.split('/').map(Number);
      range = getSeriesRange(new Date(y, m - 1, d));
    } else {
      range = getSeriesRange(new Date());
    }

    const visits = itineraries.filter(item => {
      if (selectedItem && item.id === selectedItem.id) return false;
      if (!item.semana || !item.semana.includes('/')) return false;

      const [id, im, iy] = item.semana.split('/').map(Number);
      const itemDate = new Date(iy, im - 1, id);
      return itemDate >= range.start && itemDate <= range.end && 
             (item.tipoEvento === 'Visita a Congregação' || item.tipoEvento === 'Visita a Grupo') &&
             (item.congregacaoId || item.congregacao);
    });

    return { visits, range };
  }, [itineraries, selectedItem?.semana, selectedItem?.id]);

  // Categorize congregations in the current series into:
  // 1. pastVisitedCongregations (data já passou -> visitada)
  // 2. scheduledCongregations (data futura/atual -> visita programada)
  // 3. pendingCongregations (não programada nesta série)
  const { pendingCongregations, scheduledCongregations, pastVisitedCongregations } = useMemo(() => {
    const pending: Congregation[] = [];
    const scheduled: Array<Congregation & { scheduledDate: string; timestamp: number }> = [];
    const pastVisited: Array<Congregation & { visitDate: string; timestamp: number }> = [];

    const { visits } = seriesVisits;

    congregations.forEach(cong => {
      const itemsForCong = visits.filter(v => (v.congregacaoId === cong.id || v.congregacao === cong.nome));
      if (itemsForCong.length === 0) {
        pending.push(cong);
      } else {
        const pastItem = itemsForCong.find(v => isWeekPast(v.semana));
        const schedItem = itemsForCong.find(v => !isWeekPast(v.semana));

        if (pastItem) {
          const [d, m, y] = pastItem.semana.split('/').map(Number);
          pastVisited.push({
            ...cong,
            visitDate: pastItem.semana,
            timestamp: new Date(y, m - 1, d).getTime()
          });
        }
        if (schedItem) {
          const [d, m, y] = schedItem.semana.split('/').map(Number);
          scheduled.push({
            ...cong,
            scheduledDate: schedItem.semana,
            timestamp: new Date(y, m - 1, d).getTime()
          });
        }
      }
    });

    return {
      pendingCongregations: pending,
      scheduledCongregations: scheduled,
      pastVisitedCongregations: pastVisited
    };
  }, [congregations, seriesVisits]);

  // Sort pending congregations: never visited first, then oldest visit date first
  const sortedPendingCongregations = useMemo(() => {
    return [...pendingCongregations].sort((a, b) => {
      const timeA = lastVisitMap.get(a.id)?.timestamp ?? 0;
      const timeB = lastVisitMap.get(b.id)?.timestamp ?? 0;
      if (timeA !== timeB) return timeA - timeB; // 0 (sem visita) vem primeiro, seguido de datas mais antigas
      return a.nome.localeCompare(b.nome);
    });
  }, [pendingCongregations, lastVisitMap]);

  const sortedScheduledCongregations = useMemo(() => {
    return [...scheduledCongregations].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.nome.localeCompare(b.nome);
    });
  }, [scheduledCongregations]);

  const sortedPastVisitedCongregations = useMemo(() => {
    return [...pastVisitedCongregations].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
      return a.nome.localeCompare(b.nome);
    });
  }, [pastVisitedCongregations]);

  const cycleProgress = useMemo(() => {
    const total = congregations.length;
    const visitedCount = pastVisitedCongregations.length;
    const scheduledCount = scheduledCongregations.length;
    const pendingCount = pendingCongregations.length;

    return {
      visited: visitedCount,
      scheduled: scheduledCount,
      pending: pendingCount,
      total,
      visitedPercent: total > 0 ? Math.round((visitedCount / total) * 100) : 0,
      scheduledPercent: total > 0 ? Math.round((scheduledCount / total) * 100) : 0,
      totalPlannedPercent: total > 0 ? Math.round(((visitedCount + scheduledCount) / total) * 100) : 0,
      label: seriesVisits.range.label
    };
  }, [congregations.length, pastVisitedCongregations.length, scheduledCongregations.length, pendingCongregations.length, seriesVisits.range.label]);

  // Active series progress for the currently viewed month (on the main screen)
  const mainSeriesProgress = useMemo(() => {
    if (congregations.length === 0) return { visitedCount: 0, scheduledCount: 0, pendingCount: 0, total: 0, label: '' };
    
    const range = getSeriesRange(viewDate);

    const visitsInSeries = itineraries.filter(item => {
      if (!item.semana || !item.semana.includes('/')) return false;
      const [id, im, iy] = item.semana.split('/').map(Number);
      const itemDate = new Date(iy, im - 1, id);
      return itemDate >= range.start && itemDate <= range.end && 
             (item.tipoEvento === 'Visita a Congregação' || item.tipoEvento === 'Visita a Grupo') &&
             (item.congregacaoId || item.congregacao);
    });

    const visitedIds = new Set<string>();
    const scheduledIds = new Set<string>();

    visitsInSeries.forEach(item => {
      const id = item.congregacaoId || congregations.find(c => c.nome === item.congregacao)?.id;
      if (!id) return;
      if (isWeekPast(item.semana)) {
        visitedIds.add(id);
      } else {
        scheduledIds.add(id);
      }
    });

    const visitedCount = visitedIds.size;
    const scheduledCount = Array.from(scheduledIds).filter(id => !visitedIds.has(id)).length;
    const pendingCount = congregations.filter(c => !visitedIds.has(c.id) && !scheduledIds.has(c.id)).length;
    const total = congregations.length;

    return {
      visitedCount,
      scheduledCount,
      pendingCount,
      total,
      label: range.label
    };
  }, [congregations, itineraries, viewDate]);
  const [modalMode, setModalMode] = useState<'actions' | 'edit' | 'confirmDelete' | null>(null);
  const defaultEditFormData: Partial<ItineraryItem> = {
    dataEvento: '',
    evento: 'Visita a Congregação',
    tipoEvento: 'Visita a Congregação',
    observacoes: '',
    dataInicialDia: 'Terça-Feira',
    dataTerminoDia: 'Domingo',
    congregacao: '',
    congregacaoId: '',
    substituto: '',
    grupo: '',
    outroEvento: ''
  };

  const isItemEmpty = (item: Partial<ItineraryItem> | null | undefined): boolean => {
    if (!item) return true;
    return !item.evento?.trim() && 
           !item.observacoes?.trim() && 
           !item.dataEvento?.trim() && 
           !item.congregacao?.trim() && 
           !item.outroEvento?.trim() &&
           !item.grupo?.trim();
  };

  const [editFormData, setEditFormData] = useState<Partial<ItineraryItem>>(defaultEditFormData);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const isAdding = useMemo(() => {
    if (isAddingNew) return true;
    if (!selectedItem) return false;
    return isItemEmpty(selectedItem);
  }, [isAddingNew, selectedItem]);

  const calculateDate = (mondayStr: string, dayName: string) => {
    try {
      const [day, month, year] = mondayStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      const dayIndex = DIAS_SEMANA.indexOf(dayName);
      if (dayIndex === -1) return '';
      
      date.setDate(date.getDate() + dayIndex);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    } catch (e) {
      return '';
    }
  };

  const getWeekRangeDisplay = (mondayStr: string) => {
    try {
      const [day, month, year] = mondayStr.split('/').map(Number);
      const monday = new Date(year, month - 1, day);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const d1 = String(monday.getDate()).padStart(2, '0');
      const m1 = String(monday.getMonth() + 1).padStart(2, '0');
      const y1 = monday.getFullYear();
      
      const d2 = String(sunday.getDate()).padStart(2, '0');
      const m2 = String(sunday.getMonth() + 1).padStart(2, '0');
      const y2 = sunday.getFullYear();
      
      return `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
    } catch (e) {
      return mondayStr;
    }
  };

  const eventTypeOptions: CustomDropdownOption[] = useMemo(() => {
    return TIPOS_EVENTO.map(t => {
      let dot = 'bg-surface-400';
      if (t === 'SEMANA LIVRE') dot = 'bg-emerald-500';
      else if (t.includes('Visita a Congregação')) dot = 'bg-primary-200';
      else if (t.includes('Visita a Grupo')) dot = 'bg-teal-500';
      else if (t.includes('Assembleia')) dot = 'bg-amber-500';
      else if (t.includes('Congresso')) dot = 'bg-orange-500';
      else if (t.includes('Escola')) dot = 'bg-blue-500';
      else if (t.includes('Licença')) dot = 'bg-rose-500';
      return {
        value: t,
        label: t,
        dot
      };
    });
  }, []);

  const dataInicialOptions: CustomDropdownOption[] = useMemo(() => {
    return DIAS_SEMANA.map(d => {
      const dayNumber = selectedItem ? calculateDate(selectedItem.semana, d).split('/')[0] : '';
      return {
        value: d,
        label: d,
        badge: dayNumber ? `Dia ${dayNumber}` : undefined,
        badgeColor: 'bg-primary-200/15 text-primary-200'
      };
    });
  }, [selectedItem]);

  const dataTerminoOptions: CustomDropdownOption[] = useMemo(() => {
    return DIAS_SEMANA.map(d => {
      const dayNumber = selectedItem ? calculateDate(selectedItem.semana, d).split('/')[0] : '';
      return {
        value: d,
        label: d,
        badge: dayNumber ? `Dia ${dayNumber}` : undefined,
        badgeColor: 'bg-primary-200/15 text-primary-200'
      };
    });
  }, [selectedItem]);

  const grupoOptions: CustomDropdownOption[] = useMemo(() => {
    return sortedCongregations.flatMap(c => 
      (c.grupos || []).map(g => ({
        value: `${c.id}|${g}`,
        label: `${g}`,
        badge: c.nome,
        badgeColor: 'bg-surface-300 text-typography-700'
      }))
    );
  }, [sortedCongregations]);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = async () => {
    const element = document.getElementById('itinerary-table-container');
    if (!element) return;

    setGenerating(true);

    const filename = `Itinerário - ${currentMonthLabel}.pdf`;

    try {
      const { toJpeg } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      element.classList.add('pdf-capture');
      
      const dataUrl = await toJpeg(element, {
        quality: 0.85,
        pixelRatio: 1.5,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      element.classList.remove('pdf-capture');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const pdfBlob = pdf.output('blob');

      // Standard download method (compatible with iframes)
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      await showAlert('Erro ao gerar PDF. Tente novamente.', 'Erro');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!userId) return;

    // Real-time congregations fetch
    const congQuery = query(collection(db, 'congregations'), where('userId', '==', userId));
    const unsubscribeCongs = onSnapshot(congQuery, (snap) => {
      const congList = snap.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome || '',
        cidade: doc.data().cidade || '',
        numero: doc.data().numero || '',
        estado: doc.data().estado || '',
        endereco: doc.data().endereco || '',
        coordenador: doc.data().coordenador || '',
        cep: doc.data().cep || '',
        grupos: doc.data().grupos || []
      })) as Congregation[];
      setCongregations(congList);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'congregations_realtime');
      }
    });

    // Real-time substitutes fetch
    const subQuery = query(collection(db, 'substitutes'), where('userId', '==', userId));
    const unsubscribeSubs = onSnapshot(subQuery, (snap) => {
      setSubstitutes(snap.docs.map(doc => ({ 
        id: doc.id, 
        nome: doc.data().nome || '' 
      })) as Substitute[]);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'substitutes_realtime');
      }
    });

    return () => {
      unsubscribeCongs();
      unsubscribeSubs();
    };
  }, [userId]);

  const initializeItineraries = useCallback(async (existingItems: ItineraryItem[]) => {
    if (initializingRef.current) return;
    
    // Guard against multiple initializations in the same session or if quota is exceeded
    const hasInitialized = sessionStorage.getItem(`itinerariesInit_${userId}`);
    if (hasInitialized || isQuotaExceeded()) return;

    try {
      initializingRef.current = true;
      setInitializing(true);
      sessionStorage.setItem(`itinerariesInit_${userId}`, 'true');
      
      const now = new Date();
      let refYear = now.getFullYear();
      // Service year starts in September (month 8)
      if (now.getMonth() < 8) {
        refYear--;
      }
      
      // Target end date: Sept 1st, 3 years after current service year start
      const targetEndDate = new Date(refYear + 3, 8, 1);
      // Minimum end date: Sept 1, 2028 (3 years from Sept 1, 2025)
      const minEndDate = new Date(2028, 8, 1);
      const finalTargetEndDate = targetEndDate > minEndDate ? targetEndDate : minEndDate;
      
      const startDateStr = '01/09/2025';
      const [startDay, startMonth, startYear] = startDateStr.split('/').map(Number);
      const currentDate = new Date(startYear, startMonth - 1, startDay);
      
      // Normalize existing semanas for comparison
      const existingSemanas = new Set(existingItems.map(item => {
        const s = item.semana || '';
        if (s.includes('/')) {
          const [d, m, y] = s.split('/');
          return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }
        return s;
      }));

      const batch = writeBatch(db);
      let addedCount = 0;
      
      // Find max ordem to continue if adding to existing
      let maxOrdem = 0;
      if (existingItems.length > 0) {
        maxOrdem = Math.max(...existingItems.map(i => i.ordem || 0));
      }

      // Generate weeks until finalTargetEndDate
      while (currentDate < finalTargetEndDate) {
        const d = String(currentDate.getDate()).padStart(2, '0');
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const y = currentDate.getFullYear();
        const semanaStr = `${d}/${m}/${y}`;
        
        if (!existingSemanas.has(semanaStr)) {
          // Use a deterministic ID for base weeks to prevent duplicates
          const docId = `${userId}_${semanaStr.replace(/\//g, '-')}`;
          const newDocRef = doc(db, 'itineraries', docId);
          
          const item: ItineraryItem = {
            semana: semanaStr,
            dataEvento: '',
            evento: '',
            observacoes: '',
            escritorioNotificado: false,
            congregacaoNotificada: false,
            ordem: ++maxOrdem
          };
          batch.set(newDocRef, { ...item, userId });
          addedCount++;
          
          // Firestore batch limit is 500. 3 years is ~156 weeks.
          if (addedCount >= 450) break; 
        }
        
        currentDate.setDate(currentDate.getDate() + 7);
      }
      
      if (addedCount > 0) {
        // Double check quota hasn't been hit recently
        if (isQuotaExceeded()) return;

        await batch.commit();
        // Mark as initialized in user doc to prevent repeated attempts in the same session
        try {
          await updateDoc(doc(db, 'users', userId), { itinerariesInitialized: true });
          localStorage.setItem(`itineraries_initialized_${userId}`, 'true');
        } catch (e) {}
      }
    } catch (error: any) {
      if (auth.currentUser) {
        if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
          setQuotaExceededGlobal();
        }
        handleFirestoreError(error, OperationType.WRITE, 'itineraries_init');
      }
    } finally {
      setInitializing(false);
      initializingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    const q = query(
      collection(db, 'itineraries'), 
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ItineraryItem[];
      
      // Group raw items by week (semana)
      const weeksMap = new Map<string, ItineraryItem[]>();
      rawItems.forEach(item => {
        const s = item.semana || '';
        const list = weeksMap.get(s) || [];
        list.push(item);
        weeksMap.set(s, list);
      });

      // Deduplicate: if a week has events, discard empty placeholders; if entirely empty, keep exactly 1
      const items: ItineraryItem[] = [];
      weeksMap.forEach((weekItems) => {
        const nonEmpty = weekItems.filter(i => !isItemEmpty(i));
        if (nonEmpty.length > 0) {
          items.push(...nonEmpty);
        } else if (weekItems.length > 0) {
          items.push(weekItems[0]);
        }
      });

      // Sort by date (semana is DD/MM/YYYY)
      items.sort((a, b) => {
        try {
          const [da, ma, ya] = a.semana.split('/').map(Number);
          const [db, mb, yb] = b.semana.split('/').map(Number);
          
          if (!da || !ma || !ya || !db || !mb || !yb) {
             return (a.semana || '').localeCompare(b.semana || '');
          }
          
          const dateA = new Date(ya, ma - 1, da).getTime();
          const dateB = new Date(yb, mb - 1, db).getTime();
          
          if (dateA !== dateB) return dateA - dateB;
        } catch (e) {
          return (a.semana || '').localeCompare(b.semana || '');
        }
        
        // If same week (multiple events), use ordem or id as fallback
        if (a.ordem !== b.ordem) return a.ordem - b.ordem;
        return (a.id || '').localeCompare(b.id || '');
      });
      
      setItineraries(items);
      setLoading(false);

      // Check if we need to initialize or backfill
      const hasStartDate = items.some(item => item.semana === '01/09/2025');
      
      // Calculate target end date
      const now = new Date();
      let refYear = now.getFullYear();
      if (now.getMonth() < 8) refYear--;
      const targetEndDate = new Date(refYear + 3, 8, 1);
      const minEndDate = new Date(2028, 8, 1);
      const finalTargetEndDate = targetEndDate > minEndDate ? targetEndDate : minEndDate;

      // Check if we have the end date
      const lastItem = items.length > 0 ? items[items.length - 1] : null;
      let hasFullRange = false;
      if (lastItem) {
        const [ld, lm, ly] = lastItem.semana.split('/').map(Number);
        const lastDate = new Date(ly, lm - 1, ld);
        // Margin of 7 days to account for the last week starting on Monday
        hasFullRange = lastDate.getTime() >= (finalTargetEndDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      }

      const quotaHit = sessionStorage.getItem('firestore_quota_exceeded') === 'true';
      
      if ((!hasStartDate || !hasFullRange) && !initializingRef.current && auth.currentUser && !quotaHit) {
        initializeItineraries(items);
      }
    }, (error: any) => {
      if (auth.currentUser) {
        if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
          sessionStorage.setItem('firestore_quota_exceeded', 'true');
        }
        handleFirestoreError(error, OperationType.GET, 'itineraries');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, user?.itinerariesInitialized, initializeItineraries]);

  const filteredItineraries = useMemo(() => {
    try {
      // First Monday of the viewed month
      const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const firstMonday = new Date(firstOfMonth);
      while (firstMonday.getDay() !== 1) {
        firstMonday.setDate(firstMonday.getDate() + 1);
      }
      firstMonday.setHours(0, 0, 0, 0);

      // Find the first item that is on or after firstMonday
      const startIndex = itineraries.findIndex(item => {
        const [d, m, y] = item.semana.split('/').map(Number);
        const itemDate = new Date(y, m - 1, d);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate >= firstMonday;
      });

      if (startIndex === -1) {
        // If we can't find a starting point, just show the first 27
        return itineraries.slice(0, 27);
      }
      
      return itineraries.slice(startIndex, startIndex + 27);
    } catch (e) {
      return itineraries.slice(0, 27);
    }
  }, [itineraries, viewDate]);

  const currentMonthLabel = `${viewDate.toLocaleDateString('pt-BR', { month: 'long' })} ${viewDate.getFullYear()}`;

  const { canPrev, canNext } = useMemo(() => {
    if (itineraries.length === 0) return { canPrev: false, canNext: false };
    
    // Find min and max dates in itineraries using a more robust approach
    const dates: Date[] = [];
    itineraries.forEach(item => {
      try {
        const [d, m, y] = item.semana.split('/').map(Number);
        if (d && m && y) {
          dates.push(new Date(y, m - 1, d));
        }
      } catch (e) {}
    });
    
    if (dates.length === 0) return { canPrev: false, canNext: false };
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const viewFirstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const minFirstOfMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const maxFirstOfMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    
    return {
      canPrev: viewFirstOfMonth.getTime() > minFirstOfMonth.getTime(),
      canNext: viewFirstOfMonth.getTime() < maxFirstOfMonth.getTime()
    };
  }, [itineraries, viewDate]);

  const handlePrevMonth = () => {
    if (!canPrev) return;
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (!canNext) return;
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setViewDate(getLastMonday());
  };

  const handleChange = async (id: string, field: keyof ItineraryItem, value: any) => {
    setItineraries(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    
    // Save directly to database
    try {
      const docRef = doc(db, 'itineraries', id);
      await updateDoc(docRef, { [field]: value });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'itinerary_update_field');
    }
  };

  const handleRowDoubleClick = (item: ItineraryItem) => {
    setSelectedItem(item);
    setIsAddingNew(false);
    setModalMode('actions');
  };

  const handleAnalysisClick = () => {
    if (selectedItem && (selectedItem.congregacaoId || selectedItem.congregacao)) {
      let cong = congregations.find(c => c.id === selectedItem.congregacaoId);
      if (!cong && selectedItem.congregacao) {
        cong = congregations.find(c => c.nome.trim().toLowerCase() === selectedItem.congregacao!.trim().toLowerCase());
      }

      if (cong) {
        setAnalysisParams({
          congregacao: cong.nome,
          congregacaoId: cong.id,
          data: selectedItem.dataEvento || selectedItem.semana
        });
        setShowAnalysis(true);
        setModalMode(null);
      } else {
        showAlert('Congregação não encontrada no cadastro. Por favor, edite o evento e selecione a congregação novamente.', 'Erro');
      }
    }
  };

  const handleS303Click = () => {
    if (selectedItem && (selectedItem.congregacaoId || selectedItem.congregacao)) {
      let cong = congregations.find(c => c.id === selectedItem.congregacaoId);
      if (!cong && selectedItem.congregacao) {
        cong = congregations.find(c => c.nome.trim().toLowerCase() === selectedItem.congregacao!.trim().toLowerCase());
      }

      if (cong) {
        setS303Params({
          congregacao: cong,
          data: selectedItem.dataEvento || selectedItem.semana,
          substituto: selectedItem.substituto
        });
        setShowS303(true);
        setModalMode(null);
      } else {
        showAlert('Congregação não encontrada no cadastro. Por favor, edite o evento e selecione a congregação novamente.', 'Erro');
      }
    }
  };

  const handleS302Click = () => {
    if (selectedItem && (selectedItem.congregacaoId || selectedItem.congregacao)) {
      // Filter all itineraries that have a congregation and map to the format S302NoticeView expects
      const s302Events = itineraries
        .filter(item => item.congregacaoId || item.congregacao)
        .map(item => {
          let cong = congregations.find(c => c.id === item.congregacaoId);
          if (!cong && item.congregacao) {
            cong = congregations.find(c => c.nome.trim().toLowerCase() === item.congregacao!.trim().toLowerCase());
          }
          return {
            congregacao: cong,
            data: item.dataEvento || item.semana,
            semana: item.semana,
            substituteName: item.substituto
          };
        })
        .filter(event => event.congregacao); // Ensure we found the congregation object

      // Find the index of the selected item in this filtered list
      const initialIndex = s302Events.findIndex(event => 
        (selectedItem.congregacaoId ? event.congregacao?.id === selectedItem.congregacaoId : event.congregacao?.nome.trim().toLowerCase() === selectedItem.congregacao?.trim().toLowerCase()) && 
        event.data === (selectedItem.dataEvento || selectedItem.semana)
      );

      if (s302Events.length > 0) {
        setS302Params({
          events: s302Events,
          initialIndex: initialIndex !== -1 ? initialIndex : 0
        });
        setShowS302(true);
        setModalMode(null);
      } else {
        showAlert('Congregação não encontrada no cadastro. Por favor, edite o evento e selecione a congregação novamente.', 'Erro');
      }
    }
  };

  const handleAppointmentLetterClick = () => {
    if (selectedItem && (selectedItem.congregacaoId || selectedItem.congregacao)) {
      let cong = congregations.find(c => c.id === selectedItem.congregacaoId);
      if (!cong && selectedItem.congregacao) {
        cong = congregations.find(c => c.nome.trim().toLowerCase() === selectedItem.congregacao!.trim().toLowerCase());
      }

      if (cong) {
        setAppointmentLetterParams({
          congregacao: cong,
          data: selectedItem.dataEvento || selectedItem.semana
        });
        setShowAppointmentLetter(true);
        setModalMode(null);
      } else {
        showAlert('Congregação não encontrada no cadastro. Por favor, edite o evento e selecione a congregação novamente.', 'Erro');
      }
    }
  };

  const handleVisitScheduleClick = () => {
    if (selectedItem && (selectedItem.congregacaoId || selectedItem.congregacao)) {
      let cong = congregations.find(c => c.id === selectedItem.congregacaoId);
      if (!cong && selectedItem.congregacao) {
        cong = congregations.find(c => c.nome.trim().toLowerCase() === selectedItem.congregacao!.trim().toLowerCase());
      }
      setVisitScheduleParams({
        congregacaoId: cong?.id || selectedItem.congregacaoId || 'cong_temp',
        congregacaoNome: cong?.nome || selectedItem.congregacao || 'Congregação',
        periodo: selectedItem.dataEvento || selectedItem.semana || 'Semana da Visita'
      });
      setShowVisitSchedule(true);
      setModalMode(null);
    }
  };

  const handleEditClick = () => {
    if (selectedItem) {
      setIsAddingNew(false);
      
      // Infer tipoEvento if it doesn't exist (for existing data)
      let tipo = selectedItem.tipoEvento;
      if (!tipo) {
        if (selectedItem.evento === 'SEMANA LIVRE') tipo = 'SEMANA LIVRE';
        else if (selectedItem.evento === 'SEMANA DE PIONEIRO') tipo = 'SEMANA DE PIONEIRO';
        else if (selectedItem.evento === 'Recebendo visita de pastoreio') tipo = 'Recebendo visita de pastoreio';
        else if (selectedItem.grupo) tipo = 'Visita a Grupo';
        else if (OUTROS_EVENTOS.includes(selectedItem.evento)) tipo = 'Outros Eventos';
        else if (selectedItem.congregacao) tipo = 'Visita a Congregação';
        else tipo = TIPOS_EVENTO[0];
      }

      setEditFormData({
        ...defaultEditFormData,
        dataEvento: selectedItem.dataEvento,
        evento: tipo,
        tipoEvento: tipo,
        observacoes: selectedItem.observacoes,
        dataInicialDia: selectedItem.dataInicialDia || (tipo === 'SEMANA LIVRE' ? 'Segunda-Feira' : 'Terça-Feira'),
        dataTerminoDia: selectedItem.dataTerminoDia || 'Domingo',
        congregacao: selectedItem.congregacao || '',
        congregacaoId: selectedItem.congregacaoId || '',
        substituto: selectedItem.substituto || '',
        grupo: selectedItem.grupo || '',
        outroEvento: selectedItem.outroEvento || (tipo === 'Outros Eventos' ? selectedItem.evento : '')
      });
      setModalMode('edit');
    }
  };

  const handleAddClick = () => {
    if (selectedItem) {
      const isEmpty = isItemEmpty(selectedItem);
      
      if (isEmpty) {
        // If the row is empty, "Adding" is just "Editing" the empty slot
        handleEditClick();
        return;
      }

      setIsAddingNew(true);
      setEditFormData({
        ...defaultEditFormData,
        evento: 'Visita a Congregação',
        tipoEvento: 'Visita a Congregação',
        dataInicialDia: 'Terça-Feira',
        dataTerminoDia: 'Domingo'
      });
      setModalMode('edit');
    }
  };

  const handleDeleteClick = () => {
    setModalMode('confirmDelete');
  };

  const executeDelete = async () => {
    if (selectedItem && selectedItem.id) {
      setSaving(true);
      try {
        // Check if there are other events for this week
        const othersInWeek = itineraries.filter(item => 
          item.semana === selectedItem.semana && item.id !== selectedItem.id && !isItemEmpty(item)
        );

        if (othersInWeek.length > 0) {
          // Delete the document
          await deleteDoc(doc(db, 'itineraries', selectedItem.id));
        } else {
          // Just clear the fields
          const docRef = doc(db, 'itineraries', selectedItem.id);
          await setDoc(docRef, { 
            semana: selectedItem.semana,
            dataEvento: '',
            evento: '',
            observacoes: '',
            escritorioNotificado: false,
            congregacaoNotificada: false,
            ordem: selectedItem.ordem || 0,
            userId,
            dataInicialDia: '',
            dataTerminoDia: '',
            congregacao: '',
            congregacaoId: '',
            substituto: '',
            grupo: '',
            outroEvento: '',
            tipoEvento: ''
          });
        }
        setModalMode(null);
        setSelectedItem(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'itinerary_delete');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleFormSave = async () => {
    if (selectedItem && selectedItem.id) {
      // Validation
      const { evento, congregacao, congregacaoId, grupo, outroEvento } = editFormData;
      
      let isValid = true;
      let message = '';

      if (evento === 'Visita a Congregação') {
        if (!congregacao && !congregacaoId) {
          isValid = false;
          message = 'Por favor, selecione uma congregação para este evento.';
        }
      } else if (evento === 'Visita a Grupo') {
        if (!grupo) {
          isValid = false;
          message = 'Por favor, informe o nome do grupo.';
        }
        if (!congregacao && !congregacaoId) {
          isValid = false;
          message = 'Por favor, selecione a congregação vinculada a este grupo.';
        }
      } else if (evento === 'Outros Eventos') {
        if (!outroEvento) {
          isValid = false;
          message = 'Por favor, selecione ou descreva o outro evento.';
        }
      }

      if (!isValid) {
        showAlert(message, 'Campo Obrigatório');
        return;
      }

      setSaving(true);
      try {
        // Calculate start and end dates in dd/mm/yyyy
        const start = calculateDate(selectedItem.semana, editFormData.dataInicialDia || 'Terça-Feira');
        const end = calculateDate(selectedItem.semana, editFormData.dataTerminoDia || 'Domingo');
        
        // 1. Format Date Range according to rules:
        // - Single day: dd/mm/yyyy
        // - Same month: dd a dd/mm/aa
        // - Different months: dd/mm a dd/mm/aa
        // - Different years: dd/mm/aa a dd/mm/aa
        let dateRange = '';
        if (start && end && start.includes('/') && end.includes('/')) {
          if (start === end) {
            dateRange = start;
          } else {
            const [d1, m1, y1] = start.split('/');
            const [d2, m2, y2] = end.split('/');
            const yy1 = y1.slice(-2);
            const yy2 = y2.slice(-2);

            if (y1 !== y2) {
              dateRange = `${d1}/${m1}/${yy1} a ${d2}/${m2}/${yy2}`;
            } else if (m1 !== m2) {
              dateRange = `${d1}/${m1} a ${d2}/${m2}/${yy2}`;
            } else {
              dateRange = `${d1} a ${d2}/${m1}/${yy2}`;
            }
          }
        }

        // 2. Format Event Name according to rules:
        // - If "SEMANA LIVRE", use that exactly
        // - If "SEMANA DE PIONEIRO", use that exactly
        // - If "Visita a Grupo", use "{Grupo} - {Congregação}"
        // - If "Outros Eventos", use the selected/typed value
        // - If congregation selected: "Nome - Cidade" (if different) or just "Nome" (if same)
        // - Otherwise use the selected event type
        let finalEvento = editFormData.evento || '';
        if (editFormData.evento === 'SEMANA LIVRE') {
          finalEvento = 'SEMANA LIVRE';
        } else if (editFormData.evento === 'SEMANA DE PIONEIRO') {
          finalEvento = 'SEMANA DE PIONEIRO';
        } else if (editFormData.evento === 'Visita a Grupo') {
          finalEvento = `${editFormData.grupo || ''} - ${editFormData.congregacao || ''}`;
        } else if (editFormData.evento === 'Outros Eventos') {
          finalEvento = editFormData.outroEvento || 'Outros Eventos';
        } else if (editFormData.congregacaoId || editFormData.congregacao) {
          const cong = congregations.find(c => 
            editFormData.congregacaoId ? c.id === editFormData.congregacaoId : c.nome === editFormData.congregacao
          );
          if (cong) {
            // Check if name and city are the same (ignoring case)
            if (cong.nome.trim().toLowerCase() === cong.cidade.trim().toLowerCase()) {
              finalEvento = cong.nome;
            } else {
              finalEvento = `${cong.nome} - ${cong.cidade}`;
            }
          } else {
            finalEvento = editFormData.congregacao || '';
          }
        }

        const dataToSave = {
          ...editFormData,
          tipoEvento: editFormData.evento,
          dataEvento: dateRange,
          evento: finalEvento,
          semana: selectedItem.semana,
          ordem: selectedItem.ordem || 0,
          userId
        };

        // If isAddingNew, check if an empty placeholder exists in this week to reuse it
        const emptyPlaceholder = itineraries.find(i => i.semana === selectedItem.semana && isItemEmpty(i));

        if (isAddingNew && !emptyPlaceholder) {
          // Create new document only if there are already other real events in that week
          const newDocRef = doc(collection(db, 'itineraries'));
          await setDoc(newDocRef, dataToSave);
        } else {
          // Update existing document (or reuse the empty placeholder)
          const targetId = (isAddingNew && emptyPlaceholder?.id) ? emptyPlaceholder.id : selectedItem.id;
          const docRef = doc(db, 'itineraries', targetId);
          await setDoc(docRef, dataToSave, { merge: true });
        }

        // Cleanup any extra empty placeholder docs for this same week if any exist
        const extraEmptyDocs = itineraries.filter(i => 
          i.semana === selectedItem.semana && isItemEmpty(i) && i.id !== selectedItem.id
        );
        for (const extra of extraEmptyDocs) {
          if (extra.id) {
            try {
              await deleteDoc(doc(db, 'itineraries', extra.id));
            } catch (e) {}
          }
        }

        setModalMode(null);
        setSelectedItem(null);
        setIsAddingNew(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'itinerary_save');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleBack = () => {
    onBack();
  };

  if (showAnalysis && analysisParams) {
    return (
      <ActivityAnalysisView 
        userId={userId}
        congregationName={analysisParams.congregacao}
        congregationId={analysisParams.congregacaoId}
        visitDate={analysisParams.data}
        onBack={() => setShowAnalysis(false)}
      />
    );
  }

  if (showS303 && s303Params) {
    return (
      <S303ReportView 
        userId={userId}
        congregation={s303Params.congregacao}
        visitDate={s303Params.data}
        substituteName={s303Params.substituto}
        onBack={() => setShowS303(false)}
      />
    );
  }

  if (showS302 && s302Params) {
    return (
      <S302NoticeView 
        userId={userId}
        isAdmin={user?.role === 'admin'}
        events={s302Params.events}
        initialIndex={s302Params.initialIndex}
        onBack={() => setShowS302(false)}
      />
    );
  }

  if (showAppointmentLetter && appointmentLetterParams) {
    return (
      <AppointmentLetterView 
        userId={userId}
        congregation={appointmentLetterParams.congregacao}
        visitDate={appointmentLetterParams.data}
        onBack={() => setShowAppointmentLetter(false)}
      />
    );
  }

  if (showVisitSchedule && visitScheduleParams) {
    return (
      <VisitScheduleManagerView
        userId={userId}
        congregationId={visitScheduleParams.congregacaoId}
        congregationName={visitScheduleParams.congregacaoNome}
        visitPeriod={visitScheduleParams.periodo}
        onBack={() => setShowVisitSchedule(false)}
      />
    );
  }


  const getEventBadgeStyle = (evento?: string, tipoEvento?: string) => {
    if (!evento) return null;
    const ev = evento.toUpperCase();
    
    if (ev === 'SEMANA LIVRE') {
      return {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-500',
        isSpecial: true
      };
    }
    if (ev === 'LICENÇA' || ev === 'AUSÊNCIA') {
      return {
        bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        dot: 'bg-rose-500',
        isSpecial: true
      };
    }
    if (ev.includes('ASSEMBLEIA') || ev.includes('CONGRESSO')) {
      return {
        bg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
        dot: 'bg-amber-500',
        isSpecial: true
      };
    }
    if (ev.includes('ESCOLA') || ev.includes('PIONEIRO')) {
      return {
        bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        dot: 'bg-blue-500',
        isSpecial: true
      };
    }
    if (tipoEvento === 'Visita a Grupo' || ev.includes('VISITA A GRUPO')) {
      return {
        bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        dot: 'bg-purple-500',
        isSpecial: false
      };
    }
    return {
      bg: 'bg-primary-200/15 text-primary-200 border-primary-200/30',
      dot: 'bg-primary-200',
      isSpecial: false
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 print:hidden">
        <button 
          onClick={handleBack}
          className="p-2 sm:p-2.5 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 hover:border-primary-200/50 shrink-0 cursor-pointer"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-typography-900 tracking-tight truncate">
            Itinerários do Circuito
          </h2>
          <p className="text-xs sm:text-sm text-typography-500 truncate mt-0.5">
            Cronograma semanal, visitas a congregações e relatórios oficiais
          </p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-100 rounded-2xl shadow-sm border border-surface-300 overflow-hidden print:overflow-visible print:shadow-none print:border-none"
      >
        {/* Navigation & Actions Top Strip */}
        <div className="bg-surface-200/50 p-3.5 sm:p-4 border-b border-surface-300 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Month Navigation Pill */}
            <div className="flex items-center bg-surface-100 border border-surface-300 rounded-xl p-1 shadow-xs shrink-0">
              <button 
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-200 text-white hover:bg-primary-150 active:scale-95 transition-all uppercase whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
              >
                Hoje
              </button>
              <div className="w-px h-4 bg-surface-300 mx-1 shrink-0" />
              <button 
                type="button"
                onClick={handlePrevMonth}
                disabled={!canPrev}
                className="p-1.5 rounded-lg text-typography-600 hover:text-typography-900 hover:bg-surface-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                title="Mês Anterior"
              >
                <ChevronsLeft size={18} />
              </button>
              <span className="px-2 sm:px-3 text-xs sm:text-sm font-bold text-typography-900 min-w-[120px] sm:min-w-[130px] text-center capitalize select-none">
                {currentMonthLabel}
              </span>
              <button 
                type="button"
                onClick={handleNextMonth}
                disabled={!canNext}
                className="p-1.5 rounded-lg text-typography-600 hover:text-typography-900 hover:bg-surface-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                title="Próximo Mês"
              >
                <ChevronsRight size={18} />
              </button>
            </div>

            {/* Series Progress Indicator */}
            {mainSeriesProgress.label && (
              <div className="flex items-center gap-2 bg-surface-100 border border-surface-300 px-3 py-1.5 rounded-xl text-xs shadow-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary-200 animate-pulse" />
                  <span className="font-bold text-typography-900 uppercase tracking-wide text-[11px] sm:text-xs">
                    Série: {mainSeriesProgress.label}
                  </span>
                </div>
                <div className="h-3 w-px bg-surface-300 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-typography-600 font-medium text-[11px] sm:text-xs">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold">
                    <span>{mainSeriesProgress.visitedCount}</span>
                    <span className="text-[9px] uppercase font-semibold">vis.</span>
                  </span>
                  <span className="text-surface-300">•</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-bold">
                    <span>{mainSeriesProgress.scheduledCount}</span>
                    <span className="text-[9px] uppercase font-semibold">prog.</span>
                  </span>
                  {mainSeriesProgress.pendingCount > 0 && (
                    <>
                      <span className="text-surface-300">•</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold">
                        <span>{mainSeriesProgress.pendingCount}</span>
                        <span className="text-[9px] uppercase font-semibold">pend.</span>
                      </span>
                    </>
                  )}
                  <span className="text-[10px] text-typography-400 font-mono ml-0.5">({mainSeriesProgress.total})</span>
                </div>
              </div>
            )}
          </div>

          {/* Export Actions & View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2 print:hidden self-end sm:self-auto">
            {/* Alternador de Modo: Tabela (com rolagem) vs Lista (Cards) */}
            <div className="flex items-center bg-surface-100 p-0.5 rounded-xl border border-surface-300 shadow-2xs">
              <button 
                type="button"
                onClick={() => handleViewModeChange('table')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table' 
                    ? 'bg-primary-200 text-white shadow-xs' 
                    : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200/60'
                }`}
                title="Modo Tabela (Estilo clássico com rolagem horizontal)"
              >
                <TableIcon size={14} />
                <span>Tabela</span>
              </button>
              <button 
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-primary-200 text-white shadow-xs' 
                    : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200/60'
                }`}
                title="Modo Lista (Cartões e timeline)"
              >
                <LayoutList size={14} />
                <span>Lista</span>
              </button>
            </div>

            <button 
              type="button"
              onClick={handleSavePDF}
              disabled={generating}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-surface-100 hover:bg-surface-200 text-typography-800 border border-surface-300 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {generating ? (
                <Loader2 size={15} className="animate-spin text-primary-200" />
              ) : (
                <FileDown size={15} className="text-primary-200" />
              )}
              <span>{generating ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>
            <button 
              type="button"
              onClick={handlePrint}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-surface-100 hover:bg-surface-200 text-typography-800 border border-surface-300 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer size={15} className="text-typography-600" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="animate-spin text-primary-200" size={40} />
            <span className="text-xs font-medium text-typography-500">Carregando itinerários...</span>
          </div>
        ) : (
          <div id="itinerary-table-container">
            {/* Print-only Header */}
            <div className="hidden print:block mb-6 text-center border-b-2 border-primary-200 pb-4">
              <h1 className="text-2xl font-black text-primary-200 uppercase tracking-tight">Itinerários do Circuito</h1>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{currentMonthLabel}</p>
            </div>

            {/* Modo Lista / Cards (Exibido quando viewMode === 'list') */}
            {viewMode === 'list' && (
              <div className="print:hidden p-3.5 sm:p-4 space-y-3">
                {filteredItineraries.map((item) => {
                const current = isCurrentWeek(item.semana);
                const isCongregation = item.tipoEvento === 'Visita a Congregação' || 
                                      item.tipoEvento === 'Visita a Grupo' ||
                                      (item.evento && (item.evento.includes('Visita a') || item.evento.includes(' - ')));
                
                const eventUpper = item.evento?.toUpperCase() || '';
                const isExcluded = eventUpper === 'SEMANA LIVRE' || eventUpper === 'LICENÇA';
                const canNotify = item.evento?.trim() && !isExcluded;
                const badge = getEventBadgeStyle(item.evento, item.tipoEvento);
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => handleRowDoubleClick(item)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden ${
                      current 
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-primary-200/70 shadow-sm ring-1 ring-primary-200/20' 
                        : 'bg-surface-100 border-surface-300 hover:border-primary-200/40 shadow-2xs'
                    }`}
                  >
                    {current && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary-200 rounded-r" />
                    )}

                    {/* Card Header: Week + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-lg border ${
                          current 
                            ? 'bg-primary-200/15 border-primary-200/30 text-primary-200 font-extrabold' 
                            : 'bg-surface-200/80 border-surface-300 text-typography-600'
                        }`}>
                          Semana {item.semana}
                        </span>
                        {current && (
                          <span className="text-[9px] font-black bg-primary-200 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                            HOJE
                          </span>
                        )}
                      </div>

                      {/* Visit Status Indicator (Bolinha) */}
                      {isCongregation && item.evento && (
                        <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                          {isWeekPast(item.semana) ? (
                            <span 
                              className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs inline-block" 
                              title="Visitada"
                            />
                          ) : current ? (
                            <span 
                              className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-amber-400/40 shadow-xs inline-block" 
                              title="Em andamento"
                            />
                          ) : (
                            <span 
                              className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-2xs inline-block" 
                              title="Semana futura (Programada)"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Event Title & Dates */}
                    <div>
                      {badge?.isSpecial ? (
                        <div className="mb-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {item.evento}
                          </span>
                        </div>
                      ) : (
                        <h4 className="text-sm sm:text-base font-bold text-typography-900 leading-snug">
                          {item.evento || <span className="text-typography-400 italic font-normal">Sem evento programado</span>}
                        </h4>
                      )}
                      {item.dataEvento && (
                        <p className="text-xs text-typography-600 mt-1 flex items-center gap-1.5 font-medium">
                          <Calendar size={13} className="text-typography-400 shrink-0" />
                          <span>{item.dataEvento}</span>
                        </p>
                      )}
                    </div>

                    {/* Substitute & Notes */}
                    {(item.substituto || item.observacoes) && (
                      <div className="text-xs text-typography-600 bg-surface-200/50 p-2.5 rounded-xl border border-surface-300/60 space-y-1">
                        {item.substituto && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                            Substituto: {item.substituto}
                          </div>
                        )}
                        {item.observacoes && (
                          <p className="text-typography-600 italic">
                            {item.observacoes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Notifications & Options */}
                    <div className="flex items-center justify-between pt-2 border-t border-surface-300/80 gap-2">
                      <div className="flex items-center gap-2">
                        {canNotify ? (
                          <>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChange(item.id!, 'escritorioNotificado', !item.escritorioNotificado);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                                item.escritorioNotificado 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 font-semibold' 
                                  : 'bg-surface-200/40 hover:bg-surface-200 text-typography-500 hover:text-typography-800 border-surface-300/70'
                              }`}
                              title={item.escritorioNotificado ? "Escritório: Notificado (Clique para desmarcar)" : "Escritório: Pendente (Clique para confirmar)"}
                            >
                              {item.escritorioNotificado ? (
                                <Check size={12} strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <Circle size={12} className="text-typography-400 shrink-0" />
                              )}
                              <span>Escritório</span>
                            </button>

                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChange(item.id!, 'congregacaoNotificada', !item.congregacaoNotificada);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                                item.congregacaoNotificada 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 font-semibold' 
                                  : 'bg-surface-200/40 hover:bg-surface-200 text-typography-500 hover:text-typography-800 border-surface-300/70'
                              }`}
                              title={item.congregacaoNotificada ? "Congregação: Notificada (Clique para desmarcar)" : "Congregação: Pendente (Clique para confirmar)"}
                            >
                              {item.congregacaoNotificada ? (
                                <Check size={12} strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <Circle size={12} className="text-typography-400 shrink-0" />
                              )}
                              <span>Congr.</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-typography-400 italic">Sem notificações</span>
                        )}
                      </div>

                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowDoubleClick(item);
                        }}
                        className="px-2.5 py-1 bg-primary-200/10 hover:bg-primary-200 text-primary-200 hover:text-white rounded-lg text-xs font-bold border border-primary-200/25 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <FileText size={13} />
                        <span>Opções</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modo Tabela (Visível quando viewMode === 'table' e SEMPRE ativo na impressão) */}
          <div className={`${viewMode === 'table' ? 'block' : 'hidden print:block'} overflow-x-auto pb-4 print:overflow-visible custom-scrollbar`}>
            <div className="min-w-[760px] md:min-w-full">
              <table className="w-full text-left border-collapse border border-surface-300">
                <thead>
                  <tr className="border-b border-surface-300">
                    <th className="p-3 text-xs font-black text-white uppercase tracking-wider border-r border-white/20 w-28 text-center bg-primary-200 shadow-inner">
                      Semana
                    </th>
                    <th className="p-3 text-xs font-bold text-typography-700 uppercase tracking-wider border-r border-surface-300 w-40 text-center bg-surface-200/80">
                      Data do Evento
                    </th>
                    <th className="p-3 text-xs font-bold text-typography-700 uppercase tracking-wider border-r border-surface-300 bg-surface-200/80">
                      Evento
                    </th>
                    <th className="p-3 text-xs font-bold text-typography-700 uppercase tracking-wider border-r border-surface-300 bg-surface-200/80">
                      Observações
                    </th>
                    <th className="p-3 text-xs font-bold text-typography-700 uppercase tracking-wider border-r border-surface-300 w-36 text-center bg-surface-200/80">
                      Notificado
                    </th>
                    <th className="p-3 text-xs font-bold text-typography-700 uppercase tracking-wider w-20 text-center bg-surface-200/80 print:hidden">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItineraries.map((item) => {
                    const current = isCurrentWeek(item.semana);
                    const isCongregation = item.tipoEvento === 'Visita a Congregação' || 
                                          item.tipoEvento === 'Visita a Grupo' ||
                                          (item.evento && (item.evento.includes('Visita a') || item.evento.includes(' - ')));
                    
                    const eventUpper = item.evento?.toUpperCase() || '';
                    const isExcluded = eventUpper === 'SEMANA LIVRE' || eventUpper === 'LICENÇA';
                    const canNotify = item.evento?.trim() && !isExcluded;
                    const badge = getEventBadgeStyle(item.evento, item.tipoEvento);
                    
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => handleRowDoubleClick(item)}
                        onDoubleClick={() => handleRowDoubleClick(item)}
                        className={`border-b border-surface-300 transition-colors cursor-pointer select-none ${
                          current 
                            ? 'bg-amber-500/10 dark:bg-amber-500/15 border-l-4 border-l-primary-200 hover:bg-amber-500/20' 
                            : 'hover:bg-surface-200/40'
                        }`}
                      >
                        <td className={`p-2.5 border-r border-surface-300 ${current ? 'bg-primary-200/15' : 'bg-surface-200/30'}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-extrabold text-center font-mono ${current ? 'text-primary-200' : 'text-typography-900'}`}>
                              {item.semana}
                            </span>
                            {current && (
                              <span className="text-[9px] font-black bg-primary-200 text-white px-2 py-0.5 rounded-full uppercase tracking-wider print:hidden whitespace-nowrap shadow-xs">
                                HOJE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 border-r border-surface-300 text-center text-xs">
                          <div className="text-typography-800 font-semibold">
                            {item.dataEvento || '-'}
                          </div>
                        </td>
                        <td className="p-2.5 border-r border-surface-300">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {badge?.isSpecial ? (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs ${badge.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                  {item.evento}
                                </span>
                              ) : (
                                <span className="font-bold text-typography-900 text-sm truncate print:overflow-visible print:whitespace-normal">
                                  {item.evento || <span className="text-typography-400 italic font-normal text-xs">Vazio...</span>}
                                </span>
                              )}
                            </div>

                            {isCongregation && item.evento && (
                              <div className="shrink-0 flex items-center print:hidden">
                                {isWeekPast(item.semana) ? (
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs inline-block" 
                                    title="Visitada"
                                  />
                                ) : current ? (
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-amber-400/40 shadow-xs inline-block" 
                                    title="Em andamento"
                                  />
                                ) : (
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-2xs inline-block" 
                                    title="Semana futura (Programada)"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 border-r border-surface-300 text-xs text-typography-600">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.substituto && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 shrink-0">
                                Sub: {item.substituto}
                              </span>
                            )}
                            {item.observacoes && (
                              <span className="text-typography-700">{item.observacoes}</span>
                            )}
                            {!item.substituto && !item.observacoes && (
                              <span className="text-typography-400 italic">-</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 border-r border-surface-300 text-center">
                          {canNotify ? (
                            <>
                              {/* Interativo na Tela: Visual Clean e Discreto */}
                              <div className="flex justify-center items-center gap-1.5 print:hidden">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChange(item.id!, 'escritorioNotificado', !item.escritorioNotificado);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-all cursor-pointer active:scale-95 ${
                                    item.escritorioNotificado 
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 font-semibold' 
                                      : 'bg-surface-200/40 hover:bg-surface-200 text-typography-500 hover:text-typography-800 border-surface-300/70 font-medium'
                                  }`}
                                  title={item.escritorioNotificado ? "Escritório: Notificado (Clique para desmarcar)" : "Escritório: Pendente (Clique para confirmar)"}
                                >
                                  {item.escritorioNotificado ? (
                                    <Check size={11} strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <Circle size={11} className="text-typography-400 shrink-0" />
                                  )}
                                  <span>Escritório</span>
                                </button>

                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChange(item.id!, 'congregacaoNotificada', !item.congregacaoNotificada);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-all cursor-pointer active:scale-95 ${
                                    item.congregacaoNotificada 
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 font-semibold' 
                                      : 'bg-surface-200/40 hover:bg-surface-200 text-typography-500 hover:text-typography-800 border-surface-300/70 font-medium'
                                  }`}
                                  title={item.congregacaoNotificada ? "Congregação: Notificada (Clique para desmarcar)" : "Congregação: Pendente (Clique para confirmar)"}
                                >
                                  {item.congregacaoNotificada ? (
                                    <Check size={11} strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <Circle size={11} className="text-typography-400 shrink-0" />
                                  )}
                                  <span>Congr.</span>
                                </button>
                              </div>

                              {/* Exibição para Impressão e PDF: Clean e Legível */}
                              <div className="hidden print:flex flex-col items-center justify-center gap-0.5 text-[9px] leading-tight py-0.5">
                                <div className="flex items-center justify-between w-full max-w-[110px] px-1">
                                  <span className="font-semibold text-gray-700 uppercase text-[8.5px]">Escritório:</span>
                                  {item.escritorioNotificado ? (
                                    <span className="font-bold text-emerald-800 text-[9.5px]">✓</span>
                                  ) : (
                                    <span className="text-gray-400 text-[9.5px]">—</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between w-full max-w-[110px] px-1">
                                  <span className="font-semibold text-gray-700 uppercase text-[8.5px]">Congr.:</span>
                                  {item.congregacaoNotificada ? (
                                    <span className="font-bold text-emerald-800 text-[9.5px]">✓</span>
                                  ) : (
                                    <span className="text-gray-400 text-[9.5px]">—</span>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <span className="text-typography-400 font-bold text-xs select-none">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center print:hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowDoubleClick(item);
                            }}
                            className="p-2 bg-primary-200/10 text-primary-200 hover:bg-primary-200 hover:text-white rounded-xl transition-all border border-primary-200/25 shadow-2xs cursor-pointer"
                            title="Ver Opções e Formulários"
                          >
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-300 relative text-typography-900"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-surface-300 bg-surface-200/40 flex justify-between items-center">
                <h3 className="font-bold text-typography-900 flex items-center gap-2 text-sm sm:text-base">
                  {modalMode === 'actions' ? 'Opções do Evento' : 
                   modalMode === 'confirmDelete' ? 'Confirmar Exclusão' : 
                   isAdding ? 'Adicionar Evento' : 'Editar Evento'}
                </h3>
                <button 
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1 hover:bg-surface-200 text-typography-500 hover:text-typography-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-5">
                {modalMode === 'actions' ? (
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                    {/* Header info badge */}
                    <div className="bg-surface-200/50 p-3 rounded-xl border border-surface-300">
                      <span className="text-[10px] font-bold text-typography-400 uppercase tracking-wider block">
                        Semana Selecionada
                      </span>
                      <span className="text-sm font-bold text-primary-200">
                        {selectedItem?.semana}
                      </span>
                      {selectedItem?.evento && (
                        <p className="text-xs text-typography-700 font-medium truncate mt-0.5">
                          {selectedItem.evento}
                        </p>
                      )}
                    </div>

                    {/* Group 1: Gerenciamento do Evento */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-typography-400 uppercase tracking-wider px-1">
                        Gerenciar Programação
                      </span>
                      
                      <button 
                        type="button"
                        onClick={handleEditClick}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-primary-200/50 hover:bg-surface-200/40 transition-all text-left group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary-200/10 border border-primary-200/20 text-primary-200 flex items-center justify-center shrink-0">
                          {isAdding ? <Plus size={16} /> : <Edit2 size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-typography-900">{isAdding ? 'Adicionar Evento' : 'Editar Evento'}</div>
                          <div className="text-[11px] text-typography-500 truncate">
                            {isAdding ? 'Programar um novo evento' : 'Alterar informações existentes'}
                          </div>
                        </div>
                      </button>

                      {(selectedItem?.evento || selectedItem?.congregacao || selectedItem?.observacoes) && (
                        <button 
                          type="button"
                          onClick={handleAddClick}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Plus size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-typography-900">Adicionar Outro Evento</div>
                            <div className="text-[11px] text-typography-500 truncate">Adicionar evento na mesma semana</div>
                          </div>
                        </button>
                      )}

                      {selectedItem?.evento && (
                        <button 
                          type="button"
                          onClick={handleDeleteClick}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-red-500/50 hover:bg-red-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                            <Trash2 size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-red-600 dark:text-red-400">Excluir Evento</div>
                            <div className="text-[11px] text-typography-500 truncate">Remover evento desta semana</div>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Group 2: Documentos e Relatórios Oficiais */}
                    {selectedItem?.congregacao && (
                      <div className="space-y-1.5 pt-2 border-t border-surface-300">
                        <span className="text-[10px] font-bold text-typography-400 uppercase tracking-wider px-1">
                          Documentos & Formulários Oficiais
                        </span>

                        <button 
                          type="button"
                          onClick={handleVisitScheduleClick}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                            <Calendar size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-typography-900">Semana da Visita</div>
                            <div className="text-[11px] text-typography-500 truncate">Programação de atividades com link para os anciãos</div>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={handleAnalysisClick}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <BarChart3 size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-typography-900">Análise de Atividades</div>
                            <div className="text-[11px] text-typography-500 truncate">Análise das atividades da congregação</div>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={handleS303Click}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileDown size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-typography-900">S-303 Relatório sobre a Visita</div>
                            <div className="text-[11px] text-typography-500 truncate">Relatório do superintendente de circuito</div>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={handleS302Click}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-typography-900">S-302 Aviso de Visitas</div>
                            <div className="text-[11px] text-typography-500 truncate">Aviso oficial de visita ao circuito</div>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={handleAppointmentLetterClick}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Printer size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-typography-900">Carta de Designação/Cancelamento</div>
                            <div className="text-[11px] text-typography-500 truncate">Gerar carta de designação ou cancelamento</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                ) : modalMode === 'confirmDelete' ? (
                  <div className="space-y-5 py-2">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                        <AlertCircle size={32} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-typography-900">Excluir este evento?</h4>
                        <p className="text-xs text-typography-500 mt-1">
                          Esta ação não pode ser desfeita. O evento da semana <span className="font-bold text-typography-700">{selectedItem?.semana}</span> será removido.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button 
                        type="button"
                        onClick={() => setModalMode(null)}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-typography-600 bg-surface-200 hover:bg-surface-300 transition-all text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button"
                        onClick={executeDelete}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-xs transition-all flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : 'Sim, Excluir'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1 pb-36 custom-scrollbar">
                    <div className="text-center pb-2 border-b border-surface-300 mb-2">
                      <h4 className="text-sm sm:text-base font-bold text-primary-200">
                        {selectedItem && getWeekRangeDisplay(selectedItem.semana)}
                      </h4>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                        Tipo de Evento:
                      </label>
                      <CustomDropdown 
                        value={editFormData.evento || ''}
                        onChange={(val) => {
                          const updates: Partial<ItineraryItem> = { 
                            evento: val,
                            congregacao: '',
                            substituto: '',
                            grupo: '',
                            outroEvento: ''
                          };
                          if (val === 'SEMANA LIVRE') {
                            updates.dataInicialDia = 'Segunda-Feira';
                            updates.dataTerminoDia = 'Domingo';
                          } else {
                            updates.dataInicialDia = 'Terça-Feira';
                            updates.dataTerminoDia = 'Domingo';
                          }
                          setEditFormData({ ...editFormData, ...updates });
                        }}
                        options={eventTypeOptions}
                        placeholder="Selecione o tipo de evento..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                          Data Inicial:
                        </label>
                        <CustomDropdown 
                          value={editFormData.dataInicialDia || 'Terça-Feira'}
                          onChange={(val) => setEditFormData({ ...editFormData, dataInicialDia: val })}
                          options={dataInicialOptions}
                          placeholder="Dia inicial..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                          Data de Término:
                        </label>
                        <CustomDropdown 
                          value={editFormData.dataTerminoDia || 'Domingo'}
                          onChange={(val) => setEditFormData({ ...editFormData, dataTerminoDia: val })}
                          options={dataTerminoOptions}
                          placeholder="Dia de término..."
                        />
                      </div>
                    </div>

                    {/* Conditional Fields based on Event Type */}
                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Visita a Grupo') && (
                      <div className="bg-surface-200/60 border border-surface-300 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary-200" />
                            <span className="text-[10px] font-bold text-typography-900 uppercase tracking-wider">
                              Série: {cycleProgress.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-typography-500">
                            {cycleProgress.visited} <span className="opacity-60 uppercase text-[9px]">vis.</span> • {cycleProgress.scheduled} <span className="opacity-60 uppercase text-[9px]">prog.</span> de {cycleProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-surface-300/60 h-1.5 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${cycleProgress.visitedPercent}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`${cycleProgress.visited} visitadas`}
                          />
                          <div 
                            style={{ width: `${cycleProgress.scheduledPercent}%` }}
                            className="bg-sky-500 h-full transition-all"
                            title={`${cycleProgress.scheduled} programadas`}
                          />
                        </div>
                        {pendingCongregations.length > 0 ? (
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold leading-tight">
                              Faltam {pendingCongregations.length} congregações para programar na série.
                            </p>
                            {pendingCongregations.length <= 5 && (
                              <p className="text-[10px] text-typography-500 font-medium leading-tight">
                                Pendentes: {sortedPendingCongregations.map(c => c.nome).join(', ')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight flex items-center gap-1">
                            ✓ Todas as {cycleProgress.total} congregações da série foram programadas/visitadas!
                          </p>
                        )}
                      </div>
                    )}

                    {editFormData.evento === 'Visita a Grupo' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                          Grupo:
                        </label>
                        <CustomDropdown 
                          value={editFormData.congregacaoId && editFormData.grupo ? `${editFormData.congregacaoId}|${editFormData.grupo}` : ''}
                          onChange={(val) => {
                            if (!val) return;
                            const [congId, grupoNome] = val.split('|');
                            const cong = congregations.find(c => c.id === congId);
                            setEditFormData({ 
                              ...editFormData, 
                              grupo: grupoNome,
                              congregacao: cong ? cong.nome : '',
                              congregacaoId: congId
                            });
                          }}
                          options={grupoOptions}
                          placeholder="Selecione um grupo..."
                        />
                      </div>
                    )}

                    {editFormData.evento === 'Outros Eventos' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                          Evento:
                        </label>
                        <div className="relative">
                          <input 
                            list="outros-eventos-list"
                            value={editFormData.outroEvento}
                            onChange={(e) => setEditFormData({ ...editFormData, outroEvento: e.target.value })}
                            placeholder="Digite ou selecione um evento..."
                            className="w-full p-2.5 rounded-xl border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 outline-none transition-all bg-surface-200 text-typography-900 text-sm font-medium"
                          />
                          <datalist id="outros-eventos-list">
                            {OUTROS_EVENTOS.map((oe, idx) => (
                              <option key={idx} value={oe} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}

                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Visita a Grupo' || editFormData.evento === 'Recebendo visita de pastoreio') && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                          Congregação:
                        </label>
                        <CongregationCustomSelect 
                          value={editFormData.congregacaoId || ''}
                          onChange={(val) => {
                            const cong = congregations.find(c => c.id === val);
                            
                            // Warning if repeating
                            const isPending = pendingCongregations.some(p => p.id === val);
                            if (val && !isPending && pendingCongregations.length > 0) {
                              const schedItem = scheduledCongregations.find(s => s.id === val);
                              const pastItem = pastVisitedCongregations.find(p => p.id === val);
                              
                              if (schedItem) {
                                showAlert(
                                  `A congregação "${cong?.nome}" já possui visita programada para a semana de ${schedItem.scheduledDate} nesta série. De acordo com a regra, todas as congregações devem ser visitadas/programadas antes de iniciar uma repetição.`,
                                  'Aviso de Repetição'
                                );
                              } else if (pastItem) {
                                showAlert(
                                  `A congregação "${cong?.nome}" já foi visitada na semana de ${pastItem.visitDate} nesta série. De acordo com a regra, todas as congregações devem ser visitadas antes de iniciar uma repetição.`,
                                  'Aviso de Repetição'
                                );
                              }
                            }

                            setEditFormData({ 
                              ...editFormData, 
                              congregacao: cong ? cong.nome : '',
                              congregacaoId: cong ? cong.id : ''
                            });
                          }}
                          congregations={congregations}
                          pendingCongregations={sortedPendingCongregations}
                          scheduledCongregations={sortedScheduledCongregations}
                          pastVisitedCongregations={sortedPastVisitedCongregations}
                          lastVisitMap={lastVisitMap}
                        />
                      </div>
                    )}

                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Visita a Grupo') && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                          Substituto (se aplicável):
                        </label>
                        <div className="relative">
                          <input 
                            list="substitutes-list"
                            value={editFormData.substituto}
                            onChange={(e) => setEditFormData({ ...editFormData, substituto: e.target.value })}
                            placeholder="Digite ou selecione um substituto..."
                            className="w-full p-2.5 rounded-xl border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 outline-none transition-all bg-surface-200 text-typography-900 text-sm font-medium"
                          />
                          <datalist id="substitutes-list">
                            {substitutes.map(s => (
                              <option key={s.id} value={s.nome} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-typography-600 uppercase tracking-wider">
                        Comentários
                      </label>
                      <textarea 
                        value={editFormData.observacoes}
                        onChange={(e) => setEditFormData({ ...editFormData, observacoes: e.target.value })}
                        placeholder="..."
                        rows={2}
                        className="w-full p-2.5 rounded-xl border border-surface-300 focus:border-primary-200 focus:ring-2 focus:ring-primary-200/15 outline-none transition-all resize-none bg-surface-200 text-typography-900 text-sm font-medium"
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button 
                        type="button"
                        onClick={() => setModalMode(null)}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-typography-600 hover:text-typography-900 bg-surface-200 hover:bg-surface-300 transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <X size={16} /> Cancelar
                      </button>
                      <button 
                        type="button"
                        onClick={handleFormSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl font-bold bg-primary-200 hover:bg-primary-150 active:scale-95 text-white shadow-xs transition-all text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : (isAdding ? 'Adicionar' : 'Salvar Alterações')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm;
            size: A4;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            transform: none !important;
            transition: none !important;
          }
          .print\:hidden {
            display: none !important;
          }
          .print\:flex {
            display: flex !important;
          }
          .print\:block {
            display: block !important;
          }
          .print-visible {
            visibility: visible !important;
            display: block !important;
            width: 100% !important;
            position: relative !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }

        .pdf-capture {
          background-color: white !important;
          color: black !important;
          padding: 20px !important;
        }

        .pdf-capture .print\:hidden {
          display: none !important;
        }

        .pdf-capture .print\:flex {
          display: flex !important;
        }

        .pdf-capture .print\:block {
          display: block !important;
        }

        .pdf-capture .md\:hidden {
          display: none !important;
        }

        .pdf-capture .hidden.md\:block {
          display: block !important;
        }

        .pdf-capture .bg-surface-100,
        .pdf-capture .bg-surface-200 {
          background-color: white !important;
        }

        .pdf-capture .text-typography-900 {
          color: black !important;
        }

        .pdf-capture .text-typography-700,
        .pdf-capture .text-typography-600 {
          color: #374151 !important;
        }

        .pdf-capture .border-surface-300 {
          border-color: #d1d5db !important;
        }

        .pdf-capture .bg-emerald-100 {
          background-color: #d1fae5 !important;
        }

        .pdf-capture .text-emerald-900 {
          color: #064e3b !important;
        }

        .pdf-capture .border-emerald-500 {
          border-color: #10b981 !important;
        }

        .pdf-capture .bg-amber-100 {
          background-color: #fef3c7 !important;
        }

        .pdf-capture .text-amber-950 {
          color: #451a03 !important;
        }

        .pdf-capture .border-amber-400 {
          border-color: #f59e0b !important;
        }

        .pdf-capture .bg-gray-100 {
          background-color: #f3f4f6 !important;
        }

        .pdf-capture .text-gray-600 {
          color: #4b5563 !important;
        }

        .pdf-capture .border-gray-300 {
          border-color: #d1d5db !important;
        }

        .pdf-capture .truncate {
          overflow: visible !important;
          white-space: normal !important;
          text-overflow: clip !important;
        }
      `}</style>
    </div>
  );
}
