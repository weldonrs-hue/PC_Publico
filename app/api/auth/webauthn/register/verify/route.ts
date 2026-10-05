import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { validateAuth } from '@/lib/server/auth';
import { getWebAuthnConfig, consumeChallenge, saveCredential, extractChallengeFromClientData } from '@/lib/server/webauthn-utils';

export async function POST(req: NextRequest) {
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { registrationResponse, expectedChallenge: clientProvidedChallenge } = body;

    if (!registrationResponse) {
      return NextResponse.json({ error: 'Dados ausentes' }, { status: 400 });
    }

    // Extrai o desafio do clientDataJSON ou do corpo da requisição
    const extractedChallenge = extractChallengeFromClientData(registrationResponse.response?.clientDataJSON);
    const candidateChallenge = clientProvidedChallenge || extractedChallenge || registrationResponse.response?.challenge;

    const expectedChallenge = await consumeChallenge(candidateChallenge, 'registration', user.uid);
    
    if (!expectedChallenge) {
      console.warn('[WebAuthn Register Verify] Desafio não encontrado para o usuário:', user.uid);
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 400 });
    }

    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const { id, publicKey, counter } = credential;

      // Utiliza o ID exato enviado pelo navegador para correspondência 1:1 no login
      const rawCredId = registrationResponse.id || (typeof id === 'string' ? id : Buffer.from(id).toString('base64url'));
      const pubKeyBase64 = Buffer.from(publicKey).toString('base64');
      const now = new Date().toISOString();

      await saveCredential(user.uid, {
        id: rawCredId,
        publicKey: publicKey,
        counter,
        transports: registrationResponse.response?.transports,
      }, user.token, {
        email: user.email,
        userName: user.email?.split('@')[0],
      });

      return NextResponse.json({ 
        verified: true,
        credential: {
          id: rawCredId,
          publicKey: pubKeyBase64,
          counter,
          userId: user.uid,
          email: user.email,
          userName: user.email?.split('@')[0],
          transports: registrationResponse.response?.transports || [],
          createdAt: now
        }
      });
    }

    return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 400 });
  } catch (error: any) {
    console.error('[WebAuthn Register Verify] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
