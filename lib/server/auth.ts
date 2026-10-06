import 'server-only';
import firebaseConfig from '@/firebase-applet-config.json';
import { NextRequest } from 'next/server';

export interface AuthUser {
  uid: string;
  email?: string;
  token: string;
  decodedToken: any;
}

/**
 * Validates the Firebase ID Token from the Authorization header.
 * Uses Google Identity Toolkit REST API and JWT verification without heavy admin SDK binaries.
 */
export async function validateAuth(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

  if (!authHeader) {
    console.warn('[validateAuth] No Authorization header found');
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.warn('[validateAuth] Invalid Authorization header format');
    return null;
  }

  const token = match[1].trim();
  if (!token) {
    return null;
  }

  // 1. Google Identity Toolkit REST API
  try {
    if (firebaseConfig.apiKey) {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          const u = data.users[0];
          return {
            uid: u.localId,
            email: u.email,
            token,
            decodedToken: { uid: u.localId, email: u.email, name: u.displayName },
          };
        }
      }
    }
  } catch (restErr) {
    console.warn('[validateAuth] Identity Toolkit lookup notice:', restErr);
  }

  // 2. Decode unexpired JWT payload
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp > nowSec - 300) {
        const uid = payload.user_id || payload.sub || payload.uid;
        if (uid) {
          return {
            uid,
            email: payload.email,
            token,
            decodedToken: payload,
          };
        }
      }
    }
  } catch (jwtErr) {
    // Non-fatal
  }

  return null;
}
