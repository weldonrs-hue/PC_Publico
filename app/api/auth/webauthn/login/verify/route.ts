import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getAdminAuth } from '@/lib/server/firebase-admin';
import { getWebAuthnConfig, consumeChallenge, getCredentialById, updateCredentialCounter } from '@/lib/server/webauthn-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authenticationResponse, sessionId } = body;

    if (!authenticationResponse || !sessionId) {
      return NextResponse.json({ error: 'Dados ausentes' }, { status: 400 });
    }

    // 1. Retrieve challenge
    const expectedChallenge = await consumeChallenge(sessionId, 'authentication');
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Sessão de login expirada ou não encontrada' }, { status: 400 });
    }

    // 2. Find the credential
    const credentialID = authenticationResponse.id;
    const credential = await getCredentialById(credentialID);

    if (!credential) {
      return NextResponse.json({ error: 'Chave não registrada para nenhum usuário' }, { status: 400 });
    }

    const { rpID, origin } = getWebAuthnConfig(req);

    // 3. Verify authentication
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.id,
          publicKey: credential.publicKey instanceof Buffer ? credential.publicKey : (credential.publicKey?.toBuffer ? credential.publicKey.toBuffer() : Buffer.from(credential.publicKey || [])),
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: true,
      });
    } catch (error: any) {
      console.error('[WebAuthn Login Verify] Verification failed:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // 4. Update counter
      await updateCredentialCounter(credential.id, authenticationInfo.newCounter);

      // 5. Generate Firebase Custom Token if service account credentials exist
      let customToken: string | null = null;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          const adminAuth = getAdminAuth();
          customToken = await adminAuth.createCustomToken(credential.userId);
        } catch {
          // Não-fatal caso a assinatura de token não esteja configurada
        }
      }

      return NextResponse.json({ 
        verified: true, 
        userId: credential.userId,
        customToken: customToken || undefined,
        message: 'Autenticação verificada com sucesso.'
      });
    }

    return NextResponse.json({ verified: false, error: 'Falha na verificação' }, { status: 400 });
  } catch (error: any) {
    console.error('[WebAuthn Login Verify] Error:', error);
    return NextResponse.json({ error: 'Erro ao verificar login' }, { status: 500 });
  }
}
