// ═══════════════════════════════════════════════════════════════════════
// createStaffAccount CALLABLE — LIVE EMULATOR RUNTIME SUITE
// ───────────────────────────────────────────────────────────────────────
// Exercises the deployed function (emulator) end-to-end: the caller signs
// in through the AUTH emulator, we invoke the callable over the Functions
// emulator HTTP endpoint, and assert on the Auth + Firestore side effects
// through Admin SDK.
//
// PREPARED, NOT RUNTIME-EXECUTED IN THE SANDBOX (no Java/emulator here —
// without emulators these checks would all report ECONNREFUSED and must
// NOT be claimed as passing).
//
// Run on a machine with Java + firebase-tools:
//   1. Start emulators (separate terminal):
//        firebase emulators:start --only auth,firestore,functions
//   2. From functions/:
//        FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//        FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//        npx mocha --timeout 40000 test/staffProvisioning.runtime.test.mjs
//
// Asserts:
//   CC allow · Clerk/QM/Ustad/SO deny · unauth deny · invalid role block ·
//   isDeveloper forced false · customerId not injectable · duplicate email ·
//   no orphan Auth account on denial · SO assignedBatchIds honored.
// ═══════════════════════════════════════════════════════════════════════

import { assert } from 'chai';
import { initializeApp as initializeClient, getApps, deleteApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, connectAuthEmulator,
} from 'firebase/auth';
import { initializeApp as initializeAdmin, applicationDefault } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'training-command-erp';
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
const REGION = process.env.FUNCTIONS_REGION || 'us-central1';
const CALLABLE_URL = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/createStaffAccount`;

// Seed accounts. The callable authorizes on the Firestore profile (fetched
// with Admin SDK), so we create BOTH an Auth user and its users/{uid} doc.
const SEED = [
  { key: 'cc',    email: 'rt-cc@example.com',    role: 'Company Commander',           active: true },
  { key: 'clerk', email: 'rt-clerk@example.com', role: 'Clerk',                       active: true },
  { key: 'qm',    email: 'rt-qm@example.com',    role: 'Quarter Master',              active: true },
  { key: 'ustad', email: 'rt-ustad@example.com', role: 'Ustad',                       active: true },
  { key: 'so',    email: 'rt-so@example.com',    role: 'Senior Officer / Inspector',  active: true },
];
const SEED_PASSWORD = 'Password123!';

let adminApp, adminAuth, adminDb, clientApp, clientAuth;
let authContexts = {}; // key -> { uid, email, idToken }

// Invoke the callable the same way the client SDK does:
//   POST with { data } JSON, Authorization: Bearer <idToken>
async function invokeCallable(idToken, data) {
  const res = await fetch(CALLABLE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

function expectDenied(r) {
  // UNALIGNED callable errors return non-2xx with body.error.status
  assert.notEqual(r.status, 200, `expected denial but got 200: ${JSON.stringify(r.body)}`);
  const status = r.body?.error?.status || r.body?.error?.code;
  assert.ok(
    ['PERMISSION_DENIED', 'permission-denied', 'UNAUTHENTICATED', 'unauthenticated'].includes(status),
    `expected permission/auth error, got ${JSON.stringify(r.body.error)}`
  );
}

describe('createStaffAccount callable (live emulator)', function () {
  this.timeout(60000);

  before(async function () {
    // Fail fast with a clear message if no emulator is running.
    try {
      await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/createStaffAccount`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
    } catch (e) {
      console.log('\n  [SKIP] Functions emulator not reachable (' + e.message + ').');
      console.log('         Start: firebase emulators:start --only auth,firestore,functions');
      this.skip();
    }

    // ── Admin SDK (seeding + side-effect inspection) ──
    adminApp = initializeAdmin({ projectId: PROJECT_ID });
    adminAuth = getAdminAuth(adminApp);
    adminDb = getFirestore(adminApp);

    // ── Client SDK (caller identity; Auth emulator) ──
    clientApp = initializeClient({
      projectId: PROJECT_ID,
      apiKey: 'fake-api-key',
      authDomain: 'localhost',
    });
    clientAuth = getAuth(clientApp);
    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });

    // Seed: config marker (post-setup company) + the five staff profiles.
    await adminDb.doc('config/firstRun').set(
      { completedAt: new Date().toISOString(), completedBy: 'seed' },
      { merge: true }
    );

    for (const s of SEED) {
      let user;
      try {
        user = await adminAuth.createUser({ email: s.email, password: SEED_PASSWORD });
      } catch (e) {
        if (e.code === 'auth/email-already-exists') {
          const u = await adminAuth.getUserByEmail(s.email);
          // ensure known password before signing in
      try { await adminAuth.updateUser(u.uid, { password: SEED_PASSWORD }); } catch { /* emulator seed */ }
          user = u;
        } else throw e;
      }
      await adminDb.doc(`users/${user.uid}`).set({
        name: s.key.toUpperCase(),
        email: s.email,
        role: s.role,
        isActive: s.active,
        isDeveloper: false,
        assignedBatchIds: s.key === 'so' ? ['batchA'] : [],
        createdAt: new Date().toISOString(),
        createdBy: 'seed',
      });
      const cred = await signInWithEmailAndPassword(clientAuth, s.email, SEED_PASSWORD);
      authContexts[s.key] = {
        uid: user.uid,
        email: s.email,
        idToken: await cred.user.getIdToken(),
      };
      await signOut(clientAuth);
    }
  });

  after(async () => {
    try { for (const a of getApps()) await deleteApp(a); } catch { /* noop */ }
  });

  const newStaffEmail = (tag) => `rt-new-${tag}-${Date.now()}@example.com`;

  it('UNAUTHENTICATED caller is denied', async () => {
    const r = await invokeCallable(null, {
      name: 'X', email: newStaffEmail('unauth'), password: 'Password123!', role: 'Clerk',
    });
    expectDenied(r);
  });

  it('CLERK caller is denied and no account is created', async () => {
    const email = newStaffEmail('clerk');
    const r = await invokeCallable(authContexts.clerk.idToken, {
      name: 'X', email, password: 'Password123!', role: 'Clerk',
    });
    expectDenied(r);
    await assert.becomes(
      adminAuth.getUserByEmail(email).then(() => 'EXISTS').catch(() => 'MISSING'),
      'MISSING',
      'no orphan auth account may exist after denial'
    );
  });

  it('QUARTER MASTER caller is denied', async () => {
    const r = await invokeCallable(authContexts.qm.idToken, {
      name: 'X', email: newStaffEmail('qm'), password: 'Password123!', role: 'Clerk',
    });
    expectDenied(r);
  });

  it('USTAD caller is denied', async () => {
    const r = await invokeCallable(authContexts.ustad.idToken, {
      name: 'X', email: newStaffEmail('ustad'), password: 'Password123!', role: 'Clerk',
    });
    expectDenied(r);
  });

  it('SENIOR OFFICER caller is denied', async () => {
    const r = await invokeCallable(authContexts.so.idToken, {
      name: 'X', email: newStaffEmail('so'), password: 'Password123!', role: 'Clerk',
    });
    expectDenied(r);
  });

  it('COMPANY COMMANDER can create a Clerk; profile is safe', async () => {
    const email = newStaffEmail('cc-clerk');
    const r = await invokeCallable(authContexts.cc.idToken, {
      name: 'New Clerk', email, password: 'Password123!', role: 'Clerk',
      // escalation / cross-company attempts — must be IGNORED:
      isDeveloper: true,
      customerId: 'OTHER-COMPANY-PROJECT',
      assignedBatchIds: ['batchX'],
    });
    assert.equal(r.status, 200, `expected success, got ${JSON.stringify(r.body)}`);
    const data = r.body.result;
    assert.equal(data.email, email);
    assert.equal(data.role, 'Clerk');
    assert.ok(!('password' in data) && !('customerId' in data), 'only safe fields returned');

    const user = await adminAuth.getUserByEmail(email);
    const snap = await adminDb.doc(`users/${user.uid}`).get();
    assert.equal(snap.exists, true);
    const p = snap.data();
    assert.equal(p.role, 'Clerk');
    assert.equal(p.isActive, true);
    assert.equal(p.isDeveloper, false,                 'client cannot force isDeveloper');
    assert.equal('customerId' in p, false,            'client cannot inject customerId');
    assert.deepEqual(p.assignedBatchIds, [],          'batch ids ignored for non-SO role');
    assert.equal(p.createdBy, authContexts.cc.uid,    'createdBy = calling CC');
  });

  it('CC creating a Senior Officer can set assignedBatchIds', async () => {
    const email = newStaffEmail('cc-so');
    const r = await invokeCallable(authContexts.cc.idToken, {
      name: 'New SO', email, password: 'Password123!',
      role: 'Senior Officer / Inspector',
      assignedBatchIds: ['batchA', 'batchB'],
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const user = await adminAuth.getUserByEmail(email);
    const p = (await adminDb.doc(`users/${user.uid}`).get()).data();
    assert.equal(p.role, 'Senior Officer / Inspector');
    assert.deepEqual(p.assignedBatchIds, ['batchA', 'batchB']);
  });

  it('CC cannot create an INVALID role (privilege escalation)', async () => {
    const email = newStaffEmail('badrole');
    const r = await invokeCallable(authContexts.cc.idToken, {
      name: 'Hax', email, password: 'Password123!', role: 'SuperAdmin',
    });
    assert.notEqual(r.status, 200);
    const status = r.body?.error?.status || r.body?.error?.code;
    assert.equal(status, 'INVALID_ARGUMENT', `got ${JSON.stringify(r.body.error)}`);
    await assert.becomes(
      adminAuth.getUserByEmail(email).then(() => 'EXISTS').catch(() => 'MISSING'),
      'MISSING', 'no orphan auth account for invalid role'
    );
  });

  it('duplicate email is rejected as already-exists', async () => {
    // First creation succeeds...
    const email = newStaffEmail('dup');
    const r1 = await invokeCallable(authContexts.cc.idToken, {
      name: 'First', email, password: 'Password123!', role: 'Clerk',
    });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    // ...second must fail with ALREADY_EXISTS.
    const r2 = await invokeCallable(authContexts.cc.idToken, {
      name: 'Second', email, password: 'Password123!', role: 'Clerk',
    });
    assert.notEqual(r2.status, 200);
    const status = r2.body?.error?.status || r2.body?.error?.code;
    assert.equal(status, 'ALREADY_EXISTS', `got ${JSON.stringify(r2.body.error)}`);
    // Exactly one account for that email.
    const list = (await adminAuth.getUsers([{ email }])).users;
    assert.equal(list.length, 1, 'duplicate attempt must not create a second account');
  });

  it('created staff can actually authenticate with the chosen password', async () => {
    // Login/password contract for NEW accounts stays intact (existing accounts
    // are untouched — they authenticate exactly as before).
    const email = newStaffEmail('login');
    const password = 'Password123!';
    const r = await invokeCallable(authContexts.cc.idToken, {
      name: 'Login Check', email, password, role: 'Clerk',
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const cred = await signInWithEmailAndPassword(clientAuth, email, password);
    assert.equal(cred.user.email, email);
    await signOut(clientAuth);
  });
});
