import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    app = initializeApp({
      apiKey: "mock",
      authDomain: "mock",
      projectId: "mock",
      storageBucket: "mock",
      messagingSenderId: "mock",
      appId: "mock",
    });
  }
} else {
  app = getApps()[0];
}

export const db = getFirestore(app);
export const auth = getAuth(app);
