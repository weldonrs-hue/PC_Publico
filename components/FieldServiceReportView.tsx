'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  FileDown, 
  Settings2, 
  X,
  Save,
  Loader2,
  Calendar as CalendarIcon
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

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    const docRef = doc(db, 'service_reports', `${userId}_${monthYearKey}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedGoal = data.goal !== undefined ? data.goal : (data.defaultGoal || 50);
        const loadedShifts = data.shifts || { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 0: 1 };
        setReport({
          days: data.days || {},
          goal: loadedGoal,
          defaultGoal: data.defaultGoal || 50,
          shifts: loadedShifts
        });
        setTempGoal(loadedGoal);
        setTempShifts(loadedShifts);
      } else {
        const defaultShifts = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 0: 1 };
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

    // Use debounced save in a real app, but here we do it directly
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
        updateData.goal = tempGoal; // Also update current month for immediate consistency
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

  const handleExportPDF = async () => {
    if (!calendarRef.current) return;
    
    try {
      const dataUrl = await toPng(calendarRef.current, { 
        backgroundColor: '#fff', 
        quality: 1,
        style: {
          borderRadius: '0'
        }
      });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`relatorio-pregacao-${monthYearKey}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper functions for time calculation
  const timeToMinutes = (time: string) => {
    if (!time || !time.includes(':')) return 0;
    const [h, m] = time.split(':').map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const minutesToTime = (totalMinutes: number) => {
    const isNegative = totalMinutes < 0;
    const absoluteMinutes = Math.abs(totalMinutes);
    const h = Math.floor(absoluteMinutes / 60);
    const m = absoluteMinutes % 60;
    return `${isNegative ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Seg, 6=Dom)
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Stats calculation
  const totalMinutesDone = Object.values(report.days).reduce((acc, day) => acc + timeToMinutes(day.hours), 0);
  const goalMinutes = report.goal * 60;
  const minutesRemaining = goalMinutes - totalMinutesDone;
  
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  // Shift-based calculation
  let totalRemainingShifts = 0;
  const startDate = isCurrentMonth ? today.getDate() : 1;
  for (let d = startDate; d <= daysInMonth; d++) {
    const dObj = new Date(currentYear, currentMonth, d);
    const dayOfWeek = dObj.getDay();
    totalRemainingShifts += (report.shifts?.[dayOfWeek] ?? 1);
  }

  const minutesPerShift = totalRemainingShifts > 0 
    ? Math.max(0, minutesRemaining / totalRemainingShifts) 
    : 0;

  const todayOfWeek = today.getDay();
  const shiftsToday = report.shifts?.[todayOfWeek] ?? 0;
  const todayTargetMinutes = shiftsToday * minutesPerShift;

  const todayKey = isCurrentMonth 
    ? `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    : '';
  const doneTodayMinutes = todayKey ? timeToMinutes(report.days[todayKey]?.hours) : 0;
  const metaHoje = Math.max(0, todayTargetMinutes - doneTodayMinutes);

  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  return (
    <div className="bg-[#FDFCFB] min-h-screen flex flex-col font-sans text-[#1A1A1A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Row (Back Button + Title) */}
      <div className="flex items-center gap-4 print:hidden max-w-7xl mx-auto w-full">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#880E4F] bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.2em] text-[#880E4F]/40 leading-none mb-1">Relatórios</h2>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-800 whitespace-nowrap">Ministério de <span className="font-serif italic font-normal text-[#880E4F]">Pregação</span></h1>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        {/* Main Banner (Navigation & Actions) - Patterns from ItinerariesView */}
        <div className="bg-[#880E4F] p-4 text-white flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1">
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors uppercase"
              >
                Hoje
              </button>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button 
                onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="px-3 text-sm font-black min-w-[140px] text-center capitalize font-serif italic">
                {monthNames[currentMonth]} <span className="text-white/40 not-italic font-sans text-xs ml-1">{currentYear}</span>
              </span>
              <button 
                onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 print:hidden items-center">
            <button 
              onClick={handleExportPDF}
              className="bg-white/10 text-white p-2 sm:px-4 sm:py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center gap-2"
              title="Exportar PDF"
            >
              <FileDown size={18} />
              <span className="hidden md:inline">Baixar PDF</span>
            </button>
            <button 
              onClick={handlePrint}
              className="bg-white/10 text-white p-2 sm:px-4 sm:py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center gap-2"
              title="Imprimir"
            >
              <Printer size={18} />
              <span className="hidden md:inline">Imprimir</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
            <button 
              onClick={() => setShowSettings(true)}
              className="bg-white text-[#880E4F] p-2 sm:px-5 sm:py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg flex items-center gap-2"
              title="Ajustes"
            >
              <Settings2 size={18} />
              <span className="hidden md:inline">Ajustes</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-6 sm:space-y-10">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-6 print:grid-cols-5">
            {[
              { label: 'Meta Mensal', value: `${report.goal}:00`, color: 'text-gray-900', bg: 'bg-white' },
              { label: 'Horas Feitas', value: minutesToTime(totalMinutesDone), color: 'text-white', bg: 'bg-[#880E4F]' },
              { label: 'Faltam', value: minutesToTime(minutesRemaining), color: 'text-orange-900', bg: 'bg-orange-50' },
              { label: 'Cada Turno', value: minutesToTime(Math.round(minutesPerShift)), color: 'text-gray-600', bg: 'bg-gray-50' },
              { label: 'Meta p/ Hoje', value: minutesToTime(Math.round(metaHoje)), color: 'text-white', bg: 'bg-[#1A1A1A]' },
            ].map((stat, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className={`${stat.bg} p-4 sm:p-6 rounded-2xl border border-orange-100 shadow-xl shadow-orange-900/5 flex flex-col justify-center relative overflow-hidden group ${i === 4 ? 'col-span-2 md:col-span-1' : 'col-span-1'}`}
              >
                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 sm:mb-1 relative z-10 ${stat.bg === 'bg-[#880E4F]' || stat.bg === 'bg-[#1A1A1A]' ? 'text-white/40' : 'text-[#880E4F]/40'}`}>
                  {stat.label}
                </span>
                <span className={`text-xl sm:text-3xl font-black font-mono tracking-tighter relative z-10 ${stat.color}`}>{stat.value}</span>
                <div className={`absolute -right-4 -bottom-4 w-12 h-12 sm:w-20 sm:h-20 rounded-full opacity-10 transition-transform group-hover:scale-150 ${stat.bg === 'bg-[#880E4F]' || stat.bg === 'bg-[#1A1A1A]' ? 'bg-white' : 'bg-[#880E4F]'}`} />
              </motion.div>
            ))}
          </div>

          {/* Calendar Body */}
          <div ref={calendarRef} className="print:p-0 print:border-none print:shadow-none">
            {/* Scrollable Container for Mobile */}
            <div className="overflow-x-auto custom-scrollbar-wide">
              <div className="min-w-[750px] lg:min-w-0">
                {/* Weekday Labels (High Contrast - Maroon Row) */}
                <div className="grid grid-cols-7 gap-x-px mb-2 bg-[#880E4F] rounded-t-2xl sm:rounded-t-3xl overflow-hidden border-2 border-[#880E4F]">
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, idx) => (
                    <div key={day} className={`text-center py-3 sm:py-4 ${idx === 6 ? 'bg-[#700B3F]' : 'bg-[#880E4F]'}`}>
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-white">
                        {day}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 border-2 border-[#880E4F] rounded-b-2xl sm:rounded-b-3xl overflow-hidden">
                  {/* Main Calendar Grid */}
                  <div className="grid grid-cols-7 gap-px bg-[#880E4F]">
                    {/* Padding start (Days from previous month) */}
                    {Array.from({ length: firstDay }).map((_, i) => {
                      const prevMonthDate = new Date(currentYear, currentMonth, 0 - (firstDay - i - 1));
                      return (
                        <div key={`pad-${i}`} className="bg-gray-100 h-44 flex flex-col p-0 opacity-50 relative overflow-hidden border-r border-[#880E4F]/10">
                          <div className="h-8 bg-gray-200/50 flex items-center justify-end px-3">
                            <span className="text-[12px] font-black text-gray-400">
                              {prevMonthDate.getDate().toString().padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Days of current month */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                      const dayData = report.days[dateKey] || { hours: '', notes: '' };
                      const isToday = isCurrentMonth && day === today.getDate();
                      const isSunday = (firstDay + i) % 7 === 6;

                      return (
                        <div 
                          key={day} 
                          className={`bg-white h-44 flex flex-col relative group transition-all duration-300 border-r border-[#880E4F]/10 ${isToday ? 'bg-[#FCE4EC]/40' : (isSunday ? 'bg-orange-50/20' : 'hover:bg-gray-50')}`}
                        >
                          {/* Day Header Bar */}
                          <div className={`h-8 sm:h-10 flex items-center justify-end px-2 sm:px-3 transition-colors ${isToday ? 'bg-[#880E4F]' : (isSunday ? 'bg-[#F8BBD0]/50 group-hover:bg-[#F8BBD0]/70' : 'bg-[#FCE4EC]/60 group-hover:bg-[#FCE4EC]/80')}`}>
                            <span className={`text-sm sm:text-[18px] font-black tracking-widest ${isToday ? 'text-white' : 'text-[#880E4F]'}`}>
                              {day.toString().padStart(2, '0')}
                            </span>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-between px-0.5 pt-1 pb-6">
                            <div className="w-full">
                              <input 
                                type="text" 
                                value={dayData.hours}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.length <= 5) updateDayData(dateKey, 'hours', val);
                                }}
                                placeholder="0:00"
                                className={`w-full text-center text-3xl font-mono font-black tracking-tighter bg-transparent border-none outline-none transition-colors ${dayData.hours ? 'text-gray-900' : 'text-gray-50'} focus:text-[#880E4F] placeholder:text-gray-50`}
                              />
                            </div>
                            
                            <div className="w-full flex-grow flex flex-col justify-center px-0">
                              <textarea 
                                value={dayData.notes}
                                onChange={(e) => updateDayData(dateKey, 'notes', e.target.value.slice(0, 50))}
                                placeholder="..."
                                rows={3}
                                maxLength={50}
                                className={`w-full text-center font-serif italic text-[15px] leading-tight text-gray-800 bg-transparent border-none outline-none placeholder:text-gray-50 focus:text-gray-950 resize-none overflow-hidden transition-all duration-500 h-[95px] mb-[-45px] ${dayData.notes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 focus:opacity-100 focus:translate-y-0'}`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Padding end (Days from next month) */}
                    {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }).map((_, i) => {
                      const nextMonthDate = new Date(currentYear, currentMonth + 1, i + 1);
                      return (
                        <div key={`pad-end-${i}`} className="bg-gray-100 h-44 flex flex-col p-0 opacity-50 relative overflow-hidden border-r border-[#880E4F]/10">
                          <div className="h-8 bg-gray-200/50 flex items-center justify-end px-3">
                            <span className="text-[12px] font-black text-gray-400">
                              {nextMonthDate.getDate().toString().padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

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
                <div className="space-y-0.5">
                  <h3 className="text-2xl font-black tracking-tight text-gray-900">Ajustar <span className="font-serif italic font-normal text-[#880E4F]">Objetivo</span></h3>
                  <p className="text-[12px] text-gray-400 font-medium italic font-serif">Configure seu ritmo espiritual</p>
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
                    className="w-full text-7xl font-black tracking-tighter text-[#880E4F] p-0 bg-transparent border-none outline-none text-center selection:bg-[#FCE4EC] font-mono"
                  />
                  <div className="text-center font-bold text-[9px] uppercase tracking-[0.3em] text-orange-300 mt-2">Horas {isSettingAllMonths ? 'como Padrão' : 'este Mês'}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[30, 50, 70].map(h => (
                    <button 
                      key={h}
                      onClick={() => setTempGoal(h)}
                      className={`h-12 rounded-xl font-black text-sm transition-all ${tempGoal === h ? 'bg-[#880E4F] text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>

                <div className="space-y-6 pt-4 border-t border-orange-50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-[#880E4F]">Meta Padrão</h4>
                      <p className="text-[9px] text-gray-400 italic">Aplicar em todos os meses futuros.</p>
                    </div>
                    <button 
                      onClick={() => setIsSettingAllMonths(!isSettingAllMonths)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isSettingAllMonths ? 'bg-[#880E4F]' : 'bg-gray-100'}`}
                    >
                      <motion.div 
                        animate={{ x: isSettingAllMonths ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-orange-50/50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-900">Programação de Turnos</h4>
                      <span className="text-[10px] font-serif italic text-orange-300">0-3 por dia</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dayName, idx) => {
                        const dayIdx = idx;
                        const shifts = tempShifts[dayIdx] || 0;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1.5">
                            <span className="text-[9px] font-black text-orange-200 uppercase">{dayName}</span>
                            <button 
                              onClick={() => {
                                const next = (shifts + 1) % 4;
                                setTempShifts(prev => ({ ...prev, [dayIdx]: next }));
                              }}
                              className={`w-full aspect-square rounded-lg font-mono font-bold text-xs transition-all flex items-center justify-center border-2 ${shifts > 0 ? 'bg-[#880E4F] border-[#880E4F] text-white shadow-md' : 'bg-white border-orange-50 text-orange-100'}`}
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

              <div className="grid grid-cols-2 gap-3 shrink-0 pt-2">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="h-14 text-gray-400 font-bold hover:text-gray-900 transition-all text-[11px] uppercase tracking-widest border border-gray-100 rounded-2xl"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveGoal}
                  disabled={saving}
                  className="h-14 bg-[#1A1A1A] text-white font-black rounded-2xl hover:bg-[#880E4F] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
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
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .max-w-7xl { max-width: none !important; width: 100% !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
