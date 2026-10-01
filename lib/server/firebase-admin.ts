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
      // Initialize with config to specify the correct project ID
      console.log('[Firebase Admin] Initializing with projectId:', firebaseConfig.projectId);
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
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
