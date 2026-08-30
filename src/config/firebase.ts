import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Initialize Firebase configuration securely using environment variables.
// `import.meta.env` is provided by Vite; the `|| {}` guard also lets this
// module be imported under plain Node (deterministic test harness) without
// throwing — values are simply undefined there, and no network calls run.
const ENV: Record<string, any> = import.meta.env || {};
export const firebaseConfig = {
  apiKey: ENV.VITE_FIREBASE_API_KEY,
  authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: ENV.VITE_FIREBASE_PROJECT_ID,
  storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.VITE_FIREBASE_APP_ID
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize and Export Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);