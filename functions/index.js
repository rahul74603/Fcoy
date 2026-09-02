// ═══════════════════════════════════════════════════════════════════════
// FCOY ERP — CLOUD FUNCTIONS (100% FREE — No Secret Manager)
// ───────────────────────────────────────────────────────────────────────
// Sirf FREE functions hain:
//   1. createStaffAccount — Staff account banana (CC only)
//   2. scheduledBackup    — Daily 2 AM backup
//   3. onBatchCreated     — Batch activate hone pe backup
//   4. onBatchClosed      — Batch band hone pe backup
//
// AI functions (Groq/Gemini/Pinecone) hata diye gaye hain taaki:
//   - Secret Manager ka koi charge na lage
//   - Koi API key store nahi karni padti
//   - Project 100% FREE rahe
// ═══════════════════════════════════════════════════════════════════════

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import {
  assertCallerIsCommander, normalizeStaffInput, provisionStaff, ProvisioningError,
} from './staffProvisioning.mjs';
import { scheduledBackup, onBatchCreated, onBatchClosed } from './backup.mjs';

// ───────────────────────────────────────────────────────────────────────
// LAZY firebase-admin initialization.
// ───────────────────────────────────────────────────────────────────────
let _db = null;
let _auth = null;
function getDb() {
  if (_db) return _db;
  if (!getApps().length) initializeApp();
  _db = getFirestore();
  return _db;
}
function getAdminAuth() {
  if (_auth) return _auth;
  if (!getApps().length) initializeApp();
  _auth = getAuth();
  return _auth;
}

// ───────────────────────────────────────────────────────────────────────
// AUTHORIZATION — server-trusted role verification
// ───────────────────────────────────────────────────────────────────────
async function assertAuthorized(request) {
  if (!request?.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const uid = request.auth.uid;
  const email = (request.auth.token?.email || '').toLowerCase();

  // Developer email: bypass all checks
  if (email === 'developer@acoy.com') {
    return { uid, email };
  }

  let snap;
  try {
    snap = await getDb().collection('users').doc(uid).get();
  } catch (err) {
    logger.error('Authorization lookup failed', { uid, err: String(err) });
    throw new HttpsError('internal', 'Authorization check failed.');
  }

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'User profile not found.');
  }

  const data = snap.data() || {};
  if (data.isActive === false) {
    throw new HttpsError('permission-denied', 'Account is deactivated.');
  }

  return { uid, email: email || data.email || '', role: data.role || '' };
}

// ───────────────────────────────────────────────────────────────────────
// 1) STAFF ACCOUNT PROVISIONING (CC-only)
// ───────────────────────────────────────────────────────────────────────
export const createStaffAccount = onCall(
  { timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    const caller = await assertAuthorized(request);

    try {
      const callerSnap = await getDb().collection('users').doc(request.auth.uid).get();
      assertCallerIsCommander(callerSnap.exists ? callerSnap.data() : null, caller.email);

      const input = normalizeStaffInput(request.data || {});
      const result = await provisionStaff(getAdminAuth(), getDb(), { uid: caller.uid }, input);
      return { uid: result.uid, email: result.email, role: result.role };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err instanceof ProvisioningError) {
        const statusByCode = {
          'permission-denied': 'permission-denied',
          'invalid-argument': 'invalid-argument',
          'already-exists':    'already-exists',
          'internal':          'internal',
        };
        throw new HttpsError(statusByCode[err.code] || 'internal', err.message);
      }
      logger.error('Staff provisioning failed', { uid: request.auth?.uid, err: String(err) });
      throw new HttpsError('internal', 'Staff account create nahi ho paya.');
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// 2) AUTOMATIC BACKUP — Firestore → Storage (daily at 2 AM IST)
// ───────────────────────────────────────────────────────────────────────
export { scheduledBackup, onBatchCreated, onBatchClosed };
