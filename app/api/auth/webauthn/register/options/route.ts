import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { validateAuth } from '@/lib/server/auth';
import { getWebAuthnConfig, generateAndStoreChallenge, getUserCredentials } from '@/lib/server/webauthn-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const userCredentials = await getUserCredentials(user.uid, user.token);
    const { rpName, rpID } = getWebAuthnConfig(req);
    
    const displayName = user.decodedToken?.name || (user.email ? user.email.split('@')[0] : user.uid);
    
    const validExcludeCredentials = (userCredentials || [])
      .filter(c => !!c && typeof c.id === 'string' && c.id.trim().length > 0)
      .map(cred => ({
        id: cred.id,
        type: 'public-key' as const,
        transports: Array.isArray(cred.transports) ? cred.transports : undefined,
      }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user.uid, 'utf-8')),
      userName: displayName,
      userDisplayName: displayName,
      // Exclui credenciais válidas já existentes para este usuário
      excludeCredentials: validExcludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });

    // Armazena o desafio de registro
    const dbChallenge = await generateAndStoreChallenge('registration', user.uid);
    options.challenge = dbChallenge;

    return NextResponse.json(options, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Register Options] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao gerar opções de registro' }, { status: 500, headers: corsHeaders });
  }
}
