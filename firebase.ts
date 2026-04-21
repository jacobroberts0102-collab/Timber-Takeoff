import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED,
  getFirestore
} from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom settings for better caching
// Using a safe initialization pattern to avoid "SDK cache is already specified" errors
let _db;
try {
    _db = initializeFirestore(app, {
        localCache: {
            // This provides multi-tab persistence which is essential for reducing read quota usage
            kind: 'indexedDb',
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
        }
    } as any, firebaseConfig.firestoreDatabaseId);
} catch (e: any) {
    if (e.message?.includes('cache is already specified') || e.code === 'failed-precondition') {
        console.warn("Firestore cache already initialized, using existing instance.");
        _db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } else {
        console.error("Firestore initialization failed:", e);
        _db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
}

export const db = _db;

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isOffline = error instanceof Error && error.message.includes('client is offline');
  const isQuota = error instanceof Error && error.message.toLowerCase().includes('quota');
  
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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

  // Only log non-transient errors to console.error
  if (!isOffline && !isQuota) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    // For offline/quota, we log a warning but don't throw, 
    // letting the calling service return its default (null/[])
    console.warn(`Firestore ${isOffline ? 'Offline' : 'Quota'}:`, errInfo.error);
  }
}

/**
 * Recursively removes undefined values from an object, replacing them with null or removing them.
 * Firestore does not support undefined values.
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj === undefined ? null : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
  }
  return sanitized;
}

// Validate Connection to Firestore (Disabled in production to save quota)
/*
async function testConnection() {
  try {
    // This is a connectivity test. We use getDocFromServer to bypass local cache.
    // The rules should allow public read on this specific path to avoid permission errors.
    console.log("Testing Firestore connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    const errorCode = error?.code || 'unknown';
    const message = error?.message || String(error);
    
    if (errorCode === 'unavailable') {
      console.error(`🔥 Firestore Connection Failed [code=unavailable]: The database might still be provisioning or the project/database ID might be incorrect. Database ID: ${firebaseConfig.firestoreDatabaseId}`);
    } else if (message.includes('the client is offline')) {
      console.error("🔥 Firestore Connection Failed: The client appears to be offline.");
    } else if (errorCode === 'permission-denied') {
      // Permission denied is actually a good sign - it means we reached the server!
      console.log("Firestore reachability confirmed (Permission Denied as expected).");
    } else {
      console.error(`🔥 Firestore Connection Error [${errorCode}]: ${message}`);
    }
  }
}
testConnection();
*/
