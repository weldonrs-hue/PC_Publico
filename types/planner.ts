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

export interface PlannerItem {
  id: string;
  userId: string;
  type: PlannerItemType;
  title: string;
  description?: string;

  // Propriedades de Tarefa
  hasDeadline?: boolean;
  dueDate?: string;            // YYYY-MM-DD
  attentionDate?: string;      // YYYY-MM-DD
  priority: PriorityLevel;     // 'low' | 'medium' | 'high'
  status: TaskStatus;          // 'pending' | 'in_progress' | 'completed'
  completedAt?: string | null; // ISO string

  // Propriedades de Evento
  date?: string;               // YYYY-MM-DD
  time?: string;               // HH:mm
  location?: string;
  notes?: string;

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
