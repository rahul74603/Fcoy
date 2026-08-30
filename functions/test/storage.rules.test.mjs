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
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

// chai-as-promised (assert.isFulfilled / isRejected) is not installed under
// Chai 5; alias the canonical rules-unit-testing assertions (assertFails
// still rejects on a non-permission error or on success, so bugs aren't
// masked). See firestore.rules.test.mjs for details.
assert.isFulfilled = (p) => assertSucceeds(p);
assert.isRejected = (p) => assertFails(p);

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
  // rules-unit-testing v4 has no firestoreAdmin(); seed inside a single
  // rules-disabled context (local emulator only, mock "owner" token).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await admin.doc('users/ccUid').set({ name: 'CC', email: CC.email, role: 'Company Commander', isActive: true });
    await admin.doc('users/clerkUid').set({ name: 'Clerk', email: CLERK.email, role: 'Clerk', isActive: true });
    await admin.doc('users/qmUid').set({ name: 'QM', email: QM.email, role: 'Quarter Master', isActive: true });
    await admin.doc('users/ustadUid').set({ name: 'Ustad', email: USTAD.email, role: 'Ustad', isActive: true });
  });
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
          .ref('documents/REG1/aadhar_1.png').put(PNG, { contentType: 'image/png' }));
    });
    it('Ustad cannot upload a document', async () => {
      await assert.isRejected(
        authedStorage(testEnv, USTAD)
          .ref('documents/REG1/aadhar_1.png').put(PNG, { contentType: 'image/png' }));
    });
    it('QM can upload a document', async () => {
      await assert.isFulfilled(
        authedStorage(testEnv, QM)
          .ref('documents/REG1/bill_1.png').put(PNG, { contentType: 'image/png' }));
    });
    it('CC can delete a document; Clerk cannot', async () => {
      await authedStorage(testEnv, CLERK)
        .ref('documents/REG1/x.png').put(PNG, { contentType: 'image/png' });
      await assert.isRejected(
        authedStorage(testEnv, CLERK)
          .ref('documents/REG1/x.png').delete());
      await assert.isFulfilled(
        authedStorage(testEnv, CC)
          .ref('documents/REG1/x.png').delete());
    });
  });

  describe('public / unauthorized', () => {
    it('unauthenticated cannot read', async () => {
      await assert.isRejected(
        testEnv.unauthenticatedContext().storage()
          .ref('documents/REG1/x.png').put(PNG, { contentType: 'image/png' }));
    });
    it('public write to an arbitrary path is denied', async () => {
      await assert.isRejected(
        testEnv.unauthenticatedContext().storage()
          .ref('public/shell.html').put(Buffer.from('<script>'), { contentType: 'text/html' }));
    });
    it('unmatched tree write is denied', async () => {
      await assert.isRejected(
        authedStorage(testEnv, CC)
          .ref('secrets/key.txt').put(Buffer.from('x'), { contentType: 'text/plain' }));
    });
  });
});
