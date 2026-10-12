import { PlannerItem } from '@/types/planner';

export interface PlannerItemUrgency {
  situation:
    | 'overdue'
    | 'urgent'
    | 'attention'
    | 'approaching'
    | 'event_today'
    | 'event_upcoming'
    | 'event_past'
    | 'completed'
    | 'normal';
  badgeText: string;
  badgeClass: string;
  glowColor: string;
  borderColor: string;
  daysDiff?: number;
  daysCompletedEarly?: number;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatDisplayDateTime(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return '';
  const dateFormatted = formatDisplayDate(dateStr);
  if (timeStr) {
    return `${dateFormatted} às ${timeStr}`;
  }
  return dateFormatted;
}

export function formatPlannerDate(dateStr?: string | null): string {
  return formatDisplayDate(dateStr);
}

export function getRecurrenceLabel(
  recurrence?: string | null,
  interval?: number | null,
  unit?: string | null
): string {
  if (!recurrence || recurrence === 'none') return 'Sem repetição';
  const effectiveInterval = interval && interval > 1 ? interval : 1;

  if (unit) {
    if (unit === 'days') return effectiveInterval === 1 ? 'Diário' : `A cada ${effectiveInterval} dias`;
    if (unit === 'weeks') return effectiveInterval === 1 ? 'Semanal' : `A cada ${effectiveInterval} semanas`;
    if (unit === 'months') return effectiveInterval === 1 ? 'Mensal' : `A cada ${effectiveInterval} meses`;
    if (unit === 'years') return effectiveInterval === 1 ? 'Anual' : `A cada ${effectiveInterval} anos`;
  }

  switch (recurrence) {
    case 'daily':
      return effectiveInterval === 1 ? 'Diário' : `A cada ${effectiveInterval} dias`;
    case 'weekly':
      return effectiveInterval === 1 ? 'Semanal' : `A cada ${effectiveInterval} semanas`;
    case 'monthly':
      return effectiveInterval === 1 ? 'Mensal' : `A cada ${effectiveInterval} meses`;
    case 'yearly':
      return effectiveInterval === 1 ? 'Anual' : `A cada ${effectiveInterval} anos`;
    default:
      return 'Recorrente';
  }
}

export function calculateNextRecurrenceDate(
  baseDateStr: string,
  recurrence?: string | null,
  interval?: number | null,
  unit?: string | null
): string {
  if (!baseDateStr) return getTodayDateString();
  const clean = baseDateStr.includes('T') ? baseDateStr.split('T')[0] : baseDateStr;
  const parts = clean.split('-').map(Number);
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);

  const step = interval && interval > 0 ? interval : 1;

