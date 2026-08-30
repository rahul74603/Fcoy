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
