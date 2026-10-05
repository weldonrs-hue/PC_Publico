import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { validateAuth } from '@/lib/server/auth';
import { getWebAuthnConfig, generateAndStoreChallenge, getUserCredentials } from '@/lib/server/webauthn-utils';

export async function GET(req: NextRequest) {
  const user = await validateAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userCredentials = await getUserCredentials(user.uid, user.token);
    const { rpName, rpID } = getWebAuthnConfig(req);
    
    const displayName = user.decodedToken?.name || (user.email ? user.email.split('@')[0] : user.uid);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.uid),
      userName: displayName,
      userDisplayName: displayName,
      // Exclui credenciais já existentes para este usuário
      excludeCredentials: userCredentials.map(cred => ({
        id: cred.id,
        type: 'public-key',
        transports: cred.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });

    // Store challenge
    const dbChallenge = await generateAndStoreChallenge('registration', user.uid);
    options.challenge = dbChallenge;

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('[WebAuthn Register Options] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
