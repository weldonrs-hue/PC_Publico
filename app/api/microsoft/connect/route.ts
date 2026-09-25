import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/server/auth';
import { generateRandomString, generateCodeChallenge, verifyMicrosoftConfig } from '@/lib/server/microsoft-oauth';
import { getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('[Microsoft Connect] Request headers:', Array.from(req.headers.keys()));
    const authHeader = req.headers.get('Authorization');
    console.log('[Microsoft Connect] Auth header present:', !!authHeader);
    
    // 1. Validate Firebase User
    const user = await validateAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify Config
    verifyMicrosoftConfig();

    // 3. Generate OAuth Params
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // 4. Store State and Verifier in Firestore (Temporary)
    // We link the OAuth process to the Firebase UID that started it.
    const db = getAdminDb();
    await db.collection('oauth_attempts').doc(state).set({
      uid: user.uid,
      codeVerifier: codeVerifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    });

    // 5. Build Microsoft Auth URL
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', process.env.MICROSOFT_REDIRECT_URI!);
    authUrl.searchParams.set('scope', 'openid email offline_access https://outlook.office.com/SMTP.Send');
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('prompt', 'select_account');

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error: any) {
    console.error('[Microsoft Connect] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
