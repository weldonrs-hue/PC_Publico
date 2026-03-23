import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function isQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false;
  const quotaHit = localStorage.getItem('firestore_quota_exceeded_date');
  if (!quotaHit) return false;
  
  const today = new Date().toISOString().split('T')[0];
  return quotaHit === today;
}

export function setQuotaExceededGlobal() {
  if (typeof window === 'undefined') return;
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('firestore_quota_exceeded_date', today);
  // Also set in session for immediate reactive checks if needed
  sessionStorage.setItem('firestore_quota_exceeded', 'true');
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('resource-exhausted');

  if (isQuotaError) {
    setQuotaExceededGlobal();
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Only throw if it's NOT a quota error, to avoid crashing the app when quota is hit
  if (!isQuotaError) {
    throw new Error(JSON.stringify(errInfo));
  } else {
    // If quota is hit, we just log it and maybe show a warning in the UI
    console.warn('Firestore Quota Exceeded. Some data may not load correctly.');
  }
}

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
