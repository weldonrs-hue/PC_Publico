import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
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

    // Atualizar via REST
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      let docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${encodeURIComponent(credentialId)}?updateMask.fieldPaths=deviceName`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      } else if (firebaseConfig.apiKey) {
        docUrl += `&key=${firebaseConfig.apiKey}`;
      }

      await fetch(docUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            deviceName: { stringValue: trimmedName },
          },
        }),
      });
    } catch (err) {
      console.warn('REST rename notice:', err);
    }

    return NextResponse.json({ success: true, newName: trimmedName }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Rename] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao renomear chave' }, { status: 500, headers: corsHeaders });
  }
}
