import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
console.log('[Firebase] App initialized with project:', firebaseConfig.projectId);
export const auth = getAuth(app);

// Set persistence to local (kept after tab close, cleared only on logout)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
});

console.log('[Firebase] Using database ID:', firebaseConfig.firestoreDatabaseId || '(default)');
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Export original Progcir database for users management
const PROGCIR_DB_ID = 'ai-studio-be9e55cd-1468-4747-acd2-d7548ca16732';
export const progcirDb = getFirestore(app, PROGCIR_DB_ID);
