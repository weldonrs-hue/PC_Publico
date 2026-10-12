import { PlannerItem, CreatePlannerItemDto, UpdatePlannerItemDto } from '@/types/planner';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  getDocs,
  Unsubscribe
} from 'firebase/firestore';
import { calculateNextRecurrenceDate, getTodayDateString } from '@/utils/planner';

/**
 * Escuta em tempo real os itens de planejamento pertencentes a um usuário.
 */
export function subscribePlannerItems(
  userId: string,
  onUpdate: (items: PlannerItem[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const q = query(
      collection(db, 'planner_items'),
      where('userId', '==', userId)
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: PlannerItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        onUpdate(items);
      },
      (error) => {
        console.error('Erro ao subscrever planner_items:', error);
        if (onError) onError(error);
      }
    );

    return () => unsubscribe();
  } catch (err) {
    console.error('Falha ao inicializar listener do planner:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Busca itens via API REST (fallback / carregamento estático).
 */
export async function fetchPlannerItems(): Promise<PlannerItem[]> {
  try {
    const res = await fetch('/api/planner/items', { cache: 'no-store' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao carregar itens.');
    }
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.warn('Fallback para busca direta no Firestore:', error);
    return [];
  }
}

/**
 * Cria um novo item de planejamento (tarefa ou evento).
 * Suporta assinatura compatível: createPlannerItem(userId, dto) ou createPlannerItem(dto)
 */
export async function createPlannerItem(
  userIdOrDto: string | CreatePlannerItemDto,
  maybeDto?: CreatePlannerItemDto
): Promise<PlannerItem> {
  let userId: string = '';
  let dto: CreatePlannerItemDto;

  if (typeof userIdOrDto === 'string') {
    userId = userIdOrDto;
    dto = maybeDto || { type: 'task', title: '' };
  } else {
    dto = userIdOrDto;
    userId = dto.userId || '';
  }

  const nowIso = new Date().toISOString();
  const isCompleted = dto.type === 'task' && dto.status === 'completed';
  const hasRecurrence = Boolean(dto.isRecurring && dto.recurrence && dto.recurrence !== 'none');

  const itemRef = doc(collection(db, 'planner_items'));
  const newItem: PlannerItem = {
    id: itemRef.id,
    userId: userId || dto.userId || '',
    type: dto.type,
    title: (dto.title || '').trim(),
    description: (dto.description || '').trim(),
    hasDeadline: Boolean(dto.hasDeadline && dto.dueDate),
    dueDate: dto.hasDeadline && dto.dueDate ? dto.dueDate : null,
    attentionDate: dto.hasDeadline && dto.attentionDate ? dto.attentionDate : null,
    priority: dto.priority || 'medium',
    status: dto.status || 'pending',
    completedAt: isCompleted ? nowIso : null,
    isRecurring: hasRecurrence,
    recurrence: hasRecurrence ? dto.recurrence || null : null,
    recurrenceInterval: hasRecurrence && dto.recurrenceInterval ? Number(dto.recurrenceInterval) : null,
    recurrenceUnit: hasRecurrence && dto.recurrenceUnit ? dto.recurrenceUnit : null,
    date: dto.type === 'event' && dto.date ? dto.date : null,
    time: dto.type === 'event' && dto.time ? dto.time : null,
    location: dto.type === 'event' && dto.location ? dto.location.trim() : null,
    notes: dto.type === 'event' && dto.notes ? dto.notes.trim() : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const cleanedData: Record<string, any> = {};
  for (const [k, v] of Object.entries(newItem)) {
    if (v !== undefined) cleanedData[k] = v;
  }

  try {
    await setDoc(itemRef, {
      ...cleanedData,
      serverCreatedAt: serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    });
    return newItem;
  } catch (err) {
    // Tenta fallback via rota de API
    const res = await fetch('/api/planner/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao criar item.');
    }
    const data = await res.json();
    return data.item;
  }
}

/**
 * Atualiza um item de planejamento existente.
 */
export async function updatePlannerItem(id: string, dto: UpdatePlannerItemDto): Promise<PlannerItem> {
  const nowIso = new Date().toISOString();
  const updates: Record<string, any> = {
    updatedAt: nowIso,
    serverUpdatedAt: serverTimestamp(),
  };

  if (dto.title !== undefined) updates.title = dto.title.trim();
  if (dto.description !== undefined) updates.description = dto.description.trim();
  if (dto.priority !== undefined) updates.priority = dto.priority;
  if (dto.status !== undefined) {
    updates.status = dto.status;
    if (dto.status === 'completed') {
      updates.completedAt = nowIso;
    } else {
      updates.completedAt = null;
    }
  }
  if (dto.reopen === true) {
    updates.status = 'pending';
    updates.completedAt = null;
  }
  if (dto.hasDeadline !== undefined) {
    updates.hasDeadline = Boolean(dto.hasDeadline);
    if (!updates.hasDeadline) {
      updates.dueDate = null;
      updates.attentionDate = null;
    }
  }
  if (dto.dueDate !== undefined) updates.dueDate = dto.dueDate || null;
  if (dto.attentionDate !== undefined) updates.attentionDate = dto.attentionDate || null;
  if (dto.isRecurring !== undefined) {
    updates.isRecurring = Boolean(dto.isRecurring);
    if (!updates.isRecurring) {
      updates.recurrence = null;
      updates.recurrenceInterval = null;
      updates.recurrenceUnit = null;
    }
  }
  if (dto.recurrence !== undefined) updates.recurrence = dto.recurrence || null;
  if (dto.recurrenceInterval !== undefined) updates.recurrenceInterval = dto.recurrenceInterval ? Number(dto.recurrenceInterval) : null;
  if (dto.recurrenceUnit !== undefined) updates.recurrenceUnit = dto.recurrenceUnit || null;
  if (dto.date !== undefined) updates.date = dto.date || null;
  if (dto.time !== undefined) updates.time = dto.time || null;
  if (dto.location !== undefined) updates.location = dto.location ? dto.location.trim() : null;
  if (dto.notes !== undefined) updates.notes = dto.notes ? dto.notes.trim() : null;

  try {
    const itemRef = doc(db, 'planner_items', id);
    await updateDoc(itemRef, updates);
    return { id, ...updates } as PlannerItem;
  } catch (err) {
    // Fallback para API
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
}

/**
 * Exclui um item de planejamento.
 */
export async function deletePlannerItem(id: string): Promise<void> {
  try {
    const itemRef = doc(db, 'planner_items', id);
    await deleteDoc(itemRef);
  } catch (err) {
    const res = await fetch(`/api/planner/items/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao excluir item.');
    }
  }
}

/**
 * Alterna a conclusão de uma tarefa (conclui ou reabre).
 * Se a tarefa for recorrente, ao concluir cria automaticamente a próxima ocorrência.
 */
export async function toggleCompleteTask(
  item: PlannerItem
): Promise<{ isCompleted: boolean; nextDueDate?: string }> {
  if (item.type !== 'task') {
    return { isCompleted: false };
  }

  const isCurrentlyCompleted = item.status === 'completed';

  // 1. Reabrir tarefa se já estava concluída
  if (isCurrentlyCompleted) {
    await updatePlannerItem(item.id, {
      status: 'pending',
      reopen: true,
    });
    return { isCompleted: false };
  }

  // 2. Marcar tarefa como concluída
  const nowIso = new Date().toISOString();
  await updatePlannerItem(item.id, {
    status: 'completed',
  });

  // 3. Se for recorrente, calcular próxima data e criar novo item agendado
  if (item.isRecurring && item.recurrence && item.recurrence !== 'none') {
    const baseDate = item.dueDate || getTodayDateString();
    const nextDueDate = calculateNextRecurrenceDate(
      baseDate,
      item.recurrence,
      item.recurrenceInterval,
      item.recurrenceUnit
    );

    let nextAttentionDate: string | null = null;
    if (item.attentionDate && item.dueDate) {
      try {
        const diffMs = new Date(item.dueDate + 'T00:00:00').getTime() - new Date(item.attentionDate + 'T00:00:00').getTime();
        const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        const nextDueObj = new Date(nextDueDate + 'T00:00:00');
        nextDueObj.setDate(nextDueObj.getDate() - diffDays);
        const y = nextDueObj.getFullYear();
        const m = String(nextDueObj.getMonth() + 1).padStart(2, '0');
        const d = String(nextDueObj.getDate()).padStart(2, '0');
        nextAttentionDate = `${y}-${m}-${d}`;
      } catch {
        nextAttentionDate = null;
      }
    }

    // Criar próxima tarefa recorrente
    const nextItemDto: CreatePlannerItemDto = {
      userId: item.userId,
      type: 'task',
      title: item.title,
      description: item.description,
      hasDeadline: item.hasDeadline,
      dueDate: nextDueDate,
      attentionDate: nextAttentionDate,
      priority: item.priority,
      status: 'pending',
      isRecurring: true,
      recurrence: item.recurrence,
      recurrenceInterval: item.recurrenceInterval,
      recurrenceUnit: item.recurrenceUnit,
    };

    await createPlannerItem(item.userId, nextItemDto);

    return {
      isCompleted: true,
      nextDueDate,
    };
  }

  return { isCompleted: true };
}
