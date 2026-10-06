import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import firebaseConfig from '@/firebase-applet-config.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
  }

  try {
    const { credentialId, newName } = await req.json();
    if (!credentialId || !newName || typeof newName !== 'string') {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400, headers: corsHeaders });
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'O nome não pode estar vazio' }, { status: 400, headers: corsHeaders });
    }

    // 1. Atualizar via REST se token estiver disponível
    if (user.token) {
      try {
        const projectId = firebaseConfig.projectId;
        const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
        const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${credentialId}?updateMask.fieldPaths=deviceName`;
        await fetch(docUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            fields: {
              deviceName: { stringValue: trimmedName },
            },
          }),
        });
      } catch (err) {
        console.warn('REST rename notice:', err);
      }
    }

    // 2. Atualizar via Admin SDK
    try {
      const db = getAdminDb();
      await db.collection('webauthn_credentials').doc(credentialId).update({
        deviceName: trimmedName,
      });
    } catch (adminErr) {
      // Non-fatal
    }

    return NextResponse.json({ success: true, newName: trimmedName }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Rename] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao renomear chave' }, { status: 500, headers: corsHeaders });
  }
}
