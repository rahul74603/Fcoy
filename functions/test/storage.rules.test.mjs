// ═══════════════════════════════════════════════════════════════════════
// FIREBASE STORAGE SECURITY RULES — EMULATOR TEST SUITE
// ───────────────────────────────────────────────────────────────────────
// PREPARED, NOT RUNTIME-EXECUTED IN THE SANDBOX (no Java/emulator here).
//
// Run on a machine with Java + firebase-tools (from repo root):
//   firebase emulators:exec --project fcoy-test 'npm --prefix functions run test:storage'
//
// Requires the Firestore rules test seeding as well because Storage rules
// read the user's Firestore profile (firestore.get(...users/{uid})).
// ═══════════════════════════════════════════════════════════════════════

import { assert } from 'chai';
// NOTE: `RulesTestEnvironment` is a TypeScript TYPE only in
// @firebase/rules-unit-testing v4 — it is NOT a runtime export. The runtime
// entry point is `initializeTestEnvironment`.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'fcoy-test';

/** @type {RulesTestEnvironment} */
let testEnv;

async function makeEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
    storage: {
      rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8'),
    },
  });
}

const CC    = { uid: 'ccUid',  email: 'cc@example.com' };
const CLERK = { uid: 'clerkUid', email: 'clerk@example.com' };
const QM    = { uid: 'qmUid',   email: 'qm@example.com' };
const USTAD = { uid: 'ustadUid', email: 'ustad@example.com' };

async function seedProfiles(env) {
  const admin = env.firestoreAdmin();
  await admin.doc('users/ccUid').set({ name: 'CC', email: CC.email, role: 'Company Commander', isActive: true });
  await admin.doc('users/clerkUid').set({ name: 'Clerk', email: CLERK.email, role: 'Clerk', isActive: true });
  await admin.doc('users/qmUid').set({ name: 'QM', email: QM.email, role: 'Quarter Master', isActive: true });
  await admin.doc('users/ustadUid').set({ name: 'Ustad', email: USTAD.email, role: 'Ustad', isActive: true });
}

function authedStorage(env, auth) {
  return env.authenticatedContext(auth.uid, { email: auth.email }).storage();
}

const PNG = Buffer.from('fake-png-bytes');

describe('Storage rules', () => {
  before(async () => { testEnv = await makeEnv(); });
  after(async () => { await testEnv.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearStorage();
    await testEnv.clearFirestore();
    await seedProfiles(testEnv);
  });

  describe('documents/ tree', () => {
    it('Clerk can upload a document', async () => {
      await assert.isFulfilled(
        authedStorage(testEnv, CLERK)
          .bucket().file('documents/REG1/aadhar_1.png').save(PNG));
    });
    it('Ustad cannot upload a document', async () => {
      await assert.isRejected(
        authedStorage(testEnv, USTAD)
          .bucket().file('documents/REG1/aadhar_1.png').save(PNG));
    });
    it('QM can upload a document', async () => {
      await assert.isFulfilled(
        authedStorage(testEnv, QM)
          .bucket().file('documents/REG1/bill_1.png').save(PNG));
    });
    it('CC can delete a document; Clerk cannot', async () => {
      await authedStorage(testEnv, CLERK)
        .bucket().file('documents/REG1/x.png').save(PNG);
      await assert.isRejected(
        authedStorage(testEnv, CLERK)
          .bucket().file('documents/REG1/x.png').delete());
      await assert.isFulfilled(
        authedStorage(testEnv, CC)
          .bucket().file('documents/REG1/x.png').delete());
    });
  });

  describe('public / unauthorized', () => {
    it('unauthenticated cannot read', async () => {
      await assert.isRejected(
        testEnv.unauthenticatedContext().storage()
          .bucket().file('documents/REG1/x.png').save(PNG));
    });
    it('public write to an arbitrary path is denied', async () => {
      await assert.isRejected(
        testEnv.unauthenticatedContext().storage()
          .bucket().file('public/shell.html').save(Buffer.from('<script>')));
    });
    it('unmatched tree write is denied', async () => {
      await assert.isRejected(
        authedStorage(testEnv, CC)
          .bucket().file('secrets/key.txt').save(Buffer.from('x')));
    });
  });
});
