import { PlannerItem } from '@/types/planner';

export function isItemOverdue(item: PlannerItem): boolean {
  if (item.type !== 'task' || item.status === 'completed' || !item.dueDate) return false;
  const due = new Date(item.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function isItemAttention(item: PlannerItem): boolean {
  if (item.type !== 'task' || item.status === 'completed' || !item.attentionDate) return false;
  const att = new Date(item.attentionDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return att <= today;
}

export function formatPlannerDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function sortPlannerItems(items: PlannerItem[]): PlannerItem[] {
  return [...items].sort((a, b) => {
    // Pendentes primeiro
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;

    // Prioridade alta primeiro
    const pWeight = { high: 3, medium: 2, low: 1 };
    const diffP = (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
    if (diffP !== 0) return diffP;

    // Data de vencimento
    const dateA = a.dueDate || a.date || a.createdAt;
    const dateB = b.dueDate || b.date || b.createdAt;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });
}
