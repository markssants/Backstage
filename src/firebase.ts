import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { OperationType, FirestoreErrorInfo } from './types';
import firebaseJson from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseJson.storageBucket,
  messagingSenderId: "581432306990",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseJson.appId,
};

// Only initialize if we have the minimum required config
const hasRequiredConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

if (!hasRequiredConfig) {
  console.warn("Firebase configuration is missing. Please check your environment variables.");
}

const app = hasRequiredConfig ? initializeApp(firebaseConfig) : ({} as any);
const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseJson.firestoreDatabaseId;

export const db = hasRequiredConfig 
  ? (dbId ? getFirestore(app, dbId) : getFirestore(app)) 
  : ({} as any);

export const auth = hasRequiredConfig ? getAuth(app) : ({} as any);

let storageInstance: any = null;
if (hasRequiredConfig) {
  try {
    storageInstance = getStorage(app);
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
