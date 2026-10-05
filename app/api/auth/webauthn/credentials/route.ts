import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { getUserCredentials } from '@/lib/server/webauthn-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    const credentials = await getUserCredentials(user.uid, user.token);
    
    // Return only non-sensitive info with device metadata
    const safeCredentials = (credentials || []).map(cred => ({
      id: cred.id,
      deviceName: cred.deviceName || 'Chave de acesso',
      deviceType: cred.deviceType || 'other',
      browserName: cred.browserName || '',
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
      transports: cred.transports || [],
    }));

    return NextResponse.json(safeCredentials, { headers: corsHeaders });
  } catch (error: any) {
    console.warn('[WebAuthn List Credentials] Graceful fallback to empty list:', error.message || error);
    return NextResponse.json([], { headers: corsHeaders });
  }
}
