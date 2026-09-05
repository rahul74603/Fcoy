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
  'Trainee',
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
    // Surface WHY it failed. This was previously a flat
    // "Staff account create nahi ho paya", which hid a real infrastructure
    // fault ("The default Firebase app does not exist") behind a generic
    // message for days. The detail here is an operator-facing cause, not a
    // secret: no keys, tokens or credentials are ever included.
    const detail = String(err?.message ?? err ?? '').slice(0, 200);
    throw new ProvisioningError(
      'internal',
      detail ? `Staff account create nahi ho paya — ${detail}` : 'Staff account create nahi ho paya.',
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BROKEN PROFILE REPAIR
// ───────────────────────────────────────────────────────────────────────
// Purane accounts (QM, SO, Clerk...) us zamane me bane the jab ye page
// sirf Firestore profile banata tha aur Firebase Auth account NAHI. Aise
// account se login kabhi nahi hota — Firebase `auth/invalid-credential`
// deta hai, kyunki us email ka Auth user exist hi nahi karta.
//
// Ye function unhe theek karta hai, WITHOUT data loss:
//   • Auth account nahi hai  → bana do, aur profile ko naye uid par le jao
//   • Auth account hai       → sirf password reset kar do
//   • Profile doc id != uid  → naye doc id par copy, purana deactivate
//
// Role, name, phone, designation, assignedBatchIds — sab preserve hote
// hain. isDeveloper hamesha false force hota hai (client kabhi trust nahi).
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} adminAuth firebase-admin Auth
 * @param {object} adminDb   firebase-admin Firestore
 * @param {object} caller    { uid }
 * @param {object} input     { profileId: string, password: string }
 */
export async function repairStaffAccount(adminAuth, adminDb, caller, input) {
  const profileId = String(input?.profileId ?? '').trim();
  const password = String(input?.password ?? '');

  if (!profileId) {
    throw new ProvisioningError('invalid-argument', 'Profile id required.');
  }
  if (password.length < 6) {
    throw new ProvisioningError('invalid-argument', 'Password kam se kam 6 character ka ho.');
  }

  const snap = await adminDb.collection('users').doc(profileId).get();
  if (!snap.exists) {
    throw new ProvisioningError('invalid-argument', 'Ye profile Firestore me nahi mila.');
  }
  const p = snap.data() || {};

  const email = String(p.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new ProvisioningError('invalid-argument',
      'Is profile me valid email nahi hai — pehle email theek karo.');
  }

  const role = String(p.role ?? '').trim();
  if (!STAFF_ROLES.includes(role)) {
    throw new ProvisioningError('invalid-argument',
      `Is profile ka role "${role}" pehchana nahi gaya — pehle role theek karo.`);
  }

  const name = String(p.name ?? '').trim() || email.split('@')[0];

  // 1) Auth account dhundo, warna banao.
  let uid;
  let action;
  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
    // Account hai — sirf password reset karo taaki CC turant de sake.
    await adminAuth.updateUser(uid, { password, displayName: name, disabled: false });
    action = 'password-reset';
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      const created = await adminAuth.createUser({ email, password, displayName: name });
      uid = created.uid;
      action = 'auth-created';
    } else {
      throw new ProvisioningError('internal', 'Auth account check nahi ho paya.');
    }
  }

  // 2) Profile ko sahi doc id (= auth uid) par le jao.
  const payload = {
    name,
    email,
    role,
    phone: String(p.phone ?? '').trim(),
    designation: String(p.designation ?? '').trim(),
    isActive: true,
    isDeveloper: false, // forced — kabhi client se nahi
    assignedBatchIds: Array.isArray(p.assignedBatchIds)
      ? p.assignedBatchIds.map(String).filter(Boolean)
      : [],
    createdAt: String(p.createdAt ?? new Date().toISOString()),
    createdBy: String(p.createdBy ?? caller.uid),
    repairedAt: new Date().toISOString(),
    repairedBy: caller.uid,
  };

  let moved = false;
  if (profileId !== uid) {
    // Naye uid par likho, purana doc deactivate karke chhod do (delete nahi
    // — history aur audit trail bacha rehna chahiye).
    await adminDb.collection('users').doc(uid).set(payload, { merge: true });
    await adminDb.collection('users').doc(profileId).set({
      isActive: false,
      supersededBy: uid,
      supersededAt: new Date().toISOString(),
      note: 'Broken profile — repair ke baad naye uid par move ho gaya.',
    }, { merge: true });
    moved = true;
  } else {
    await adminDb.collection('users').doc(uid).set(payload, { merge: true });
  }

  return { uid, email, role, action, moved };
}

/**
 * Sirf report karta hai — kuch badalta nahi.
 * Har profile ke liye batata hai ki uska Auth account hai ya nahi.
 */
export async function auditStaffAccounts(adminAuth, adminDb) {
  const snap = await adminDb.collection('users').get();
  const rows = [];

  for (const d of snap.docs) {
    const p = d.data() || {};
    const email = String(p.email ?? '').trim().toLowerCase();
    let authExists = false;
    let authUid = '';

    if (EMAIL_RE.test(email)) {
      try {
        const u = await adminAuth.getUserByEmail(email);
        authExists = true;
        authUid = u.uid;
      } catch { /* user-not-found */ }
    }

    rows.push({
      profileId: d.id,
      name: String(p.name ?? ''),
      email,
      role: String(p.role ?? ''),
      isActive: p.isActive !== false,
      authExists,
      idMatchesAuth: authExists && authUid === d.id,
      canLogin: authExists && authUid === d.id && p.isActive !== false,
    });
  }

  return rows;
}
