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
  console.warn('⚠️ Firestore Quota Exceeded flag set in localStorage for today:', today);
  
  // Dispatch a custom event so the UI can react immediately
  window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', { detail: { date: today } }));
}

export function clearQuotaExceeded() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('firestore_quota_exceeded_date');
  sessionStorage.removeItem('firestore_quota_exceeded');
  console.log('🔄 Firestore Quota flag cleared manually.');
  
  // Dispatch event to clear UI
  window.dispatchEvent(new CustomEvent('firestore-quota-cleared'));
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error?.code || 'unknown';
  
  const isQuotaError = 
    errorCode === 'resource-exhausted' || 
    errorMessage.toLowerCase().includes('quota') || 
    errorMessage.toLowerCase().includes('limit exceeded') ||
    errorMessage.toLowerCase().includes('resource-exhausted');

  const isPermissionError = 
    errorCode === 'permission-denied' || 
    errorMessage.toLowerCase().includes('permission');

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
  
  if (isQuotaError) {
    console.error('🛑 ERRO DE COTA (Firestore):', errorMessage, { errorCode, operationType, path });
  } else if (isPermissionError) {
    console.error('🔐 ERRO DE PERMISSÃO (Firestore):', errorMessage, { errorCode, operationType, path });
  } else {
    console.error('❌ Erro no Firestore:', JSON.stringify(errInfo, null, 2));
  }
  
  // Only throw if it's NOT a quota or permission error, to avoid crashing the app
  if (!isQuotaError && !isPermissionError) {
    throw new Error(JSON.stringify(errInfo));
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
