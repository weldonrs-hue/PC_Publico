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
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
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
  userId: string;
  onBack: () => void;
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

export default function FieldServiceReportView({ userId, onBack }: FieldServiceReportViewProps) {
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
  const calendarRef = useRef<HTMLDivElement>(null);

  const monthYearKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;

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
    if (!userId) return;

    setLoading(true);
    const docRef = doc(db, 'service_reports', `${userId}_${monthYearKey}`);
    
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
        const defaultShifts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
        setReport({ days: {}, goal: 50, defaultGoal: 50, shifts: defaultShifts });
        setTempGoal(50);
        setTempShifts(defaultShifts);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading report:", error);
      handleFirestoreError(error, OperationType.GET, `service_reports/${userId}_${monthYearKey}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, monthYearKey]);

  const updateDayData = async (dateKey: string, field: keyof DayData, value: string) => {
    const newDays = { ...report.days };
    if (!newDays[dateKey]) {
      newDays[dateKey] = { hours: '', notes: '' };
    }
    newDays[dateKey][field] = value;

    setReport(prev => ({ ...prev, days: newDays }));

    try {
      const docRef = doc(db, 'service_reports', `${userId}_${monthYearKey}`);
      await setDoc(docRef, { ...report, days: newDays, userId }, { merge: true });
    } catch (error) {
      console.error("Error saving day data:", error);
      handleFirestoreError(error, OperationType.UPDATE, `service_reports/${userId}_${monthYearKey}`);
    }
  };

  const handleSaveGoal = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'service_reports', `${userId}_${monthYearKey}`);
      
      const updateData: any = { 
        userId,
        shifts: tempShifts
      };
      if (isSettingAllMonths) {
        updateData.defaultGoal = tempGoal;
        updateData.goal = tempGoal; 
      } else {
        updateData.goal = tempGoal;
      }

      await setDoc(docRef, updateData, { merge: true });
      setShowSettings(false);
      setIsSettingAllMonths(false);
    } catch (error) {
      console.error("Error saving goal:", error);
      handleFirestoreError(error, OperationType.UPDATE, `service_reports/${userId}_${monthYearKey}`);
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

  // Shift-based calculation
  let totalRemainingShifts = 0;
  const startDate = isCurrentMonth ? today.getDate() : 1;
  const daysInMonthArray = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

  const todayDateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const hasHoursToday = report.days[todayDateKey]?.hours && report.days[todayDateKey]?.hours !== '0:00' && report.days[todayDateKey]?.hours !== '00:00';
  const isTodayRemaining = isCurrentMonth && !hasHoursToday;

  for (let d = startDate; d <= daysInMonthCount; d++) {
    // If it's today and we've already recorded hours, skip it from remaining turns
    if (isCurrentMonth && d === today.getDate()) {
      if (hasHoursToday) continue;
    }
    const dObj = new Date(currentYear, currentMonth, d);
    const dayOfWeek = dObj.getDay();
    totalRemainingShifts += (report.shifts?.[dayOfWeek] ?? 0);
  }

  const minutesPerShift = totalRemainingShifts > 0 
    ? Math.max(0, minutesRemaining / totalRemainingShifts) 
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
  const minutesTodayTarget = isTodayRemaining ? (minutesPerShift * shiftsPlannedToday) : 0;

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

  return (
    <div className="bg-[#FDFCFB] min-h-screen flex flex-col font-sans text-[#1A1A1A] p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 max-w-7xl mx-auto w-full print:hidden">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-[#000666] hover:text-white rounded-2xl transition-all text-[#000666] bg-white shadow-xl shadow-black/5 border border-gray-100 group"
          >
            <ChevronLeft size={24} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
          </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-1 bg-[#000666] rounded-full" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-[#000666]">Gestão Pessoal</h2>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-gray-900 leading-tight">
                Relatório de <span className="font-serif italic font-normal text-[#000666]">Pregação</span>
              </h1>
            </div>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-xl shadow-black/5 border border-gray-50">
          <button 
            onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
            className="p-2.5 rounded-xl hover:bg-gray-50 text-gray-400 transition-colors"
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
          >
            <ChevronRight size={20} strokeWidth={3} />
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
          {/* Calendar Header Navigation */}
          <div className="overflow-x-auto no-scrollbar pb-2">
            <header className="mb-4 bg-[#1a237e] rounded-2xl p-1.5 shadow-lg min-w-[600px]" data-purpose="calendar-header">
              <nav className="grid grid-cols-7 items-center h-12 text-white font-bold text-xs sm:text-sm uppercase tracking-[0.15em]">
                {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, idx) => (
                  <div key={day} className="text-center py-2">
                    {day}
                  </div>
                ))}
              </nav>
            </header>
          </div>

          {/* Calendar Grid Wrapper for Horizontal Scroll */}
          <div className="overflow-x-auto custom-scrollbar-wide pb-4">
            <div className="calendar-grid bg-white rounded-xl overflow-hidden shadow-2xl border-l border-t border-[#c6c5d4] min-w-[700px]">
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
                  const isWeekend = (firstDay + day - 1) % 7 >= 5;
                  
                  return (
                    <div 
                      key={day} 
                      className={`calendar-cell p-4 flex flex-col transition-all duration-200 group relative ${isWeekend ? 'weekend-cell' : 'bg-white'} ${isToday ? 'bg-primary-fixed/30 ring-2 ring-inset ring-[#000666] z-10' : ''}`}
                    >
                      {/* Day Header */}
                      <div className="w-full flex justify-between items-start mb-2">
                        <span className={`font-black text-sm ${isToday ? 'text-[#000666]' : 'text-[#454652]'}`}>
                          {day.toString().padStart(2, '0')}
                        </span>
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
                          placeholder="0:00"
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

          <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center px-4 gap-4 text-gray-400">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-[#88d982] rounded-full shadow-sm"></span>
              <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Dias com serviço programado</span>
            </div>
            <div className="text-[11px] font-medium italic text-gray-400">
              * Clique em um dia para adicionar notas ou ajustar o horário.
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
                      className="text-6xl font-black uppercase tracking-[0.2em] text-[#000666] hover:bg-[#000666] hover:text-white px-12 py-8 rounded-full transition-all border-[6px] border-[#000666]/30 bg-white shadow-2xl shadow-[#000666]/10 active:scale-95"
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
                    <div className={`bg-white/10 p-2.5 rounded-2xl ${paceTextColor} shadow-[0_0_20px_rgba(255,255,255,0.05)]`}>
                      <TrendingUp size={22} />
                    </div>
                    <span className={`text-xs font-black uppercase tracking-[0.4em] ${paceTextColor}`}>Sugestão Dinâmica</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black tracking-tighter ${paceTextColor} font-mono leading-none`}>
                          {minutesToTime(Math.round(minutesPerShift))}
                        </span>
                        <span className={`text-[10px] font-black ${paceTextColor} opacity-60 uppercase tracking-widest`}>/ turno</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black tracking-tighter ${paceTextColor} font-mono leading-none`}>
                          {minutesToTime(Math.round(minutesTodayTarget))}
                        </span>
                        <span className={`text-[10px] font-black ${paceTextColor} opacity-60 uppercase tracking-widest`}>/ hoje</span>
                      </div>
                    </div>
                    <p className={`text-base font-serif italic ${paceTextColor} opacity-90 leading-relaxed font-medium`}>
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
                  <h3 className="text-3xl font-black tracking-tight text-gray-900">Ajustar <span className="font-serif italic font-normal text-[#000666]">Objetivo</span></h3>
                  <p className="text-base text-gray-500 font-medium italic font-serif">Configure seu ritmo espiritual</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center transition-colors text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                <div className="relative pt-4">
                  <input 
                    type="number" 
                    value={tempGoal} 
                    onChange={(e) => setTempGoal(Number(e.target.value))}
                    className="w-full text-8xl font-black tracking-tighter text-[#000666] p-0 bg-transparent border-none outline-none text-center selection:bg-blue-50 font-mono"
                  />
                  <div className="text-center font-black text-xs uppercase tracking-[0.3em] text-orange-500 mt-4 leading-relaxed">Horas {isSettingAllMonths ? 'como Padrão' : 'este Mês'}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {[30, 50, 70].map(h => (
                    <button 
                      key={h}
                      onClick={() => setTempGoal(h)}
                      className={`h-20 rounded-2xl font-black text-2xl transition-all border-4 ${tempGoal === h ? 'bg-[#000666] border-[#000666] text-white shadow-2xl scale-105' : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-200'}`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>

                <div className="space-y-6 pt-10 border-t-2 border-orange-50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#000666]">Meta Padrão</h4>
                      <p className="text-[11px] text-gray-500 font-serif italic">Aplicar em todos os meses futuros</p>
                    </div>
                    <button 
                      onClick={() => setIsSettingAllMonths(!isSettingAllMonths)}
                      className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isSettingAllMonths ? 'bg-[#000666]' : 'bg-gray-200'}`}
                    >
                      <motion.div 
                        animate={{ x: isSettingAllMonths ? 28 : 4 }}
                        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                      />
                    </button>
                  </div>

                  <div className="space-y-8 pt-10 border-t-2 border-orange-50/50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#000666]">Programação de Turnos</h4>
                      <span className="text-[11px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100 italic">0-3 por dia</span>
                    </div>
                    <div className="grid grid-cols-7 gap-3">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((dayName, idx) => {
                        const dayIdx = idx;
                        const shifts = tempShifts[dayIdx] || 0;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-4">
                            <span className="text-xs font-black text-[#000666]/40 uppercase tracking-tighter">{dayName}</span>
                            <button 
                              onClick={() => {
                                const next = (shifts + 1) % 4;
                                setTempShifts(prev => ({ ...prev, [dayIdx]: next }));
                              }}
                              className={`w-full aspect-square rounded-2xl font-mono font-black text-base transition-all flex items-center justify-center border-4 ${shifts > 0 ? 'bg-[#000666] border-[#000666] text-white shadow-2xl scale-110' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                            >
                              {shifts}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0 pt-4">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="h-14 text-gray-400 font-bold hover:text-gray-900 transition-all text-xs uppercase tracking-widest border border-gray-100 rounded-2xl"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveGoal}
                  disabled={saving}
                  className="h-14 bg-[#1A1A1A] text-white font-black rounded-2xl hover:bg-[#000666] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {saving ? <Loader2 className="animate-spin size={16}" /> : <Save size={16} />}
                  Salvar
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
