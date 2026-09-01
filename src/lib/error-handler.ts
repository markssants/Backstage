import { auth } from '../firebase';
import { OperationType, FirestoreErrorInfo } from '../types';

/**
 * Sanitizes an object or array for Firestore by recursively removing `undefined`
 * properties or converting undefined items so addDoc / updateDoc / setDoc never fail with
 * "Unsupported field value: undefined".
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  // Firestore FieldValue / Timestamp checks
  if (
    typeof (data as any).isEqual === 'function' ||
    (data as any)._methodName ||
    typeof (data as any).toMillis === 'function' ||
    (data as any) instanceof Date
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

