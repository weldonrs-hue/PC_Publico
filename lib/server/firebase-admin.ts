import 'server-only';
import { getApps, initializeApp, App, cert } from 'firebase-admin/app';
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
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson) {
        console.log('[Firebase Admin] Initializing with service account credentials');
        const serviceAccount = JSON.parse(serviceAccountJson);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: firebaseConfig.projectId,
        });
      } else {
        console.log('[Firebase Admin] Initializing with Project ID:', firebaseConfig.projectId);
        adminApp = initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
      console.log('[Firebase Admin] Initialization successful');
    } catch (error: any) {
      console.error('[Firebase Admin] Initialization failed:', error.message);
      throw new Error('Firebase Admin could not be initialized.');
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
    const databaseId = firebaseConfig.firestoreDatabaseId;
    
    if (databaseId) {
      console.log('[Firebase Admin] Using Firestore with databaseId:', databaseId);
      adminDb = getFirestore(app, databaseId);
    } else {
      adminDb = getFirestore(app);
    }
  }
  return adminDb;
}
