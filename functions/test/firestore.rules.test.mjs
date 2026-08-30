// ═══════════════════════════════════════════════════════════════════════
// FIRESTORE SECURITY RULES — EMULATOR TEST SUITE
// ───────────────────────────────────────────────────────────────────────
// PREPARED, NOT RUNTIME-EXECUTED IN THE SANDBOX (no Java/emulator here).
//
// Run on a machine with Java + firebase-tools:
//   cd functions && npm install
//   firebase emulators:exec --project fcoy-test 'npm run test:rules'
// or from repo root:
//   firebase emulators:start --only firestore,auth   (then: npm run test:rules)
//
// Deps (in functions/package.json devDependencies):
//   @firebase/rules-unit-testing, firebase-admin, mocha
// ═══════════════════════════════════════════════════════════════════════

import { assert } from 'chai';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'fcoy-test';

/** @type {RulesTestEnvironment} */
let testEnv;

async function makeEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
}

const CC    = { uid: 'ccUid',  email: 'cc@example.com' };
const CLERK = { uid: 'clerkUid', email: 'clerk@example.com' };
const QM    = { uid: 'qmUid',   email: 'qm@example.com' };
const USTAD = { uid: 'ustadUid', email: 'ustad@example.com' };

async function seedProfiles(env) {
  // Write profiles with admin (bypasses rules) so role lookups resolve.
  const admin = env.firestoreAdmin();
  await admin.doc('users/ccUid').set({
    name: 'CC', email: CC.email, role: 'Company Commander',
    isActive: true, isDeveloper: false,
  });
  await admin.doc('users/clerkUid').set({
    name: 'Clerk', email: CLERK.email, role: 'Clerk',
    isActive: true, isDeveloper: false,
  });
  await admin.doc('users/qmUid').set({
    name: 'QM', email: QM.email, role: 'Quarter Master',
    isActive: true, isDeveloper: false,
  });
  await admin.doc('users/ustadUid').set({
    name: 'Ustad', email: USTAD.email, role: 'Ustad',
    isActive: true, isDeveloper: false,
  });
}

function authedDb(env, auth) {
  return env.authenticatedContext(auth.uid, { email: auth.email }).firestore();
}

