import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { deleteCredential } from '@/lib/server/webauthn-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const body = await req.json().catch(() => ({}));
    const credentialId = body?.credentialId;
    
    if (!credentialId) {
      return NextResponse.json({ error: 'ID da credencial é obrigatório' }, { status: 400, headers: corsHeaders });
    }

    const success = await deleteCredential(credentialId, user.uid, user.token);
    return NextResponse.json({ success }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Delete] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao remover chave de acesso' }, { status: 500, headers: corsHeaders });
  }
}
