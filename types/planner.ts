export type PlannerItemType = 'task' | 'event';
export type PlannerPriority = 'low' | 'medium' | 'high';
export type PlannerStatus = 'pending' | 'in_progress' | 'completed';
export type PlannerRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type PlannerRecurrenceUnit = 'days' | 'weeks' | 'months' | 'years';

export interface PlannerItem {
  id: string;
  userId: string;
  type: PlannerItemType;
  title: string;
  description: string;
  hasDeadline: boolean;
  dueDate: string | null;
  attentionDate: string | null;
  priority: PlannerPriority;
  status: PlannerStatus;
  completedAt: string | null;
  isRecurring: boolean;
  recurrence: string | null;
  recurrenceInterval: number | null;
  recurrenceUnit: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  serverCreatedAt?: any;
  serverUpdatedAt?: any;
}

export interface CreatePlannerItemDto {
  type: PlannerItemType;
  title: string;
  description?: string;
  hasDeadline?: boolean;
  dueDate?: string | null;
  attentionDate?: string | null;
  priority?: PlannerPriority;
  status?: PlannerStatus;
  isRecurring?: boolean;
  recurrence?: string | null;
  recurrenceInterval?: number | null;
  recurrenceUnit?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface UpdatePlannerItemDto extends Partial<CreatePlannerItemDto> {
  reopen?: boolean;
}
