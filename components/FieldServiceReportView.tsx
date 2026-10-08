'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  X,
  Save,
  Loader2,
  Calendar as CalendarIcon,
  TrendingUp,
  Target,
  Clock,
  CheckCircle2,
  Share2,
  Copy,
  Trash2,
  Check,
  UserCircle2,
  ExternalLink,
  Edit3,
  Table as TableIcon,
  LayoutList,
  ArrowLeft,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface FieldServiceReportViewProps {
  userId?: string;
  profileId?: string;
  isPublic?: boolean;
  wifeNameProp?: string;
  onBack?: () => void;
}

interface DayData {
  hours: string; // HH:mm
  notes: string;
}

interface MonthlyReport {
  days: { [date: string]: DayData };
  goal: number;
  defaultGoal?: number;
  shifts?: { [weekday: number]: number }; // 0=Dom, 1=Seg... 6=Sab
}

export default function FieldServiceReportView({ userId, profileId, isPublic, wifeNameProp, onBack }: FieldServiceReportViewProps) {
  const { showAlert, showConfirm } = useDialog();
  const getCleanProfileId = () => {
    if (profileId && profileId.trim()) return profileId.trim();
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/public-report/');
      if (parts[1]) {
        return decodeURIComponent(parts[1].split('/')[0].split('?')[0].trim());
      }
    }
    return '';
  };
  const resolvedProfileId = getCleanProfileId();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'tabela' | 'lista'>('tabela');
  const [report, setReport] = useState<MonthlyReport>({ days: {}, goal: 50 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempGoal, setTempGoal] = useState(50);
  const [isSettingAllMonths, setIsSettingAllMonths] = useState(false);
  const [tempShifts, setTempShifts] = useState<{ [key: number]: number }>({
    1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 0: 1
  });
  const [wifeProfile, setWifeProfile] = useState<{ id: string; secretKey: string; wifeName?: string } | null>(null);
  const [wifeName, setWifeName] = useState<string>(wifeNameProp || '');
  const [copyingLink, setCopyingLink] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [editingDay, setEditingDay] = useState<{
    day: number;
    dateKey: string;
    dayName: string;
    hours: string;
    notes: string;
  } | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Sync wifeName if passed as prop
  useEffect(() => {
    if (wifeNameProp && wifeNameProp.trim()) {
      setWifeName(wifeNameProp.trim());
    }
  }, [wifeNameProp]);

  // Load wifeName from personal_data if logged in and not supplied via prop
  useEffect(() => {
    if (!userId || (wifeNameProp && wifeNameProp.trim())) return;

    const loadWifeName = async () => {
      try {
        const pdDocRef = doc(db, 'personal_data', userId);
        const pdSnap = await getDoc(pdDocRef);
        if (pdSnap.exists() && pdSnap.data()?.nomeEsposa) {
          const name = pdSnap.data().nomeEsposa.trim();
          if (name) setWifeName(name);
        } else {
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty && qSnap.docs[0].data()?.nomeEsposa) {
            const name = qSnap.docs[0].data().nomeEsposa.trim();
            if (name) setWifeName(name);
          }
        }
      } catch (err) {
        console.warn('Error fetching wife name from personal_data:', err);
      }
    };

    loadWifeName();
  }, [userId, wifeNameProp]);

  // Load wifeName when in public access mode from shared profile
  useEffect(() => {
    if (!isPublic || !resolvedProfileId) return;

    const loadPublicProfile = async () => {
      try {
        const pDoc = await getDoc(doc(db, 'shared_report_profiles', resolvedProfileId));
        if (pDoc.exists()) {
          const data = pDoc.data();
          if (data?.wifeName) {
            setWifeName(data.wifeName);
          } else if (data?.profileName && data.profileName !== 'esposa') {
            setWifeName(data.profileName);
          }
        }
      } catch (err) {
        console.warn('Error loading public profile data:', err);
      }
    };

    loadPublicProfile();
  }, [isPublic, resolvedProfileId]);

  useEffect(() => {
    if (!userId) return;

    const fetchWifeProfile = async () => {
      try {
        const q = query(
          collection(db, 'shared_report_profiles'),
          where('ownerId', '==', userId),
          where('profileName', '==', 'esposa')
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const d = querySnapshot.docs[0];
          const data = d.data();
          setWifeProfile({ id: d.id, secretKey: data.secretKey, wifeName: data.wifeName });
          if (data.wifeName && !wifeName) {
            setWifeName(data.wifeName);
          } else if (wifeName && data.wifeName !== wifeName) {
            updateDoc(doc(db, 'shared_report_profiles', d.id), { wifeName }).catch(() => {});
          }
        } else {
          setWifeProfile(null);
        }
      } catch (error) {
        console.error("Error fetching wife profile:", error);
      }
    };

    fetchWifeProfile();
  }, [userId, wifeName]);

  const createWifeProfile = async () => {
    setCreatingProfile(true);
    try {
      const secretKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const displayName = wifeName.trim() || 'Esposa';
      const profileData = {
        ownerId: userId,
        profileName: 'esposa',
        wifeName: displayName,
        secretKey,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'shared_report_profiles'), profileData);
      setWifeProfile({ id: docRef.id, secretKey, wifeName: displayName });
    } catch (error) {
      console.error("Error creating wife profile:", error);
      handleFirestoreError(error, OperationType.CREATE, 'shared_report_profiles');
    } finally {
      setCreatingProfile(false);
    }
  };

  const deleteWifeProfile = async () => {
    if (!wifeProfile) return;
    const displayName = wifeName?.trim() ? wifeName.trim() : 'sua esposa';
    const confirmed = await showConfirm(`Tem certeza que deseja desativar o link de ${displayName}? O acesso será perdido imediatamente.`, 'Desativar Link');
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'shared_report_profiles', wifeProfile.id));
      setWifeProfile(null);
    } catch (error) {
      console.error("Error deleting wife profile:", error);
      handleFirestoreError(error, OperationType.DELETE, `shared_report_profiles/${wifeProfile.id}`);
    }
  };

  const copyWifeLink = () => {
    if (!wifeProfile) return;
    const url = `${window.location.origin}/public-report/${wifeProfile.id}`;
    navigator.clipboard.writeText(url);
    setCopyingLink(true);
    setTimeout(() => setCopyingLink(false), 2000);
  };

  const monthYearKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
  const reportDocId = isPublic 
    ? `shared_${resolvedProfileId}_${monthYearKey}` 
    : `${userId}_${monthYearKey}`;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Seg, 6=Dom)
  };

  const daysInMonthCount = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  useEffect(() => {
    if (!userId && !resolvedProfileId) return;

    setLoading(true);
    const docRef = doc(db, 'service_reports', reportDocId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedGoal = data.goal !== undefined ? data.goal : (data.defaultGoal || 50);
        const loadedShifts = data.shifts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
        // Ensure all keys exist
        const fullShifts = { ...{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 }, ...loadedShifts };
        setReport({
          days: data.days || {},
          goal: loadedGoal,
          defaultGoal: data.defaultGoal || 50,
          shifts: fullShifts
        });
        setTempGoal(loadedGoal);
        setTempShifts(fullShifts);
      } else {
        setReport(prev => {
          const currentShifts = prev.shifts && Object.values(prev.shifts).some(v => (v as number) > 0)
            ? prev.shifts
            : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
          const defaultGoal = prev.defaultGoal || 50;
          setTempGoal(defaultGoal);
          setTempShifts(currentShifts);
          return { days: {}, goal: defaultGoal, defaultGoal, shifts: currentShifts };
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading report:", error);
      handleFirestoreError(error, OperationType.GET, `service_reports/${reportDocId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, resolvedProfileId, reportDocId]);

  const openDayModal = (day: number) => {
    const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const dObj = new Date(currentYear, currentMonth, day);
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayData = report.days[dateKey] || { hours: '', notes: '' };
    setEditingDay({
      day,
      dateKey,
      dayName: dayNames[dObj.getDay()],
      hours: dayData.hours || '',
      notes: dayData.notes || ''
    });
  };

  const handleSaveDayModal = async () => {
    if (!editingDay) return;
    setSavingDay(true);
    setSaveStatus('saving');
    try {
      const activeId = userId || resolvedProfileId || 'shared';
      const docRef = doc(db, 'service_reports', reportDocId);

      const newDays = {
        ...report.days,
        [editingDay.dateKey]: {
          hours: editingDay.hours,
          notes: editingDay.notes
        }
      };

      setReport(prev => ({ ...prev, days: newDays }));

      await setDoc(docRef, {
        days: newDays,
        goal: report.goal,
        defaultGoal: report.defaultGoal || 50,
        shifts: report.shifts || {},
        userId: activeId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveStatus('saved');
      setEditingDay(null);
    } catch (error) {
      console.error("Error saving day from modal:", error);
      handleFirestoreError(error, OperationType.UPDATE, `service_reports/${reportDocId}`);
      setSaveStatus('error');
    } finally {
      setSavingDay(false);
    }
  };

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      const activeId = userId || resolvedProfileId || 'shared';
      const docRef = doc(db, 'service_reports', reportDocId);
      await setDoc(docRef, {
        days: report.days,
        goal: report.goal,
        defaultGoal: report.defaultGoal || 50,
        shifts: report.shifts || {},
        userId: activeId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaveStatus('saved');
    } catch (error) {
      console.error("Error manual saving report:", error);
      handleFirestoreError(error, OperationType.UPDATE, `service_reports/${reportDocId}`);
      setSaveStatus('error');
    }
  };

  const updateDayData = (dateKey: string, field: keyof DayData, value: string) => {
    const newDays = { ...report.days };
    if (!newDays[dateKey]) {
      newDays[dateKey] = { hours: '', notes: '' };
    }
    newDays[dateKey][field] = value;

    setReport(prev => ({ ...prev, days: newDays }));
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const activeId = userId || resolvedProfileId || 'shared';
        const docRef = doc(db, 'service_reports', reportDocId);
        await setDoc(docRef, {
          days: newDays,
          goal: report.goal,
          defaultGoal: report.defaultGoal || 50,
          shifts: report.shifts || {},
          userId: activeId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSaveStatus('saved');
      } catch (error) {
        console.error("Error saving day data:", error);
        handleFirestoreError(error, OperationType.UPDATE, `service_reports/${reportDocId}`);
        setSaveStatus('error');
      }
    }, 600);
  };

  const handleSaveGoal = async () => {
    setSaving(true);
    try {
      const activeId = userId || resolvedProfileId || 'shared';
      const docRef = doc(db, 'service_reports', reportDocId);

      const updateData: any = {
        userId: activeId,
        shifts: tempShifts,
        goal: tempGoal
      };
      if (isSettingAllMonths) {
        updateData.defaultGoal = tempGoal;
      }

      // 1. Atualização otimista imediata para feedback instantâneo no calendário
      setReport(prev => ({
        ...prev,
        goal: tempGoal,
        defaultGoal: isSettingAllMonths ? tempGoal : (prev.defaultGoal || 50),
        shifts: { ...tempShifts }
      }));

      // 2. Persistência no Firestore
      await setDoc(docRef, updateData, { merge: true });

      // 3. Fechar modal de configurações
      setShowSettings(false);
      setIsSettingAllMonths(false);
    } catch (error) {
      console.error("Error saving goal:", error);
      handleFirestoreError(error, OperationType.UPDATE, `service_reports/${reportDocId}`);
      // Fecha o diálogo para não travar a tela da usuária mesmo em instabilidades de rede
      setShowSettings(false);
    } finally {
      setSaving(false);
    }
  };

  const timeToMinutes = (time: string) => {
    if (!time || !time.includes(':')) return 0;
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const minutesToTime = (totalMinutes: number) => {
    const isNegative = totalMinutes < 0;
    const absoluteMinutes = Math.abs(totalMinutes);
    const h = Math.floor(absoluteMinutes / 60);
    const m = absoluteMinutes % 60;
    return `${isNegative ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
  };

  // Stats calculation
  const totalMinutesDone = Object.values(report.days).reduce((acc, day) => acc + timeToMinutes(day.hours), 0);
  const goalMinutes = report.goal * 60;
  const minutesRemaining = goalMinutes - totalMinutesDone;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const isFutureMonth = (currentYear > today.getFullYear()) || (currentYear === today.getFullYear() && currentMonth > today.getMonth());
  const isPastMonth = (currentYear < today.getFullYear()) || (currentYear === today.getFullYear() && currentMonth < today.getMonth());

  // Shift-based calculation
  const isShiftPlanningActive = Object.values(report.shifts || {}).some(v => (v as number) > 0);
  let totalRemainingShifts = 0;
  let remainingDaysCount = 0;
  const startDate = isCurrentMonth ? today.getDate() : 1;
  const daysInMonthArray = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

  const todayDateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const hasHoursToday = report.days[todayDateKey]?.hours && report.days[todayDateKey]?.hours !== '0:00' && report.days[todayDateKey]?.hours !== '00:00';
  const isTodayRemaining = isCurrentMonth && !hasHoursToday;

  if (!isPastMonth) {
    for (let d = startDate; d <= daysInMonthCount; d++) {
      const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const hasHours = report.days[dateKey]?.hours && report.days[dateKey]?.hours !== '0:00' && report.days[dateKey]?.hours !== '00:00';

      if (hasHours) continue;

      const dObj = new Date(currentYear, currentMonth, d);
      const dayOfWeek = dObj.getDay();
      totalRemainingShifts += (report.shifts?.[dayOfWeek] ?? 0);
      remainingDaysCount++;
    }
  }

  const minutesPerShift = totalRemainingShifts > 0
    ? Math.max(0, minutesRemaining / totalRemainingShifts)
    : 0;

  const minutesPerDay = (!isShiftPlanningActive && remainingDaysCount > 0)
    ? Math.max(0, minutesRemaining / remainingDaysCount)
    : 0;

  const roundedPace = Math.round(minutesPerShift);
  let paceLabel = 'Suave';
  let paceBadgeColor = 'bg-emerald-500';
  let paceTextColor = 'text-emerald-400';
  let paceShadow = 'shadow-[0_0_10px_rgba(16,185,129,0.5)]';

  if (roundedPace > 100) {
    paceLabel = 'Intenso';
    paceBadgeColor = 'bg-red-500';
    paceTextColor = 'text-red-400';
    paceShadow = 'shadow-[0_0_10px_rgba(239,68,68,0.5)]';
  } else if (roundedPace >= 60) {
    paceLabel = 'Moderado';
    paceBadgeColor = 'bg-orange-500';
    paceTextColor = 'text-orange-400';
    paceShadow = 'shadow-[0_0_10px_rgba(249,115,22,0.5)]';
  }

  const shiftsPlannedToday = report.shifts?.[today.getDay()] ?? 0;
  const minutesTodayTarget = isTodayRemaining
    ? (isShiftPlanningActive ? (minutesPerShift * shiftsPlannedToday) : minutesPerDay)
    : 0;

  // Chart data preparation
  const chartData = daysInMonthArray.map(day => {
    const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const dayMinutes = timeToMinutes(report.days[dateKey]?.hours || '');

    // Calculate cumulative hours
    let cumulative = 0;
    for (let d = 1; d <= day; d++) {
      const key = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      cumulative += timeToMinutes(report.days[key]?.hours || '');
    }

    // Target cumulative line (simple linear)
    const targetCumulative = (report.goal / daysInMonthCount) * day;

    return {
      name: day.toString(),
      horas: (dayMinutes / 60).toFixed(1),
      acumulado: (cumulative / 60).toFixed(1),
      meta: targetCumulative.toFixed(1)
    };
  });

  const percentComplete = Math.min(100, Math.max(0, (totalMinutesDone / goalMinutes) * 100));

  const wifeDisplayName = wifeName?.trim() ? wifeName.trim() : 'Esposa';

  return (
    <div className="space-y-6 pb-16 print:p-0 print:m-0 print:space-y-0">
      {/* Top Header Row (no-print) */}
      <div className="space-y-3 no-print">
        <div className="flex items-center justify-between gap-3 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex-wrap relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-transparent" />
          <div className="flex items-center gap-3 min-w-0">
            {!isPublic && onBack && (
              <button
                onClick={onBack}
                className="h-9 w-9 sm:h-10 sm:w-10 p-1.5 sm:p-2 hover:bg-surface-200 active:scale-95 rounded-xl transition-all text-typography-900 bg-surface-200/80 shadow-xs border border-surface-300 flex items-center justify-center shrink-0 cursor-pointer"
                title="Voltar para Diversos"
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
              </button>
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-none truncate">
                  {isPublic ? `Relatório de ${wifeDisplayName}` : 'Relatório de Pregação'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 shrink-0">
                  {isPublic ? 'Esposa' : 'Mensal'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate mt-0.5">
                {isPublic ? `Acesso independente de ${wifeDisplayName}` : 'Gestão mensal de horas e metas'}
              </p>
            </div>
          </div>

          {/* Mês Seletor */}
          <div className="flex items-center gap-1 bg-surface-200/80 p-0.5 rounded-xl border border-surface-300 shadow-2xs">
            <button
              onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-surface-100 text-typography-600 hover:text-typography-900 transition-colors cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <div className="px-2 sm:px-3 flex items-center gap-1.5 min-w-[120px] justify-center">
              <span className="text-xs sm:text-sm font-black text-typography-900 capitalize">{monthNames[currentMonth]}</span>
              <span className="text-[10px] font-bold text-typography-400">{currentYear}</span>
            </div>
            <button
              onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-surface-100 text-typography-600 hover:text-typography-900 transition-colors cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Alternador de Modo: Tabela vs Lista */}
          <div className="flex items-center bg-surface-200/80 p-0.5 rounded-xl border border-surface-300 shadow-2xs">
            <button
              onClick={() => setViewMode('tabela')}
              className={`h-8 sm:h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'tabela'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Modo Calendário/Tabela"
            >
              <TableIcon size={14} />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('lista')}
              className={`h-8 sm:h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Modo Lista (Ideal para celular)"
            >
              <LayoutList size={14} />
              <span>Lista</span>
            </button>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
            {isPublic && (
              <>
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-xl text-xs font-bold shadow-xs">
                    <Loader2 size={13} className="animate-spin text-amber-600" />
                    <span className="hidden sm:inline">Salvando...</span>
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-xl text-xs font-bold shadow-xs" title="Todos os dados estão salvos">
                    <Check size={13} strokeWidth={3} className="text-emerald-600" />
                    <span className="hidden sm:inline">Salvo</span>
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-xl text-xs font-bold shadow-xs">
                    <X size={13} strokeWidth={3} className="text-rose-600" />
                    <span className="hidden sm:inline">Erro</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  title="Salvar imediatamente todas as atividades no banco de dados"
                >
                  {saveStatus === 'saving' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>Salvar</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-typography-700 bg-surface-200/80 hover:bg-surface-200 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Imprimir relatório"
            >
              <Printer size={14} className="shrink-0 text-typography-500" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-typography-700 bg-surface-200/80 hover:bg-surface-200 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title={isPublic ? "Configurar Meta e Turnos" : "Configurações do Relatório"}
            >
              <Settings2 size={14} className="shrink-0 text-typography-500" />
              <span className="hidden sm:inline">Configurar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full space-y-8">
        {/* Main Content: Tabela (Calendário) ou Lista Responsiva */}
        <motion.div
          ref={calendarRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col w-full"
        >
          {viewMode === 'lista' ? (
            /* Modo Lista Responsiva para Celular / Visual Clean */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {daysInMonthArray.map(day => {
                  const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                  const dayData = report.days[dateKey] || { hours: '', notes: '' };
                  const isToday = isCurrentMonth && day === today.getDate();
                  const dObj = new Date(currentYear, currentMonth, day);
                  const dayOfWeek = dObj.getDay();
                  const isPlanned = (report.shifts?.[dayOfWeek] ?? 0) > 0;
                  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

                  return (
                    <div
                      key={day}
                      className={`p-3.5 rounded-2xl border transition-all bg-surface-100 flex flex-col justify-between gap-2.5 shadow-2xs ${
                        isToday 
                          ? 'border-primary-200 ring-2 ring-primary-200/20 bg-primary-200/5' 
                          : 'border-surface-300 hover:border-surface-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                            isToday ? 'bg-primary-200 text-white' : 'bg-surface-200 text-typography-900'
                          }`}>
                            {day.toString().padStart(2, '0')}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-typography-900 truncate">
                              {dayNames[dayOfWeek]}
                            </span>
                            <span className="text-[10px] text-typography-400 uppercase font-medium">
                              {monthNames[currentMonth].slice(0, 3)} {currentYear}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPlanned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Planejado
                            </span>
                          )}
                          {isPublic && (
                            <button
                              type="button"
                              onClick={() => openDayModal(day)}
                              className="p-1 rounded-lg hover:bg-surface-200 text-typography-400 hover:text-typography-900 transition-colors"
                              title="Editar em janela"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-surface-300/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-typography-400">Horas:</span>
                          <input
                            type="text"
                            value={dayData.hours}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9:]/g, '');
                              if (val.length <= 5) updateDayData(dateKey, 'hours', val);
                            }}
                            onBlur={(e) => {
                              let val = e.target.value;
                              if (val && !val.includes(':')) {
                                updateDayData(dateKey, 'hours', `${val}:00`);
                              }
                            }}
                            placeholder={
                              isShiftPlanningActive
                                ? (isPlanned ? minutesToTime(Math.round((report.shifts?.[dayOfWeek] ?? 0) * minutesPerShift)) : "0:00")
                                : minutesToTime(Math.round(minutesPerDay))
                            }
                            className="w-24 text-right px-2.5 py-1 rounded-xl bg-surface-200/70 border border-surface-300 font-black text-sm text-typography-900 tracking-tight outline-none focus:border-primary-200 focus:bg-surface-100 transition-all placeholder:text-typography-400/50"
                          />
                        </div>

                        <input
                          type="text"
                          value={dayData.notes}
                          onChange={(e) => updateDayData(dateKey, 'notes', e.target.value)}
                          placeholder="Nota ou atividade..."
                          className="w-full px-2.5 py-1 rounded-xl bg-surface-200/40 border border-transparent hover:border-surface-300 focus:border-primary-200/60 focus:bg-surface-100 text-xs text-typography-700 outline-none transition-all placeholder:text-typography-400/60"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Modo Calendário/Tabela */
            <div className="bg-surface-100 rounded-3xl border border-surface-300 shadow-xs p-3 sm:p-5 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar-wide pb-2">
                <div className="min-w-[700px] flex flex-col gap-3">
                  {/* Calendar Header Navigation */}
                  <header className="bg-surface-200/90 rounded-2xl p-1.5 border border-surface-300/80 shadow-2xs" data-purpose="calendar-header">
                    <nav className="grid grid-cols-7 items-center h-10 text-typography-700 font-extrabold text-xs uppercase tracking-wider">
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day) => (
                        <div key={day} className="text-center py-1">
                          {day}
                        </div>
                      ))}
                    </nav>
                  </header>

                  {/* Calendar Grid */}
                  <div className="calendar-grid bg-surface-100 rounded-2xl overflow-hidden border-l border-t border-surface-300 shadow-2xs">
                    <div className="grid grid-cols-7">
                    {/* Empty cells from previous month */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`pad-${i}`} className="calendar-cell bg-surface-200/30 p-4 border-r border-b border-surface-300" />
                    ))}

                    {/* Monthly Days */}
                    {daysInMonthArray.map(day => {
                      const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                      const dayData = report.days[dateKey] || { hours: '', notes: '' };
                      const isToday = isCurrentMonth && day === today.getDate();
                      const dObj = new Date(currentYear, currentMonth, day);
                      const dayOfWeek = dObj.getDay();
                      const isPlanned = (report.shifts?.[dayOfWeek] ?? 0) > 0;
                      const hasHours = dayData.hours && dayData.hours !== '0:00' && dayData.hours !== '00:00';
                      const isWeekend = (firstDay + day - 1) % 7 >= 5;

                      return (
                        <div
                          key={day}
                          className={`calendar-cell p-3 sm:p-4 flex flex-col transition-all duration-200 group relative border-r border-b border-surface-300 hover:bg-surface-200/40 ${isWeekend ? 'bg-surface-200/20' : 'bg-surface-100'} ${isToday ? 'bg-primary-200/5 ring-2 ring-inset ring-primary-200 z-10' : ''}`}
                        >
                          {/* Day Header */}
                          <div 
                            onClick={() => {
                              if (isPublic) openDayModal(day);
                            }}
                            className={`w-full flex justify-between items-start mb-2 ${isPublic ? 'cursor-pointer group/header hover:opacity-80 transition-opacity' : ''}`}
                            title={isPublic ? "Toque para abrir formulário do dia" : undefined}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`font-black text-sm ${isToday ? 'text-primary-200 font-extrabold' : 'text-typography-700'}`}>
                                {day.toString().padStart(2, '0')}
                              </span>
                              {isPublic && (
                                <span className="opacity-0 group-hover/header:opacity-100 sm:group-hover:opacity-80 transition-opacity text-primary-200">
                                  <Edit3 size={12} />
                                </span>
                              )}
                            </div>
                            {isPlanned && (
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm ring-2 ring-emerald-500/30" title="Serviço programado" />
                            )}
                          </div>

                          {/* Content Area */}
                          <div className="flex-1 flex flex-col items-center justify-between gap-1 overflow-hidden">
                            <input
                              type="text"
                              value={dayData.hours}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9:]/g, '');
                                if (val.length <= 5) updateDayData(dateKey, 'hours', val);
                              }}
                              onBlur={(e) => {
                                let val = e.target.value;
                                if (val && !val.includes(':')) {
                                  updateDayData(dateKey, 'hours', `${val}:00`);
                                }
                              }}
                              placeholder={
                                isShiftPlanningActive
                                  ? (isPlanned ? minutesToTime(Math.round((report.shifts?.[dayOfWeek] ?? 0) * minutesPerShift)) : "0:00")
                                  : minutesToTime(Math.round(minutesPerDay))
                              }
                              className="w-full text-center text-xl sm:text-2xl font-black text-typography-900 tracking-tight bg-transparent border-none outline-none p-0 placeholder:text-typography-400/40"
                            />

                            <textarea
                              value={dayData.notes}
                              onChange={(e) => updateDayData(dateKey, 'notes', e.target.value)}
                              placeholder="Nota..."
                              rows={2}
                              className="w-full text-center text-[10px] text-typography-600 italic leading-tight bg-transparent border-none outline-none resize-none px-1 overflow-y-auto no-scrollbar placeholder:opacity-0 group-hover:placeholder:opacity-40 focus:placeholder:opacity-40"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          <footer className="mt-4 flex flex-col sm:flex-row justify-between items-center px-2 gap-4 text-typography-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-xs"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-typography-500">Dias com serviço programado</span>
            </div>
            <div className="text-[11px] font-medium text-typography-400 text-center sm:text-right">
              {isPublic 
                ? "* Toque no número do dia para abrir o formulário ou edite diretamente."
                : "* Edite as horas e notas diretamente no formulário."}
            </div>
          </footer>
        </motion.div>

        {/* Bottom Section: Stats & Progress Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Sidebar Panel - Stats & Dynamic Goal */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-4 sm:space-y-6 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6">
              {/* Progress Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-surface-100 rounded-3xl p-5 sm:p-7 shadow-xs border border-surface-300 relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-transparent" />
                <div className="relative z-10 space-y-5">
                  <div className="flex justify-between items-start">
                    <div className="bg-primary-200/10 p-2.5 sm:p-3 rounded-2xl text-primary-200 border border-primary-200/20">
                      <Target size={22} />
                    </div>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="text-[11px] font-extrabold uppercase tracking-wider text-primary-200 bg-primary-200/10 hover:bg-primary-200 hover:text-white px-3.5 py-1.5 rounded-full transition-all border border-primary-200/20 cursor-pointer active:scale-95"
                    >
                      Meta: {report.goal}h
                    </button>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-typography-900 leading-none">{minutesToTime(totalMinutesDone)}</span>
                      <span className="text-xs font-bold text-typography-400 uppercase tracking-wider">horas totais</span>
                    </div>
                    <p className="text-sm font-medium text-typography-500">Progresso realizado este mês</p>
                  </div>

                  <div className="space-y-3">
                    <div className="h-3.5 bg-surface-200 rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentComplete}%` }}
                        transition={{ duration: 1, ease: "circOut" }}
                        className="h-full bg-primary-200 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="text-primary-200 font-extrabold">{percentComplete.toFixed(0)}% Concluído</span>
                      <span className="text-typography-600">{minutesToTime(minutesRemaining)} restantes</span>
                    </div>
                  </div>

                  {/* Link do Relatório de [Esposa] - Abaixo da Linha de Progressão */}
                  {!isPublic && (
                    <div className="pt-5 border-t border-surface-300 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Share2 size={15} className="text-primary-200" />
                          <span className="text-xs font-bold uppercase tracking-wider text-typography-800">
                            Link de {wifeDisplayName}
                          </span>
                        </div>
                        {wifeProfile && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ativo
                          </span>
                        )}
                      </div>

                      {!wifeProfile ? (
                        <button
                          type="button"
                          onClick={createWifeProfile}
                          disabled={creatingProfile}
                          className="w-full py-3 px-4 bg-surface-200/60 hover:bg-surface-200 text-typography-700 rounded-2xl border border-dashed border-surface-300 flex items-center justify-center gap-2 transition-all font-bold text-xs group shadow-2xs cursor-pointer active:scale-95"
                        >
                          {creatingProfile ? (
                            <Loader2 className="animate-spin text-primary-200" size={16} />
                          ) : (
                            <>
                              <UserCircle2 size={16} className="text-typography-400 group-hover:text-primary-200 transition-colors" />
                              <span>Gerar link exclusivo para {wifeDisplayName}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-surface-200/70 p-1.5 rounded-xl border border-surface-300">
                            <input
                              type="text"
                              readOnly
                              value={typeof window !== 'undefined' ? `${window.location.origin}/public-report/${wifeProfile.id}` : ''}
                              className="flex-1 bg-transparent text-[11px] font-mono text-typography-700 outline-none px-2 select-all truncate"
                            />
                            <button
                              type="button"
                              onClick={copyWifeLink}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                                copyingLink 
                                  ? 'bg-emerald-600 text-white shadow-2xs' 
                                  : 'bg-primary-200 text-white hover:bg-primary-200/90 shadow-2xs'
                              }`}
                              title="Copiar link"
                            >
                              {copyingLink ? (
                                <>
                                  <Check size={13} />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                            <a
                              href={`/public-report/${wifeProfile.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-typography-400 hover:text-primary-200 hover:bg-surface-100 rounded-lg transition-colors shrink-0"
                              title={`Abrir relatório de ${wifeDisplayName} em nova aba`}
                            >
                              <ExternalLink size={15} />
                            </a>
                          </div>
                          <p className="text-[11px] text-typography-400 italic leading-snug">
                            Envie este link para {wifeDisplayName}. Ela registrará o relatório dela de forma independente sem precisar fazer login.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Dynamic Suggestion Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-surface-100 rounded-3xl p-5 sm:p-7 shadow-xs border border-surface-300 relative overflow-hidden group"
              >
                <div className="relative z-10 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-200/10 p-2.5 rounded-xl text-primary-200 border border-primary-200/20">
                      <TrendingUp size={18} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-typography-500">Sugestão Dinâmica</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black tracking-tight ${paceTextColor} font-mono leading-none`}>
                          {minutesToTime(Math.round(minutesPerShift))}
                        </span>
                        <span className="text-xs font-bold text-typography-400 uppercase tracking-wider">/ turno</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black tracking-tight ${paceTextColor} font-mono leading-none`}>
                          {minutesToTime(Math.round(minutesTodayTarget))}
                        </span>
                        <span className="text-xs font-bold text-typography-400 uppercase tracking-wider">/ hoje</span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-typography-500 leading-relaxed mt-2">
                      Baseado em {totalRemainingShifts} turnos planejados restantes até o fim de {monthNames[currentMonth].toLowerCase()}.
                    </p>
                  </div>

                  <div className="bg-surface-200/70 rounded-2xl p-4 flex items-center justify-between border border-surface-300">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${paceBadgeColor} ${paceShadow}`} />
                      <span className="text-xs font-bold uppercase tracking-wider text-typography-700">Ritmo Atual</span>
                    </div>
                    <span className={`text-xs font-mono font-black ${paceTextColor} uppercase tracking-wider`}>
                      {paceLabel}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Main Chart Panel */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-8">
            {/* Progress Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-100 rounded-3xl p-5 sm:p-7 shadow-xs border border-surface-300 print:hidden h-full min-h-[340px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-200/10 text-primary-200 rounded-xl border border-primary-200/20">
                    <TrendingUp size={18} />
                  </div>
                  <h3 className="text-base font-black tracking-tight text-typography-900">Curva de Progressão</h3>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 text-[11px] font-extrabold uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-200" />
                    <span className="text-typography-700">Acumulado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-surface-300" />
                    <span className="text-typography-400">Meta</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-surface-300/60" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: '12px', fontWeight: '800' }}
                      labelStyle={{ color: '#0f172a', marginBottom: '4px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acumulado"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorAcumulado)"
                      name="Horas Reais"
                    />
                    <Line
                      type="monotone"
                      dataKey="meta"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Projeção Meta"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>
      </div>


      {/* Settings Modal (Responsive Fix) */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[2000] p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-100 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full my-auto flex flex-col gap-6 max-h-[90vh] overflow-hidden border border-surface-300 relative text-typography-900"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
              <div className="flex justify-between items-center shrink-0">
                <div className="space-y-0.5">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-typography-900">
                    Ajustar <span className="text-primary-200">Objetivo</span>
                  </h3>
                  <p className="text-xs text-typography-500 font-medium">Configure seu ritmo espiritual</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="w-9 h-9 bg-surface-200 hover:bg-surface-300/80 rounded-xl flex items-center justify-center transition-colors text-typography-500 hover:text-typography-900 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                <div className="relative pt-2">
                  <input
                    type="number"
                    value={tempGoal}
                    onChange={(e) => setTempGoal(Number(e.target.value))}
                    className="w-full text-5xl sm:text-6xl font-black tracking-tight text-primary-200 p-0 bg-transparent border-none outline-none text-center selection:bg-primary-200/20 font-mono"
                  />
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-typography-400 mt-2">
                    Horas {isSettingAllMonths ? 'como Padrão' : 'este Mês'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[30, 50, 70].map(h => (
                    <button
                      key={h}
                      onClick={() => setTempGoal(h)}
                      className={`h-11 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        tempGoal === h 
                          ? 'bg-primary-200 text-white shadow-2xs' 
                          : 'bg-surface-200/80 text-typography-700 hover:bg-surface-200 border border-surface-300'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>

                <div className="space-y-6 pt-5 border-t border-surface-300">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-typography-800">Meta Padrão</h4>
                      <p className="text-[11px] text-typography-400 italic">Aplicar em todos os meses futuros.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSettingAllMonths(!isSettingAllMonths)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer ${isSettingAllMonths ? 'bg-primary-200' : 'bg-surface-300'}`}
                    >
                      <motion.div
                        animate={{ x: isSettingAllMonths ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-xs"
                      />
                    </button>
                  </div>

                  {/* Programação de Turnos */}
                  <div className="space-y-3 pt-5 border-t border-surface-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-typography-800">Programação de Turnos</h4>
                        <p className="text-[11px] text-typography-400 italic">Planeje a rotina de turnos por dia da semana</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-200/10 text-primary-200 border border-primary-200/20">
                        {Object.values(tempShifts).reduce((acc, v) => acc + (Number(v) || 0), 0)} {Object.values(tempShifts).reduce((acc, v) => acc + (Number(v) || 0), 0) === 1 ? 'turno' : 'turnos'}/sem
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                      {[
                        { idx: 0, name: 'Dom', fullName: 'Domingo' },
                        { idx: 1, name: 'Seg', fullName: 'Segunda-feira' },
                        { idx: 2, name: 'Ter', fullName: 'Terça-feira' },
                        { idx: 3, name: 'Qua', fullName: 'Quarta-feira' },
                        { idx: 4, name: 'Qui', fullName: 'Quinta-feira' },
                        { idx: 5, name: 'Sex', fullName: 'Sexta-feira' },
                        { idx: 6, name: 'Sáb', fullName: 'Sábado' },
                      ].map((day) => {
                        const shifts = tempShifts[day.idx] || 0;
                        return (
                          <div key={day.idx} className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-typography-500 uppercase">{day.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = (shifts + 1) % 4;
                                setTempShifts(prev => ({ ...prev, [day.idx]: next }));
                              }}
                              className={`w-full aspect-square rounded-xl font-mono font-bold text-xs transition-all flex flex-col items-center justify-center border cursor-pointer ${
                                shifts > 0 
                                  ? 'bg-primary-200 border-primary-200 text-white shadow-2xs' 
                                  : 'bg-surface-200/60 hover:bg-surface-200 border-surface-300 text-typography-500'
                              }`}
                              title={`${day.fullName}: ${shifts} ${shifts === 1 ? 'turno' : 'turnos'}`}
                            >
                              <span>{shifts}</span>
                            </button>
                            <span className="text-[9px] font-semibold text-typography-400">
                              {shifts > 0 ? `${shifts}t` : 'livre'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-typography-400 italic text-center">
                      Toque em qualquer dia para alternar entre 0, 1, 2 ou 3 turnos.
                    </p>
                  </div>

                  {/* Shared Access Section (Apenas para o titular da conta) */}
                  {!isPublic && (
                    <div className="space-y-3 pt-5 border-t border-surface-300">
                      <div className="flex items-center gap-2">
                        <Share2 size={15} className="text-primary-200" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-typography-800">Acesso Compartilhado</h4>
                      </div>

                      {!wifeProfile ? (
                        <button
                          type="button"
                          onClick={createWifeProfile}
                          disabled={creatingProfile}
                          className="w-full py-3.5 bg-surface-200/60 hover:bg-surface-200 rounded-2xl border border-dashed border-surface-300 flex flex-col items-center justify-center gap-1 transition-all group cursor-pointer"
                        >
                          {creatingProfile ? (
                            <Loader2 className="animate-spin text-primary-200" />
                          ) : (
                            <>
                              <UserCircle2 className="text-typography-400 group-hover:text-primary-200 transition-colors" size={20} />
                              <span className="text-xs font-bold text-typography-600 group-hover:text-primary-200">
                                Criar link para {wifeDisplayName}
                              </span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-surface-200/60 rounded-2xl p-3.5 space-y-3 border border-surface-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-xs font-bold text-typography-800 uppercase tracking-wider">
                                Link de {wifeDisplayName} Ativo
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={deleteWifeProfile}
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title={`Desativar link de ${wifeDisplayName}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-100 p-2 rounded-xl border border-surface-300 text-[10px] font-mono text-typography-600 truncate">
                              {typeof window !== 'undefined' ? `${window.location.origin}/public-report/${wifeProfile.id}` : ''}
                            </div>
                            <button
                              type="button"
                              onClick={copyWifeLink}
                              className={`p-2 rounded-xl transition-all cursor-pointer ${
                                copyingLink ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-primary-200 text-white hover:bg-primary-200/90 shadow-2xs'
                              }`}
                              title="Copiar link"
                            >
                              {copyingLink ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          </div>

                          <p className="text-[10px] text-typography-400 italic leading-tight">
                            Envie este link para {wifeDisplayName}. Ela poderá registrar o relatório dela de forma independente sem precisar logar.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0 pt-3 border-t border-surface-300">
                <button
                  type="button"
                  id="settings-cancel-btn"
                  onClick={() => setShowSettings(false)}
                  className="h-11 sm:h-12 text-typography-500 font-bold hover:text-typography-900 hover:bg-surface-200/60 transition-all text-xs uppercase tracking-wider border border-surface-300 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="settings-save-btn"
                  onClick={handleSaveGoal}
                  disabled={saving}
                  className="h-11 sm:h-12 bg-primary-200 text-white font-bold rounded-xl hover:bg-primary-200/90 transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Lançamento de Atividade do Dia */}
        {editingDay && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-100 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl space-y-5 border border-surface-300 relative overflow-hidden text-typography-900"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
              <div className="flex items-center justify-between pb-3.5 border-b border-surface-300">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-200/10 flex items-center justify-center text-primary-200 border border-primary-200/20">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-typography-900 tracking-tight">
                      Lançar Atividade
                    </h3>
                    <p className="text-xs text-typography-500 font-medium">
                      {editingDay.dayName}, {editingDay.day} de {monthNames[currentMonth]}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="p-1.5 rounded-lg text-typography-400 hover:text-typography-900 hover:bg-surface-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Horas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-typography-700">
                    Horas no Ministério (HH:mm)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      value={editingDay.hours}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9:]/g, '');
                        if (val.length <= 5) setEditingDay(prev => prev ? ({ ...prev, hours: val }) : null);
                      }}
                      onBlur={(e) => {
                        let val = e.target.value;
                        if (val && !val.includes(':')) {
                          setEditingDay(prev => prev ? ({ ...prev, hours: `${val}:00` }) : null);
                        }
                      }}
                      placeholder="0:00"
                      className="w-full text-center text-3xl font-black text-primary-200 tracking-tight bg-surface-200/60 focus:bg-surface-100 border border-surface-300 focus:border-primary-200 rounded-2xl py-2.5 px-4 outline-none transition-all font-mono"
                    />
                  </div>

                  {/* Botões Rápidos */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {[
                      { label: '+30m', minutes: 30 },
                      { label: '+1h', minutes: 60 },
                      { label: '+1h30', minutes: 90 },
                      { label: '+2h', minutes: 120 },
                      { label: '+3h', minutes: 180 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => {
                          const currentMins = timeToMinutes(editingDay.hours);
                          const newMins = currentMins + btn.minutes;
                          setEditingDay(prev => prev ? ({ ...prev, hours: minutesToTime(newMins) }) : null);
                        }}
                        className="px-2.5 py-1.5 bg-surface-200/80 hover:bg-primary-200 hover:text-white rounded-xl text-[11px] font-bold text-typography-700 border border-surface-300/60 transition-all active:scale-95 cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditingDay(prev => prev ? ({ ...prev, hours: '' }) : null)}
                      className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl text-[11px] font-bold border border-red-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Notas / Observações */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-typography-700">
                    Notas e Observações
                  </label>
                  <textarea
                    value={editingDay.notes}
                    onChange={(e) => setEditingDay(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                    placeholder="Ex: 2 revisitas, testemunho de carrinho, 1 estudo bíblico..."
                    rows={3}
                    className="w-full text-xs text-typography-900 bg-surface-200/60 focus:bg-surface-100 border border-surface-300 focus:border-primary-200 rounded-2xl p-3 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="h-11 text-typography-500 font-bold hover:text-typography-900 hover:bg-surface-200/60 transition-all text-xs uppercase tracking-wider border border-surface-300 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDayModal}
                  disabled={savingDay}
                  className="h-11 bg-primary-200 text-white font-bold rounded-xl hover:bg-primary-200/90 transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingDay ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Salvar Atividade
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .calendar-grid {
          border-top: 1px solid #c6c5d4;
          border-left: 1px solid #c6c5d4;
          overflow: hidden;
        }
        .calendar-cell {
          border-right: 1px solid #c6c5d4;
          border-bottom: 1px solid #c6c5d4;
          min-height: 160px;
          transition: background-color 0.1s ease;
        }
        .calendar-cell:hover {
          background-color: rgba(243, 244, 245, 0.6);
        }
        .weekend-cell {
          background-color: #fcfcfd;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar-wide::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar-wide::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar-wide::-webkit-scrollbar-thumb {
          background: #c6c5d4;
          border-radius: 10px;
        }
        .custom-scrollbar-wide::-webkit-scrollbar-thumb:hover {
          background: #b1b0c0;
        }
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .max-w-7xl { max-width: none !important; width: 100% !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