describe('Firestore rules', () => {
  before(async () => { testEnv = await makeEnv(); });
  after(async () => { await testEnv.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedProfiles(testEnv);
  });

  // ── LEAVE APPROVAL ──────────────────────────────────────────────────
  describe('staff_leave approval', () => {
    async function seedLeave(env) {
      await env.firestoreAdmin().doc('staff_leave/leave1').set({
        leaveNumber: 'LV-2026-001', staffId: 's1', staffName: 'X',
        status: 'pending', approvedBy: '', approvedByName: '',
        approvalDate: null, rejectionReason: '', remarks: '',
      });
    }
    const approve = { status: 'approved', approvedBy: 'ccUid',
      approvedByName: 'CC', approvalDate: 'now', rejectionReason: '' };
    const reject = { status: 'rejected', approvedBy: 'ccUid',
      approvedByName: 'CC', rejectionReason: 'reason', approvalDate: 'now' };

    it('CC can approve leave', async () => {
      await seedLeave(testEnv);
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('staff_leave/leave1').update(approve));
    });
    it('CC can reject leave', async () => {
      await seedLeave(testEnv);
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('staff_leave/leave1').update(reject));
    });
    it('Clerk cannot approve', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, CLERK).doc('staff_leave/leave1').update(approve));
    });
    it('QM cannot approve', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, QM).doc('staff_leave/leave1').update(approve));
    });
    it('Ustad cannot approve', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('staff_leave/leave1').update(approve));
    });
    it('Clerk cannot reject', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, CLERK).doc('staff_leave/leave1').update(reject));
    });
    it('QM cannot reject', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, QM).doc('staff_leave/leave1').update(reject));
    });
    it('Ustad cannot reject', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('staff_leave/leave1').update(reject));
    });
    it('Ustad direct status mutation denied', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('staff_leave/leave1')
          .update({ status: 'approved' }));
    });
    it('Ustad approval-field mutation denied', async () => {
      await seedLeave(testEnv);
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('staff_leave/leave1')
          .update({ approvedBy: 'ustadUid', rejectionReason: 'x' }));
    });
    it('Ustad may edit non-approval fields (remarks) allowed', async () => {
      await seedLeave(testEnv);
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('staff_leave/leave1')
          .update({ remarks: 'note' }));
    });
  });

  // ── SELF-ESCALATION ─────────────────────────────────────────────────
  describe('users protected fields', () => {
    it('Ustad cannot promote self to Company Commander', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('users/ustadUid')
          .update({ role: 'Company Commander' }));
    });
    it('Ustad cannot set isDeveloper=true', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('users/ustadUid')
          .update({ isDeveloper: true }));
    });
    it('Ustad cannot manipulate isActive', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('users/ustadUid')
          .update({ isActive: false }));
    });
    it('Ustad cannot modify another user role', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('users/clerkUid')
          .update({ role: 'Company Commander' }));
    });
    it('Ustad cannot create users', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).collection('users')
          .add({ name: 'x', role: 'Company Commander', isActive: true }));
    });
    it('CC can change roles', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('users/ustadUid')
          .update({ role: 'Clerk' }));
    });
  });

  // ── DEVELOPER DATA ──────────────────────────────────────────────────
  describe('dev/test isolation', () => {
    beforeEach(async () => {
      await testEnv.firestoreAdmin().doc('trainees/dev1').set({
        name: 'Dev', chestNo: '9999', isDevData: true, batchId: 'b1',
      });
      await testEnv.firestoreAdmin().doc('trainees/real1').set({
        name: 'Real', chestNo: '1', batchId: 'b1',
      });
    });
    it('normal user cannot read developer document', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('trainees/dev1').get());
    });
    it('normal user developer-tagged query returns only real docs', async () => {
      const snap = await authedDb(testEnv, CLERK)
        .collection('trainees').get();
      const names = snap.docs.map(d => d.data().name);
      assert.includeMembers(names, ['Real']);
      assert.notInclude(names, ['Dev']);
    });
    it('normal user cannot create dev-tagged data', async () => {
      await assert.isRejected(
        authedDb(testEnv, CLERK)
          .collection('trainees').add({ name: 'x', isDevData: true, batchId: 'b1' }));
    });
  });

  // ── SUBSCRIPTION ────────────────────────────────────────────────────
  describe('subscription protection', () => {
    it('normal user cannot write subscription/current', async () => {
      await assert.isRejected(
        authedDb(testEnv, CLERK).doc('subscription/current')
          .set({ planId: 'p1' }));
    });
    it('normal user cannot write subscriptionHistory', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).collection('subscriptionHistory')
          .add({ action: 'RENEWED' }));
    });
    it('normal user cannot write subscriptionPlans', async () => {
      await assert.isRejected(
        authedDb(testEnv, QM).doc('subscriptionPlans/monthly')
          .set({ price: 1 }));
    });
    it('normal user cannot write customers/bridge', async () => {
      await assert.isRejected(
        authedDb(testEnv, CLERK).doc('customers/c1').set({ x: 1 }));
    });
  });

  // ── FINANCE / INVENTORY AUTHORIZATION ───────────────────────────────
  describe('finance & inventory', () => {
    it('Ustad cannot write finance expense', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).collection('mess_fund_expenses')
          .add({ amount: 100 }));
    });
    it('Clerk cannot write finance expense', async () => {
      await assert.isRejected(
        authedDb(testEnv, CLERK).collection('mess_fund_expenses')
          .add({ amount: 100 }));
    });
    it('QM can write finance expense', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, QM).collection('mess_fund_expenses')
          .add({ amount: 100 }));
    });
    it('Ustad cannot create issue_records', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).collection('issue_records')
          .add({ traineeName: 'x' }));
    });
    it('Ustad cannot write stock_ledgers', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('stock_ledgers/dm-shoes')
          .set({ balance: 5 }));
    });
    it('stock_ledger balance cannot be set negative', async () => {
      await assert.isRejected(
        authedDb(testEnv, QM).doc('stock_ledgers/dm-shoes')
          .set({ balance: -1 }));
    });
  });
});
