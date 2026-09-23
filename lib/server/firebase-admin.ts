import 'server-only';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

function getFirebaseAdmin() {
  if (adminApp) return adminApp;
  
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
  } else {
    try {
      adminApp = initializeApp();
    } catch (error) {
      console.error('[Firebase Admin] Initialization failed:', error);
      throw new Error('Firebase Admin could not be initialized. Check your credentials.');
    }
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getFirebaseAdmin());
  }
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getFirebaseAdmin());
  }
  return adminDb;
}
