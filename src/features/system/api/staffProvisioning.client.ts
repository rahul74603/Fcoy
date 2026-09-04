// ═══════════════════════════════════════════════════════════════════════
// STAFF PROVISIONING — client callable wrapper
// ───────────────────────────────────────────────────────────────────────
// Staff accounts are created SERVER-SIDE by the `createStaffAccount` Cloud
// Function (Admin SDK). The browser no longer calls
// createUserWithEmailAndPassword for staff provisioning, so a non-CC signed-in
// user cannot mint even an orphan Auth account. Authorization (active Company
// Commander) is enforced inside the function; the role/isDeveloper/
// assignedBatchIds/customerId values are validated/forced server-side.
// ═══════════════════════════════════════════════════════════════════════

import {
  getFunctions, httpsCallable, connectFunctionsEmulator,
} from 'firebase/functions';
import { app } from '../../../config/firebase';

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  designation?: string;
  assignedBatchIds?: string[];
}

export interface CreateStaffResult {
  uid: string;
  email: string;
  role: string;
}

let cached: ReturnType<typeof getFunctions> | null = null;
function functionsInstance() {
  if (cached) return cached;
  const region = (import.meta.env.VITE_FUNCTIONS_REGION as string | undefined) || 'us-central1';
  cached = getFunctions(app, region);
  if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
    connectFunctionsEmulator(cached, 'localhost', 5001);
  }
  return cached;
}

/**
 * Provision a staff login account. Throws an Error with a Hinglish-friendly
 * message for known failure reasons.
 */
export async function createStaffAccount(input: CreateStaffInput): Promise<CreateStaffResult> {
  const callable = httpsCallable<CreateStaffInput, CreateStaffResult>(
    functionsInstance(), 'createStaffAccount');
  try {
    const res = await callable(input);
    return res.data;
  } catch (e: any) {
    const code = e?.code ?? '';
    if (code === 'already-exists' || /email-already|already exists|already-exists/i.test(e?.message ?? '')) {
      throw new Error('Ye email pehle se registered hai.');
    }
    if (code === 'permission-denied' || code === 'unauthenticated') {
      throw new Error('SURAKSHA: staff account sirf Company Commander bana sakta hai.');
    }
    if (code === 'invalid-argument') {
      throw new Error(e?.message ?? 'Input galat hai (name/email/password/role check karo).');
    }
    if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'failed-precondition') {
      throw new Error('Server abhi reachable nahi. Cloud Functions deploy/emulator check karo.');
    }
    throw new Error(e?.message ?? 'Staff account create nahi ho paya.');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN AUDIT + REPAIR
// ───────────────────────────────────────────────────────────────────────
// Purane staff accounts sirf Firestore me bane the, Firebase Auth me nahi.
// Aise account se login KABHI nahi hota — Firebase seedha
// `auth/invalid-credential` deta hai, kyunki us email ka Auth user hai hi
// nahi. Screen par profile dikhta hai, isliye lagta hai account theek hai.
// ═══════════════════════════════════════════════════════════════════════

export interface LoginAuditRow {
  profileId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  /** Is email ka Firebase Auth account maujood hai? */
  authExists: boolean;
  /** Profile ka doc id auth uid ke barabar hai? (app ka login contract) */
  idMatchesAuth: boolean;
  /** Teeno sahi — ye banda sach me login kar sakta hai. */
  canLogin: boolean;
}

export interface RepairResult {
  uid: string;
  email: string;
  role: string;
  /** 'auth-created' = naya Auth account bana · 'password-reset' = tha, password badla */
  action: 'auth-created' | 'password-reset';
  /** Profile ko naye doc id par move karna pada? */
  moved: boolean;
}

const friendly = (e: any, fallback: string): Error => {
  const code = e?.code ?? '';
  if (code === 'permission-denied' || code === 'unauthenticated') {
    return new Error('SURAKSHA: ye kaam sirf Company Commander kar sakta hai.');
  }
  if (code === 'invalid-argument') {
    return new Error(e?.message ?? 'Input galat hai.');
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'failed-precondition') {
    return new Error('Server abhi reachable nahi. Cloud Functions deploy hue hain? (firebase deploy --only functions)');
  }
  if (code === 'not-found' || /not.?found/i.test(e?.message ?? '')) {
    return new Error('Ye function deploy nahi hua. Chalao: firebase deploy --only functions');
  }
  return new Error(e?.message ?? fallback);
};

/** Har profile ke liye batata hai ki login ho sakta hai ya nahi. Read-only. */
export async function auditStaffLogins(): Promise<LoginAuditRow[]> {
  const callable = httpsCallable<Record<string, never>, { rows: LoginAuditRow[] }>(
    functionsInstance(), 'auditStaffLogins');
  try {
    const res = await callable({} as Record<string, never>);
    return res.data.rows ?? [];
  } catch (e: any) {
    throw friendly(e, 'Login audit nahi ho paya.');
  }
}

/**
 * Ek toote hue profile ko login-capable banata hai.
 * Auth account nahi hai to banata hai, hai to password reset karta hai.
 * Role/name/phone/assignedBatchIds sab preserve rehte hain.
 */
export async function repairStaffLogin(
  profileId: string, password: string,
): Promise<RepairResult> {
  const callable = httpsCallable<{ profileId: string; password: string }, RepairResult>(
    functionsInstance(), 'repairStaffLogin');
  try {
    const res = await callable({ profileId, password });
    return res.data;
  } catch (e: any) {
    throw friendly(e, 'Repair nahi ho paya.');
  }
}
