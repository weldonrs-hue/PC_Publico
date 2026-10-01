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
    // 1. Verify State and Verifier from Cookie
    const cookieStore = req.cookies;
    const stateCookie = cookieStore.get('microsoft_oauth_state');
    
    if (!stateCookie) {
      console.error('[Microsoft Callback] Missing state cookie');
      return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
    }

    const { state: savedState, codeVerifier, uid } = JSON.parse(stateCookie.value);

    if (state !== savedState) {
      console.error('[Microsoft Callback] State mismatch');
      return NextResponse.redirect(new URL('/?error=invalid_state', req.url));
    }

    // 2. Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // 3. Get user profile to identify the Microsoft account
    const profile = await getMicrosoftProfile(tokens.access_token);

    // 4. Encrypt sensitive Refresh Token
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // 5. Store connection associated with Firebase UID
    // Note: We use the UID from the cookie which was validated during initial request
    const db = getAdminDb();
    await db.collection('microsoft_connections').doc(uid).set({
      provider: 'microsoft',
      email: profile.mail || profile.userPrincipalName,
      refreshToken: encryptedRefreshToken,
      scopes: tokens.scope,
      connectedAt: new Date(),
      updatedAt: new Date()
    });

    // 6. Return a success page that closes the popup if applicable
    const successHtml = `
      <html>
        <body style="display:flex;align-items:center;justify-center;height:100vh;font-family:sans-serif;text-align:center;background:#f0f9ff;color:#0369a1;">
          <div>
            <h1 style="margin:0;">Conectado com Sucesso!</h1>
            <p>Esta janela será fechada automaticamente.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'microsoft_connected' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                window.location.href = '/?microsoft_connected=true';
              }
            </script>
          </div>
        </body>
      </html>
    `;

    const response = new NextResponse(successHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
    response.cookies.delete('microsoft_oauth_state');
    return response;
  } catch (err: any) {
    console.error('[Microsoft Callback] Processing error:', err);
    return NextResponse.redirect(new URL('/?error=processing_failed', req.url));
  }
}
