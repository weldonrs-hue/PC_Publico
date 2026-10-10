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

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      adminApp = initializeApp({
        projectId,
      });
    }
    return adminApp;
  } catch (error: any) {
    console.warn('[Firebase Admin] Initialization notice (using client-token/REST mode):', error.message || error);
    return null;
  }
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = getFirebaseAdmin();
    if (!app) throw new Error('[Firebase Admin] App unavailable');
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    const app = getFirebaseAdmin();
    if (!app) throw new Error('[Firebase Admin] App unavailable');
    const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
    
    if (databaseId && databaseId !== '(default)') {
      adminDb = getFirestore(app, databaseId);
    } else {
      adminDb = getFirestore(app);
    }
  }
  return adminDb;
}
