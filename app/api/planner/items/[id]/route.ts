import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { PlannerItem } from '@/types/planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/planner/items/[id]
 * Busca um item específico garantindo a propriedade do usuário.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await validateAuth(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado. Faça login novamente.' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const itemRef = doc(db, 'planner_items', id);
    const snap = await getDoc(itemRef);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: 'Item não encontrado.' },
        { status: 404 }
      );
    }

    const data = snap.data() as PlannerItem;
    if (data.userId !== user.uid) {
      return NextResponse.json(
        { error: 'Permissão negada para este item.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      item: { ...data, id: snap.id }
    });
  } catch (error: any) {
    console.error(`[GET /api/planner/items/${id}] Erro:`, error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar item.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/planner/items/[id]
 * Atualiza campos do item com regras protegidas de conclusão e reabertura.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await validateAuth(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado. Faça login novamente.' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const itemRef = doc(db, 'planner_items', id);
    const snap = await getDoc(itemRef);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: 'Item não encontrado.' },
        { status: 404 }
      );
    }

    const currentItem = snap.data() as PlannerItem;
    if (currentItem.userId !== user.uid) {
      return NextResponse.json(
        { error: 'Permissão negada para alterar este item.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const nowIso = new Date().toISOString();
    const updates: Partial<PlannerItem> & Record<string, any> = {
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
    };

    // 1. Título
    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json(
          { error: 'O título não pode ser vazio.' },
          { status: 400 }
        );
      }
      updates.title = body.title.trim();
    }

    // 2. Descrição
    if (body.description !== undefined) {
      updates.description = body.description.trim();
    }

    // 3. Regra de Conclusão / Reabertura Protegida no Backend
    if (body.reopen === true) {
      // Reabertura explícita
      updates.status = 'pending';
      updates.completedAt = null;
    } else if (body.status !== undefined) {
      const newStatus = body.status;
      if (!['pending', 'in_progress', 'completed'].includes(newStatus)) {
        return NextResponse.json(
          { error: 'Status inválido.' },
          { status: 400 }
        );
      }
      updates.status = newStatus;

      if (newStatus === 'completed' && currentItem.status !== 'completed') {
        // Tarefa marcada como concluída: registra automaticamente o timestamp
        updates.completedAt = nowIso;
      } else if (newStatus !== 'completed' && currentItem.status === 'completed') {
        // Tarefa reaberta: anula o timestamp de conclusão
        updates.completedAt = null;
      }
    }

    // 4. Prioridade
    if (body.priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(body.priority)) {
        return NextResponse.json(
          { error: 'Prioridade inválida.' },
          { status: 400 }
        );
      }
      updates.priority = body.priority;
    }

    // 5. Prazo e data de atenção
    if (body.hasDeadline !== undefined) {
      updates.hasDeadline = Boolean(body.hasDeadline);
      if (!updates.hasDeadline) {
        updates.dueDate = null;
        updates.attentionDate = null;
      }
    }
    if (updates.hasDeadline !== false) {
      if (body.dueDate !== undefined) {
        updates.dueDate = body.dueDate || null;
      }
      if (body.attentionDate !== undefined) {
        updates.attentionDate = body.attentionDate || null;
      }
    }

    // 6. Recorrência / Lembrete Periódico
    if (body.isRecurring !== undefined) {
      updates.isRecurring = Boolean(body.isRecurring);
      if (!updates.isRecurring) {
        updates.recurrence = null;
        updates.recurrenceInterval = null;
        updates.recurrenceUnit = null;
      }
    }
    if (updates.isRecurring !== false) {
      if (body.recurrence !== undefined) {
        updates.recurrence = body.recurrence || null;
      }
      if (body.recurrenceInterval !== undefined) {
        updates.recurrenceInterval = body.recurrenceInterval ? Number(body.recurrenceInterval) : null;
      }
      if (body.recurrenceUnit !== undefined) {
        updates.recurrenceUnit = body.recurrenceUnit || null;
      }
    }

    // 7. Campos de Evento
    if (body.date !== undefined) {
      updates.date = body.date || null;
    }
    if (body.time !== undefined) {
      updates.time = body.time || null;
    }
    if (body.location !== undefined) {
      updates.location = body.location ? body.location.trim() : null;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes ? body.notes.trim() : null;
    }

    const cleanedUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanedUpdates[k] = v;
    }

    await updateDoc(itemRef, cleanedUpdates);

    return NextResponse.json({
      success: true,
      item: {
        ...currentItem,
        ...updates
      }
    });
  } catch (error: any) {
    console.error(`[PATCH /api/planner/items/${id}] Erro:`, error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar item.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planner/items/[id]
 * Remove um item do planejamento.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await validateAuth(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado. Faça login novamente.' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const itemRef = doc(db, 'planner_items', id);
    const snap = await getDoc(itemRef);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: 'Item não encontrado.' },
        { status: 404 }
      );
    }

    const currentItem = snap.data() as PlannerItem;
    if (currentItem.userId !== user.uid) {
      return NextResponse.json(
        { error: 'Permissão negada para excluir este item.' },
        { status: 403 }
      );
    }

    await deleteDoc(itemRef);

    return NextResponse.json({
      success: true,
      message: 'Item excluído com sucesso.'
    });
  } catch (error: any) {
    console.error(`[DELETE /api/planner/items/${id}] Erro:`, error);
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir item.' },
      { status: 500 }
    );
  }
}
