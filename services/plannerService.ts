import { PlannerItem, CreatePlannerItemDto, UpdatePlannerItemDto } from '@/types/planner';

export async function fetchPlannerItems(): Promise<PlannerItem[]> {
  const res = await fetch('/api/planner/items', { cache: 'no-store' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao carregar itens.');
  }
  const data = await res.json();
  return data.items || [];
}

export async function createPlannerItem(dto: CreatePlannerItemDto): Promise<PlannerItem> {
  const res = await fetch('/api/planner/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao criar item.');
  }
  const data = await res.json();
  return data.item;
}

export async function updatePlannerItem(id: string, dto: UpdatePlannerItemDto): Promise<PlannerItem> {
  const res = await fetch(`/api/planner/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao atualizar item.');
  }
  const data = await res.json();
  return data.item;
}

export async function deletePlannerItem(id: string): Promise<void> {
  const res = await fetch(`/api/planner/items/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao excluir item.');
  }
}
