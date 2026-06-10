import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { OperationType, FirestoreErrorInfo } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "581432306990",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialize if we have the minimum required config
const hasRequiredConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

if (!hasRequiredConfig) {
  console.warn("Firebase configuration is missing. Please configure VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in your environment variables/Vercel settings.");
}

const app = hasRequiredConfig ? initializeApp(firebaseConfig) : ({} as any);
const rawDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const dbId = rawDbId && rawDbId !== "(default)" && rawDbId !== "default" ? rawDbId : undefined;

export const db = hasRequiredConfig 
  ? (dbId ? getFirestore(app, dbId) : getFirestore(app)) 
  : ({} as any);

export const auth = hasRequiredConfig ? getAuth(app) : ({} as any);

let storageInstance: any = null;
if (hasRequiredConfig) {
  try {
    storageInstance = getStorage(app);
    // Limit retries to 4 seconds to fail fast and trigger clean error message instead of infinite spinner
    storageInstance.maxUploadRetryTime = 4000;
    storageInstance.maxOperationRetryTime = 4000;
  } catch (error) {
    console.error("Firebase Storage failed to initialize, probably because it is not enabled in the Firebase Console. Standard HTTP link fallback will be used:", error);
  }
}

export const storage = storageInstance;

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
