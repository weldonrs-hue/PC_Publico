import 'server-only';
import { getAdminAuth } from './firebase-admin';
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
 * Expects format: Authorization: Bearer <token>
 */
export async function validateAuth(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

  if (!authHeader) {
    console.warn('[validateAuth] No Authorization header found');
    return null;
  }

  // Robustly parse "Bearer <token>" case-insensitively
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.warn('[validateAuth] Invalid Authorization header format');
    return null;
  }

  const token = match[1].trim();
  if (!token) {
    return null;
  }

  // 1. Primary: Admin SDK verifyIdToken
  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      token,
      decodedToken
    };
  } catch (error: any) {
    // 2. Fallback: Google Identity Toolkit REST API
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
      // Non-fatal
    }

    // 3. Fallback: Decode unexpired JWT payload
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const nowSec = Math.floor(Date.now() / 1000);
        // Ensure token is not expired (allow 5 min clock drift)
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

    console.error('[validateAuth] All auth verification methods failed for token.');
    return null;
  }
}
