import 'server-only';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
      console.log('[Firebase Admin] Initializing with projectId:', projectId);
      
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (serviceAccountJson) {
        console.log('[Firebase Admin] Using credentials from environment variable');
        const { cert } = await import('firebase-admin/app');
        const serviceAccount = JSON.parse(serviceAccountJson);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId,
        });
      } else {
        console.log('[Firebase Admin] No service account JSON found, falling back to default credentials');
        adminApp = initializeApp({
          projectId,
        });
      }
      console.log('[Firebase Admin] Initialization successful');
    } catch (error: any) {
      console.error('[Firebase Admin] Initialization failed:', error.message);
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
    const app = getFirebaseAdmin();
    const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
    
    if (databaseId && databaseId !== '(default)') {
      console.log('[Firebase Admin] Using Firestore with databaseId:', databaseId);
      adminDb = getFirestore(app, databaseId);
    } else {
      adminDb = getFirestore(app);
    }
  }
  return adminDb;
}

