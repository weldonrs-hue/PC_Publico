'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Check, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  CalendarCheck,
  Building,
  GraduationCap,
  Users,
  Landmark,
  CheckSquare,
  Square
} from 'lucide-react';
import { ScannedCircuitEvent } from '@/services/circuitEventsScanner';
import { createPlannerItem } from '@/services/plannerService';

interface SyncCircuitEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  scannedEvents: ScannedCircuitEvent[];
  isLoadingScan: boolean;
  onRefreshScan: () => void;
  onImportCompleted: () => void;
}

export default function SyncCircuitEventsModal({
  isOpen,
  onClose,
  userId,
  scannedEvents: initialEvents,
  isLoadingScan,
  onRefreshScan,
  onImportCompleted,
}: SyncCircuitEventsModalProps) {
  const [events, setEvents] = useState<ScannedCircuitEvent[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Atualiza estado local quando scannedEvents muda
  React.useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  if (!isOpen) return null;

  const handleToggleSelect = (key: string) => {
    setEvents(prev => prev.map(ev => {
      if (ev.key === key) {
        return { ...ev, selected: !ev.selected };
      }
      return ev;
    }));
  };

  const handleDateChange = (key: string, newDate: string) => {
    setEvents(prev => prev.map(ev => {
      if (ev.key === key) {
        return { ...ev, date: newDate, selected: Boolean(newDate) };
      }
      return ev;
    }));
  };

  const handleTimeChange = (key: string, newTime: string) => {
    setEvents(prev => prev.map(ev => {
      if (ev.key === key) {
        return { ...ev, time: newTime };
      }
      return ev;
    }));
  };

  const handleLocationChange = (key: string, newLoc: string) => {
    setEvents(prev => prev.map(ev => {
      if (ev.key === key) {
        return { ...ev, location: newLoc };
      }
      return ev;
    }));
  };

  const handleSelectAll = (select: boolean) => {
    setEvents(prev => prev.map(ev => {
      if (ev.alreadyImported) return ev;
      return { ...ev, selected: select && Boolean(ev.date) };
    }));
  };

  const selectedCount = events.filter(e => e.selected && !e.alreadyImported).length;

  const handleConfirmImport = async () => {
    const toImport = events.filter(e => e.selected && !e.alreadyImported && e.date);
    if (toImport.length === 0) return;

    setIsImporting(true);
    try {
      for (const ev of toImport) {
        const originTag = `[origem:${ev.key}]`;
        const notesWithOrigin = ev.notes ? `${ev.notes}\n${originTag}` : originTag;

        await createPlannerItem(userId, {
          type: 'event',
          title: ev.title,
          description: `${ev.categoryLabel} • ${ev.subtitle || 'Evento'}\nData informada: "${ev.rawDate}"`,
          date: ev.date,
          time: ev.time || null,
          location: ev.location || null,
          notes: notesWithOrigin,
          priority: 'medium',
          status: 'pending',
          hasDeadline: false,
        });
      }

      onImportCompleted();
      onClose();
    } catch (err) {
      console.error('Erro ao importar eventos selecionados:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const getCategoryIcon = (category: ScannedCircuitEvent['category']) => {
    switch (category) {
      case 'assembly':
        return <Building size={16} className="text-amber-500" />;
      case 'convention':
        return <Landmark size={16} className="text-emerald-500" />;
      case 'pioneer_meeting':
        return <Users size={16} className="text-violet-500" />;
      case 'emr':
      case 'pioneer_school':
        return <GraduationCap size={16} className="text-blue-500" />;
      default:
        return <Calendar size={16} className="text-primary-200" />;
    }
  };

  const filteredEvents = events.filter(ev => {
    if (filterType === 'all') return true;
    if (filterType === 'pending') return !ev.alreadyImported;
    if (filterType === 'imported') return ev.alreadyImported;
    return ev.category === filterType;
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md no-print">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden border border-surface-300 relative text-typography-900"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />

        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-surface-300 bg-surface-200/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-200/10 border border-primary-200/20 rounded-xl text-primary-200 shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black text-typography-900 uppercase tracking-tight flex items-center gap-2">
                Sincronizar Eventos do Circuito
              </h3>
              <p className="text-xs text-typography-500 font-medium">
                Detectamos datas cadastradas em Assembleias, Congresso e Escolas. Confira e confirme a importação para sua agenda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-typography-400 hover:text-typography-900 hover:bg-surface-200 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sub-bar / Filters & Quick Selection */}
        <div className="px-5 py-3 border-b border-surface-300/80 bg-surface-100 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-primary-200 text-white'
                  : 'bg-surface-200 text-typography-600 hover:text-typography-900'
              }`}
            >
              Todos ({events.length})
            </button>
            <button
              onClick={() => setFilterType('pending')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                filterType === 'pending'
                  ? 'bg-primary-200 text-white'
                  : 'bg-surface-200 text-typography-600 hover:text-typography-900'
              }`}
            >
              Não Importados ({events.filter(e => !e.alreadyImported).length})
            </button>
            <button
              onClick={() => setFilterType('imported')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                filterType === 'imported'
                  ? 'bg-primary-200 text-white'
                  : 'bg-surface-200 text-typography-600 hover:text-typography-900'
              }`}
            >
              Já na Agenda ({events.filter(e => e.alreadyImported).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="text-[11px] font-bold text-primary-200 hover:underline cursor-pointer"
            >
              Marcar todos
            </button>
            <span className="text-surface-400">•</span>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="text-[11px] font-bold text-typography-500 hover:text-typography-800 cursor-pointer"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {/* Body / List of Scanned Events */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 no-scrollbar">
          {isLoadingScan ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-primary-200" />
              <p className="text-sm font-bold text-typography-800">Lendo cadastros das programações...</p>
              <p className="text-xs text-typography-400 max-w-sm">
                Procurando datas em Assembleias (CAco/CAbr), Congresso Regional, Reunião de Pioneiros e Escolas.
              </p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-surface-200/30 rounded-3xl border border-dashed border-surface-300">
              <div className="w-12 h-12 rounded-2xl bg-surface-200 flex items-center justify-center text-typography-400">
                <CalendarCheck size={24} />
              </div>
              <p className="text-sm font-bold text-typography-800">Nenhum evento localizado com este filtro.</p>
              <p className="text-xs text-typography-400 max-w-sm">
                Certifique-se de que preencheu as datas nos detalhes das páginas de Assembleia, Congresso ou Escolas.
              </p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const isChecked = ev.selected && !ev.alreadyImported;

              return (
                <div
                  key={ev.key}
                  className={`p-4 rounded-2xl border transition-all ${
                    ev.alreadyImported
                      ? 'bg-surface-200/40 border-surface-300 opacity-60'
                      : isChecked
                      ? 'bg-primary-200/5 border-primary-200 ring-1 ring-primary-200/30 shadow-xs'
                      : 'bg-surface-100 border-surface-300 hover:border-surface-400'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Checkbox */}
                    <button
                      type="button"
                      disabled={ev.alreadyImported}
                      onClick={() => handleToggleSelect(ev.key)}
                      className={`mt-1 w-5 h-5 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                        ev.alreadyImported
                          ? 'border-surface-400 bg-surface-300 text-surface-500 cursor-not-allowed'
                          : isChecked
                          ? 'bg-primary-200 border-primary-200 text-white shadow-xs'
                          : 'border-surface-400 bg-surface-200 hover:border-primary-200'
                      }`}
                    >
                      {ev.alreadyImported ? <Check size={12} /> : isChecked ? <Check size={13} strokeWidth={3} /> : null}
                    </button>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Top labels */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-surface-200 border border-surface-300 shrink-0">
                            {getCategoryIcon(ev.category)}
                          </span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-typography-400">
                            {ev.categoryLabel}
                          </span>
                          {ev.subtitle && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-200 text-typography-600 border border-surface-300">
                              {ev.subtitle}
                            </span>
                          )}
                        </div>

                        {ev.alreadyImported && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} />
                            Já importado na Agenda
                          </span>
                        )}
                      </div>

                      {/* Title & Original string preview */}
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-typography-900 leading-snug">
                          {ev.title}
                        </h4>
                        <p className="text-xs text-typography-500 mt-0.5">
                          Texto cadastrado na folha:{' '}
                          <span className="font-mono font-bold text-typography-800 bg-surface-200/70 px-1.5 py-0.5 rounded">
                            "{ev.rawDate}"
                          </span>
                        </p>
                      </div>

                      {/* Inputs Row for Confirmation */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {/* Data */}
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-typography-400 ml-1 block mb-1">
                            Data Confirmada
                          </label>
                          <div 
                            className="relative cursor-pointer"
                            onClick={(e) => {
                              const input = e.currentTarget.querySelector('input');
                              if (input && !ev.alreadyImported) {
                                if ('showPicker' in HTMLInputElement.prototype) {
                                  try { (input as any).showPicker(); } catch { input.focus(); }
                                } else {
                                  input.focus();
                                }
                              }
                            }}
                          >
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400 pointer-events-none" />
                            <input
                              type="date"
                              value={ev.date}
                              disabled={ev.alreadyImported}
                              onChange={(e) => handleDateChange(ev.key, e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs font-bold text-typography-900 focus:bg-surface-100 focus:border-primary-200 outline-none transition-all disabled:opacity-60 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Hora */}
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-typography-400 ml-1 block mb-1">
                            Horário (Opcional)
                          </label>
                          <div 
                            className="relative cursor-pointer"
                            onClick={(e) => {
                              const input = e.currentTarget.querySelector('input');
                              if (input && !ev.alreadyImported) {
                                if ('showPicker' in HTMLInputElement.prototype) {
                                  try { (input as any).showPicker(); } catch { input.focus(); }
                                } else {
                                  input.focus();
                                }
                              }
                            }}
                          >
                            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400 pointer-events-none" />
                            <input
                              type="time"
                              value={ev.time}
                              disabled={ev.alreadyImported}
                              onChange={(e) => handleTimeChange(ev.key, e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs font-bold text-typography-900 focus:bg-surface-100 focus:border-primary-200 outline-none transition-all disabled:opacity-60 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Local */}
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-typography-400 ml-1 block mb-1">
                            Local do Evento
                          </label>
                          <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                            <input
                              type="text"
                              placeholder="Local não informado"
                              value={ev.location}
                              disabled={ev.alreadyImported}
                              onChange={(e) => handleLocationChange(ev.key, e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs font-bold text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-surface-300 bg-surface-200/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-typography-500 font-medium text-center sm:text-left">
            {selectedCount > 0 ? (
              <span>
                <strong className="text-primary-200">{selectedCount}</strong>{' '}
                {selectedCount === 1 ? 'evento selecionado' : 'eventos selecionados'} para adicionar à agenda
              </span>
            ) : (
              <span>Selecione os eventos que deseja adicionar à sua agenda de Eventos e Tarefas.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-surface-200 hover:bg-surface-300 text-typography-700 font-bold rounded-2xl border border-surface-300 transition-all cursor-pointer text-xs disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedCount === 0 || isImporting}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-primary-200 hover:bg-primary-150 text-white font-bold rounded-2xl shadow-md shadow-primary-200/20 transition-all cursor-pointer text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <CalendarCheck size={15} />
                  <span>Importar Selecionados ({selectedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

