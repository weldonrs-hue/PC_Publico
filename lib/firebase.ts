import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to session (clears on tab close)
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
});

// Initialize Firestore with experimentalForceLongPolling to avoid connection issues in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
