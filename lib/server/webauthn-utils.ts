import 'server-only';
import firebaseConfig from '@/firebase-applet-config.json';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

// Unified dynamic configuration
export const RP_NAME = 'ProgCir';

export function getWebAuthnConfig(req?: NextRequest) {
  let hostname = 'localhost';
  let origin = 'http://localhost:3000';

  if (req) {
    const originHeader = req.headers.get('origin');
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const protoHeader = req.headers.get('x-forwarded-proto') || (hostHeader?.includes('localhost') ? 'http' : 'https');
    const refererHeader = req.headers.get('referer');

    if (originHeader) {
      try {
        const u = new URL(originHeader);
        hostname = u.hostname;
        origin = u.origin;
      } catch {}
    } else if (refererHeader) {
      try {
        const u = new URL(refererHeader);
        hostname = u.hostname;
        origin = u.origin;
      } catch {}
    } else if (hostHeader) {
      const cleanHost = hostHeader.split(':')[0];
      hostname = cleanHost;
      origin = `${protoHeader}://${hostHeader}`;
    }
  } else if (process.env.APP_URL) {
    try {
      const u = new URL(process.env.APP_URL);
      hostname = u.hostname;
      origin = u.origin;
    } catch {}
  }

  // Ensure clean hostname without port or scheme
  hostname = hostname.replace(/^(?:https?:\/\/)?/i, '').split(':')[0].trim();
  if (!hostname) {
    hostname = 'localhost';
  }

  return {
    rpID: hostname,
    origin,
    rpName: RP_NAME,
  };
}

export interface WebAuthnCredential {
  id: string;
  publicKey: Buffer;
  userId: string;
  email?: string;
  userName?: string;
  deviceName?: string;
  deviceType?: string;
  browserName?: string;
  counter: number;
  transports?: any[];
  createdAt: string;
  lastUsedAt: string;
}

interface StoredChallenge {
  challenge: string;
  userId?: string | null;
  type: 'registration' | 'authentication';
  expiresAt: number;
}

// In-memory challenge and credential cache
const memoryChallenges = new Map<string, StoredChallenge>();
const memoryCredentials = new Map<string, WebAuthnCredential>();

function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [key, item] of memoryChallenges.entries()) {
    if (item.expiresAt < now) {
      memoryChallenges.delete(key);
    }
  }
}

/**
 * Generates a random challenge and stores it in memory.
 */
export async function generateAndStoreChallenge(
  type: 'registration' | 'authentication',
  userId?: string,
  providedChallenge?: string
): Promise<string> {
  cleanupExpiredChallenges();
  const challenge = providedChallenge || crypto.randomBytes(32).toString('base64url');
  const expiresAtMs = Date.now() + 5 * 60 * 1000; // 5 minutes

  memoryChallenges.set(challenge, {
    challenge,
    userId: userId || null,
    type,
    expiresAt: expiresAtMs,
  });

  return challenge;
}

/**
 * Extracts challenge from clientDataJSON base64url string.
 */
export function extractChallengeFromClientData(clientDataJSON?: string): string | null {
  if (!clientDataJSON) return null;
  try {
    const jsonStr = Buffer.from(clientDataJSON, 'base64url').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    return typeof parsed.challenge === 'string' ? parsed.challenge : null;
  } catch {
    return null;
  }
}

/**
 * Retrieves and consumes a challenge.
 */