  if (unit === 'days' || recurrence === 'daily') {
    dt.setDate(dt.getDate() + step);
  } else if (unit === 'weeks' || recurrence === 'weekly') {
    dt.setDate(dt.getDate() + step * 7);
  } else if (unit === 'months' || recurrence === 'monthly') {
    dt.setMonth(dt.getMonth() + step);
  } else if (unit === 'years' || recurrence === 'yearly') {
    dt.setFullYear(dt.getFullYear() + step);
  } else {
    dt.setDate(dt.getDate() + step * 7);
  }

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isItemOverdue(item: PlannerItem): boolean {
  if (item.type !== 'task' || item.status === 'completed' || !item.dueDate) return false;
  const due = new Date(item.dueDate + (item.dueDate.includes('T') ? '' : 'T00:00:00'));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function isItemAttention(item: PlannerItem): boolean {
  if (item.type !== 'task' || item.status === 'completed' || !item.attentionDate) return false;
  const att = new Date(item.attentionDate + (item.attentionDate.includes('T') ? '' : 'T00:00:00'));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return att <= today;
}

export function getPlannerItemUrgency(item: PlannerItem, todayDateStr?: string): PlannerItemUrgency {
  const todayStr = todayDateStr || getTodayDateString();
  const todayDate = new Date(todayStr + 'T00:00:00');

  // Caso 1: Tarefa Concluída
  if (item.type === 'task' && item.status === 'completed') {
    let daysCompletedEarly: number | undefined;
    if (item.dueDate && item.completedAt) {
      const compStr = item.completedAt.substring(0, 10);
      const dueDate = new Date(item.dueDate + 'T00:00:00');
      const compDate = new Date(compStr + 'T00:00:00');
      const diff = Math.round((dueDate.getTime() - compDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        daysCompletedEarly = diff;
      }
    }

    return {
      situation: 'completed',
      badgeText: daysCompletedEarly ? `Concluída (${daysCompletedEarly}d antes)` : 'Concluída',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      glowColor: '#10b981',
      borderColor: '#10b981',
      daysCompletedEarly,
    };
  }

  // Caso 2: Tarefa Pendente
  if (item.type === 'task') {
    if (!item.hasDeadline || !item.dueDate) {
      return {
        situation: 'normal',
        badgeText: 'Sem Prazo',
        badgeClass: 'bg-surface-200 text-typography-600 border-surface-300',
        glowColor: '#94a3b8',
        borderColor: '#94a3b8',
      };
    }

    const dueDate = new Date(item.dueDate + 'T00:00:00');
    const daysDiff = Math.round((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    // Atrasada
    if (daysDiff < 0) {
      return {
        situation: 'overdue',
        badgeText: `Atrasada (${Math.abs(daysDiff)}d)`,
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold',
        glowColor: '#ef4444',
        borderColor: '#ef4444',
        daysDiff,
      };
    }

    // Vence Hoje
    if (daysDiff === 0) {
      return {
        situation: 'urgent',
        badgeText: 'Vence Hoje',
        badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-bold',
        glowColor: '#f43f5e',
        borderColor: '#f43f5e',
        daysDiff: 0,
      };
    }

    // Urgente (1 a 2 dias)
    if (daysDiff <= 2) {
      return {
        situation: 'urgent',
        badgeText: `Vence em ${daysDiff}d`,
        badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 font-bold',
        glowColor: '#f97316',
        borderColor: '#f97316',
        daysDiff,
      };
    }

    // Em Atenção (data de atenção alcançada)
    if (item.attentionDate) {
      const attDate = new Date(item.attentionDate + 'T00:00:00');
      if (todayDate >= attDate) {
        return {
          situation: 'attention',
          badgeText: `Atenção (${daysDiff}d)`,
          badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold',
          glowColor: '#f59e0b',
          borderColor: '#f59e0b',
          daysDiff,
        };
      }
    }

    // Aproximando do prazo (até 7 dias)
    if (daysDiff <= 7) {
      return {
        situation: 'approaching',
        badgeText: `Em ${daysDiff} dias`,
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        glowColor: '#3b82f6',
        borderColor: '#3b82f6',
        daysDiff,
      };
    }

    // Prazo Normal
    return {
      situation: 'normal',
      badgeText: `Prazo (${daysDiff}d)`,
      badgeClass: 'bg-surface-200 text-typography-700 border-surface-300',
      glowColor: '#64748b',
      borderColor: '#64748b',
      daysDiff,
    };
  }

  // Caso 3: Evento
  if (!item.date) {
    return {
      situation: 'normal',
      badgeText: 'Evento',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      glowColor: '#3b82f6',
      borderColor: '#3b82f6',
    };
  }

  const evDate = new Date(item.date + 'T00:00:00');
  const daysDiff = Math.round((evDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    return {
      situation: 'event_today',
      badgeText: 'Evento Hoje',
      badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30 font-bold',
      glowColor: '#3b82f6',
      borderColor: '#3b82f6',
      daysDiff: 0,
    };
  }

  if (daysDiff > 0) {
    return {
      situation: 'event_upcoming',
      badgeText: daysDiff === 1 ? 'Amanhã' : `Em ${daysDiff}d`,
      badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      glowColor: '#0ea5e9',
      borderColor: '#0ea5e9',
      daysDiff,
    };
  }

  return {
    situation: 'event_past',
    badgeText: `Passado (${Math.abs(daysDiff)}d)`,
    badgeClass: 'bg-surface-200 text-typography-400 border-surface-300',
    glowColor: '#94a3b8',
    borderColor: '#94a3b8',
    daysDiff,
  };
}

export function sortPlannerItems(items: PlannerItem[], todayStr?: string): PlannerItem[] {
  const today = todayStr || getTodayDateString();

  const getSituationWeight = (item: PlannerItem): number => {
    if (item.type === 'task' && item.status === 'completed') return 0;
    const urgency = getPlannerItemUrgency(item, today);
    switch (urgency.situation) {
      case 'overdue':
        return 6;
      case 'urgent':
        return 5;
      case 'event_today':
        return 5;
      case 'attention':
        return 4;
      case 'approaching':
        return 3;
      case 'event_upcoming':
        return 2;
      case 'normal':
        return 1;
      case 'event_past':
        return 0;
      default:
        return 1;
    }
  };

  const getPriorityWeight = (priority: string): number => {
    switch (priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  };

  return [...items].sort((a, b) => {
    // 1. Pendentes antes de concluídas
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;

    // 2. Situação de urgência / atraso
    const sitA = getSituationWeight(a);
    const sitB = getSituationWeight(b);
    if (sitA !== sitB) return sitB - sitA;

    // 3. Prioridade (Alta > Média > Baixa)
    const prioA = getPriorityWeight(a.priority);
    const prioB = getPriorityWeight(b.priority);
    if (prioA !== prioB) return prioB - prioA;

    // 4. Data de vencimento / evento
    const dateA = a.dueDate || a.date || a.createdAt;
    const dateB = b.dueDate || b.date || b.createdAt;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });
}
