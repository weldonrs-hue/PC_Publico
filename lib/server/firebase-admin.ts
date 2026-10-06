import 'server-only';
import { getApps, initializeApp, App, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

function getFirebaseAdmin(): App | null {
  if (adminApp) return adminApp;
  
  try {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0];
      return adminApp;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: firebaseConfig.projectId,
      });
    } else {
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
    return adminApp;
  } catch (error: any) {
    console.warn('[Firebase Admin] Initialization notice (using client-token/REST mode):', error.message || error);
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  try {
    if (!adminAuth) {
      const app = getFirebaseAdmin();
      if (!app) return null;
      adminAuth = getAuth(app);
    }
    return adminAuth;
  } catch (err: any) {
    console.warn('[Firebase Admin] getAdminAuth unavailable:', err.message || err);
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  try {
    if (!adminDb) {
      const app = getFirebaseAdmin();
      if (!app) return null;
      const databaseId = firebaseConfig.firestoreDatabaseId;
      
      if (databaseId) {
        adminDb = getFirestore(app, databaseId);
      } else {
        adminDb = getFirestore(app);
      }
    }
    return adminDb;
  } catch (err: any) {
    console.warn('[Firebase Admin] getAdminDb unavailable:', err.message || err);
    return null;
  }
}
