// ═══════════════════════════════════════════════════════════
// FCM — Firebase Cloud Messaging (Push Notifications)
// ───────────────────────────────────────────────────────────
// 100% FREE — Firebase provides this at no cost.
//
// SETUP STEPS (one-time, on your PC):
//   1. Go to Firebase Console → Project Settings → Cloud Messaging
//   2. Under "Web Push certificates" click "Generate key pair"
//   3. Copy the generated key
//   4. Create a file called ".env" in your project root (same level as package.json)
//   5. Add this line: VITE_FIREBASE_VAPID_KEY=your_copied_key_here
//   6. Restart dev server (npm run dev)
//
// That's it! Notifications will work automatically.
// ═══════════════════════════════════════════════════════════

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { app } from '../config/firebase';

/**
 * Request notification permission and store FCM token.
 * Call this once after user login.
 * Returns the token if successful, null otherwise.
 */
export async function initFCM(uid: string): Promise<string | null> {
  try {
    // Step 1: Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('FCM: Is browser mein notifications support nahi hai');
      return null;
    }

    // Step 2: Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.log('FCM: Service Worker support nahi hai');
      return null;
    }

    // Step 3: Get VAPID key from .env file
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      // No VAPID key configured — silently skip (not an error)
      return null;
    }

    // Step 4: Ask user for notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('FCM: User ne notification permission deny ki');
      return null;
    }

    // Step 5: Get FCM token from Firebase
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: vapidKey });

    if (token) {
      // Step 6: Save token in Firestore (so server can send notifications later)
      await setDoc(doc(db, 'fcm_tokens', uid), {
        token: token,
        uid: uid,
        updatedAt: serverTimestamp(),
        userAgent: navigator.userAgent,
      }, { merge: true });

      console.log('FCM: Token save ho gaya ✅');
      return token;
    }

    return null;
  } catch (err) {
    console.warn('FCM init error:', err);
    return null;
  }
}

/**
 * Listen for notifications when app is OPEN.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log('FCM: Notification aayi:', payload);
      callback(payload);
    });
  } catch {
    return () => {};
  }
}
