import 'server-only';
import { getAdminAuth } from './firebase-admin';
import { NextRequest } from 'next/server';

export interface AuthUser {
  uid: string;
  email?: string;
  decodedToken: any;
}

/**
 * Validates the Firebase ID Token from the Authorization header.
 * Expects format: Authorization: Bearer <token>
 */
export async function validateAuth(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get('Authorization');

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

  try {
    const adminAuth = getAdminAuth();
    // verifyIdToken automatically checks for expiration and validity
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      decodedToken
    };
  } catch (error: any) {
    console.error('[validateAuth] Firebase verifyIdToken failed. Code:', error.code, 'Message:', error.message);
    return null;
  }
}
