import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { deleteCredential } from '@/lib/server/webauthn-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { credentialId } = await req.json();
    if (!credentialId) {
      return NextResponse.json({ error: 'ID da credencial é obrigatório' }, { status: 400 });
    }

    const success = await deleteCredential(credentialId, user.uid, user.token);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('[WebAuthn Delete] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao remover chave de acesso' }, { status: 500 });
  }
}
