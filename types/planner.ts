export type PlannerItemType = 'task' | 'event';
export type PriorityLevel = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type UrgencySituation =
  | 'completed'       // ✅ Concluída
  | 'overdue'         // ⚠️ Atrasada (prazo expirou)
  | 'urgent'          // 🔴 Urgente (prazo muito próximo)
  | 'attention'       // 🟡/🟠 Atenção (data de atenção atingida ou prazo se aproximando)
  | 'approaching'     // 🟠 Prazo próximo (aproximando da atenção)
  | 'high_priority'   // 🔴 Alta prioridade sem prazo
  | 'medium_priority' // 🟡 Média prioridade sem prazo
  | 'low_priority'    // 🟢 Baixa prioridade sem prazo
  | 'future'          // 🟢 Prazo distante / baixa urgência
  | 'event_today'     // 📅 Evento hoje
  | 'event_upcoming'  // 📅 Evento futuro
  | 'event_past';     // 📅 Evento passado

export type RecurrenceFrequency =
  | 'none'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'every_2_months'
  | 'every_3_months'
  | 'every_6_months'
  | 'yearly'
  | 'custom';

export type RecurrenceUnit = 'days' | 'weeks' | 'months' | 'years';

// Aliases for compatibility
export type PriorityLevel = PlannerPriority;
export type TaskStatus = PlannerStatus;
export type RecurrenceFrequency = PlannerRecurrence;
export type RecurrenceUnit = PlannerRecurrenceUnit;

export interface PlannerItem {
  id: string;
  userId: string;
  type: PlannerItemType;
  title: string;
  description?: string;

  // Propriedades de Tarefa
  hasDeadline?: boolean;
  dueDate?: string | null;            // YYYY-MM-DD
  attentionDate?: string | null;      // YYYY-MM-DD
  priority: PriorityLevel;     // 'low' | 'medium' | 'high'
  status: TaskStatus;          // 'pending' | 'in_progress' | 'completed'
  completedAt?: string | null; // ISO string

  // Recorrência / Lembrete Periódico
  isRecurring?: boolean;
  recurrence?: RecurrenceFrequency | null;
  recurrenceInterval?: number | null; // Usado para intervalo customizado (ex: 3)
  recurrenceUnit?: RecurrenceUnit | null; // 'days' | 'weeks' | 'months' | 'years'

  // Propriedades de Evento
  date?: string | null;               // YYYY-MM-DD
  time?: string | null;               // HH:mm
  location?: string | null;
  notes?: string | null;

  createdAt: string;           // ISO string
  updatedAt: string;           // ISO string
}

export interface UrgencyInfo {
  situation: UrgencySituation;
  label: string;
  badgeText: string;
  badgeClass: string;
  borderColor: string;
  glowColor: string;
  daysRemaining?: number;      // negativo se atrasado
  daysCompletedEarly?: number; // > 0 se concluída antes do prazo
  sortWeight: number;          // menor valor = maior prioridade no topo da lista
}

// Compatibilidade com DTOs
export type PlannerPriority = PriorityLevel;
export type PlannerStatus = TaskStatus;
export type PlannerRecurrence = RecurrenceFrequency;
export type PlannerRecurrenceUnit = RecurrenceUnit;

export interface CreatePlannerItemDto {
  type: PlannerItemType;
  title: string;
  description?: string;
  hasDeadline?: boolean;
  dueDate?: string | null;
  attentionDate?: string | null;
  priority?: PriorityLevel;
  status?: TaskStatus;
  isRecurring?: boolean;
  recurrence?: RecurrenceFrequency | null;
  recurrenceInterval?: number | null;
  recurrenceUnit?: RecurrenceUnit | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  notes?: string | null;
  userId?: string;
}

export interface UpdatePlannerItemDto extends Partial<CreatePlannerItemDto> {
  reopen?: boolean;
}


