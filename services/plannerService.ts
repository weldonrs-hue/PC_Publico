import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDocs,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { PlannerItem } from '@/types/planner';
import { 
  calculateNextRecurrenceDate, 
  addDaysSafe, 
  getDaysDifference, 
  getTodayDateString 
} from '@/utils/planner';

const COLLECTION_NAME = 'planner_items';

/**
 * Escuta em tempo real todas as tarefas e eventos de um usuário.
 */
export function subscribePlannerItems(
  userId: string,
  onUpdate: (items: PlannerItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PlannerItem[] = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as any),
      }));
      onUpdate(items);
    },
    (err) => {
      console.error('[subscribePlannerItems] Erro no listener:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Busca itens do planner uma única vez.
 */
export async function getPlannerItems(userId: string): Promise<PlannerItem[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as any),
  }));
}

/**
 * Remove chaves com valor undefined para evitar erro de 'Unsupported field value: undefined' no Firestore.
 */
function sanitizeDocData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Cria um novo item (tarefa ou evento).
 */
export async function createPlannerItem(
  userId: string,
  data: Omit<PlannerItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<PlannerItem> {
  const nowIso = new Date().toISOString();
  const itemRef = doc(collection(db, COLLECTION_NAME));
  const isCompleted = data.type === 'task' && data.status === 'completed';
  const isWithDeadline = data.type === 'task' ? Boolean(data.hasDeadline && data.dueDate) : false;
  const isRecurring = Boolean(data.isRecurring && data.recurrence && data.recurrence !== 'none');

  const newItem: PlannerItem = {
    ...data,
    id: itemRef.id,
    userId,
    hasDeadline: isWithDeadline,
    dueDate: isWithDeadline && data.dueDate ? data.dueDate : null,
    attentionDate: isWithDeadline && data.attentionDate ? data.attentionDate : null,
    isRecurring,
    recurrence: isRecurring ? data.recurrence : null,
    recurrenceInterval: isRecurring && data.recurrenceInterval ? data.recurrenceInterval : null,
    recurrenceUnit: isRecurring && data.recurrenceUnit ? data.recurrenceUnit : null,
    completedAt: isCompleted ? (data.completedAt || nowIso) : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const firestoreData = sanitizeDocData({
    ...newItem,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  await setDoc(itemRef, firestoreData);

  return newItem;
}

/**
 * Atualiza campos de um item existente.
 */
export async function updatePlannerItem(
  itemId: string,
  updates: Partial<PlannerItem>
): Promise<void> {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  const nowIso = new Date().toISOString();

  const cleanedUpdates = sanitizeDocData({
    ...updates,
    updatedAt: nowIso,
    serverUpdatedAt: serverTimestamp(),
  });

  // Se for tarefa e hasDeadline for explicitamente false, garante anulação dos prazos
  if (cleanedUpdates.hasDeadline === false) {
    cleanedUpdates.dueDate = null;
    cleanedUpdates.attentionDate = null;
  }

  // Se isRecurring for explicitamente false, limpa configurações de recorrência
  if (cleanedUpdates.isRecurring === false) {
    cleanedUpdates.recurrence = null;
    cleanedUpdates.recurrenceInterval = null;
    cleanedUpdates.recurrenceUnit = null;
  }

  await updateDoc(itemRef, cleanedUpdates);
}

export interface ToggleCompleteResult {
  isCompleted: boolean;
  nextDueDate?: string;
  nextItem?: PlannerItem;
}

/**
 * Marca uma tarefa como concluída ou reabre uma tarefa concluída.
 * Regra de negócio:
 * - Ao concluir: registra completedAt com o timestamp atual e preserva o prazo original.
 * - Se for recorrente: cria automaticamente a próxima ocorrência com o novo prazo calculado.
 * - Ao reabrir: remove completedAt e altera status para 'pending'.
 */
export async function toggleCompleteTask(item: PlannerItem): Promise<ToggleCompleteResult> {
  if (item.type !== 'task') return { isCompleted: false };

  const itemRef = doc(db, COLLECTION_NAME, item.id);
  const nowIso = new Date().toISOString();

  if (item.status === 'completed') {
    // Reabrir tarefa
    await updateDoc(itemRef, {
      status: 'pending',
      completedAt: null,
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
    });
    return { isCompleted: false };
  } else {
    // Concluir tarefa (antecipada ou no prazo)
    await updateDoc(itemRef, {
      status: 'completed',
      completedAt: nowIso,
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
    });

    let nextDueDate: string | undefined;
    let nextItem: PlannerItem | undefined;

    // Se a tarefa for recorrente e possuir data limite, agenda a próxima ocorrência
    if (item.isRecurring && item.recurrence && item.recurrence !== 'none' && item.hasDeadline && item.dueDate) {
      const freq = item.recurrence;
      const interval = item.recurrenceInterval || 1;
      const unit = item.recurrenceUnit || 'months';
      const today = getTodayDateString();

      let nextDate = calculateNextRecurrenceDate(item.dueDate, freq, interval, unit);
      // Se a data calculada ainda estiver no passado, avança até o próximo ciclo
      let loops = 0;
      while (nextDate < today && loops < 50) {
        nextDate = calculateNextRecurrenceDate(nextDate, freq, interval, unit);
        loops++;
      }
      nextDueDate = nextDate;

      let nextAttentionDate: string | null = null;
      if (item.attentionDate) {
        const offset = getDaysDifference(item.dueDate, item.attentionDate);
        nextAttentionDate = addDaysSafe(nextDueDate, -offset);
      }

      nextItem = await createPlannerItem(item.userId, {
        type: 'task',
        title: item.title,
        description: item.description,
        hasDeadline: true,
        dueDate: nextDueDate,
        attentionDate: nextAttentionDate,
        priority: item.priority,
        status: 'pending',
        isRecurring: true,
        recurrence: item.recurrence,
        recurrenceInterval: item.recurrenceInterval,
        recurrenceUnit: item.recurrenceUnit,
        completedAt: null,
      });
    }

    return {
      isCompleted: true,
      nextDueDate,
      nextItem,
    };
  }
}

/**
 * Exclui um item de planejamento.
 */
export async function deletePlannerItem(itemId: string): Promise<void> {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  await deleteDoc(itemRef);
}

