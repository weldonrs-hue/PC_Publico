import { PlannerItem, UrgencyInfo, UrgencySituation, RecurrenceFrequency, RecurrenceUnit } from '@/types/planner';

/**
 * Limiares centralizados de urgência em dias.
 * Fáceis de ajustar e reutilizar no sistema.
 */
export const PLANNER_THRESHOLDS = {
  URGENT_DAYS: 3,     // Tarefas a 3 dias ou menos do prazo são consideradas Urgentes
  ATTENTION_DAYS: 7,  // Tarefas a 7 dias ou menos entram em período de Atenção (quando não há data de atenção explícita)
};

/**
 * Retorna a data atual no formato YYYY-MM-DD considerando o fuso horário local.
 * Evita bugs clássicos do UTC onde o dia muda horas antes da meia-noite local.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Faz parse seguro de uma string YYYY-MM-DD para Date local ao meio-dia.
 * O horário de 12:00:00 protege contra qualquer variação de horário de verão (DST).
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] || 2026;
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Calcula a diferença em dias inteiros entre duas datas no formato YYYY-MM-DD.
 * Retorna positivo se targetDate for futuro em relação a fromDate.
 * Retorna negativo se targetDate já tiver passado.
 */
export function getDaysDifference(targetDateStr: string, fromDateStr?: string): number {
  if (!targetDateStr) return 0;
  const from = parseLocalDate(fromDateStr || getTodayDateString());
  const target = parseLocalDate(targetDateStr);
  const diffMs = target.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formata YYYY-MM-DD para exibição amigável em pt-BR (DD/MM/AAAA).
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Formata data e horário para exibição de eventos.
 */
export function formatDisplayDateTime(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return '';
  const dateFormatted = formatDisplayDate(dateStr);
  if (timeStr) {
    return `${dateFormatted} às ${timeStr}`;
  }
  return dateFormatted;
}

/**
 * Determina a situação de urgência, estilo visual e prioridade de ordenação de um item.
 * Centraliza toda a regra de negócio da aplicação.
 */
export function getPlannerItemUrgency(item: PlannerItem, todayOverride?: string): UrgencyInfo {
  const today = todayOverride || getTodayDateString();

  // 1. TAREFA CONCLUÍDA
  // Uma tarefa concluída nunca deve continuar aparecendo como urgente ou atrasada.
  if (item.type === 'task' && item.status === 'completed') {
    let daysCompletedEarly: number | undefined;

    if (item.hasDeadline && item.dueDate && item.completedAt) {
      // Extrai o dia do timestamp de conclusão YYYY-MM-DD
      const completedDateStr = item.completedAt.substring(0, 10);
      const diff = getDaysDifference(item.dueDate, completedDateStr);
      if (diff > 0) {
        daysCompletedEarly = diff;
      }
    }

    return {
      situation: 'completed',
      label: 'Concluída',
      badgeText: daysCompletedEarly 
        ? `Concluída ${daysCompletedEarly} ${daysCompletedEarly === 1 ? 'dia' : 'dias'} antes do prazo`
        : 'Concluída',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      borderColor: '#10B981',
      glowColor: '#10B981',
      daysCompletedEarly,
      sortWeight: 200,
    };
  }

  // 2. EVENTO
  if (item.type === 'event') {
    if (!item.date) {
      return {
        situation: 'event_upcoming',
        label: 'Evento',
        badgeText: 'Evento',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        borderColor: '#3B82F6',
        glowColor: '#3B82F6',
        sortWeight: 60,
      };
    }

    const daysUntilEvent = getDaysDifference(item.date, today);

    if (daysUntilEvent === 0) {
      return {
        situation: 'event_today',
        label: 'Hoje',
        badgeText: 'Evento Hoje',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        borderColor: '#F59E0B',
        glowColor: '#F59E0B',
        daysRemaining: 0,
        sortWeight: 25,
      };
    }

    if (daysUntilEvent > 0) {
      return {
        situation: 'event_upcoming',
        label: daysUntilEvent === 1 ? 'Amanhã' : `Em ${daysUntilEvent} dias`,
        badgeText: daysUntilEvent === 1 ? 'Evento Amanhã' : `Evento em ${daysUntilEvent} dias`,
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        borderColor: '#3B82F6',
        glowColor: '#3B82F6',
        daysRemaining: daysUntilEvent,
        sortWeight: daysUntilEvent <= 7 ? 35 + daysUntilEvent : 60 + daysUntilEvent,
      };
    }

    return {
      situation: 'event_past',
      label: 'Passado',
      badgeText: 'Evento Passado',
      badgeClass: 'bg-surface-200 text-typography-500 border-surface-300',
      borderColor: '#94A3B8',
      glowColor: '#94A3B8',
      daysRemaining: daysUntilEvent,
      sortWeight: 100,
    };
  }

  // 3. TAREFA COM PRAZO
  if (item.type === 'task' && item.hasDeadline && item.dueDate) {
    const daysRemaining = getDaysDifference(item.dueDate, today);

    // 3.1. Atrasada (prazo venceu)
    if (daysRemaining < 0) {
      const daysOverdue = Math.abs(daysRemaining);
      return {
        situation: 'overdue',
        label: `Atrasada (${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'})`,
        badgeText: `Atrasada há ${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'}`,
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse',
        borderColor: '#EF4444',
        glowColor: '#EF4444',
        daysRemaining,
        // Mais atrasada = menor sortWeight (fica mais no topo)
        sortWeight: 10 - Math.min(daysOverdue, 9),
      };
    }

    // 3.2. Urgente (vence hoje ou nos próximos URGENT_DAYS)
    if (daysRemaining <= PLANNER_THRESHOLDS.URGENT_DAYS) {
      let label = 'Urgente';
      if (daysRemaining === 0) label = 'Vence Hoje';
      else if (daysRemaining === 1) label = 'Vence Amanhã';
      else label = `Vence em ${daysRemaining} dias`;

      return {
        situation: 'urgent',
        label,
        badgeText: label,
        badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
        borderColor: '#DC2626',
        glowColor: '#DC2626',
        daysRemaining,
        sortWeight: 20 + daysRemaining,
      };
    }

    // 3.3. Atenção pela data personalizada de início de atenção
    if (item.attentionDate && today >= item.attentionDate) {
      return {
        situation: 'attention',
        label: 'Em Atenção',
        badgeText: `Atenção: vence em ${daysRemaining} dias`,
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
        borderColor: '#F59E0B',
        glowColor: '#F59E0B',
        daysRemaining,
        sortWeight: 30 + Math.min(daysRemaining, 10),
      };
    }

    // 3.4. Atenção automática por proximidade padrão (ATTENTION_DAYS)
    if (daysRemaining <= PLANNER_THRESHOLDS.ATTENTION_DAYS) {
      return {
        situation: 'approaching',
        label: `Prazo Próximo (${daysRemaining}d)`,
        badgeText: `Prazo em ${daysRemaining} dias`,
        badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
        borderColor: '#F97316',
        glowColor: '#F97316',
        daysRemaining,
        sortWeight: 50 + daysRemaining,
      };
    }

    // 3.5. Futura (prazo distante e ainda fora da janela de atenção)
    return {
      situation: 'future',
      label: `Vence em ${daysRemaining} dias`,
      badgeText: `Prazo: ${formatDisplayDate(item.dueDate)}`,
      badgeClass: 'bg-surface-200 text-typography-600 border-surface-300',
      borderColor: item.priority === 'high' ? '#8B5CF6' : '#10B981',
      glowColor: '#10B981',
      daysRemaining,
      sortWeight: 70 + Math.min(daysRemaining, 30),
    };
  }

  // 4. TAREFA SEM PRAZO
  // Organizada estritamente pela prioridade manual escolhida pelo usuário
  if (item.priority === 'high') {
    return {
      situation: 'high_priority',
      label: 'Alta Prioridade',
      badgeText: 'Prioridade Alta',
      badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
      borderColor: '#DC2626',
      glowColor: '#DC2626',
      sortWeight: 40,
    };
  }

  if (item.priority === 'medium') {
    return {
      situation: 'medium_priority',
      label: 'Média Prioridade',
      badgeText: 'Prioridade Média',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
      borderColor: '#F59E0B',
      glowColor: '#F59E0B',
      sortWeight: 80,
    };
  }

  // Baixa prioridade
  return {
    situation: 'low_priority',
    label: 'Baixa Prioridade',
    badgeText: 'Prioridade Baixa',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    borderColor: '#10B981',
    glowColor: '#10B981',
    sortWeight: 90,
  };
}

/**
 * Ordena lista de PlannerItem por urgência e relevância preditiva.
 */
export function sortPlannerItems(items: PlannerItem[], todayOverride?: string): PlannerItem[] {
  const today = todayOverride || getTodayDateString();

  return [...items].sort((a, b) => {
    const urgencyA = getPlannerItemUrgency(a, today);
    const urgencyB = getPlannerItemUrgency(b, today);

    // 1. Compara pesos de ordenação primários
    if (urgencyA.sortWeight !== urgencyB.sortWeight) {
      return urgencyA.sortWeight - urgencyB.sortWeight;
    }

    // 2. Se ambos forem concluídos, o mais recentemente concluído vem primeiro
    if (a.status === 'completed' && b.status === 'completed') {
      const dateA = a.completedAt || a.updatedAt || '';
      const dateB = b.completedAt || b.updatedAt || '';
      return dateB.localeCompare(dateA);
    }

    // 3. Critério de desempate por data mais próxima
    const dateA = a.dueDate || a.date || '';
    const dateB = b.dueDate || b.date || '';
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // 4. Critério por título
    return a.title.localeCompare(b.title);
  });
}

/**
 * Adiciona meses a uma data YYYY-MM-DD de forma segura sem estourar o mês.
 * Exemplo: 31/01 + 1 mês = 28/02 (ou 29/02 em ano bissexto).
 * Exemplo: 31/03 + 3 meses = 30/06.
 */
export function addMonthsSafe(dateStr: string, monthsToAdd: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  const targetMonthIndex = month + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Último dia do mês alvo
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  const y = targetYear.toString().padStart(4, '0');
  const m = (targetMonth + 1).toString().padStart(2, '0');
  const d = targetDay.toString().padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/**
 * Adiciona dias a uma data YYYY-MM-DD de forma segura.
 */
export function addDaysSafe(dateStr: string, daysToAdd: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calcula a próxima data de ocorrência com base na regra de recorrência.
 */
export function calculateNextRecurrenceDate(
  baseDateStr: string,
  frequency: RecurrenceFrequency,
  interval: number = 1,
  unit: RecurrenceUnit = 'months'
): string {
  switch (frequency) {
    case 'weekly':
      return addDaysSafe(baseDateStr, 7);
    case 'biweekly':
      return addDaysSafe(baseDateStr, 14);
    case 'monthly':
      return addMonthsSafe(baseDateStr, 1);
    case 'every_2_months':
      return addMonthsSafe(baseDateStr, 2);
    case 'every_3_months':
      return addMonthsSafe(baseDateStr, 3);
    case 'every_6_months':
      return addMonthsSafe(baseDateStr, 6);
    case 'yearly':
      return addMonthsSafe(baseDateStr, 12);
    case 'custom': {
      const count = Math.max(1, interval || 1);
      if (unit === 'days') return addDaysSafe(baseDateStr, count);
      if (unit === 'weeks') return addDaysSafe(baseDateStr, count * 7);
      if (unit === 'months') return addMonthsSafe(baseDateStr, count);
      if (unit === 'years') return addMonthsSafe(baseDateStr, count * 12);
      return addMonthsSafe(baseDateStr, count);
    }
    default:
      return baseDateStr;
  }
}

/**
 * Retorna o rótulo legível em português da regra de recorrência.
 */
export function getRecurrenceLabel(
  frequency?: RecurrenceFrequency | null,
  interval?: number | null,
  unit?: RecurrenceUnit | null
): string {
  if (!frequency || frequency === 'none') return '';
  switch (frequency) {
    case 'weekly':
      return 'Semanal';
    case 'biweekly':
      return 'Quinzenal';
    case 'monthly':
      return 'A cada mês';
    case 'every_2_months':
      return 'A cada 2 meses';
    case 'every_3_months':
      return 'A cada 3 meses';
    case 'every_6_months':
      return 'A cada 6 meses';
    case 'yearly':
      return 'A cada 1 ano';
    case 'custom': {
      const count = interval || 1;
      if (unit === 'days') return `A cada ${count} ${count === 1 ? 'dia' : 'dias'}`;
      if (unit === 'weeks') return `A cada ${count} ${count === 1 ? 'semana' : 'semanas'}`;
      if (unit === 'years') return `A cada ${count} ${count === 1 ? 'ano' : 'anos'}`;
      return `A cada ${count} ${count === 1 ? 'mês' : 'meses'}`;
    }
    default:
      return '';
  }
}

