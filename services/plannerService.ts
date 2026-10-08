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
 * Cria um novo item (tarefa ou evento).
 */
export async function createPlannerItem(
  userId: string,
  data: Omit<PlannerItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<PlannerItem> {
  const nowIso = new Date().toISOString();
  const itemRef = doc(collection(db, COLLECTION_NAME));
  const isCompleted = data.type === 'task' && data.status === 'completed';

  const newItem: PlannerItem = {
    ...data,
    id: itemRef.id,
    userId,
    completedAt: isCompleted ? nowIso : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(itemRef, {
    ...newItem,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

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

  await updateDoc(itemRef, {
    ...updates,
    updatedAt: nowIso,
    serverUpdatedAt: serverTimestamp(),
  });
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
