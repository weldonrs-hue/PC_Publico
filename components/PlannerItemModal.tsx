'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  CheckSquare, 
  Clock, 
  MapPin, 
  FileText, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Flag, 
  CalendarCheck, 
  Bell,
  Repeat
} from 'lucide-react';
import { PlannerItem, PlannerItemType, PriorityLevel, TaskStatus, RecurrenceFrequency, RecurrenceUnit } from '@/types/planner';
import { cn } from '@/lib/utils';
import { getTodayDateString, calculateNextRecurrenceDate, formatDisplayDate } from '@/utils/planner';
import CustomSelect from '@/components/CustomSelect';

interface PlannerItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<PlannerItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  itemToEdit?: PlannerItem | null;
}

export default function PlannerItemModal({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
}: PlannerItemModalProps) {
  const [type, setType] = useState<PlannerItemType>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [attentionDate, setAttentionDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('every_3_months');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(3);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>('months');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calcula preview da próxima data de recorrência
  const baseDateForRecurrence = type === 'task' ? (hasDeadline ? dueDate : '') : eventDate;
  const nextRecurrencePreviewDate = useMemo(() => {
    if (!isRecurring || !baseDateForRecurrence) return null;
    return calculateNextRecurrenceDate(baseDateForRecurrence, recurrence, recurrenceInterval, recurrenceUnit);
  }, [isRecurring, baseDateForRecurrence, recurrence, recurrenceInterval, recurrenceUnit]);

  // Inicializa o formulário com dados do item em edição ou valores padrão
  useEffect(() => {
    if (itemToEdit) {
      setType(itemToEdit.type);
      setTitle(itemToEdit.title || '');
      setDescription(itemToEdit.description || '');
      setHasDeadline(Boolean(itemToEdit.hasDeadline && itemToEdit.dueDate));
      setDueDate(itemToEdit.dueDate || '');
      setAttentionDate(itemToEdit.attentionDate || '');
      setPriority(itemToEdit.priority || 'medium');
      setStatus(itemToEdit.status || 'pending');
      setIsRecurring(Boolean(itemToEdit.isRecurring));
      setRecurrence(itemToEdit.recurrence || 'every_3_months');
      setRecurrenceInterval(itemToEdit.recurrenceInterval || 3);
      setRecurrenceUnit(itemToEdit.recurrenceUnit || 'months');
      setEventDate(itemToEdit.date || '');
      setEventTime(itemToEdit.time || '');
      setLocation(itemToEdit.location || '');
      setNotes(itemToEdit.notes || '');
    } else {
      // Valores padrão para novo item
      setType('task');
      setTitle('');
      setDescription('');
      setHasDeadline(false);
      setDueDate('');
      setAttentionDate('');
      setPriority('medium');
      setStatus('pending');
      setIsRecurring(false);
      setRecurrence('every_3_months');
      setRecurrenceInterval(3);
      setRecurrenceUnit('months');
      setEventDate(getTodayDateString());
      setEventTime('');
      setLocation('');
      setNotes('');
    }
    setError(null);
  }, [itemToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Por favor, informe um título.');
      return;
    }

    if (type === 'task' && hasDeadline && !dueDate) {
      setError('Informe a data limite para a tarefa com prazo.');
      return;
    }

    if (type === 'task' && hasDeadline && dueDate && attentionDate && attentionDate > dueDate) {
      setError('A data de início da atenção não pode ser posterior ao prazo final.');
      return;
    }

    if (type === 'event' && !eventDate) {
      setError('Por favor, informe a data do evento.');
      return;
    }

    setLoading(true);
    try {
      if (type === 'task') {
        const isWithDeadline = Boolean(hasDeadline && dueDate);
        await onSave({
          type: 'task',
          title: title.trim(),
          description: description.trim(),
          hasDeadline: isWithDeadline,
          dueDate: isWithDeadline ? dueDate : null,
          attentionDate: isWithDeadline && attentionDate ? attentionDate : null,
          priority,
          status,
          isRecurring,
          recurrence: isRecurring ? recurrence : null,
          recurrenceInterval: isRecurring && recurrence === 'custom' ? recurrenceInterval : null,
          recurrenceUnit: isRecurring && recurrence === 'custom' ? recurrenceUnit : null,
          completedAt: itemToEdit?.completedAt || (status === 'completed' ? new Date().toISOString() : null),
        });
      } else {
        await onSave({
          type: 'event',
          title: title.trim(),
          description: description.trim(),
          priority,
          status: 'pending',
          date: eventDate || null,
          time: eventTime.trim() || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
          isRecurring,
          recurrence: isRecurring ? recurrence : null,
          recurrenceInterval: isRecurring && recurrence === 'custom' ? recurrenceInterval : null,
          recurrenceUnit: isRecurring && recurrence === 'custom' ? recurrenceUnit : null,
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar item:', err);
      setError(err.message || 'Erro ao salvar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-surface-100 border border-surface-300 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden text-typography-900 my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-surface-200/50 border-b border-surface-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
              type === 'task' 
                ? "bg-primary-200/10 border-primary-200/20 text-primary-200" 
                : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
            )}>
              {type === 'task' ? <CheckSquare size={20} /> : <Calendar size={20} />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-typography-900 leading-tight">
                {itemToEdit ? 'Editar Item' : 'Novo Planejamento'}
              </h3>
              <p className="text-xs text-typography-500 font-medium">
                {type === 'task' ? 'Tarefa para execução e acompanhamento' : 'Evento com data e horário'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-typography-400 hover:text-typography-900 hover:bg-surface-200 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Alternador de Tipo (Tarefa vs Evento) */}
          <div className="bg-surface-200/60 p-1.5 rounded-2xl border border-surface-300 flex gap-1.5">
            <button
              type="button"
              onClick={() => setType('task')}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                type === 'task'
                  ? "bg-surface-100 text-typography-900 shadow-xs border border-surface-300/80"
                  : "text-typography-500 hover:text-typography-900"
              )}
            >
              <CheckSquare size={16} className={type === 'task' ? "text-primary-200" : ""} />
              <span>Tarefa</span>
            </button>
            <button
              type="button"
              onClick={() => setType('event')}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                type === 'event'
                  ? "bg-surface-100 text-typography-900 shadow-xs border border-surface-300/80"
                  : "text-typography-500 hover:text-typography-900"
              )}
            >
              <Calendar size={16} className={type === 'event' ? "text-blue-500" : ""} />
              <span>Evento</span>
            </button>
          </div>

          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-2xl flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1">
              Título {type === 'task' ? 'da Tarefa' : 'do Evento'} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'task' ? 'Ex: Preparar relatório de contas' : 'Ex: Reunião com anciãos'}
              className="w-full px-4 py-3 bg-surface-200 border border-surface-300 text-typography-900 rounded-2xl text-sm placeholder:text-typography-400 focus:outline-none focus:border-primary-200 transition-all font-medium"
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais, anotações ou passos a seguir..."
              rows={2}
              className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 text-typography-900 rounded-2xl text-xs sm:text-sm placeholder:text-typography-400 focus:outline-none focus:border-primary-200 transition-all resize-none font-normal"
            />
          </div>

          {/* CAMPOS ESPECÍFICOS DE TAREFA */}
          {type === 'task' && (
            <div className="space-y-4 pt-1 border-t border-surface-300/60">
              {/* Opção Com Prazo / Sem Prazo */}
              <div className="p-4 bg-surface-200/40 rounded-2xl border border-surface-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-typography-900 block">
                      Esta tarefa possui data limite?
                    </span>
                    <span className="text-[11px] text-typography-500">
                      {hasDeadline ? 'Possui prazo final de entrega' : 'Sem prazo (organizada por prioridade)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hasDeadline;
                      setHasDeadline(next);
                      if (next && !dueDate) {
                        setDueDate(getTodayDateString());
                      }
                    }}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer",
                      hasDeadline ? "bg-primary-200" : "bg-surface-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-xs",
                      hasDeadline ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>

                {hasDeadline && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-surface-300/60"
                  >
                    {/* Prazo Final */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={13} className="text-primary-200" />
                        Data Limite (Prazo) *
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-surface-100 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-primary-200 transition-all font-medium"
                      />
                    </div>

                    {/* Início da Atenção */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Bell size={13} className="text-amber-500" />
                        Começar Atenção em (opcional)
                      </label>
                      <input
                        type="date"
                        value={attentionDate}
                        onChange={(e) => setAttentionDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-surface-100 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-primary-200 transition-all font-medium"
                      />
                    </div>

                    <p className="col-span-full text-[10px] text-typography-500 italic">
                      Dica: Antes da data de atenção, a tarefa é considerada &ldquo;futura&rdquo;. A partir dela, ganha destaque para você planejar com antecedência.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Opção de Recorrência / Repetição Periódica */}
              <div className="p-4 bg-surface-200/40 rounded-2xl border border-surface-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Repeat size={15} />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-typography-900 block">
                        Lembrete ou Tarefa Recorrente?
                      </span>
                      <span className="text-[11px] text-typography-500">
                        {isRecurring ? 'Repete periodicamente de forma automática' : 'Ocorrência única'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer",
                      isRecurring ? "bg-indigo-500" : "bg-surface-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-xs",
                      isRecurring ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>

                {isRecurring && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-3 border-t border-surface-300/60"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider">
                        Frequência de Repetição
                      </label>
                      <CustomSelect
                        value={recurrence}
                        onChange={(val) => setRecurrence(val as RecurrenceFrequency)}
                        size="sm"
                        options={[
                          { value: 'every_3_months', label: 'A cada 3 meses (Trimestral)' },
                          { value: 'every_6_months', label: 'A cada 6 meses (Semestral)' },
                          { value: 'yearly', label: 'A cada 1 ano (Anual)' },
                          { value: 'monthly', label: 'A cada mês (Mensal)' },
                          { value: 'every_2_months', label: 'A cada 2 meses (Bimestral)' },
                          { value: 'weekly', label: 'Semanal (a cada 7 dias)' },
                          { value: 'biweekly', label: 'Quinzenal (a cada 14 dias)' },
                          { value: 'custom', label: 'Personalizado...' },
                        ]}
                      />
                    </div>

                    {recurrence === 'custom' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider">
                            A cada:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={recurrenceInterval}
                            onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full px-3.5 py-2 bg-surface-100 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider">
                            Unidade:
                          </label>
                          <CustomSelect
                            value={recurrenceUnit}
                            onChange={(val) => setRecurrenceUnit(val as RecurrenceUnit)}
                            size="sm"
                            options={[
                              { value: 'months', label: 'Meses' },
                              { value: 'days', label: 'Dias' },
                              { value: 'weeks', label: 'Semanas' },
                              { value: 'years', label: 'Anos' },
                            ]}
                          />
                        </div>
                      </div>
                    )}

                    {nextRecurrencePreviewDate && (
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs flex items-center gap-2">
                        <Repeat size={14} className="shrink-0" />
                        <span>
                          Ao concluir esta tarefa, a próxima será agendada para <strong>{formatDisplayDate(nextRecurrencePreviewDate)}</strong>.
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Prioridade */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <Flag size={13} />
                  Importância / Prioridade Manual
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('low')}
                    className={cn(
                      "py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                      priority === 'low'
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                        : "bg-surface-200/50 border-surface-300 text-typography-600 hover:bg-surface-200"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Baixa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('medium')}
                    className={cn(
                      "py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                      priority === 'medium'
                        ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "bg-surface-200/50 border-surface-300 text-typography-600 hover:bg-surface-200"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Média</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('high')}
                    className={cn(
                      "py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                      priority === 'high'
                        ? "bg-red-500/15 border-red-500 text-red-700 dark:text-red-300 shadow-xs"
                        : "bg-surface-200/50 border-surface-300 text-typography-600 hover:bg-surface-200"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Alta</span>
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1">
                  Status Inicial
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'pending', label: 'Pendente' },
                    { value: 'in_progress', label: 'Em Andamento' },
                    { value: 'completed', label: 'Concluída' },
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatus(s.value as TaskStatus)}
                      className={cn(
                        "py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer truncate",
                        status === s.value
                          ? "bg-primary-200/15 border-primary-200 text-primary-200"
                          : "bg-surface-200/40 border-surface-300 text-typography-500 hover:bg-surface-200"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CAMPOS ESPECÍFICOS DE EVENTO */}
          {type === 'event' && (
            <div className="space-y-4 pt-1 border-t border-surface-300/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Data do Evento */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-500" />
                    Data do Evento *
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-200 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-primary-200 transition-all font-medium"
                  />
                </div>

                {/* Horário */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={13} className="text-blue-500" />
                    Horário (opcional)
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-200 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-primary-200 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Local */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <MapPin size={13} className="text-blue-500" />
                  Local (opcional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Salão do Reino Central ou Zoom"
                  className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm placeholder:text-typography-400 focus:outline-none focus:border-primary-200 transition-all font-medium"
                />
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-typography-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-500" />
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais para este compromisso..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-surface-200 border border-surface-300 text-typography-900 rounded-xl text-xs sm:text-sm placeholder:text-typography-400 focus:outline-none focus:border-primary-200 transition-all resize-none font-normal"
                />
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-4 border-t border-surface-300 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-surface-200 hover:bg-surface-300 text-typography-700 font-bold rounded-2xl border border-surface-300 transition-all cursor-pointer text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-3 px-4 bg-primary-200 hover:opacity-90 text-white font-bold rounded-2xl shadow-lg shadow-primary-200/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Salvando...
                </>
              ) : (
                <>
                  <CalendarCheck size={16} />
                  {itemToEdit ? 'Atualizar Item' : 'Criar Item'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

