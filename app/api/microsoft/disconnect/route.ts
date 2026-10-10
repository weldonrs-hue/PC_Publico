import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await validateAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    await db.collection('microsoft_connections').doc(user.uid).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Microsoft Disconnect] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
