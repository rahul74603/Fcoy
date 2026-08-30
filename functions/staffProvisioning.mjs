// ═══════════════════════════════════════════════════════════════════════
// STAFF ACCOUNT PROVISIONING — server-side (Admin SDK) logic
// ───────────────────────────────────────────────────────────────────────
// Creates a Firebase Auth account + Firestore profile for a new staff
// member. Runs ONLY inside a CC-authorized callable (the CC check lives in
// the wrapper in index.js and is re-asserted here against the caller's
// Firestore profile).
//
// Security rules enforced here (defense in depth, independent of the UI):
//   • Only a Company Commander (active) may provision staff.
//   • Role must be a known staff role — a client cannot inject a role.
//   • isDeveloper is ALWAYS forced false (never trustable from the client).
//   • customerId is NEVER taken from the client (company = the project).
//   • assignedBatchIds (SO scope) is honored only for the SO role and must
//     be an array of strings; it is a CC-managed authorization field.
//   • Email/password validated server-side; duplicate emails handled.
//   • Partial failure rolls back the Auth account (no orphan accounts).
// No secret values are ever returned.
// ═══════════════════════════════════════════════════════════════════════

export const STAFF_ROLES = [
  'Clerk',
  'Quarter Master',
  'Ustad',
  'Senior Officer / Inspector',
  'Company Commander',
];

export class ProvisioningError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // maps to an HttpsError status in the wrapper
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Assert the CALLER is an active Company Commander.
 * `callerProfile` is the Firestore users/{uid} doc fetched with Admin SDK.
 */
export function assertCallerIsCommander(callerProfile) {
  if (!callerProfile) {
    throw new ProvisioningError('permission-denied', 'Caller profile not found.');
  }
  if (callerProfile.isActive === false) {
    throw new ProvisioningError('permission-denied', 'Caller account is deactivated.');
  }
  if (String(callerProfile.role || '').trim() !== 'Company Commander') {
    throw new ProvisioningError('permission-denied',
      'Only the Company Commander may provision staff accounts.');
  }
}

/** Validate and normalize the requested staff payload. */
export function normalizeStaffInput(data) {
  const d = data || {};
  const name = String(d.name ?? '').trim();
  const email = String(d.email ?? '').trim().toLowerCase();
  const password = String(d.password ?? '');
  const role = String(d.role ?? '').trim();

  if (!name) throw new ProvisioningError('invalid-argument', 'Name is required.');
  if (!EMAIL_RE.test(email)) throw new ProvisioningError('invalid-argument', 'A valid email is required.');
  if (password.length < 6) throw new ProvisioningError('invalid-argument', 'Password must be at least 6 characters.');
  if (!STAFF_ROLES.includes(role)) {
    throw new ProvisioningError('invalid-argument', `Invalid role "${role}".`);
  }

  // assignedBatchIds is meaningful ONLY for the Senior Officer / Inspector.
  let assignedBatchIds = [];
  if (role === 'Senior Officer / Inspector') {
    const raw = Array.isArray(d.assignedBatchIds) ? d.assignedBatchIds : [];
    assignedBatchIds = raw.map((x) => String(x)).filter(Boolean);
  }

  return {
    name,
    email,
    password,
    role,
    phone: String(d.phone ?? '').trim(),
    designation: String(d.designation ?? '').trim(),
    assignedBatchIds,
  };
}

/**
 * Create the Auth account + Firestore profile.
 *
 * @param {object} adminAuth  firebase-admin Auth instance
 * @param {object} adminDb    firebase-admin Firestore instance
 * @param {object} caller     { uid: string } the authenticated CC
 * @param {object} input      normalized payload from normalizeStaffInput()
 * @returns {Promise<{uid:string,email:string,role:string}>}
 */
export async function provisionStaff(adminAuth, adminDb, caller, input) {
  let createdUid = null;
  try {
    // 1) Auth account via Admin SDK (runs with service-account privileges).
    const userRecord = await adminAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });
    createdUid = userRecord.uid;

    // 2) Firestore profile — doc id = auth uid (the app's login contract).
    //    Authorization fields are set SERVER-SIDE, never from the client.
    await adminDb.collection('users').doc(createdUid).set({
      name: input.name,
      email: input.email,
      role: input.role,
      phone: input.phone,
      designation: input.designation,
      isActive: true,
      isDeveloper: false,                 // forced — cannot be escalated
      assignedBatchIds: input.assignedBatchIds,
      // customerId is deliberately NOT copied from the request: a staff
      // member belongs to THIS company/project. Multi-company isolation is
      // the per-Firebase-project boundary.
      createdAt: new Date().toISOString(),
      createdBy: caller.uid,
    });

    return { uid: createdUid, email: input.email, role: input.role };
  } catch (err) {
    // Roll back the Auth account if the profile write failed, so we never
    // leave an orphaned login with no (or a wrong) profile.
    if (createdUid) {
      try { await adminAuth.deleteUser(createdUid); } catch { /* best effort */ }
    }
    // Admin SDK uses 'auth/email-already-exists'.
    if (err && (err.code === 'auth/email-already-exists' || err.code === 'already-exists')) {
      throw new ProvisioningError('already-exists', 'Ye email pehle se registered hai.');
    }
    if (err instanceof ProvisioningError) throw err;
    throw new ProvisioningError('internal', 'Staff account create nahi ho paya.');
  }
}
