import admin from 'firebase-admin';
import { logger } from '../logger';

// Initialize Firebase Admin SDK
// In production, use FIREBASE_SERVICE_ACCOUNT environment variable with JSON string
// In development, use FIREBASE_SERVICE_ACCOUNT_PATH environment variable with path to JSON file

let firebaseApp: admin.app.App | null = null;

function initializeFirebase(): admin.app.App | null {
  // Don't reinitialize if already done
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if Firebase is already initialized
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0] ?? null;
    return firebaseApp;
  }

  try {
    // Try to get credentials from environment variable (production)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountJson) {
      // Parse JSON from environment variable
      const serviceAccount = JSON.parse(serviceAccountJson);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      logger.info('Firebase Admin initialized with service account from environment');
      return firebaseApp;
    }

    if (serviceAccountPath) {
      // Load from file path (development)
      // Dynamic import for Node.js fs
      const fs = require('fs');
      const path = require('path');

      const absolutePath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);

      if (fs.existsSync(absolutePath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        logger.info('Firebase Admin initialized with service account from file');
        return firebaseApp;
      }
    }

    // Try Application Default Credentials (for Google Cloud environments)
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    logger.info('Firebase Admin initialized with application default credentials');
    return firebaseApp;
  } catch (error) {
    logger.warn('Firebase Admin SDK not initialized:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Export a function to get the Firebase app
export function getFirebaseApp(): admin.app.App | null {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp;
}

// Export Firebase messaging for FCM
export function getMessaging(): admin.messaging.Messaging | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  return admin.messaging(app);
}

// Export Firebase Auth for verification
export function getAuth(): admin.auth.Auth | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  return admin.auth(app);
}

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  return getFirebaseApp() !== null;
}
