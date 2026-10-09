import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const effectiveConfig = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  firestoreDatabaseId: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || undefined
} : firebaseConfig;

const app = getApps().length > 0 ? getApp() : initializeApp(effectiveConfig);
console.log('[Firebase] App initialized with project:', effectiveConfig.projectId);
export const auth = getAuth(app);

// Define persistência por sessão (exige login explícito por senha ou chave de acesso ao abrir o aplicativo)
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
});

const dbId = (effectiveConfig as any).firestoreDatabaseId;
console.log('[Firebase] Using database ID:', dbId || '(default)');
export const db = dbId && dbId !== '(default)'
  ? getFirestore(app, dbId)
  : getFirestore(app);
