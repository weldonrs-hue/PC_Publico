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
  Edit3
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
    <div className="bg-[#FDFCFB] min-h-screen flex flex-col font-sans text-[#1A1A1A] p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto w-full print:hidden">
        <div className="flex items-center gap-6">
          {!isPublic && onBack && (
            <button
              onClick={onBack}
              className="p-3 hover:bg-[#000666] hover:text-white rounded-2xl transition-all text-[#000666] bg-white shadow-xl shadow-black/5 border border-gray-100 group"
            >
              <ChevronLeft size={28} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
            </button>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-1 bg-[#000666] rounded-full" />
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-[#000666]">
                {isPublic ? `Acesso de ${wifeDisplayName}` : 'Gestão Pessoal'}
              </h2>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 leading-tight">
              Relatório de <span className="font-serif italic font-normal text-[#000666]">{isPublic ? wifeDisplayName : 'Pregação'}</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Botão Salvar e Status na Nuvem (Exclusivo para o relatório da esposa no link) */}
          {isPublic && (
            <>
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200/70 text-amber-700 rounded-2xl text-xs font-bold shadow-sm">
                  <Loader2 size={14} className="animate-spin text-amber-600" />
                  <span className="hidden sm:inline">Salvando...</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200/70 text-emerald-700 rounded-2xl text-xs font-bold shadow-sm" title="Todos os dados estão salvos com segurança">
                  <Check size={14} strokeWidth={3} className="text-emerald-600" />
                  <span className="hidden sm:inline">Salvo na nuvem</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200/70 text-rose-700 rounded-2xl text-xs font-bold shadow-sm">
                  <X size={14} strokeWidth={3} className="text-rose-600" />
                  <span className="hidden sm:inline">Erro ao salvar</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleManualSave}
                disabled={saveStatus === 'saving'}
                className="p-3 bg-[#000666] hover:bg-[#000666]/90 text-white rounded-2xl shadow-xl shadow-[#000666]/20 flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-70 cursor-pointer"
                title="Salvar imediatamente todas as atividades no banco de dados"
              >
                {saveStatus === 'saving' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                <span className="inline">Salvar</span>
              </button>
            </>
          )}

          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-xl shadow-black/5 border border-gray-50">
            <button
              onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
              className="p-2.5 rounded-xl hover:bg-gray-50 text-gray-400 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft size={20} strokeWidth={3} />
            </button>
            <div className="px-6 flex flex-col items-center min-w-[160px]">
              <span className="text-xs font-black uppercase tracking-widest text-[#000666]/40 leading-none mb-1">{currentYear}</span>
              <span className="text-lg font-black text-gray-900 capitalize font-serif italic">{monthNames[currentMonth]}</span>
            </div>
            <button
              onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
              className="p-2.5 rounded-xl hover:bg-gray-50 text-gray-400 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight size={20} strokeWidth={3} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-3 bg-white hover:bg-gray-50 rounded-2xl shadow-xl shadow-black/5 border border-gray-50 text-[#000666] flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            title={isPublic ? "Configurar Meta e Turnos" : "Configurações do Relatório"}
          >
            <Settings2 size={20} />
            <span className="hidden sm:inline">Configurar</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full space-y-10">
        {/* Full Width Calendar - At the top as requested */}
        <motion.div
          ref={calendarRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col w-full overflow-hidden"
        >
          {/* Unified Horizontal Scroll Container: weekday headers and calendar grid scroll together */}
          <div className="overflow-x-auto custom-scrollbar-wide pb-4">
            <div className="min-w-[700px] flex flex-col gap-3">
              {/* Calendar Header Navigation */}
              <header className="bg-[#1a237e] rounded-2xl p-1.5 shadow-lg" data-purpose="calendar-header">
                <nav className="grid grid-cols-7 items-center h-12 text-white font-bold text-xs sm:text-sm uppercase tracking-[0.15em]">
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day) => (
                    <div key={day} className="text-center py-2">
                      {day}
                    </div>
                  ))}
                </nav>
              </header>

              {/* Calendar Grid */}
              <div className="calendar-grid bg-white rounded-xl overflow-hidden shadow-2xl border-l border-t border-[#c6c5d4]">
                <div className="grid grid-cols-7">
                {/* Empty cells from previous month */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`pad-${i}`} className="calendar-cell bg-gray-50/50 p-4" />
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
                  const isDayRemaining = !isPastMonth && ((isCurrentMonth && day >= today.getDate()) || isFutureMonth) && !hasHours;
                  const isWeekend = (firstDay + day - 1) % 7 >= 5;

                  return (
                    <div
                      key={day}
                      className={`calendar-cell p-4 flex flex-col transition-all duration-200 group relative ${isWeekend ? 'weekend-cell' : 'bg-white'} ${isToday ? 'bg-primary-fixed/30 ring-2 ring-inset ring-[#000666] z-10' : ''}`}
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
                          <span className={`font-black text-sm ${isToday ? 'text-[#000666]' : 'text-[#454652]'}`}>
                            {day.toString().padStart(2, '0')}
                          </span>
                          {isPublic && (
                            <span className="opacity-0 group-hover/header:opacity-100 sm:group-hover:opacity-80 transition-opacity text-[#000666]">
                              <Edit3 size={12} />
                            </span>
                          )}
                        </div>
                        {isPlanned && (
                          <div className="w-2.5 h-2.5 bg-[#88d982] rounded-full shadow-sm ring-2 ring-[#88d982]/30" title="Serviço programado" />
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
                          className="w-full text-center text-xl sm:text-2xl font-black text-[#000666] tracking-tight bg-transparent border-none outline-none p-0 placeholder:text-[#e1e3e4]"
                        />

                        <textarea
                          value={dayData.notes}
                          onChange={(e) => updateDayData(dateKey, 'notes', e.target.value)}
                          placeholder="Nota..."
                          rows={2}
                          className="w-full text-center text-[10px] text-[#454652] italic leading-tight bg-transparent border-none outline-none resize-none px-1 overflow-y-auto no-scrollbar placeholder:opacity-0 group-hover:placeholder:opacity-30 focus:placeholder:opacity-30"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

          <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center px-4 gap-4 text-gray-400">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-[#88d982] rounded-full shadow-sm"></span>
              <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Dias com serviço programado</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="text-[11px] font-medium italic text-gray-400 text-center sm:text-right">
                {isPublic 
                  ? "* Toque no número do dia para abrir o formulário ou edite diretamente."
                  : "* Edite as horas e notas diretamente no calendário."}
              </div>
              {isPublic && (
                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  className="px-4 py-2 bg-[#000666] hover:bg-[#000666]/90 text-white rounded-xl shadow-md text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 cursor-pointer"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Salvar Atividades</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </motion.div>

        {/* Bottom Section: Stats & Progress Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Panel - Stats & Dynamic Goal */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-8 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-8">
              {/* Progress Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-black/5 border border-gray-50 relative overflow-hidden group"
              >
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="bg-[#000666]/5 p-3 rounded-2xl text-[#000666]">
                      <Target size={24} />
                    </div>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="text-[11px] font-black uppercase tracking-widest text-[#000666] hover:bg-[#000666] hover:text-white px-4 py-2 rounded-full transition-all border border-[#000666]/20"
                    >
                      Meta: {report.goal}h
                    </button>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-black tracking-tighter text-gray-900 leading-none">{minutesToTime(totalMinutesDone)}</span>
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">horas totais</span>
                    </div>
                    <p className="text-base font-serif italic text-gray-600 font-medium">Progresso realizado este mês</p>
                  </div>

                  <div className="space-y-4">
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentComplete}%` }}
                        transition={{ duration: 1, ease: "circOut" }}
                        className="h-full bg-gradient-to-r from-[#000666] to-[#343d96] rounded-full shadow-[0_0_20px_rgba(0,6,102,0.3)]"
                      />
                    </div>
                    <div className="flex justify-between text-sm font-black uppercase tracking-widest">
                      <span className="text-[#000666]">{percentComplete.toFixed(0)}% Concluído</span>
                      <span className="text-gray-600">{minutesToTime(minutesRemaining)} restantes</span>
                    </div>
                  </div>

                  {/* Link do Relatório de [Esposa] - Abaixo da Linha de Progressão */}
                  {!isPublic && (
                    <div className="pt-6 border-t border-gray-100 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Share2 size={16} className="text-[#000666]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#000666]">
                            Link do Relatório de {wifeDisplayName}
                          </span>
                        </div>
                        {wifeProfile && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
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
                          className="w-full py-3.5 px-4 bg-gray-50 hover:bg-[#000666] hover:text-white text-gray-700 rounded-2xl border border-dashed border-gray-300 flex items-center justify-center gap-2 transition-all font-bold text-xs group shadow-sm"
                        >
                          {creatingProfile ? (
                            <Loader2 className="animate-spin text-[#000666] group-hover:text-white" size={16} />
                          ) : (
                            <>
                              <UserCircle2 size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                              <span>Gerar link exclusivo para {wifeDisplayName}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                            <input
                              type="text"
                              readOnly
                              value={typeof window !== 'undefined' ? `${window.location.origin}/public-report/${wifeProfile.id}` : ''}
                              className="flex-1 bg-transparent text-[11px] font-mono text-gray-600 outline-none px-2 select-all truncate"
                            />
                            <button
                              type="button"
                              onClick={copyWifeLink}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                                copyingLink 
                                  ? 'bg-emerald-600 text-white shadow-sm' 
                                  : 'bg-[#000666] text-white hover:bg-[#000666]/90'
                              }`}
                              title="Copiar link"
                            >
                              {copyingLink ? (
                                <>
                                  <Check size={14} />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                            <a
                              href={`/public-report/${wifeProfile.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-[#000666] hover:bg-white rounded-xl transition-colors shrink-0"
                              title={`Abrir relatório de ${wifeDisplayName} em nova aba`}
                            >
                              <ExternalLink size={16} />
                            </a>
                          </div>
                          <p className="text-[11px] text-gray-500 italic leading-snug">
                            Envie este link para {wifeDisplayName}. Ela registrará o relatório dela de forma independente sem precisar fazer login.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#000666] opacity-[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
              </motion.div>

              {/* Dynamic Suggestion Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#1A1A1A] rounded-[2.5rem] p-8 text-white shadow-2xl shadow-black/20 border border-black/10 relative overflow-hidden"
              >
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={`bg-white/10 p-2 rounded-xl ${paceTextColor}`}>
                      <TrendingUp size={20} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-white/50">Sugestão Dinâmica</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black tracking-tighter ${paceTextColor} font-mono leading-none`}>
                          {minutesToTime(Math.round(minutesPerShift))}
                        </span>
                        <span className="text-sm font-bold text-white/40 uppercase tracking-widest">/ turno</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black tracking-tighter ${paceTextColor} font-mono leading-none`}>
                          {minutesToTime(Math.round(minutesTodayTarget))}
                        </span>
                        <span className="text-sm font-bold text-white/40 uppercase tracking-widest">/ hoje</span>
                      </div>
                    </div>
                    <p className="text-base font-serif italic text-white/80 leading-relaxed font-medium">
                      Baseado em {totalRemainingShifts} turnos planejados restantes até o fim de {monthNames[currentMonth].toLowerCase()}.
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${paceBadgeColor} ${paceShadow}`} />
                      <span className="text-sm font-bold uppercase tracking-widest text-white/90">Ritmo Atual</span>
                    </div>
                    <span className={`text-sm font-mono font-black ${paceTextColor} uppercase tracking-[0.2em]`}>
                      {paceLabel}
                    </span>
                  </div>
                </div>
                <div className="absolute -bottom-8 -right-8 w-40 h-40 border border-white/5 rounded-full" />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 border border-white/5 rounded-full" />
              </motion.div>
            </div>
          </div>

          {/* Main Chart Panel */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-8">
            {/* Progress Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-black/5 border border-gray-50 print:hidden h-full min-h-[300px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <TrendingUp size={20} className="text-[#000666]" />
                  <h3 className="text-base font-black uppercase tracking-widest text-[#000666]">Curva de Progressão</h3>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#000666]" />
                    <span className="text-gray-600">Acumulado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="text-gray-400">Meta</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full -ml-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000666" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#000666" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#bbb' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#bbb' }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '900' }}
                      labelStyle={{ color: '#000666', marginBottom: '4px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acumulado"
                      stroke="#000666"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorAcumulado)"
                      name="Horas Reais"
                    />
                    <Line
                      type="monotone"
                      dataKey="meta"
                      stroke="#e5e7eb"
                      strokeWidth={2}
                      strokeDasharray="5 5"
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
          <div className="fixed inset-0 bg-[#1A1A1A]/90 backdrop-blur-md flex items-center justify-center z-[2000] p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] p-6 sm:p-10 max-w-md w-full my-auto flex flex-col gap-6 sm:gap-8 max-h-[90vh] overflow-hidden"
            >
              <div className="flex justify-between items-center shrink-0">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tight text-gray-900">Ajustar <span className="font-serif italic font-normal text-[#000666]">Objetivo</span></h3>
                  <p className="text-sm text-gray-400 font-medium italic font-serif">Configure seu ritmo espiritual</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center transition-colors text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                <div className="relative pt-2">
                  <input
                    type="number"
                    value={tempGoal}
                    onChange={(e) => setTempGoal(Number(e.target.value))}
                    className="w-full text-6xl font-black tracking-tighter text-[#000666] p-0 bg-transparent border-none outline-none text-center selection:bg-blue-50 font-mono"
                  />
                  <div className="text-center font-bold text-xs uppercase tracking-[0.2em] text-orange-400 mt-3">Horas {isSettingAllMonths ? 'como Padrão' : 'este Mês'}</div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[30, 50, 70].map(h => (
                    <button
                      key={h}
                      onClick={() => setTempGoal(h)}
                      className={`h-12 rounded-xl font-black text-sm transition-all ${tempGoal === h ? 'bg-[#000666] text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>

                <div className="space-y-6 pt-6 border-t border-orange-50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#000666]">Meta Padrão</h4>
                      <p className="text-[11px] text-gray-400 italic">Aplicar em todos os meses futuros.</p>
                    </div>
                    <button
                      onClick={() => setIsSettingAllMonths(!isSettingAllMonths)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isSettingAllMonths ? 'bg-[#000666]' : 'bg-gray-100'}`}
                    >
                      <motion.div
                        animate={{ x: isSettingAllMonths ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  {/* Programação de Turnos */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#000666]">Programação de Turnos</h4>
                        <p className="text-[11px] text-gray-400 italic">Planeje a rotina de turnos por dia da semana</p>
                      </div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#000666]/5 text-[#000666]">
                        {Object.values(tempShifts).reduce((acc, v) => acc + (Number(v) || 0), 0)} {Object.values(tempShifts).reduce((acc, v) => acc + (Number(v) || 0), 0) === 1 ? 'turno' : 'turnos'}/sem
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
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
                          <div key={day.idx} className="flex flex-col items-center gap-1.5">
                            <span className="text-[10px] font-black text-gray-500 uppercase">{day.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = (shifts + 1) % 4;
                                setTempShifts(prev => ({ ...prev, [day.idx]: next }));
                              }}
                              className={`w-full aspect-square rounded-xl font-mono font-bold text-sm transition-all flex flex-col items-center justify-center border-2 ${
                                shifts > 0 
                                  ? 'bg-[#000666] border-[#000666] text-white shadow-md shadow-[#000666]/20' 
                                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-400'
                              }`}
                              title={`${day.fullName}: ${shifts} ${shifts === 1 ? 'turno' : 'turnos'}`}
                            >
                              <span>{shifts}</span>
                            </button>
                            <span className="text-[9px] font-bold text-gray-400">
                              {shifts > 0 ? `${shifts}t` : 'livre'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 italic text-center">
                      Toque em qualquer dia para alternar entre 0, 1, 2 ou 3 turnos.
                    </p>
                  </div>

                  {/* Shared Access Section (Apenas para o titular da conta) */}
                  {!isPublic && (
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Share2 size={16} className="text-[#000666]" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#000666]">Acesso Compartilhado</h4>
                      </div>

                      {!wifeProfile ? (
                        <button
                          type="button"
                          onClick={createWifeProfile}
                          disabled={creatingProfile}
                          className="w-full py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 transition-all group"
                        >
                          {creatingProfile ? (
                            <Loader2 className="animate-spin text-[#000666]" />
                          ) : (
                            <>
                              <UserCircle2 className="text-gray-400 group-hover:text-[#000666] transition-colors" />
                              <span className="text-xs font-bold text-gray-500 group-hover:text-[#000666]">
                                Criar link para {wifeDisplayName}
                              </span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                                Link de {wifeDisplayName} Ativo
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={deleteWifeProfile}
                              className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              title={`Desativar link de ${wifeDisplayName}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white p-3 rounded-xl border border-gray-200 text-[10px] font-mono text-gray-400 truncate">
                              {typeof window !== 'undefined' ? `${window.location.origin}/public-report/${wifeProfile.id}` : ''}
                            </div>
                            <button
                              type="button"
                              onClick={copyWifeLink}
                              className={`p-3 rounded-xl transition-all ${copyingLink ? 'bg-emerald-500 text-white' : 'bg-[#000666] text-white'}`}
                              title="Copiar link"
                            >
                              {copyingLink ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                          </div>

                          <p className="text-[10px] text-gray-400 italic leading-tight">
                            Envie este link para {wifeDisplayName}. Ela poderá registrar o relatório dela de forma independente sem precisar logar.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0 pt-4">
                <button
                  type="button"
                  id="settings-cancel-btn"
                  onClick={() => setShowSettings(false)}
                  className="h-14 text-gray-400 font-bold hover:text-gray-900 transition-all text-xs uppercase tracking-widest border border-gray-100 rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="settings-save-btn"
                  onClick={handleSaveGoal}
                  disabled={saving}
                  className="h-14 bg-[#1A1A1A] text-white font-black rounded-2xl hover:bg-[#000666] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 text-xs uppercase tracking-widest cursor-pointer disabled:opacity-50"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#000666]/5 flex items-center justify-center text-[#000666]">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">
                      Lançar Atividade
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      {editingDay.dayName}, {editingDay.day} de {monthNames[currentMonth]}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                {/* Horas */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-[#000666]">
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
                      className="w-full text-center text-3xl font-black text-[#000666] tracking-tight bg-gray-50 focus:bg-white border-2 border-gray-100 focus:border-[#000666] rounded-2xl py-3 px-4 outline-none transition-all"
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
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-[#000666] hover:text-white rounded-xl text-[11px] font-bold text-gray-600 transition-all active:scale-95 cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditingDay(prev => prev ? ({ ...prev, hours: '' }) : null)}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Notas / Observações */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-[#000666]">
                    Notas e Observações
                  </label>
                  <textarea
                    value={editingDay.notes}
                    onChange={(e) => setEditingDay(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                    placeholder="Ex: 2 revisitas, testemunho de carrinho, 1 estudo bíblico..."
                    rows={3}
                    className="w-full text-sm text-gray-700 bg-gray-50 focus:bg-white border-2 border-gray-100 focus:border-[#000666] rounded-2xl p-3 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="h-12 text-gray-400 font-bold hover:text-gray-900 transition-all text-xs uppercase tracking-widest border border-gray-100 rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDayModal}
                  disabled={savingDay}
                  className="h-12 bg-[#000666] text-white font-black rounded-2xl hover:bg-[#000666]/90 transition-all shadow-xl shadow-[#000666]/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50 cursor-pointer"
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
