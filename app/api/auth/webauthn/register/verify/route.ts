import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { validateAuth } from '@/lib/server/auth';
import { getWebAuthnConfig, consumeChallenge, saveCredential, extractChallengeFromClientData } from '@/lib/server/webauthn-utils';

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
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      registrationResponse, 
      expectedChallenge: clientProvidedChallenge,
      deviceName,
      deviceType,
      browserName 
    } = body;

    if (!registrationResponse) {
      return NextResponse.json({ error: 'Dados da resposta de registro ausentes' }, { status: 400, headers: corsHeaders });
    }

    // Extrai o desafio do clientDataJSON ou do corpo da requisição
    const extractedChallenge = extractChallengeFromClientData(registrationResponse.response?.clientDataJSON);
    const candidateChallenge = clientProvidedChallenge || extractedChallenge || registrationResponse.response?.challenge;

    const expectedChallenge = await consumeChallenge(candidateChallenge, 'registration', user.uid);
    
    if (!expectedChallenge) {
      console.warn('[WebAuthn Register Verify] Desafio não encontrado para o usuário:', user.uid);
      return NextResponse.json({ error: 'Desafio expirado ou inválido. Tente novamente.' }, { status: 400, headers: corsHeaders });
    }

    const { rpID, origin } = getWebAuthnConfig(req);

    // Suporta origens com variações comuns (ex: com/sem barra, https, porta)
    const expectedOrigins = [
      origin,
      origin.replace(/\/$/, ''),
      `https://${rpID}`,
      `http://${rpID}`,
    ];

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: false, // Permite ampla compatibilidade com biometria no Android e iOS
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const { id, publicKey, counter } = credential;

      // Utiliza o ID exato enviado pelo navegador para correspondência 1:1 no login
      const rawCredId = registrationResponse.id || (typeof id === 'string' ? id : Buffer.from(id).toString('base64url'));
      const pubKeyBase64 = Buffer.from(publicKey).toString('base64');
      const now = new Date().toISOString();

      const userAgent = req.headers.get('user-agent') || '';
      let finalDeviceName = deviceName;
      let finalDeviceType = deviceType;
      let finalBrowserName = browserName;

      if (!finalDeviceName) {
        if (/android/i.test(userAgent)) {
          finalDeviceName = 'Android (Chrome)';
          finalDeviceType = 'android';
        } else if (/iphone|ipad|ipod/i.test(userAgent)) {
          finalDeviceName = 'iPhone / iPad';
          finalDeviceType = 'ios';
        } else if (/windows/i.test(userAgent)) {
          finalDeviceName = 'Windows PC';
          finalDeviceType = 'windows';
        } else if (/macintosh|mac os x/i.test(userAgent)) {
          finalDeviceName = 'Mac';
          finalDeviceType = 'macos';
        } else {
          finalDeviceName = 'Chave de acesso';
          finalDeviceType = 'other';
        }
      }

      await saveCredential(user.uid, {
        id: rawCredId,
        publicKey: publicKey,
        counter,
        transports: registrationResponse.response?.transports,
      }, user.token, {
        email: user.email,
        userName: user.email?.split('@')[0],
        deviceName: finalDeviceName,
        deviceType: finalDeviceType,
        browserName: finalBrowserName,
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
          deviceName: finalDeviceName,
          deviceType: finalDeviceType,
          browserName: finalBrowserName,
          transports: registrationResponse.response?.transports || [],
          createdAt: now,
        }
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ verified: false, error: 'A validação criptográfica da chave falhou' }, { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Register Verify] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao verificar registro da chave' }, { status: 500, headers: corsHeaders });
  }
}
