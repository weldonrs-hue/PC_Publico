import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
console.log('[Firebase] App initialized with project:', firebaseConfig.projectId);
export const auth = getAuth(app);

// Set persistence to session (clears on tab close)
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
});

console.log('[Firebase] Using database ID:', firebaseConfig.firestoreDatabaseId || '(default)');
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
