import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Test endpoint to verify Firebase ID Token authentication.
 * Returns the authenticated user's UID.
 */
export async function GET(req: NextRequest) {
  const user = await validateAuth(req);

  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const response: any = {
    authenticated: true,
    uid: user.uid,
  };

  if (user.email) {
    response.email = user.email;
  }

  return NextResponse.json(response);
}
