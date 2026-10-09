import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getWebAuthnConfig, generateAndStoreChallenge } from '@/lib/server/webauthn-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { rpID } = getWebAuthnConfig(req);

    // 1. Generate options (discoverable login)
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: [], // Allows any resident key from this RP
    });

    const sessionId = await generateAndStoreChallenge('authentication');
    options.challenge = sessionId;

    return NextResponse.json({ ...options, sessionId });
  } catch (error: any) {
    console.error('[WebAuthn Login Options] Error:', error);
    return NextResponse.json({ error: 'Erro ao gerar opções de login' }, { status: 500 });
  }
}
