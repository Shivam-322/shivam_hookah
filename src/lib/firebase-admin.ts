import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // This replace handles newlines correctly and strips any surrounding quotes that might be present in the env var
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

// Export the admin-level instances
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