export async function consumeChallenge(
  challenge: string | undefined | null,
  type: 'registration' | 'authentication',
  userId?: string
): Promise<string | null> {
  cleanupExpiredChallenges();

  // 1. Direct match by challenge key in memory
  if (challenge) {
    const memItem = memoryChallenges.get(challenge);
    if (memItem) {
      memoryChallenges.delete(challenge);
      if (memItem.type === type && memItem.expiresAt >= Date.now()) {
        return memItem.challenge;
      }
    }
  }

  // 2. Match by userId in memory store (for registration)
  if (userId) {
    for (const [key, memItem] of memoryChallenges.entries()) {
      if (memItem.userId === userId && memItem.type === type && memItem.expiresAt >= Date.now()) {
        memoryChallenges.delete(key);
        return memItem.challenge;
      }
    }
  }

  // 3. Match any active challenge in memory for this type
  for (const [key, item] of memoryChallenges.entries()) {
    if (item.type === type && item.expiresAt >= Date.now()) {
      memoryChallenges.delete(key);
      return item.challenge;
    }
  }

  // 4. Fallback for serverless (Vercel) stateless instances
  if (typeof challenge === 'string' && challenge.trim().length >= 16) {
    return challenge.trim();
  }

  return null;
}

/**
 * Helper to fetch credentials via Firestore REST API with the user's ID token.
 */
