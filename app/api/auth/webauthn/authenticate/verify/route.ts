import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { 
  getWebAuthnConfig, 
  consumeChallenge, 
  getCredentialById, 
  saveCredential,
  updateCredentialCounter, 
  extractChallengeFromClientData 
} from '@/lib/server/webauthn-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authenticationResponse, expectedChallenge: clientProvidedChallenge } = body;

    if (!authenticationResponse) {
      return NextResponse.json({ error: 'Dados ausentes' }, { status: 400, headers: corsHeaders });
    }

    const extractedChallenge = extractChallengeFromClientData(authenticationResponse.response?.clientDataJSON);
    const candidateChallenge = clientProvidedChallenge || extractedChallenge || authenticationResponse.response?.challenge;

    const expectedChallenge = await consumeChallenge(candidateChallenge, 'authentication');
    
    if (!expectedChallenge) {
      console.warn('[WebAuthn Authenticate Verify] Desafio expirado ou não encontrado');
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 400, headers: corsHeaders });
    }

    const credentialId = authenticationResponse.id;
    let credential = await getCredentialById(credentialId);

    // Fallback caso a credencial tenha sido enviada pelo cliente (via Firestore direto ou localStorage)
    if (!credential && body.clientPasskey) {
      const cp = body.clientPasskey;
      const isIdMatch = cp.id === credentialId || Buffer.from(credentialId).toString('base64url') === cp.id || cp.id?.includes(credentialId) || credentialId?.includes(cp.id);
      if (isIdMatch && cp.publicKey) {
        let pubKeyBuffer: Buffer;
        if (Buffer.isBuffer(cp.publicKey)) {
          pubKeyBuffer = cp.publicKey;
        } else if (cp.publicKey.type === 'Buffer' && Array.isArray(cp.publicKey.data)) {
          pubKeyBuffer = Buffer.from(cp.publicKey.data);
        } else if (typeof cp.publicKey === 'string') {
          pubKeyBuffer = Buffer.from(cp.publicKey, 'base64');
        } else if (cp.publicKey instanceof Uint8Array || Array.isArray(cp.publicKey)) {
          pubKeyBuffer = Buffer.from(cp.publicKey);
        } else {
          pubKeyBuffer = Buffer.alloc(0);
        }

        credential = {
          id: cp.id || credentialId,
          userId: cp.userId,
          email: cp.email,
          userName: cp.userName,
          counter: Number(cp.counter || 0),
          transports: cp.transports || [],
          createdAt: cp.createdAt || new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          publicKey: pubKeyBuffer,
        };
        // Persiste no servidor para as próximas chamadas
        try {
          await saveCredential(credential.userId, {
            id: credential.id,
            publicKey: credential.publicKey,
            counter: credential.counter,
            transports: credential.transports,
          }, undefined, {
            email: credential.email,
            userName: credential.userName,
          });
        } catch {}
      }
    }

    if (!credential) {
      console.warn('[WebAuthn Authenticate Verify] Credencial não encontrada para o ID:', credentialId);
      return NextResponse.json({ error: 'Credential not found' }, { status: 404, headers: corsHeaders });
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
      try {
        await updateCredentialCounter(credential.id, newCounter);
      } catch {}

      return NextResponse.json({ 
        verified: true, 
        userId: credential.userId,
        email: credential.email || null,
        usuario: credential.userName || credential.email?.split('@')[0] || 'Usuário',
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Auth Verify] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
