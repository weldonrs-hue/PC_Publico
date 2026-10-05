import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getAdminAuth } from '@/lib/server/firebase-admin';
import { getWebAuthnConfig, consumeChallenge, getCredentialById, updateCredentialCounter, extractChallengeFromClientData } from '@/lib/server/webauthn-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authenticationResponse, expectedChallenge: clientProvidedChallenge } = body;

    if (!authenticationResponse) {
      return NextResponse.json({ error: 'Dados ausentes' }, { status: 400 });
    }

    const extractedChallenge = extractChallengeFromClientData(authenticationResponse.response?.clientDataJSON);
    const candidateChallenge = clientProvidedChallenge || extractedChallenge || authenticationResponse.response?.challenge;

    const expectedChallenge = await consumeChallenge(candidateChallenge, 'authentication');
    
    if (!expectedChallenge) {
      console.warn('[WebAuthn Authenticate Verify] Desafio expirado ou não encontrado');
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 400 });
    }

    const credentialId = authenticationResponse.id;
    let credential = await getCredentialById(credentialId);

    // Fallback caso a credencial tenha sido salva pelo cliente em localStorage
    if (!credential && body.clientPasskey) {
      const cp = body.clientPasskey;
      const isIdMatch = cp.id === credentialId || Buffer.from(credentialId).toString('base64url') === cp.id;
      if (isIdMatch && cp.publicKey) {
        credential = {
          id: cp.id,
          userId: cp.userId,
          email: cp.email,
          userName: cp.userName,
          counter: Number(cp.counter || 0),
          transports: cp.transports || [],
          createdAt: cp.createdAt || new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          publicKey: Buffer.isBuffer(cp.publicKey) ? cp.publicKey : Buffer.from(cp.publicKey, 'base64'),
        };
        // Persiste no servidor para as próximas chamadas
        await saveCredential(credential.userId, {
          id: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports,
        }, undefined, {
          email: credential.email,
          userName: credential.userName,
        });
      }
    }

    if (!credential) {
      console.warn('[WebAuthn Authenticate Verify] Credencial não encontrada para o ID:', credentialId);
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      },
      requireUserVerification: true,
    });

    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;
      await updateCredentialCounter(credential.id, newCounter);

      // Gera Firebase Custom Token caso FIREBASE_SERVICE_ACCOUNT_JSON esteja configurado
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
        email: credential.email || null,
        usuario: credential.userName || credential.email?.split('@')[0] || 'Usuário',
        customToken: customToken || undefined
      });
    }

    return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 400 });
  } catch (error: any) {
    console.error('[WebAuthn Auth Verify] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
