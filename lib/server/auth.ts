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
    return null;
  }

  // Robustly parse "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1].trim();
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
  } catch (error) {
    // Do not log the token itself
    return null;
  }
}
