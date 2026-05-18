import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { OperationType, FirestoreErrorInfo } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: "581432306990",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialize if we have the minimum required config
const hasRequiredConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

if (!hasRequiredConfig) {
  console.warn("Firebase configuration is missing. Please check your environment variables.");
}

const app = hasRequiredConfig ? initializeApp(firebaseConfig) : ({} as any);
const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

export const db = hasRequiredConfig 
  ? (dbId ? getFirestore(app, dbId) : getFirestore(app)) 
  : ({} as any);

export const auth = hasRequiredConfig ? getAuth(app) : ({} as any);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
    },
    operationType,
    path
  };
  const errorString = JSON.stringify(errInfo, null, 2);
  console.error('Firestore Error:', errorString);
  throw new Error(errorString);
}

async function testConnection() {
  if (!hasRequiredConfig) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Ignore errors here as they might just be permission errors
  }
}

testConnection();
