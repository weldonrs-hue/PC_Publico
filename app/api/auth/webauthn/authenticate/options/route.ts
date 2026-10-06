import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getWebAuthnConfig, generateAndStoreChallenge } from '@/lib/server/webauthn-utils';

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
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  return handleOptions(req);
}

async function handleOptions(req: NextRequest) {
  try {
    const { rpID } = getWebAuthnConfig(req);
    
    let credentialId: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        credentialId = body?.credentialId || null;
      } catch {}
    }

    if (!credentialId) {
      try {
        const { searchParams } = new URL(req.url);
        credentialId = searchParams.get('credentialId');
      } catch {}
    }

    let allowCredentials: any[] = [];
    if (credentialId) {
      allowCredentials = [{
        id: credentialId,
        transports: ['internal', 'hybrid', 'usb', 'smart-card'],
      }];
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials,
    });

    if (credentialId) {
      options.allowCredentials = [{
        id: credentialId,
        type: 'public-key',
        transports: ['internal', 'hybrid', 'usb', 'smart-card'],
      }];
    }

    // Store challenge
    const dbChallenge = await generateAndStoreChallenge('authentication');
    options.challenge = dbChallenge;

    return NextResponse.json(options, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Auth Options] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