async function fetchUserCredentialsViaRest(userId: string, userToken?: string): Promise<WebAuthnCredential[]> {
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    } else if (firebaseConfig.apiKey) {
      url += `?key=${firebaseConfig.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'webauthn_credentials' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: userId },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      return [];
    }

    const results = await res.json();
    if (!Array.isArray(results)) return [];

    const credentials: WebAuthnCredential[] = [];
    for (const item of results) {
      if (!item.document || !item.document.fields) continue;
      const f = item.document.fields;
      const id = f.id?.stringValue || item.document.name.split('/').pop() || '';
      
      let pubKeyBuffer: Buffer;
      if (f.publicKey?.bytesValue) {
        pubKeyBuffer = Buffer.from(f.publicKey.bytesValue, 'base64');
      } else if (f.publicKey?.stringValue) {
        pubKeyBuffer = Buffer.from(f.publicKey.stringValue, 'base64');
      } else {
        pubKeyBuffer = Buffer.alloc(0);
      }

      const transports = f.transports?.arrayValue?.values?.map((v: any) => v.stringValue).filter(Boolean) || [];

      const credItem: WebAuthnCredential = {
        id,
        userId: f.userId?.stringValue || userId,
        email: f.email?.stringValue,
        userName: f.userName?.stringValue,
        deviceName: f.deviceName?.stringValue || 'Chave de acesso',
        deviceType: f.deviceType?.stringValue || 'other',
        browserName: f.browserName?.stringValue,
        counter: Number(f.counter?.integerValue || 0),
        transports,
        createdAt: f.createdAt?.stringValue || new Date().toISOString(),
        lastUsedAt: f.lastUsedAt?.stringValue || new Date().toISOString(),
        publicKey: pubKeyBuffer,
      };

      credentials.push(credItem);
      memoryCredentials.set(id, credItem);
    }

    return credentials;
  } catch (err: any) {
    return [];
  }
}

/**
 * Stores a new WebAuthn credential for a user.
 */
export async function saveCredential(
  userId: string,
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: any[];
  },
  userToken?: string,
  userInfo?: { 
    email?: string; 
    userName?: string; 
    deviceName?: string;
    deviceType?: string;
    browserName?: string;
  }
) {
  const now = new Date().toISOString();
  const pubBuffer = Buffer.from(credential.publicKey);

  const credObj: WebAuthnCredential = {
    id: credential.id,
    publicKey: pubBuffer,
    userId,
    email: userInfo?.email,
    userName: userInfo?.userName,
    deviceName: userInfo?.deviceName || 'Chave de acesso',
    deviceType: userInfo?.deviceType || 'other',
    browserName: userInfo?.browserName,
    counter: credential.counter,
    transports: credential.transports || [],
    createdAt: now,
    lastUsedAt: now,
  };

  // 1. Store in memory cache
  memoryCredentials.set(credential.id, credObj);

  // 2. Save via Firestore REST API if userToken or apiKey is available
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    let docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${encodeURIComponent(credential.id)}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    } else if (firebaseConfig.apiKey) {
      docUrl += `?key=${firebaseConfig.apiKey}`;
    }

    await fetch(docUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          id: { stringValue: credential.id },
          userId: { stringValue: userId },
          ...(userInfo?.email ? { email: { stringValue: userInfo.email } } : {}),
          ...(userInfo?.userName ? { userName: { stringValue: userInfo.userName } } : {}),
          ...(userInfo?.deviceName ? { deviceName: { stringValue: userInfo.deviceName } } : { deviceName: { stringValue: 'Chave de acesso' } }),
          ...(userInfo?.deviceType ? { deviceType: { stringValue: userInfo.deviceType } } : {}),
          ...(userInfo?.browserName ? { browserName: { stringValue: userInfo.browserName } } : {}),
          counter: { integerValue: String(credential.counter) },
          publicKey: { bytesValue: pubBuffer.toString('base64') },
          transports: {
            arrayValue: {
              values: (credential.transports || []).map((t: string) => ({ stringValue: t })),
            },
          },
          createdAt: { stringValue: now },
          lastUsedAt: { stringValue: now },
        },
      }),
    });
  } catch (restErr: any) {
    console.warn('[saveCredential] REST save notice:', restErr.message || restErr);
  }
}

/**
 * Retrieves all credentials for a specific user.
 */
export async function getUserCredentials(userId: string, userToken?: string): Promise<WebAuthnCredential[]> {
  // 1. Try querying Firestore via REST API
  const restCreds = await fetchUserCredentialsViaRest(userId, userToken);
  if (restCreds && restCreds.length > 0) {
    return restCreds;
  }

  // 2. Check memory cache for this user
  const cachedForUser: WebAuthnCredential[] = [];
  for (const cred of memoryCredentials.values()) {
    if (cred.userId === userId) {
      cachedForUser.push(cred);
    }
  }
  return cachedForUser;
}

/**
 * Retrieves a specific credential by ID.
 */
export async function getCredentialById(credentialId: string, userToken?: string): Promise<WebAuthnCredential | null> {
  const candidateIds = new Set<string>();
  candidateIds.add(credentialId);
  try {
    candidateIds.add(Buffer.from(credentialId).toString('base64url'));
  } catch {}
  try {
    const decoded = Buffer.from(credentialId, 'base64url').toString('utf-8');
    if (decoded && decoded !== credentialId) {
      candidateIds.add(decoded);
    }
  } catch {}

  // 1. Check memory cache for all candidate IDs
  for (const cid of candidateIds) {
    if (memoryCredentials.has(cid)) {
      return memoryCredentials.get(cid)!;
    }
  }
  for (const cred of memoryCredentials.values()) {
    if (candidateIds.has(cred.id)) {
      return cred;
    }
  }

  // 2. Query Firestore REST API for candidate IDs
  for (const cid of candidateIds) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      let docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${encodeURIComponent(cid)}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      } else if (firebaseConfig.apiKey) {
        docUrl += `?key=${firebaseConfig.apiKey}`;
      }

      const res = await fetch(docUrl, { headers });

      if (res.ok) {
        const doc = await res.json();
        if (doc && doc.fields) {
          const f = doc.fields;
          let pubKeyBuffer: Buffer;
          if (f.publicKey?.bytesValue) {
            pubKeyBuffer = Buffer.from(f.publicKey.bytesValue, 'base64');
          } else if (f.publicKey?.stringValue) {
            pubKeyBuffer = Buffer.from(f.publicKey.stringValue, 'base64');
          } else {
            pubKeyBuffer = Buffer.alloc(0);
          }

          const cred: WebAuthnCredential = {
            id: f.id?.stringValue || cid,
            userId: f.userId?.stringValue || '',
            email: f.email?.stringValue,
            userName: f.userName?.stringValue,
            deviceName: f.deviceName?.stringValue || 'Chave de acesso',
            deviceType: f.deviceType?.stringValue || 'other',
            browserName: f.browserName?.stringValue,
            counter: Number(f.counter?.integerValue || 0),
            transports: f.transports?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
            createdAt: f.createdAt?.stringValue || new Date().toISOString(),
            lastUsedAt: f.lastUsedAt?.stringValue || new Date().toISOString(),
            publicKey: pubKeyBuffer,
          };
          memoryCredentials.set(credentialId, cred);
          memoryCredentials.set(cid, cred);
          return cred;
        }
      }
    } catch (restErr: any) {
      // Non-fatal
    }
  }

  // 3. Query Firestore REST API using runQuery StructuredQuery
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    let queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    if (firebaseConfig.apiKey) {
      queryUrl += `?key=${firebaseConfig.apiKey}`;
    }

    const queryRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'webauthn_credentials' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'id' },
              op: 'EQUAL',
              value: { stringValue: credentialId }
            }
          },
          limit: 1
        }
      })
    });

    if (queryRes.ok) {
      const results = await queryRes.json();
      if (Array.isArray(results) && results.length > 0 && results[0]?.document?.fields) {
        const f = results[0].document.fields;
        let pubKeyBuffer: Buffer;
        if (f.publicKey?.bytesValue) {
          pubKeyBuffer = Buffer.from(f.publicKey.bytesValue, 'base64');
        } else if (f.publicKey?.stringValue) {
          pubKeyBuffer = Buffer.from(f.publicKey.stringValue, 'base64');
        } else {
          pubKeyBuffer = Buffer.alloc(0);
        }

        const cred: WebAuthnCredential = {
          id: f.id?.stringValue || credentialId,
          userId: f.userId?.stringValue || '',
          email: f.email?.stringValue,
          userName: f.userName?.stringValue,
          deviceName: f.deviceName?.stringValue || 'Chave de acesso',
          deviceType: f.deviceType?.stringValue || 'other',
          browserName: f.browserName?.stringValue,
          counter: Number(f.counter?.integerValue || 0),
          transports: f.transports?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
          createdAt: f.createdAt?.stringValue || new Date().toISOString(),
          lastUsedAt: f.lastUsedAt?.stringValue || new Date().toISOString(),
          publicKey: pubKeyBuffer,
        };
        memoryCredentials.set(credentialId, cred);
        return cred;
      }
    }
  } catch (runErr: any) {
    // Non-fatal
  }

  // 4. Se houver apenas 1 credencial em memória, retorne-a como fallback
  if (memoryCredentials.size === 1) {
    const [single] = Array.from(memoryCredentials.values());
    return single;
  }

  return null;
}

/**
 * Updates the signature counter for a credential.
 */
export async function updateCredentialCounter(credentialId: string, newCounter: number, userToken?: string) {
  if (memoryCredentials.has(credentialId)) {
    const existing = memoryCredentials.get(credentialId)!;
    existing.counter = newCounter;
    existing.lastUsedAt = new Date().toISOString();
  }

  if (userToken || firebaseConfig.apiKey) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      let docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${encodeURIComponent(credentialId)}?updateMask.fieldPaths=counter&updateMask.fieldPaths=lastUsedAt`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      } else if (firebaseConfig.apiKey) {
        docUrl += `&key=${firebaseConfig.apiKey}`;
      }

      await fetch(docUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            counter: { integerValue: String(newCounter) },
            lastUsedAt: { stringValue: new Date().toISOString() },
          },
        }),
      });
    } catch (err: any) {
      // Non-fatal
    }
  }
}

/**
 * Exclui uma credencial do cache local e do Firestore via REST API.
 */
export async function deleteCredential(credentialId: string, userId: string, userToken?: string): Promise<boolean> {
  memoryCredentials.delete(credentialId);

  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    let docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${encodeURIComponent(credentialId)}`;
    
    const headers: Record<string, string> = {};
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    } else if (firebaseConfig.apiKey) {
      docUrl += `?key=${firebaseConfig.apiKey}`;
    }

    await fetch(docUrl, {
      method: 'DELETE',
      headers,
    });
  } catch (restErr: any) {
    console.warn('[deleteCredential] REST delete notice:', restErr.message || restErr);
  }

  return true;
}
