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

  const newItem: PlannerItem = {
    ...data,
    id: itemRef.id,
    userId,
    hasDeadline: isWithDeadline,
    dueDate: isWithDeadline && data.dueDate ? data.dueDate : null,
    attentionDate: isWithDeadline && data.attentionDate ? data.attentionDate : null,
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

  await updateDoc(itemRef, cleanedUpdates);
}

/**
 * Marca uma tarefa como concluída ou reabre uma tarefa concluída.
 * Regra de negócio:
 * - Ao concluir: registra completedAt com o timestamp atual e preserva o prazo original.
 * - Ao reabrir: remove completedAt e altera status para 'pending'.
 */
export async function toggleCompleteTask(item: PlannerItem): Promise<boolean> {
  if (item.type !== 'task') return false;

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
    return false; // agora não concluída
  } else {
    // Concluir tarefa (antecipada ou no prazo)
    await updateDoc(itemRef, {
      status: 'completed',
      completedAt: nowIso,
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
    });
    return true; // agora concluída
  }
}

/**
 * Exclui um item de planejamento.
 */
export async function deletePlannerItem(itemId: string): Promise<void> {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  await deleteDoc(itemRef);
}

