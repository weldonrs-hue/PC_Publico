import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { PlannerItem } from '@/types/planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/planner/items
 * Lista todas as tarefas e eventos pertencentes ao usuário autenticado.
 */
export async function GET(req: NextRequest) {
  const user = await validateAuth(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado. Faça login novamente.' },
      { status: 401 }
    );
  }

  try {
    const q = query(
      collection(db, 'planner_items'),
      where('userId', '==', user.uid)
    );

    const snapshot = await getDocs(q);
    const items: PlannerItem[] = snapshot.docs.map(d => ({
      id: d.id,
      ...(d.data() as any)
    }));

    return NextResponse.json({
      success: true,
      items
    });
  } catch (error: any) {
    console.error('[GET /api/planner/items] Erro ao buscar itens:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar itens de planejamento.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/planner/items
 * Cria uma nova tarefa ou evento.
 */
export async function POST(req: NextRequest) {
  const user = await validateAuth(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado. Faça login novamente.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { 
      type, 
      title, 
      description = '', 
      hasDeadline = false, 
      dueDate = null, 
      attentionDate = null, 
      priority = 'medium', 
      status = 'pending',
      date = null,
      time = null,
      location = '',
      notes = ''
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'O título é obrigatório.' },
        { status: 400 }
      );
    }

    if (!type || !['task', 'event'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Deve ser "task" ou "event".' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const isCompleted = type === 'task' && status === 'completed';

    const itemRef = doc(collection(db, 'planner_items'));
    const newItem: PlannerItem = {
      id: itemRef.id,
      userId: user.uid,
      type,
      title: title.trim(),
      description: description.trim(),
      hasDeadline: type === 'task' ? Boolean(hasDeadline && dueDate) : false,
      dueDate: type === 'task' && hasDeadline && dueDate ? dueDate : undefined,
      attentionDate: type === 'task' && hasDeadline && attentionDate ? attentionDate : undefined,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      status: ['pending', 'in_progress', 'completed'].includes(status) ? status : 'pending',
      completedAt: isCompleted ? nowIso : null,
      date: type === 'event' && date ? date : undefined,
      time: type === 'event' && time ? time : undefined,
      location: type === 'event' ? location.trim() : undefined,
      notes: type === 'event' ? notes.trim() : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(itemRef, {
      ...newItem,
      serverCreatedAt: serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      item: newItem
    }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/planner/items] Erro ao criar item:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar novo item.' },
      { status: 500 }
    );
  }
}
