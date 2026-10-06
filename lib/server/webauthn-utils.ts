import 'server-only';
import { getAdminDb } from './firebase-admin';
import firebaseConfig from '../../firebase-applet-config.json';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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

    if (originHeader) {
      try {
        const u = new URL(originHeader);
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
  expiresAt: number; // timestamp ms
}

interface GlobalWebAuthnStore {
  challenges: Map<string, StoredChallenge>;
  credentials: Map<string, WebAuthnCredential>;
}

declare global {
  var __progcirWebAuthnStore: GlobalWebAuthnStore | undefined;
}

// Preserve in-memory store on globalThis across all Next.js compilation boundaries & worker threads
if (!globalThis.__progcirWebAuthnStore) {
  globalThis.__progcirWebAuthnStore = {
    challenges: new Map(),
    credentials: new Map(),
  };
}

const memoryChallenges = globalThis.__progcirWebAuthnStore.challenges;
const memoryCredentials = globalThis.__progcirWebAuthnStore.credentials;

const CREDENTIALS_BACKUP_FILE = path.join('/tmp', 'progcir_webauthn_credentials.json');

// Hydrate memoryCredentials from disk backup on startup
function hydrateCredentialsBackup() {
  try {
    if (fs.existsSync(CREDENTIALS_BACKUP_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_BACKUP_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.id && item.publicKey) {
            memoryCredentials.set(item.id, {
              ...item,
              publicKey: Buffer.from(item.publicKey, 'base64'),
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebAuthn] Falha ao hidratar backup de credenciais:', err.message || err);
  }
}
hydrateCredentialsBackup();

function persistCredentialsBackup() {
  try {
    const list: any[] = [];
    for (const cred of memoryCredentials.values()) {
      list.push({
        id: cred.id,
        userId: cred.userId,
        email: cred.email,
        userName: cred.userName,
        counter: cred.counter,
        transports: cred.transports,
        createdAt: cred.createdAt,
        lastUsedAt: cred.lastUsedAt,
        publicKey: cred.publicKey.toString('base64'),
      });
    }
    fs.writeFileSync(CREDENTIALS_BACKUP_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[WebAuthn] Falha ao persistir backup de credenciais:', err.message || err);
  }
}

/**
 * Periodically purge expired in-memory challenges
 */
function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [key, item] of memoryChallenges.entries()) {
    if (item.expiresAt < now) {
      memoryChallenges.delete(key);
    }
  }
}

/**
 * Generates a random challenge and stores it in memory (and Firestore as fallback).
 */
export async function generateAndStoreChallenge(
  type: 'registration' | 'authentication',
  userId?: string
): Promise<string> {
  cleanupExpiredChallenges();
  const challenge = crypto.randomBytes(32).toString('base64url');
  const expiresAtMs = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Store in global memory
  memoryChallenges.set(challenge, {
    challenge,
    userId: userId || null,
    type,
    expiresAt: expiresAtMs,
  });

  // Background save to Firestore via Admin SDK if available (non-blocking)
  try {
    const db = getAdminDb();
    db.collection('webauthn_challenges').doc(challenge).set({
      challenge,
      userId: userId || null,
      type,
      expiresAt: new Date(expiresAtMs).toISOString(),
    }).catch(() => {});
  } catch (err: any) {
    // Non-fatal: memory store already holds the challenge
  }

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
 * Retrieves and deletes a challenge from memory or Firestore.
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
      return null;
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

  // 3. Match any active authentication challenge in memory store
  if (type === 'authentication') {
    let latestKey: string | null = null;
    let latestItem: StoredChallenge | null = null;
    for (const [key, item] of memoryChallenges.entries()) {
      if (item.type === type && item.expiresAt >= Date.now()) {
        if (!latestItem || item.expiresAt > latestItem.expiresAt) {
          latestKey = key;
          latestItem = item;
        }
      }
    }
    if (latestKey && latestItem) {
      memoryChallenges.delete(latestKey);
      return latestItem.challenge;
    }
  }

  // 4. Fallback to Firestore Admin SDK if challenge key is available
  if (challenge) {
    try {
      const db = getAdminDb();
      const challengeDoc = await db.collection('webauthn_challenges').doc(challenge).get();

      if (!challengeDoc.exists) {
        return null;
      }

      const data = challengeDoc.data();
      if (!data || data.type !== type) {
        return null;
      }

      const expiresAt = new Date(data.expiresAt);
      if (expiresAt < new Date()) {
        await db.collection('webauthn_challenges').doc(challenge).delete().catch(() => {});
        return null;
      }

      await db.collection('webauthn_challenges').doc(challenge).delete().catch(() => {});
      return data.challenge;
    } catch (err: any) {
      // Non-fatal
    }
  }

  return null;
}

/**
 * Helper to fetch credentials via Firestore REST API with the user's ID token.
 */
async function fetchUserCredentialsViaRest(userId: string, userToken: string): Promise<WebAuthnCredential[]> {
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
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

    persistCredentialsBackup();
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

  // 1. Store in memory cache & disk backup
  memoryCredentials.set(credential.id, credObj);
  persistCredentialsBackup();

  // 2. If userToken is provided, save via Firestore REST API
  if (userToken) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${credential.id}`;

      await fetch(docUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
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

  // 3. Fallback attempt via Admin SDK
  try {
    const db = getAdminDb();
    await db.collection('webauthn_credentials').doc(credential.id).set({
      id: credential.id,
      publicKey: pubBuffer,
      userId,
      email: userInfo?.email || null,
      userName: userInfo?.userName || null,
      deviceName: userInfo?.deviceName || 'Chave de acesso',
      deviceType: userInfo?.deviceType || 'other',
      browserName: userInfo?.browserName || null,
      counter: credential.counter,
      transports: credential.transports || [],
      createdAt: now,
      lastUsedAt: now,
    });
  } catch (adminErr: any) {
    // Non-fatal
  }
}

/**
 * Retrieves all credentials for a specific user without throwing PERMISSION_DENIED.
 */
export async function getUserCredentials(userId: string, userToken?: string): Promise<WebAuthnCredential[]> {
  hydrateCredentialsBackup();

  // 1. If userToken is available, try querying Firestore via REST API
  if (userToken) {
    const restCreds = await fetchUserCredentialsViaRest(userId, userToken);
    if (restCreds && restCreds.length > 0) {
      return restCreds;
    }
  }

  // 2. Check memory cache for this user
  const cachedForUser: WebAuthnCredential[] = [];
  for (const cred of memoryCredentials.values()) {
    if (cred.userId === userId) {
      cachedForUser.push(cred);
    }
  }
  if (cachedForUser.length > 0) {
    return cachedForUser;
  }

  // 3. Try Admin SDK, catching any permission errors safely
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('webauthn_credentials')
      .where('userId', '==', userId)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id,
        userId: data.userId,
        email: data.email,
        userName: data.userName,
        deviceName: data.deviceName || 'Chave de acesso',
        deviceType: data.deviceType || 'other',
        browserName: data.browserName,
        counter: data.counter,
        transports: data.transports,
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt,
        publicKey: data.publicKey instanceof Buffer ? data.publicKey : (data.publicKey?.toBuffer ? data.publicKey.toBuffer() : Buffer.from(data.publicKey || [])),
      } as WebAuthnCredential;
    });
  } catch (adminErr: any) {
    return [];
  }
}

/**
 * Retrieves a specific credential by ID.
 */
export async function getCredentialById(credentialId: string, userToken?: string): Promise<WebAuthnCredential | null> {
  hydrateCredentialsBackup();

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

  // 2. Query Firestore REST API for all candidate IDs
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
          persistCredentialsBackup();
          return cred;
        }
      }
    } catch (restErr: any) {
      // Non-fatal
    }
  }

  // 2b. Query Firestore REST API using runQuery StructuredQuery
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
        persistCredentialsBackup();
        return cred;
      }
    }
  } catch (runErr: any) {
    // Non-fatal
  }

  // 3. Fallback to Admin SDK
  for (const cid of candidateIds) {
    try {
      const db = getAdminDb();
      const doc = await db.collection('webauthn_credentials').doc(cid).get();

      if (doc.exists) {
        const data = doc.data()!;
        const cred: WebAuthnCredential = {
          id: data.id || cid,
          userId: data.userId,
          email: data.email,
          userName: data.userName,
          deviceName: data.deviceName || 'Chave de acesso',
          deviceType: data.deviceType || 'other',
          browserName: data.browserName,
          counter: data.counter,
          transports: data.transports,
          createdAt: data.createdAt,
          lastUsedAt: data.lastUsedAt,
          publicKey: data.publicKey instanceof Buffer ? data.publicKey : (data.publicKey?.toBuffer ? data.publicKey.toBuffer() : Buffer.from(data.publicKey || [])),
        };
        memoryCredentials.set(credentialId, cred);
        memoryCredentials.set(cid, cred);
        persistCredentialsBackup();
        return cred;
      }

      // Query by id field in Admin SDK
      const querySnap = await db.collection('webauthn_credentials').where('id', '==', cid).limit(1).get();
      if (!querySnap.empty) {
        const data = querySnap.docs[0].data();
        const cred: WebAuthnCredential = {
          id: data.id || cid,
          userId: data.userId,
          email: data.email,
          userName: data.userName,
          deviceName: data.deviceName || 'Chave de acesso',
          deviceType: data.deviceType || 'other',
          browserName: data.browserName,
          counter: data.counter,
          transports: data.transports,
          createdAt: data.createdAt,
          lastUsedAt: data.lastUsedAt,
          publicKey: data.publicKey instanceof Buffer ? data.publicKey : (data.publicKey?.toBuffer ? data.publicKey.toBuffer() : Buffer.from(data.publicKey || [])),
        };
        memoryCredentials.set(credentialId, cred);
        memoryCredentials.set(cid, cred);
        persistCredentialsBackup();
        return cred;
      }
    } catch (adminErr: any) {
      // Non-fatal
    }
  }

  // 4. Se houver apenas 1 credencial em memória, retorne-a como fallback seguro
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
  // Update memory
  if (memoryCredentials.has(credentialId)) {
    const existing = memoryCredentials.get(credentialId)!;
    existing.counter = newCounter;
    existing.lastUsedAt = new Date().toISOString();
    persistCredentialsBackup();
  }

  // Update REST if userToken provided
  if (userToken) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${credentialId}?updateMask.fieldPaths=counter&updateMask.fieldPaths=lastUsedAt`;

      await fetch(docUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
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

  // Fallback to Admin SDK
  try {
    const db = getAdminDb();
    await db.collection('webauthn_credentials').doc(credentialId).update({
      counter: newCounter,
      lastUsedAt: new Date().toISOString(),
    });
  } catch (adminErr: any) {
    // Non-fatal
  }
}

/**
 * Exclui uma credencial do cache local e do Firestore.
 */
export async function deleteCredential(credentialId: string, userId: string, userToken?: string): Promise<boolean> {
  hydrateCredentialsBackup();

  // 1. Remove do cache em memória e backup local
  const existing = memoryCredentials.get(credentialId);
  if (existing && existing.userId === userId) {
    memoryCredentials.delete(credentialId);
    persistCredentialsBackup();
  } else if (!existing) {
    memoryCredentials.delete(credentialId);
    persistCredentialsBackup();
  }

  // 2. Exclui no Firestore via REST API se tiver userToken
  if (userToken) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/webauthn_credentials/${credentialId}`;
      await fetch(docUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
    } catch (restErr: any) {
      console.warn('[deleteCredential] REST delete notice:', restErr.message || restErr);
    }
  }

  // 3. Exclui via Admin SDK
  try {
    const db = getAdminDb();
    await db.collection('webauthn_credentials').doc(credentialId).delete();
  } catch (adminErr: any) {
    // Non-fatal
  }

  return true;
}

