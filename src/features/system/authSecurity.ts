// ============================================
// AUTH SECURITY HELPERS (Module 16 Audit ★)
// ============================================
// 1) createStaffAuthUser  — CC ke session ko touch kiye bina
//    naya Firebase Auth user banata hai (secondary app pattern)
// 2) logLoginEvent        — login_history collection mein
//    SUCCESS / FAILED attempts ka audit trail
// 3) requestPasswordReset — pre-login "Forgot Password" email
// ============================================

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../../config/firebase';

// ─── FRIENDLY ERROR MESSAGES ─────────────────
const authErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ye email pehle se registered hai. Dusra email use karein ya purana account re-activate karein.';
    case 'auth/invalid-email':
      return 'Email address ka format galat hai.';
    case 'auth/weak-password':
      return 'Password kam se kam 6 characters ka hona chahiye.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in Firebase console mein enabled nahi hai.';
    case 'auth/user-not-found':
      return 'Is email ka koi account nahi mila.';
    case 'auth/too-many-requests':
      return 'Bahut zyada attempts. Thodi der baad try karein.';
    case 'auth/network-request-failed':
      return 'Network error. Internet connection check karein.';
    default:
      return '';
  }
};

// ─── CREATE AUTH USER (SESSION-SAFE) ─────────
// Secondary Firebase app banate hain taaki CC ka current
// login session disturb na ho. User banate hi secondary
// session sign-out + app delete ho jaati hai.
export const createStaffAuthUser = async (
  email: string,
  password: string
): Promise<string> => {
  const secondaryApp = initializeApp(firebaseConfig, `user-create-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } catch (error: unknown) {
    const fbErr = error as { code?: string; message?: string };
    const friendly = authErrorMessage(fbErr.code ?? '');
    throw new Error(friendly || fbErr.message || 'Auth user creation failed');
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }
};

// ─── LOGIN HISTORY LOGGER ────────────────────
export type LoginEventStatus = 'SUCCESS' | 'FAILED';

export const logLoginEvent = async (
  email: string,
  status: LoginEventStatus,
  role: string = '',
  reason: string = ''
): Promise<void> => {
  try {
    await addDoc(collection(db, 'login_history'), {
      email: email.toLowerCase().trim(),
      status,
      role,
      reason,
      userAgent: (navigator.userAgent ?? '').slice(0, 200),
      module: 'AUTH',
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Audit kabhi main flow ko break nahi karta
    console.error('Login history log error:', error);
  }
};

// ─── PASSWORD RESET (PRE-LOGIN) ──────────────
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: unknown) {
    const fbErr = error as { code?: string; message?: string };
    const friendly = authErrorMessage(fbErr.code ?? '');
    throw new Error(friendly || fbErr.message || 'Reset email bhejne mein error');
  }
};

// ─── SESSION TIMEOUT CONSTANT ────────────────
// 30 minute inactivity ke baad auto logout (AuthContext use karta hai)
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_EXPIRED_FLAG = 'fcoy_session_expired';
