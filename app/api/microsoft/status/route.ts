import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await validateAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const connectionDoc = await db.collection('microsoft_connections').doc(user.uid).get();

    if (!connectionDoc.exists) {
      return NextResponse.json({ connected: false });
    }

    const data = connectionDoc.data();
    return NextResponse.json({
      connected: true,
      email: data?.email,
      connectedAt: data?.connectedAt?.toDate()
    });
  } catch (error) {
    console.error('[Microsoft Status] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
