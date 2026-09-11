'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Map as MapIcon, 
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Save,
  Loader2,
  CheckCircle2,
  Circle,
  Edit2,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Calendar,
  Info,
  Type,
  Printer,
  BarChart3,
  FileDown,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ActivityAnalysisView from './ActivityAnalysisView';
import S303ReportView from './S303ReportView';
import AppointmentLetterView from './AppointmentLetterView';
import S302NoticeView from './S302NoticeView';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  updateDoc,
  doc, 
  onSnapshot,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <button 
          onClick={handleBack}
          className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-violet-600 bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={22} strokeWidth={3} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">
          Itinerários do Circuito
        </h2>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden print:overflow-visible print:shadow-none print:border-none"
      >
        <div className="bg-violet-600 p-4 text-white flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1">
              <button 
                onClick={handleToday}
                className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors uppercase"
              >
                Hoje
              </button>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button 
                onClick={handlePrevMonth}
                disabled={!canPrev}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Mês Anterior"
              >
                <ChevronsLeft size={18} />
              </button>
              <span className="px-2 text-sm font-medium min-w-[140px] text-center capitalize">
                {currentMonthLabel}
              </span>
              <button 
                onClick={handleNextMonth}
                disabled={!canNext}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próximo Mês"
              >
                <ChevronsRight size={18} />
              </button>
            </div>

            {mainSeriesProgress.label && (
              <div className="flex items-center gap-2 bg-violet-700/80 border border-violet-400/40 px-3 py-1.5 rounded-xl text-xs shadow-inner flex-wrap">
                <span className="font-bold text-amber-300 uppercase tracking-wide">
                  Série: {mainSeriesProgress.label}
                </span>
                <span className="text-violet-200/80 flex items-center gap-1.5 flex-wrap font-medium">
                  <span className="opacity-40">•</span>
                  <span>{mainSeriesProgress.visitedCount} <span className="text-[10px] opacity-70 uppercase">vis.</span></span>
                  <span className="opacity-40">•</span>
                  <span>{mainSeriesProgress.scheduledCount} <span className="text-[10px] opacity-70 uppercase">prog.</span></span>
                  {mainSeriesProgress.pendingCount > 0 && (
                    <>
                      <span className="opacity-40">•</span>
                      <span>{mainSeriesProgress.pendingCount} <span className="text-[10px] opacity-70 uppercase">pend.</span></span>
                    </>
                  )}
                  <span className="opacity-40 text-[10px]">({mainSeriesProgress.total})</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 print:hidden">
            <button 
              onClick={handleSavePDF}
              disabled={generating}
              className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileDown size={16} />
              )}
              {generating ? 'Gerando...' : 'Baixar PDF'}
            </button>
            <button 
              onClick={handlePrint}
              className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <Printer size={16} />
              Imprimir
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-violet-600" size={48} />
          </div>
        ) : (
          <div className="overflow-x-auto pb-8 print:overflow-visible" id="itinerary-table-container">
            <div className="w-full max-w-full bg-white print:w-full print:mx-auto print:p-0 print:shadow-none print-visible">
              {/* Print-only Header */}
              <div className="hidden print:block mb-6 text-center border-b-2 border-violet-600 pb-4">
                <h1 className="text-2xl font-black text-violet-600 uppercase tracking-tight">Itinerários do Circuito</h1>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{currentMonthLabel}</p>
              </div>

              <table className="w-full text-left border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="p-3 text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 w-24 bg-violet-600 text-center">Semana</th>
                    <th className="p-3 text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 w-40 text-center">Data do Evento</th>
                    <th className="p-3 text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300">Evento</th>
                    <th className="p-3 text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300">Observações</th>
                    <th className="p-3 text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 w-24 text-center">Notificado</th>
                    <th className="p-3 text-xs font-bold text-gray-800 uppercase tracking-wider w-20 text-center print:hidden">Ações</th>
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
                    
                    return (
                      <tr 
                        key={item.id} 
                        onDoubleClick={() => handleRowDoubleClick(item)}
                        className={`border-b border-gray-300 transition-colors cursor-pointer select-none ${current ? 'bg-amber-100/40' : 'hover:bg-gray-50'}`}
                      >
                        <td className={`p-2 border-r border-gray-300 ${current ? 'bg-amber-200/30' : ''}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-black text-center p-1 rounded ${current ? 'text-violet-600' : 'text-gray-900'}`}>
                              {item.semana}
                            </span>
                            {current && (
                              <span className="text-[9px] font-black bg-violet-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider print:hidden">
                                HOJE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 border-r border-gray-300 text-center text-xs">
                          <div className="text-gray-900 font-medium">
                            {item.dataEvento || '-'}
                          </div>
                        </td>
                        <td className="p-2 border-r border-gray-300">
                          <div className="text-sm text-gray-900 p-1 break-words flex items-center justify-between gap-2">
                            <span>{item.evento || <span className="text-gray-400 italic">Vazio...</span>}</span>
                            {isCongregation && item.evento && (
                              <div className="shrink-0 flex items-center gap-1 print:hidden" title={isWeekPast(item.semana) ? "Visitada" : current ? "Em andamento" : "Programada"}>
                                {isWeekPast(item.semana) ? (
                                  <span className="text-emerald-500 font-black text-[10px]" title="Visitada">✓</span>
                                ) : current ? (
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Em andamento" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400/50 border border-sky-400" title="Programada" />
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2 border-r border-gray-300 text-xs text-gray-500">
                          <div className="p-1 break-words">
                            {item.substituto && (
                              <span className="font-bold text-indigo-700">Sub: {item.substituto}</span>
                            )}
                            {item.substituto && item.observacoes ? ' - ' : ''}
                            {item.observacoes || (!item.substituto && <span className="text-gray-400 italic">-</span>)}
                          </div>
                        </td>
                        <td className="p-2 border-r border-gray-300">
                          <div className="flex justify-center items-center gap-4">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-bold text-gray-400 uppercase">Escritório</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!canNotify) return;
                                  handleChange(item.id!, 'escritorioNotificado', !item.escritorioNotificado);
                                }}
                                disabled={!canNotify}
                                className={`transition-colors ${!canNotify ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110'} ${item.escritorioNotificado ? 'text-green-600' : 'text-gray-400'}`}
                              >
                                {item.escritorioNotificado ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-bold text-gray-400 uppercase">Congr.</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!canNotify) return;
                                  handleChange(item.id!, 'congregacaoNotificada', !item.congregacaoNotificada);
                                }}
                                disabled={!canNotify}
                                className={`transition-colors ${!canNotify ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110'} ${item.congregacaoNotificada ? 'text-green-600' : 'text-gray-400'}`}
                              >
                                {item.congregacaoNotificada ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowDoubleClick(item);
                            }}
                            className="p-2 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-600 hover:text-white transition-all shadow-sm border border-violet-100"
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
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              {/* Modal Header */}
              <div className={`${modalMode === 'confirmDelete' ? 'bg-red-600' : 'bg-violet-600'} p-3 text-white flex justify-between items-center transition-colors`}>
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  {modalMode === 'actions' ? 'Opções do Evento' : 
                   modalMode === 'confirmDelete' ? 'Confirmar Exclusão' : 
                   isAdding ? 'Adicionar Evento' : 'Editar Evento'}
                </h3>
                <button 
                  onClick={() => setModalMode(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4">
                {modalMode === 'actions' ? (
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <p className="text-xs text-gray-500 mb-2">
                      Semana de <span className="font-bold text-violet-600">{selectedItem?.semana}</span>
                    </p>
                    
                    <button 
                      onClick={handleEditClick}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-violet-600 hover:bg-violet-50 transition-all group"
                    >
                      <div className="bg-violet-100 p-1.5 rounded-lg text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                        {isAdding ? <Plus size={18} /> : <Edit2 size={18} />}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-sm text-gray-800">{isAdding ? 'Adicionar Evento' : 'Editar Evento'}</div>
                        <div className="text-[10px] text-gray-500 leading-tight">
                          {isAdding ? 'Programar um novo evento' : 'Alterar informações existentes'}
                        </div>
                      </div>
                    </button>

                    {(selectedItem?.evento || selectedItem?.congregacao || selectedItem?.observacoes) && (
                      <button 
                        onClick={handleAddClick}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                      >
                        <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <Plus size={18} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-sm text-gray-800">Adicionar Evento</div>
                          <div className="text-[10px] text-gray-500 leading-tight">Adicionar evento na mesma semana</div>
                        </div>
                      </button>
                    )}

                    {selectedItem?.evento && (
                      <button 
                        onClick={handleDeleteClick}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-red-500 hover:bg-red-50 transition-all group"
                      >
                        <div className="bg-red-100 p-1.5 rounded-lg text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors">
                          <Trash2 size={18} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-sm text-gray-800">Excluir Evento</div>
                          <div className="text-[10px] text-gray-500 leading-tight">Remover evento desta semana</div>
                        </div>
                      </button>
                    )}

                    {selectedItem?.congregacao && (
                      <>
                        <div className="border-t border-gray-100 my-1 pt-1" />
                        <button 
                          onClick={handleAnalysisClick}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-amber-500 hover:bg-amber-50 transition-all group"
                        >
                          <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <BarChart3 size={18} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-gray-800">Análise</div>
                            <div className="text-[10px] text-gray-500 leading-tight">Análise das atividades da congregação</div>
                          </div>
                        </button>

                        <button 
                          onClick={handleS303Click}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                        >
                          <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <FileDown size={18} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-gray-800">S-303 Relatório sobre a visita</div>
                            <div className="text-[10px] text-gray-500 leading-tight">Relatório do superintendente de circuito</div>
                          </div>
                        </button>

                        <button 
                          onClick={handleS302Click}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all group"
                        >
                          <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                            <FileText size={18} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-gray-800">S-302 Aviso de Visitas</div>
                            <div className="text-[10px] text-gray-500 leading-tight">Aviso oficial de visita ao circuito</div>
                          </div>
                        </button>

                        <button 
                          onClick={handleAppointmentLetterClick}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-100 hover:border-purple-500 hover:bg-purple-50 transition-all group"
                        >
                          <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <Printer size={18} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-gray-800">Carta de Designação/Cancelamento</div>
                            <div className="text-[10px] text-gray-500 leading-tight">Gerar carta de designação ou cancelamento</div>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                ) : modalMode === 'confirmDelete' ? (
                  <div className="space-y-6 py-2">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                        <AlertCircle size={40} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">Excluir este evento?</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Esta ação não pode ser desfeita. O evento da semana <span className="font-bold text-gray-700">{selectedItem?.semana}</span> será removido.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setModalMode(null)}
                        disabled={saving}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
                      >
                        Não, Cancelar
                      </button>
                      <button 
                        onClick={executeDelete}
                        disabled={saving}
                        className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : 'Sim, Excluir'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="text-center pb-1 border-b border-gray-100 mb-2">
                      <h4 className="text-base font-bold text-violet-600">
                        {selectedItem && getWeekRangeDisplay(selectedItem.semana)}
                      </h4>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        Tipo de Evento:
                      </label>
                      <select 
                        value={editFormData.evento}
                        onChange={(e) => {
                          const val = e.target.value;
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
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white text-gray-900 text-sm font-medium"
                      >
                        {TIPOS_EVENTO.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                          Data inicial:
                        </label>
                        <div className="relative">
                          <select 
                            value={editFormData.dataInicialDia}
                            onChange={(e) => setEditFormData({ ...editFormData, dataInicialDia: e.target.value })}
                            className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white appearance-none pr-8 text-gray-900 text-sm font-medium"
                          >
                            {DIAS_SEMANA.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-red-700 font-serif italic text-[10px]">
                            {selectedItem && calculateDate(selectedItem.semana, editFormData.dataInicialDia || 'Terça-Feira').split('/')[0]}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                          Data de término:
                        </label>
                        <div className="relative">
                          <select 
                            value={editFormData.dataTerminoDia}
                            onChange={(e) => setEditFormData({ ...editFormData, dataTerminoDia: e.target.value })}
                            className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white appearance-none pr-8 text-gray-900 text-sm font-medium"
                          >
                            {DIAS_SEMANA.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-red-700 font-serif italic text-[10px]">
                            {selectedItem && calculateDate(selectedItem.semana, editFormData.dataTerminoDia || 'Domingo').split('/')[0]}
                          </div>
                        </div>
                      </div>
                    </div>

                      {/* Conditional Fields based on Event Type */}
                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Visita a Grupo') && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                              Série: {cycleProgress.label}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-amber-700/80">
                            {cycleProgress.visited} <span className="text-[8px] opacity-60 uppercase font-medium">vis.</span> • {cycleProgress.scheduled} <span className="text-[8px] opacity-60 uppercase font-medium">prog.</span> de {cycleProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200/50 h-1 rounded-full overflow-hidden mb-2 flex shadow-inner">
                          <div 
                            style={{ width: `${cycleProgress.visitedPercent}%` }}
                            className="bg-emerald-500/70 h-full transition-all"
                            title={`${cycleProgress.visited} visitadas (data já passou)`}
                          />
                          <div 
                            style={{ width: `${cycleProgress.scheduledPercent}%` }}
                            className="bg-sky-500/70 h-full transition-all"
                            title={`${cycleProgress.scheduled} programadas (data futura)`}
                          />
                        </div>
                        {pendingCongregations.length > 0 ? (
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-amber-700 font-bold leading-tight">
                              Faltam {pendingCongregations.length} congregações para programar na série.
                            </p>
                            {pendingCongregations.length <= 5 && (
                              <p className="text-[9px] text-amber-600 font-medium leading-tight">
                                Pendentes: {sortedPendingCongregations.map(c => c.nome).join(', ')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[9px] text-emerald-600 font-bold leading-tight flex items-center gap-1">
                            ✓ Todas as {cycleProgress.total} congregações da série foram programadas/visitadas!
                          </p>
                        )}
                      </div>
                    )}

                    {editFormData.evento === 'Visita a Grupo' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                          Grupo:
                        </label>
                        <select 
                          value={editFormData.congregacaoId && editFormData.grupo ? `${editFormData.congregacaoId}|${editFormData.grupo}` : ''}
                          onChange={(e) => {
                            const val = e.target.value;
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
                          className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white text-gray-900 text-sm font-medium"
                        >
                          <option value="">Selecione um grupo...</option>
                          {sortedCongregations.flatMap(c => (c.grupos || []).map(g => ({ nome: g, congNome: c.nome, congId: c.id }))).map((g, idx) => (
                            <option key={idx} value={`${g.congId}|${g.nome}`}>{g.nome} ({g.congNome})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {editFormData.evento === 'Outros Eventos' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                          Evento:
                        </label>
                        <div className="relative">
                          <input 
                            list="outros-eventos-list"
                            value={editFormData.outroEvento}
                            onChange={(e) => setEditFormData({ ...editFormData, outroEvento: e.target.value })}
                            placeholder="Digite ou selecione um evento..."
                            className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white text-gray-900 text-sm font-medium"
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
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                          Congregação:
                        </label>
                        <select 
                          value={editFormData.congregacaoId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
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
                          className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white text-gray-900 text-sm font-medium"
                        >
                          <option value="">Selecione uma congregação...</option>
                          {/* 1. Pendentes / Não programadas nesta série */}
                          {sortedPendingCongregations.length > 0 && (
                            <optgroup label="Pendentes / Não Programadas (Nesta Série - Prioridade)">
                              {sortedPendingCongregations.map(c => {
                                const lastInfo = lastVisitMap.get(c.id);
                                const lastStr = lastInfo ? ` - Última: ${lastInfo.formattedDate}` : ' - Sem visita anterior';
                                return (
                                  <option key={c.id} value={c.id}>
                                    📍 {c.nome} - {c.cidade}{lastStr}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          {/* 2. Visitas Programadas (data futura) */}
                          {sortedScheduledCongregations.length > 0 && (
                            <optgroup label="Visitas Programadas (Nesta Série - Data futura)">
                              {sortedScheduledCongregations.map(c => (
                                <option key={c.id} value={c.id}>
                                  📅 {c.nome} - {c.cidade} (Programada para: {c.scheduledDate})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {/* 3. Já Visitadas (data já passou) */}
                          {sortedPastVisitedCongregations.length > 0 && (
                            <optgroup label="Já Visitadas (Nesta Série - Realizada)">
                              {sortedPastVisitedCongregations.map(c => (
                                <option key={c.id} value={c.id}>
                                  ✓ {c.nome} - {c.cidade} (Visitada em: {c.visitDate})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {/* Fallback if no categorized groups */}
                          {sortedPendingCongregations.length === 0 && sortedScheduledCongregations.length === 0 && sortedPastVisitedCongregations.length === 0 && congregations.map(c => {
                            const lastInfo = lastVisitMap.get(c.id);
                            const lastStr = lastInfo ? `Última: ${lastInfo.formattedDate}` : 'Sem visita anterior';
                            return (
                              <option key={c.id} value={c.id}>
                                {c.nome} - {c.cidade} ({lastStr})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {(editFormData.evento === 'Visita a Congregação' || editFormData.evento === 'Visita a Grupo') && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                          Substituto (se aplicável):
                        </label>
                        <div className="relative">
                          <input 
                            list="substitutes-list"
                            value={editFormData.substituto}
                            onChange={(e) => setEditFormData({ ...editFormData, substituto: e.target.value })}
                            placeholder="Digite ou selecione um substituto..."
                            className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all bg-white text-gray-900 text-sm font-medium"
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
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        COMENTÁRIOS
                      </label>
                      <textarea 
                        value={editFormData.observacoes}
                        onChange={(e) => setEditFormData({ ...editFormData, observacoes: e.target.value })}
                        placeholder="..."
                        rows={2}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-violet-600 outline-none transition-all resize-none bg-white text-gray-900 text-sm font-medium"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setModalMode(null)}
                        className="flex-1 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <X size={16} /> Cancelar
                      </button>
                      <button 
                        onClick={handleFormSave}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg font-bold bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-indigo-200 transition-all text-sm disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : (isAdding ? 'Adicionar' : 'Salvar Alterações')}
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
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Reset transforms for print to avoid animation offsets */
          * {
            transform: none !important;
            transition: none !important;
          }
          .print\:hidden {
            display: none !important;
          }
          .print-visible {
            visibility: visible !important;
            display: block !important;
            width: 100% !important;
            position: relative !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide everything else when printing the itinerary */
          @media print {
            body {
              background: white !important;
            }
          }
        }

        .pdf-capture {
          background-color: white !important;
          color: black !important;
          padding: 20px !important;
        }

        .pdf-capture .bg-\[#violet-600\] {
          background-color: #7c3aed !important;
          color: white !important;
        }

        .pdf-capture .bg-amber-100\/40 {
          background-color: #fef3c7 !important;
        }

        .pdf-capture .text-indigo-700 {
          color: #4338ca !important;
        }

        .pdf-capture .text-green-600 {
          color: #16a34a !important;
        }

        .pdf-capture .border-gray-300 {
          border-color: #d1d5db !important;
        }
      `}</style>
    </div>
  );
}
