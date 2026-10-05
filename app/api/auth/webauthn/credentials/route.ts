import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { getUserCredentials } from '@/lib/server/webauthn-utils';

export async function GET(req: NextRequest) {
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await getUserCredentials(user.uid, user.token);
    
    // Return only non-sensitive info
    const safeCredentials = (credentials || []).map(cred => ({
      id: cred.id,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
      transports: cred.transports,
    }));

    return NextResponse.json(safeCredentials);
  } catch (error: any) {
    console.warn('[WebAuthn List Credentials] Graceful fallback to empty list:', error.message || error);
    return NextResponse.json([]);
  }
}
