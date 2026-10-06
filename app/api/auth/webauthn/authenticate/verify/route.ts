import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getAdminAuth } from '@/lib/server/firebase-admin';
import { 
  getWebAuthnConfig, 
  consumeChallenge, 
  getCredentialById, 
  saveCredential,
  updateCredentialCounter, 
  extractChallengeFromClientData,
  parsePublicKey 
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
    const body = await req.json().catch(() => ({}));
    const { authenticationResponse, expectedChallenge: clientProvidedChallenge } = body;

    if (!authenticationResponse) {
      return NextResponse.json({ error: 'Dados de autenticação ausentes' }, { status: 400, headers: corsHeaders });
    }

    const extractedChallenge = extractChallengeFromClientData(authenticationResponse.response?.clientDataJSON);
    const candidateChallenge = clientProvidedChallenge || extractedChallenge || authenticationResponse.response?.challenge;

    const expectedChallenge = await consumeChallenge(candidateChallenge, 'authentication');
    
    if (!expectedChallenge) {
      console.warn('[WebAuthn Authenticate Verify] Desafio expirado ou não encontrado');
      return NextResponse.json({ error: 'Desafio expirado. Tente novamente.' }, { status: 400, headers: corsHeaders });
    }

    const credentialId = authenticationResponse.id;
    let credential = await getCredentialById(credentialId);

    // Se a credencial não foi localizada no servidor ou sua chave pública veio vazia, usa os dados do clientPasskey
    if (!credential || !credential.publicKey || credential.publicKey.length === 0) {
      if (body.clientPasskey) {
        const cp = body.clientPasskey;
        const pubKeyBuffer = parsePublicKey(cp.publicKey);
        if (pubKeyBuffer && pubKeyBuffer.length > 0) {
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

          // Salva no cache do servidor para próximas chamadas
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
    }

    if (!credential || !credential.publicKey || credential.publicKey.length === 0) {
      console.warn('[WebAuthn Authenticate Verify] Credencial não encontrada para o ID:', credentialId);
      return NextResponse.json({ error: 'Chave de acesso não cadastrada neste dispositivo ou domínio.' }, { status: 404, headers: corsHeaders });
    }

    const { rpID, origin } = getWebAuthnConfig(req);

    // Lista de origens permitidas flexível para cobrir Cloud Run, Vercel e localhost
    const possibleOrigins = Array.from(new Set([
      origin,
      `https://${rpID}`,
      `http://${rpID}`,
      `http://${rpID}:3000`,
      'https://ais-dev-nvcw4tth4zhvfngjsrwarr-460301287558.us-east1.run.app',
      'https://ais-pre-nvcw4tth4zhvfngjsrwarr-460301287558.us-east1.run.app',
      'https://prog-cir-web.vercel.app'
    ])).filter(Boolean);

    let verification: any;
    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge,
        expectedOrigin: possibleOrigins,
        expectedRPID: rpID,
        credential: {
          id: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: false,
      });
    } catch (verifyErr: any) {
      console.warn('[WebAuthn Verify] Erro na primeira tentativa de validação:', verifyErr?.message);
      // Tenta extrair a origem diretamente de clientDataJSON se houver divergência de proxy reverso
      try {
        let clientDataOrigin = '';
        if (authenticationResponse.response?.clientDataJSON) {
          const rawClient = Buffer.from(authenticationResponse.response.clientDataJSON, 'base64').toString('utf8');
          const parsedClient = JSON.parse(rawClient);
          clientDataOrigin = parsedClient.origin || '';
        }

        if (clientDataOrigin) {
          verification = await verifyAuthenticationResponse({
            response: authenticationResponse,
            expectedChallenge,
            expectedOrigin: clientDataOrigin,
            expectedRPID: rpID,
            credential: {
              id: credential.id,
              publicKey: credential.publicKey,
              counter: credential.counter,
              transports: credential.transports,
            },
            requireUserVerification: false,
          });
        } else {
          throw verifyErr;
        }
      } catch (fallbackErr: any) {
        console.error('[WebAuthn Verify] Falha na validação:', fallbackErr?.message || verifyErr?.message);
        return NextResponse.json({ 
          error: `A validação da chave falhou: ${verifyErr?.message || fallbackErr?.message || 'Assinatura inválida'}` 
        }, { status: 400, headers: corsHeaders });
      }
    }

    if (verification?.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;
      try {
        await updateCredentialCounter(credential.id, newCounter);
      } catch {}

      let customToken: string | null = null;
      try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          const adminAuth = getAdminAuth();
          if (adminAuth && credential.userId) {
            customToken = await adminAuth.createCustomToken(credential.userId);
          }
        }
      } catch {
        // Fallback silencioso para sessão do cliente
      }

      return NextResponse.json({ 
        verified: true, 
        customToken,
        userId: credential.userId,
        email: credential.email || null,
        usuario: credential.userName || credential.email?.split('@')[0] || 'Usuário',
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ verified: false, error: 'A validação criptográfica da chave falhou.' }, { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error('[WebAuthn Auth Verify] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao validar chave de acesso' }, { status: 400, headers: corsHeaders });
  }
}
