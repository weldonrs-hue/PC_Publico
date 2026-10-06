import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { validateAuth } from '@/lib/server/auth';
import { getWebAuthnConfig, generateAndStoreChallenge, getUserCredentials } from '@/lib/server/webauthn-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  return handleRegisterOptions(req);
}

export async function POST(req: NextRequest) {
  return handleRegisterOptions(req);
}

async function handleRegisterOptions(req: NextRequest) {
  try {
    const user = await validateAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado. Por favor, faça login novamente.' }, { status: 401, headers: corsHeaders });
    }

    let userCredentials = [];
    try {
      userCredentials = await getUserCredentials(user.uid, user.token);
    } catch {
      userCredentials = [];
    }

    const { rpName, rpID } = getWebAuthnConfig(req);
    
    const displayName = (user.decodedToken?.name || (user.email ? user.email.split('@')[0] : user.uid) || 'usuario').trim();
    
    const validExcludeCredentials = (userCredentials || [])
      .filter(c => !!c && typeof c.id === 'string' && /^[A-Za-z0-9_-]+$/.test(c.id.trim()))
      .map(cred => ({
        id: cred.id.trim(),
        type: 'public-key' as const,
        transports: Array.isArray(cred.transports) ? cred.transports : undefined,
      }));

    let options;
    try {
      options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new Uint8Array(Buffer.from(user.uid, 'utf-8')),
        userName: displayName,
        userDisplayName: displayName,
        excludeCredentials: validExcludeCredentials.length > 0 ? validExcludeCredentials : undefined,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        attestationType: 'none',
      });
    } catch (generateErr: any) {
      console.warn('[WebAuthn] Falha ao gerar com excludeCredentials, tentando modo básico:', generateErr);
      options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new Uint8Array(Buffer.from(user.uid, 'utf-8')),
        userName: displayName,
        userDisplayName: displayName,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        attestationType: 'none',
      });
    }

    // Armazena o desafio de registro
    await generateAndStoreChallenge('registration', user.uid, options.challenge);

    return NextResponse.json(options, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Register Options] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao gerar opções de registro' }, { status: 500, headers: corsHeaders });
  }
}
