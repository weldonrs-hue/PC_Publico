import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getMicrosoftProfile, encryptToken } from '@/lib/server/microsoft-oauth';
import { getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('[Microsoft Callback] Error from provider:', error);
    return NextResponse.redirect(new URL('/?error=microsoft_auth_failed', req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=missing_params', req.url));
  }

  try {
    const db = getAdminDb();
    const attemptDoc = await db.collection('oauth_attempts').doc(state).get();

    if (!attemptDoc.exists) {
      return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
    }

    const attemptData = attemptDoc.data();
    const now = new Date();

    if (attemptData?.expiresAt.toDate() < now) {
      await db.collection('oauth_attempts').doc(state).delete();
      return NextResponse.redirect(new URL('/?error=state_expired', req.url));
    }

    // 1. Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, attemptData?.codeVerifier);

    // 2. Get user profile to identify the Microsoft account
    const profile = await getMicrosoftProfile(tokens.access_token);

    // 3. Encrypt sensitive Refresh Token
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // 4. Store connection associated with Firebase UID
    await db.collection('microsoft_connections').doc(attemptData?.uid).set({
      provider: 'microsoft',
      email: profile.mail || profile.userPrincipalName,
      refreshToken: encryptedRefreshToken,
      scopes: tokens.scope,
      connectedAt: new Date(),
      updatedAt: new Date()
    });

    // 5. Cleanup attempt
    await db.collection('oauth_attempts').doc(state).delete();

    // 6. Redirect back to app
    return NextResponse.redirect(new URL('/?microsoft_connected=true', req.url));
  } catch (err: any) {
    console.error('[Microsoft Callback] Processing error:', err);
    return NextResponse.redirect(new URL('/?error=processing_failed', req.url));
  }
}
