// ═══════════════════════════════════════════════════════════════════════
// FIRESTORE SECURITY RULES — EMULATOR TEST SUITE
// ───────────────────────────────────────────────────────────────────────
// PREPARED, NOT RUNTIME-EXECUTED IN THE SANDBOX (no Java/emulator here).
//
// Run on a machine with Java + firebase-tools:
//   cd functions
//   npm install          <-- REQUIRED. Without functions/node_modules both the
//                            emulator and `firebase deploy --only functions`
//                            fail with "Couldn't find firebase-functions".
//   npm run test:all     <-- starts the emulator and runs every suite
//
// Or, if an emulator is ALREADY running, use the bare script (it must not
// start a nested emulator):
//   npm run test:rules
//
// NOTE: the project id must start with 'demo-' so firebase-tools treats it as
// a fake project and never touches production.
//
// Deps (in functions/package.json devDependencies):
//   @firebase/rules-unit-testing, firebase-admin, mocha
// ═══════════════════════════════════════════════════════════════════════

import { assert } from 'chai';
// NOTE: `RulesTestEnvironment` is a TypeScript TYPE only in
// @firebase/rules-unit-testing v4 — it is NOT a runtime export. Importing it
// as a value throws "does not provide an export named 'RulesTestEnvironment'".
// The runtime entry point is `initializeTestEnvironment`.
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

// The existing suites were written with chai-as-promised's
// assert.isFulfilled / assert.isRejected. chai-as-promised is not installed
// (Chai 5 ships no plugin built-in). Instead of adding a dependency, alias the
// canonical rules-unit-testing assertions onto the same names:
//   isFulfilled(p) -> assertSucceeds(p)  (request must be allowed)
//   isRejected(p)  -> assertFails(p)     (request must be DENIED; it still
//                     rejects when the promise resolves OR fails for a
//                     non-permission reason, so real bugs are never masked).
assert.isFulfilled = (p) => assertSucceeds(p);
assert.isRejected = (p) => assertFails(p);

// MUST start with 'demo-' so firebase-tools treats this as a fake project and
// never reaches production. Using the real project id here made the emulator
// try to resolve the live project (and warn about production credentials).
// Honours the emulator's own env var when it is set.
const PROJECT_ID = process.env.GCLOUD_PROJECT
  || process.env.FIREBASE_PROJECT
  || 'demo-fcoy-test';

/** @type {RulesTestEnvironment} */
let testEnv;

async function makeEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
}

const CC    = { uid: 'ccUid',  email: 'cc@example.com' };
const CLERK = { uid: 'clerkUid', email: 'clerk@example.com' };
const QM    = { uid: 'qmUid',   email: 'qm@example.com' };
const USTAD = { uid: 'ustadUid', email: 'ustad@example.com' };
// Senior Officer / Inspector — assigned batchA ONLY (batchB must be denied)
const SO    = { uid: 'soUid',   email: 'so@example.com' };
const TRAINEE = { uid: 'traineeUid', email: 'ct@master.com' };

async function seedProfiles(env) {
  // Write profiles with admin privileges (rules bypassed) so role lookups
  // resolve. rules-unit-testing v4 has NO `firestoreAdmin()`; the supported
  // bypass mechanism is withSecurityRulesDisabled(), whose context is valid
  // ONLY inside its callback (eagerly cleaned up afterwards). We do all the
  // seed writes inside ONE callback against that disabled-context Firestore.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    // Simulate a REAL, already-set-up company: the first-run wizard writes a
    // config/firstRun marker once setup completes (FirstRunSetupScreen). When
    // it exists, firstRunOpen() is false, so the bootstrap backdoors in the
    // users / subscription rules correctly stay CLOSED (CC-only). Without
    // this marker the emulator looks like a fresh/unconfigured tenant and the
    // wizard-allow paths would spuriously permit normal users.
    await admin.doc('config/firstRun').set({
      completedAt: '2026-01-01T00:00:00Z', completedBy: 'ccUid',
    });
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
    await admin.doc('users/soUid').set({
      name: 'SO', email: SO.email, role: 'Senior Officer / Inspector',
      isActive: true, isDeveloper: false, assignedBatchIds: ['batchA'],
    });
    await admin.doc('users/traineeUid').set({
      name: 'Course Trainee Senior', email: TRAINEE.email, role: 'Course Trainee Senior',
      isActive: true, isDeveloper: false,
    });
  });
}

/**
 * Admin (rules-bypassing) Firestore handle for v4.
 *
 * `firestoreAdmin()` does not exist in @firebase/rules-unit-testing v4 — every
 * privileged operation must run inside `withSecurityRulesDisabled`. This tiny
 * compat shim preserves the existing `admin.doc(path).set(data)` seeding
 * call-sites: each write is executed within its own disabled context. It
 * targets the LOCAL EMULATOR ONLY (the context is a test client with the
 * special "owner" mock token, never a production Admin SDK connection).
 */
function adminDb(env) {
  const run = (op) => env.withSecurityRulesDisabled((ctx) => Promise.resolve(op(ctx.firestore())));
  return {
    doc: (path) => ({
      set: (data, opts) => run((fs) => fs.doc(path).set(data, opts)),
      update: (data) => run((fs) => fs.doc(path).update(data)),
      delete: () => run((fs) => fs.doc(path).delete()),
      // get() is never used for seeding; supported only for completeness.
      get: () => run((fs) => fs.doc(path).get()),
    }),
  };
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
      await adminDb(env).doc('staff_leave/leave1').set({
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
      await adminDb(testEnv).doc('trainees/dev1').set({
        name: 'Dev', chestNo: '9999', isDevData: true, batchId: 'b1',
      });
      await adminDb(testEnv).doc('trainees/real1').set({
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

    // ── SELF-RENEWAL BYPASS (the real threat) ──
    // The Company Commander is the party the licence bills. Rules previously
    // said `allow write: if isCC()`, so a CC could open the browser console
    // and grant themselves an unlimited free licence. The client-side owner
    // key never protected anything — Firestore never saw it.
    it('CC CANNOT extend their own licence expiry', async () => {
      await adminDb(testEnv).doc('subscription/current').set({
        planId: 'monthly', planName: 'Monthly', endDate: '2020-01-01T00:00:00.000Z',
      });
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscription/current')
          .set({ planId: 'monthly', endDate: '2099-12-31T00:00:00.000Z' }));
    });
    it('CC CANNOT patch endDate with a partial update', async () => {
      await adminDb(testEnv).doc('subscription/current').set({
        planId: 'monthly', endDate: '2020-01-01T00:00:00.000Z',
      });
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscription/current')
          .update({ endDate: '2099-12-31T00:00:00.000Z' }));
    });
    it('CC CANNOT delete the licence to reset to unlicensed', async () => {
      await adminDb(testEnv).doc('subscription/current').set({ planId: 'monthly' });
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscription/current').delete());
    });
    it('CC CANNOT rewrite or delete billing history', async () => {
      await adminDb(testEnv).doc('subscriptionHistory/h1').set({ action: 'RENEWED' });
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscriptionHistory/h1').update({ action: 'CANCELLED' }));
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscriptionHistory/h1').delete());
    });
    // The licence must stay READABLE or the login-time listener hangs forever.
    it('licence stays readable to a signed-in user', async () => {
      await adminDb(testEnv).doc('subscription/current').set({ planId: 'monthly' });
      await assert.isFulfilled(authedDb(testEnv, CLERK).doc('subscription/current').get());
    });
    // The setup wizard must still be able to seed the very first licence.
    it('first-run seeding still works before config/firstRun exists', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('subscription/current').set({ planId: '' }));
    });

    // ── FIRST-RUN LATCH (bypass found in the b839025 re-audit) ──
    // firstRunOpen() means "config/firstRun does not exist". Because
    // `allow write` covers DELETE, a CC could delete that marker, re-open
    // the setup window and with it subscription/current — restoring the
    // self-renewal bypass one step further down the chain.
    it('CC CANNOT delete config/firstRun to re-open setup', async () => {
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isRejected(authedDb(testEnv, CC).doc('config/firstRun').delete());
    });
    it('Clerk CANNOT delete config/firstRun', async () => {
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isRejected(authedDb(testEnv, CLERK).doc('config/firstRun').delete());
    });
    it('CC CANNOT overwrite config/firstRun', async () => {
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isRejected(
        authedDb(testEnv, CC).doc('config/firstRun').set({ done: false }));
    });
    it('full attack chain: delete latch then rewrite licence is blocked', async () => {
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await adminDb(testEnv).doc('subscription/current').set({
        planId: 'monthly', endDate: '2020-01-01T00:00:00.000Z',
      });
      // Step 1 must fail, so the licence stays locked.
      await assert.isRejected(authedDb(testEnv, CC).doc('config/firstRun').delete());
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscription/current')
          .set({ planId: 'monthly', endDate: '2099-12-31T00:00:00.000Z' }));
    });
    // The wizard must still be able to arm the latch exactly once.
    it('setup wizard can create config/firstRun once', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('config/firstRun').set({ done: true }));
    });
    // Ordinary config docs must keep working (activeBatch pointer etc.).
    it('CC can still write and delete ordinary config docs', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('config/activeBatch').set({ batchId: 'b1' }));
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('config/activeBatch').delete());
    });
    it('Clerk can still write the activeBatch pointer', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CLERK).doc('config/activeBatch').set({ batchId: 'b2' }));
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

  // ── SENIOR OFFICER / INSPECTOR MODULE ───────────────────────────────
  describe('Senior Officer / Inspector module', () => {
    const inspectionA = (uid) => ({
      batchId: 'batchA', batchNumber: 'Batch A', inspectionType: 'General',
      inspectionDate: '2026-08-30', inspectorId: uid, inspectorName: 'SO',
      subject: 'Routine check', observations: '', status: 'submitted',
      createdBy: uid, createdAt: '2026-08-30T00:00:00Z',
    });
    const findingA = (uid) => ({
      batchId: 'batchA', inspectionId: 'insp1', category: 'Training',
      title: 'Register not updated', severity: 'minor',
      responsibleArea: 'Training', assignedToRole: 'Ustad',
      assignedToName: '', dueDate: '2026-09-10', status: 'open',
      correctiveAction: 'Update register', createdBy: uid,
      createdAt: '2026-08-30T00:00:00Z',
    });

    it('SO can create inspection for assigned batch', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, SO).collection('inspections')
          .add(inspectionA('soUid')));
    });
    it('SO CANNOT create inspection for unassigned batch', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('inspections')
          .add({ ...inspectionA('soUid'), batchId: 'batchB' }));
    });
    it('SO cannot spoof inspectorId/createdBy on inspection', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('inspections')
          .add({ ...inspectionA('soUid'), inspectorId: 'ccUid', createdBy: 'ccUid' }));
    });
    it('SO can create finding for assigned batch', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, SO).collection('findings')
          .add(findingA('soUid')));
    });
    it('SO CANNOT create finding for unassigned batch', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('findings')
          .add({ ...findingA('soUid'), batchId: 'batchB' }));
    });
    it('CC sees and can create SO inspections (oversight)', async () => {
      await adminDb(testEnv).doc('inspections/i1').set(inspectionA('soUid'));
      await assert.isFulfilled(authedDb(testEnv, CC).doc('inspections/i1').get());
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('inspections')
          .add({ ...inspectionA('ccUid'), inspectorId: 'ccUid' }));
    });
    it('SO can verify-close a submitted finding in assigned batch', async () => {
      await adminDb(testEnv).doc('findings/f1').set({
        ...findingA('soUid'), status: 'submitted',
      });
      await assert.isFulfilled(
        authedDb(testEnv, SO).doc('findings/f1')
          .update({ status: 'closed', verifiedBy: 'soUid',
            verifiedByName: 'SO', verifiedAt: '2026-08-31T00:00:00Z' }));
    });
    it('SO CANNOT close a finding for an unassigned batch', async () => {
      await adminDb(testEnv).doc('findings/f2').set({
        ...findingA('soUid'), batchId: 'batchB', status: 'submitted',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/f2')
          .update({ status: 'closed', verifiedBy: 'soUid' }));
    });
    it('Assigned Ustad can submit corrective action (submitted status)', async () => {
      await adminDb(testEnv).doc('findings/f3').set({
        ...findingA('soUid'), assignedToRole: 'Ustad', status: 'in_progress',
      });
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('findings/f3')
          .update({ status: 'submitted', submittedBy: 'ustadUid',
            submittedAt: '2026-08-31T00:00:00Z', updatedBy: 'ustadUid',
            updatedAt: '2026-08-31T00:00:00Z' }));
    });
    it('Ustad CANNOT close/verify a finding', async () => {
      await adminDb(testEnv).doc('findings/f4').set({
        ...findingA('soUid'), assignedToRole: 'Ustad', status: 'submitted',
      });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/f4')
          .update({ status: 'closed', verifiedBy: 'ustadUid' }));
    });
    it('Ustad cannot act on a finding assigned to another role', async () => {
      await adminDb(testEnv).doc('findings/f5').set({
        ...findingA('soUid'), assignedToRole: 'Clerk', status: 'open',
      });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/f5')
          .update({ status: 'in_progress', updatedBy: 'ustadUid' }));
    });

    // ── SO must NOT gain commander powers ──
    it('SO cannot approve leave', async () => {
      await adminDb(testEnv).doc('staff_leave/lv1').set({
        leaveNumber: 'LV-1', staffId: 's1', staffName: 'X',
        status: 'pending', approvedBy: '', approvedByName: '',
        approvalDate: null, rejectionReason: '', remarks: '',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('staff_leave/lv1')
          .update({ status: 'approved', approvedBy: 'soUid',
            approvalDate: '2026-08-31' }));
    });
    it('SO cannot reject leave', async () => {
      await adminDb(testEnv).doc('staff_leave/lv2').set({
        leaveNumber: 'LV-2', staffId: 's1', staffName: 'X',
        status: 'pending', approvedBy: '', approvedByName: '',
        approvalDate: null, rejectionReason: '', remarks: '',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('staff_leave/lv2')
          .update({ status: 'rejected', rejectionReason: 'nope' }));
    });
    it('SO can add non-approval leave recommendation fields', async () => {
      await adminDb(testEnv).doc('staff_leave/lv3').set({
        leaveNumber: 'LV-3', staffId: 's1', staffName: 'X',
        status: 'pending', approvedBy: '', approvedByName: '',
        approvalDate: null, rejectionReason: '', remarks: '',
      });
      await assert.isFulfilled(
        authedDb(testEnv, SO).doc('staff_leave/lv3')
          .update({ soRecommendation: 'Recommended', soRemarks: 'ok',
            soReviewedBy: 'soUid', soReviewedAt: '2026-08-31T00:00:00Z' }));
    });
    it('SO cannot change a user role', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).doc('users/clerkUid')
          .update({ role: 'Company Commander' }));
    });
    it('SO cannot create users', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('users')
          .add({ name: 'x', role: 'Clerk', isActive: true }));
    });
    it('SO cannot modify subscription', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).doc('subscription/current')
          .set({ planId: 'p1' }));
    });
    it('SO cannot adjust inventory stock ledger', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).doc('stock_ledgers/dm-shoes')
          .set({ balance: 500 }));
    });
    it('SO cannot write finance expenses', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('mess_fund_expenses')
          .add({ amount: 100 }));
    });
    it('SO cannot delete another SO inspection (only creator draft / CC)', async () => {
      await adminDb(testEnv).doc('inspections/i2').set(inspectionA('ccUid'));
      await assert.isRejected(authedDb(testEnv, SO).doc('inspections/i2').delete());
    });

    // ── D1: SO cannot self-assign batches / change customerId ──
    it('D1: SO cannot expand own assignedBatchIds', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).doc('users/soUid')
          .update({ assignedBatchIds: ['batchA', 'batchB'] }));
    });
    it('D1: SO cannot replace own assignedBatchIds', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).doc('users/soUid')
          .update({ assignedBatchIds: ['batchB'] }));
    });
    it('D1: SO cannot change own customerId', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).doc('users/soUid')
          .update({ customerId: 'cust-other' }));
    });
    it('D1: CC CAN edit SO assignedBatchIds (User Management)', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('users/soUid')
          .update({ assignedBatchIds: ['batchA', 'batchC'] }));
    });

    // ── D2: assigned staff cannot tamper with finding fields ──
    const seedFinding = async (id, over) => {
      await adminDb(testEnv).doc(`findings/${id}`).set({
        ...findingA('soUid'), assignedToRole: 'Ustad', status: 'open',
        assignedToName: 'Ust. Ji', category: 'Training',
        responsibleArea: 'Training',
        ...over,
      });
    };
    it('D2: assigned Ustad cannot change assignedToRole', async () => {
      await seedFinding('d2-1', {});
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-1')
          .update({ assignedToRole: 'Clerk', status: 'in_progress', updatedBy: 'ustadUid' }));
    });
    it('D2: assigned Clerk cannot change severity', async () => {
      await seedFinding('d2-2', { assignedToRole: 'Clerk' });
      await assert.isRejected(
        authedDb(testEnv, CLERK).doc('findings/d2-2')
          .update({ severity: 'critical', status: 'in_progress', updatedBy: 'clerkUid' }));
    });
    it('D2: assigned QM cannot change dueDate', async () => {
      await seedFinding('d2-3', { assignedToRole: 'Quarter Master' });
      await assert.isRejected(
        authedDb(testEnv, QM).doc('findings/d2-3')
          .update({ dueDate: '2030-01-01', status: 'in_progress', updatedBy: 'qmUid' }));
    });
    it('D2: assigned staff cannot rewrite correctiveAction', async () => {
      await seedFinding('d2-4', {});
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-4')
          .update({ correctiveAction: 'do nothing', status: 'in_progress', updatedBy: 'ustadUid' }));
    });
    it('D2: assigned staff cannot change title/description', async () => {
      await seedFinding('d2-5', {});
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-5')
          .update({ title: 'changed', description: 'changed', status: 'in_progress', updatedBy: 'ustadUid' }));
    });
    it('D2: assigned staff cannot set verifiedBy', async () => {
      await seedFinding('d2-6', { status: 'submitted' });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-6')
          .update({ verifiedBy: 'ustadUid', verifiedByName: 'U', verifiedAt: '2026-08-31T00:00:00Z' }));
    });
    it('D2: assigned staff cannot close a finding', async () => {
      await seedFinding('d2-7', { status: 'submitted' });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-7')
          .update({ status: 'closed', updatedBy: 'ustadUid' }));
    });
    it('D2: assigned staff cannot reopen/regress a closed finding', async () => {
      await seedFinding('d2-8', {
        status: 'closed',
        verifiedBy: 'soUid', verifiedByName: 'SO', verifiedAt: '2026-08-30T00:00:00Z',
      });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-8')
          .update({ status: 'in_progress', updatedBy: 'ustadUid' }));
    });
    it('D2: assigned staff cannot skip open→submitted', async () => {
      await seedFinding('d2-9', { status: 'open' });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/d2-9')
          .update({ status: 'submitted', submittedBy: 'ustadUid', submittedAt: '2026-08-31T00:00:00Z', updatedBy: 'ustadUid' }));
    });
    it('D2: legitimate open→in_progress→submitted still works for assigned role', async () => {
      await seedFinding('d2-ok', { status: 'open' });
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('findings/d2-ok')
          .update({ status: 'in_progress', updatedBy: 'ustadUid', updatedAt: '2026-08-30T12:00:00Z' }));
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('findings/d2-ok')
          .update({ status: 'submitted', submittedBy: 'ustadUid',
            submittedAt: '2026-08-31T00:00:00Z', updatedBy: 'ustadUid',
            updatedAt: '2026-08-31T00:00:00Z' }));
    });

    // ── D3: audit-history regression protection ──
    it('D3: submitted inspection cannot be regressed to draft', async () => {
      await adminDb(testEnv).doc('inspections/d3-1').set({
        ...inspectionA('soUid'), status: 'submitted',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('inspections/d3-1')
          .update({ status: 'draft', updatedBy: 'soUid' }));
    });
    it('D3: SO cannot delete submitted inspection after revert attempt', async () => {
      await adminDb(testEnv).doc('inspections/d3-2').set({
        ...inspectionA('soUid'), status: 'submitted',
      });
      // revert itself is denied
      await assert.isRejected(
        authedDb(testEnv, SO).doc('inspections/d3-2')
          .update({ status: 'draft' }));
      // and direct delete of a submitted inspection is denied
      await assert.isRejected(authedDb(testEnv, SO).doc('inspections/d3-2').delete());
    });
    it('D3: closed finding cannot be reopened (status)', async () => {
      await adminDb(testEnv).doc('findings/d3-3').set({
        ...findingA('soUid'), status: 'closed',
        verifiedBy: 'soUid', verifiedByName: 'SO', verifiedAt: '2026-08-30T00:00:00Z',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/d3-3')
          .update({ status: 'open', updatedBy: 'soUid' }));
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/d3-3')
          .update({ status: 'rework', updatedBy: 'soUid', reworkReason: 'x' }));
    });
    it('D3: closed finding verifiedBy cannot be removed', async () => {
      await adminDb(testEnv).doc('findings/d3-4').set({
        ...findingA('soUid'), status: 'closed',
        verifiedBy: 'soUid', verifiedByName: 'SO', verifiedAt: '2026-08-30T00:00:00Z',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/d3-4')
          .update({ verifiedBy: '', verifiedByName: '', verifiedAt: '' }));
    });
    it('D3: closed finding verifiedAt cannot be changed', async () => {
      await adminDb(testEnv).doc('findings/d3-5').set({
        ...findingA('soUid'), status: 'closed',
        verifiedBy: 'soUid', verifiedByName: 'SO', verifiedAt: '2026-08-30T00:00:00Z',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/d3-5')
          .update({ verifiedAt: '2020-01-01T00:00:00Z' }));
    });
    it('D3: SO cannot delete a closed finding after revert attempt', async () => {
      await adminDb(testEnv).doc('findings/d3-6').set({
        ...findingA('soUid'), status: 'closed',
        verifiedBy: 'soUid', verifiedByName: 'SO', verifiedAt: '2026-08-30T00:00:00Z',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/d3-6').update({ status: 'open' }));
      await assert.isRejected(authedDb(testEnv, SO).doc('findings/d3-6').delete());
    });
    it('D3: legitimate submitted→rework→resubmitted→closed SO flow works', async () => {
      await adminDb(testEnv).doc('findings/d3-7').set({
        ...findingA('soUid'), status: 'submitted',
      });
      await assert.isFulfilled(
        authedDb(testEnv, SO).doc('findings/d3-7')
          .update({ status: 'rework', reworkReason: 'incomplete',
            verifiedBy: 'soUid', verifiedByName: 'SO', verifiedAt: '2026-08-30T12:00:00Z',
            updatedBy: 'soUid', updatedAt: '2026-08-30T12:00:00Z' }));
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('findings/d3-7')
          .update({ status: 'in_progress', updatedBy: 'ustadUid', updatedAt: '2026-08-31T12:00:00Z' }));
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('findings/d3-7')
          .update({ status: 'submitted', submittedBy: 'ustadUid',
            submittedAt: '2026-09-01T00:00:00Z', updatedBy: 'ustadUid',
            updatedAt: '2026-09-01T00:00:00Z' }));
      await assert.isFulfilled(
        authedDb(testEnv, SO).doc('findings/d3-7')
          .update({ status: 'closed', verifiedBy: 'soUid', verifiedByName: 'SO',
            verifiedAt: '2026-09-02T00:00:00Z', closureRemarks: 'ok',
            reworkReason: '', updatedBy: 'soUid', updatedAt: '2026-09-02T00:00:00Z' }));
    });

    // ── D4: dev-data isolation for inspections/findings ──
    it('D4: normal SO cannot read dev-tagged inspection', async () => {
      await adminDb(testEnv).doc('inspections/d4-1').set({
        ...inspectionA('soUid'), isDevData: true,
      });
      await assert.isRejected(authedDb(testEnv, SO).doc('inspections/d4-1').get());
    });
    it('D4: normal SO cannot read dev-tagged finding', async () => {
      await adminDb(testEnv).doc('findings/d4-2').set({
        ...findingA('soUid'), isDevData: true,
      });
      await assert.isRejected(authedDb(testEnv, SO).doc('findings/d4-2').get());
    });
    it('D4: normal SO cannot create dev-tagged inspection', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('inspections')
          .add({ ...inspectionA('soUid'), isDevData: true }));
    });
    it('D4: normal SO cannot create dev-tagged finding', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('findings')
          .add({ ...findingA('soUid'), isDevData: true }));
    });
    it('D4: CC CAN read dev-tagged inspection (sandbox authority)', async () => {
      await adminDb(testEnv).doc('inspections/d4-3').set({
        ...inspectionA('ccUid'), isDevData: true, inspectorId: 'ccUid',
      });
      await assert.isFulfilled(authedDb(testEnv, CC).doc('inspections/d4-3').get());
    });
  });

  // ── RELEGATION / RelID ──────────────────────────────────────────────
  describe('relegations collection', () => {
    const rec = {
      relegateId: 'REL-2026-25-K7M2',
      status: 'awaiting_rejoin',
      fromTraineeId: 't1',
      fromBatchId: 'batchA',
      fromChestNo: '25',
      traineeName: 'RAM',
      reason: 'Medical — Injury',
      relegatedAt: '2026-09-02T00:00:00Z',
    };
    it('Clerk can create a relegation record', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CLERK).collection('relegations').add(rec));
    });
    it('CC can create a relegation record', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('relegations').add(rec));
    });
    it('Ustad cannot write relegations', async () => {
      await assert.isRejected(
        authedDb(testEnv, USTAD).collection('relegations').add(rec));
    });
    it('QM cannot write relegations', async () => {
      await assert.isRejected(
        authedDb(testEnv, QM).collection('relegations').add(rec));
    });
    it('SO cannot write relegations', async () => {
      await assert.isRejected(
        authedDb(testEnv, SO).collection('relegations').add(rec));
    });
    it('staff can read relegations; Ustad cannot delete', async () => {
      await adminDb(testEnv).doc('relegations/r1').set(rec);
      await assert.isFulfilled(authedDb(testEnv, USTAD).doc('relegations/r1').get());
      await assert.isRejected(authedDb(testEnv, USTAD).doc('relegations/r1').delete());
    });
    it('Clerk can update awaiting → rejoined (RelID admit)', async () => {
      await adminDb(testEnv).doc('relegations/r2').set(rec);
      await assert.isFulfilled(
        authedDb(testEnv, CLERK).doc('relegations/r2').update({
          status: 'rejoined',
          toBatchId: 'batchB',
          toChestNo: '25R',
          rejoinedAt: '2026-09-02T12:00:00Z',
        }));
    });
    it('only CC may delete a relegation record', async () => {
      await adminDb(testEnv).doc('relegations/r3').set(rec);
      await assert.isRejected(authedDb(testEnv, CLERK).doc('relegations/r3').delete());
      await assert.isFulfilled(authedDb(testEnv, CC).doc('relegations/r3').delete());
    });
  });

  describe('training_tests / staff_activity_logs (were missing rules)', () => {
    it('Clerk can write training_tests; Ustad cannot', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CLERK).collection('training_tests').add({ batchId: 'batchA', type: 'fpt' }));
      await assert.isRejected(
        authedDb(testEnv, USTAD).collection('training_tests').add({ batchId: 'batchA', type: 'fpt' }));
    });
    it('staff can create activity logs; Ustad cannot delete', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).collection('staff_activity_logs').add({ action: 'view', userId: 'u' }));
      await adminDb(testEnv).doc('staff_activity_logs/l1').set({ action: 'view' });
      await assert.isRejected(authedDb(testEnv, USTAD).doc('staff_activity_logs/l1').delete());
    });
    it('Clerk can write disciplineRecords used by full suite', async () => {
      await assert.isFulfilled(
        authedDb(testEnv, CLERK).collection('disciplineRecords').add({ traineeId: 't1', reason: 'x' }));
    });
  });

  // ── LOGIN BOOTSTRAP (must not chicken-and-egg on isStaff) ───────────

  describe('trainee senior portal', () => {
    it('Trainee can read batches / unitConfig / trainees (portal bootstrap)', async () => {
      await adminDb(testEnv).doc('batches/b1').set({
        batchNumber: '1', status: 'active', createdAt: '2026-01-01',
      });
      await adminDb(testEnv).doc('unitConfig/main').set({ companyName: 'F COY' });
      await adminDb(testEnv).doc('trainees/t1').set({ name: 'RAM', chestNo: '25', batchId: 'b1' });
      await assert.isFulfilled(authedDb(testEnv, TRAINEE).doc('batches/b1').get());
      await assert.isFulfilled(authedDb(testEnv, TRAINEE).doc('unitConfig/main').get());
      await assert.isFulfilled(authedDb(testEnv, TRAINEE).doc('trainees/t1').get());
    });
    it('Trainee cannot write finance or approve leave', async () => {
      await assert.isRejected(
        authedDb(testEnv, TRAINEE).collection('mess_fund_expenses').add({ amount: 1 }));
      await adminDb(testEnv).doc('staff_leave/lvT').set({
        leaveNumber: 'LV-T', staffId: 's1', staffName: 'X',
        status: 'pending', approvedBy: '', approvedByName: '',
        approvalDate: null, rejectionReason: '', remarks: '',
      });
      await assert.isRejected(
        authedDb(testEnv, TRAINEE).doc('staff_leave/lvT')
          .update({ status: 'approved', approvedBy: 'traineeUid' }));
    });
    it('Trainee can read traineeNotices / traineeUpdates / periodAttendance', async () => {
      await adminDb(testEnv).doc('traineeNotices/n1').set({ batchId: 'b1', title: 'x', isActive: true });
      await adminDb(testEnv).doc('traineeUpdates/u1').set({ traineeId: 't1', title: 'x' });
      await adminDb(testEnv).doc('periodAttendance/p1').set({ batchId: 'b1', traineeId: 't1', date: '2026-09-02', status: 'P' });
      await assert.isFulfilled(authedDb(testEnv, TRAINEE).doc('traineeNotices/n1').get());
      await assert.isFulfilled(authedDb(testEnv, TRAINEE).doc('traineeUpdates/u1').get());
      await assert.isFulfilled(authedDb(testEnv, TRAINEE).doc('periodAttendance/p1').get());
    });
  });

  describe('login bootstrap', () => {
    it('signed-in user can read own users/{uid} even with short role alias', async () => {
      await adminDb(testEnv).doc('users/aliasUid').set({
        name: 'Alias CC', email: 'alias@example.com', role: 'CC', isActive: true,
      });
      const ALIAS = { uid: 'aliasUid', email: 'alias@example.com' };
      await assert.isFulfilled(authedDb(testEnv, ALIAS).doc('users/aliasUid').get());
    });
    it('legacy profile keyed by random id is readable via email query', async () => {
      await adminDb(testEnv).doc('users/randomLegacyId').set({
        name: 'Legacy', email: 'legacy@example.com',
        role: 'Company Commander', isActive: true,
      });
      const LEGACY = { uid: 'authUidNoDoc', email: 'legacy@example.com' };
      await assert.isFulfilled(authedDb(testEnv, LEGACY).doc('users/authUidNoDoc').get());
      const snap = await authedDb(testEnv, LEGACY).collection('users')
        .where('email', '==', 'legacy@example.com').get();
      assert.equal(snap.empty, false);
    });
    it('signed-in stranger cannot read another user profile', async () => {
      const STRANGER = { uid: 'strangerUid', email: 'stranger@example.com' };
      await assert.isRejected(authedDb(testEnv, STRANGER).doc('users/clerkUid').get());
    });
    it('unauthenticated cannot read users', async () => {
      await assert.isRejected(
        testEnv.unauthenticatedContext().firestore().doc('users/ccUid').get());
    });
    it('signed-in user can list mixed real+dev batches (login listener)', async () => {
      await adminDb(testEnv).doc('batches/b1').set({
        batchNumber: '1', status: 'active', createdAt: '2026-01-01',
      });
      await adminDb(testEnv).doc('batches/dev').set({
        batchNumber: 'TEST', status: 'active', createdAt: '2026-01-02', isDevData: true,
      });
      const snap = await authedDb(testEnv, CLERK).collection('batches').get();
      assert.ok(snap.docs.length >= 2);
    });
    it('signed-in user can read unitConfig/main and config/activeBatch', async () => {
      await adminDb(testEnv).doc('unitConfig/main').set({ companyName: 'F COY' });
      await adminDb(testEnv).doc('config/activeBatch').set({ batchId: 'b1' });
      await assert.isFulfilled(authedDb(testEnv, USTAD).doc('unitConfig/main').get());
      await assert.isFulfilled(authedDb(testEnv, USTAD).doc('config/activeBatch').get());
    });
    it('signed-in user can read subscription/current (login listener)', async () => {
      await adminDb(testEnv).doc('subscription/current').set({ planId: 'p1', status: 'active' });
      await assert.isFulfilled(authedDb(testEnv, USTAD).doc('subscription/current').get());
    });
    it('unauthenticated cannot read batches or unitConfig', async () => {
      await adminDb(testEnv).doc('batches/b1').set({ batchNumber: '1' });
      await adminDb(testEnv).doc('unitConfig/main').set({ companyName: 'F COY' });
      const anon = testEnv.unauthenticatedContext().firestore();
      await assert.isRejected(anon.doc('batches/b1').get());
      await assert.isRejected(anon.doc('unitConfig/main').get());
    });
    it('role alias CC is treated as Company Commander for writes', async () => {
      await adminDb(testEnv).doc('users/aliasUid').set({
        name: 'Alias CC', email: 'alias@example.com', role: 'CC', isActive: true,
      });
      const ALIAS = { uid: 'aliasUid', email: 'alias@example.com' };
      await assert.isFulfilled(
        authedDb(testEnv, ALIAS).collection('relegations').add({
          relegateId: 'REL-2026-1-AAAA', status: 'awaiting_rejoin',
        }));
    });
  });

  // ── READ-ONLY DEGRADATION WHEN THE LICENCE EXPIRES ──────────────────
  // Policy: expired company keeps its data, can log in, read everything and
  // renew — but normal ERP mutations stop. Rules read subscription/current
  // .endMillis (epoch ms) because the rules language cannot parse the ISO
  // endDate string.
  describe('expired subscription = read-only', () => {
    const DAY = 86400000;
    const GRACE = 30 * DAY;

    /** Write a licence whose grace window ended `daysAgo` days ago. */
    async function setLicence(endMillis) {
      await adminDb(testEnv).doc('subscription/current').set({
        planId: 'monthly', planName: 'Monthly',
        endDate: new Date(endMillis).toISOString(),
        endMillis,
      });
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
    }
    const expired = () => setLicence(Date.now() - GRACE - 5 * DAY);
    const inGrace = () => setLicence(Date.now() - 5 * DAY);
    const active  = () => setLicence(Date.now() + 60 * DAY);

    // ── EXPIRED: mutations denied across every business domain ──
    it('expired: trainee create denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'X', chestNo: '1' }));
    });
    it('expired: trainee update denied', async () => {
      await adminDb(testEnv).doc('trainees/t1').set({ name: 'X' });
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CC).doc('trainees/t1').update({ name: 'Y' }));
    });
    it('expired: trainee delete denied', async () => {
      await adminDb(testEnv).doc('trainees/t1').set({ name: 'X' });
      await expired();
      await assert.isRejected(authedDb(testEnv, CC).doc('trainees/t1').delete());
    });
    it('expired: attendance write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CLERK).collection('absentRecords').add({ chestNo: '1' }));
    });
    it('expired: finance write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, QM).collection('mess_fund_expenses').add({ amount: 100 }));
    });
    it('expired: inventory stock write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, QM).doc('stock_ledgers/boots').set({ balance: 10 }));
    });
    it('expired: medical record write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CLERK).collection('medicalRecords').add({ chestNo: '1' }));
    });
    it('expired: batch write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CC).collection('batches').add({ batchNumber: '9' }));
    });
    it('expired: relegation write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CC).collection('relegations')
          .add({ relegateId: 'REL-1', status: 'awaiting_rejoin' }));
    });
    it('expired: staff leave write denied', async () => {
      await expired();
      await assert.isRejected(
        authedDb(testEnv, CLERK).collection('staff_leave').add({
          status: 'pending', approvedBy: '', rejectionReason: '', approvalDate: '',
        }));
    });
    it('expired: BATCH write denied (no multi-doc bypass)', async () => {
      await expired();
      const db = authedDb(testEnv, CC);
      const b = db.batch();
      b.set(db.doc('trainees/bulk1'), { name: 'A' });
      b.set(db.doc('trainees/bulk2'), { name: 'B' });
      await assert.isRejected(b.commit());
    });
    it('expired: TRANSACTION write denied (no transaction bypass)', async () => {
      await adminDb(testEnv).doc('trainees/t1').set({ name: 'X' });
      await expired();
      const db = authedDb(testEnv, CC);
      await assert.isRejected(db.runTransaction(async (tx) => {
        tx.update(db.doc('trainees/t1'), { name: 'Z' });
      }));
    });

    // ── EXPIRED: reads must keep working (this is the whole point) ──
    it('expired: reading trainees still works', async () => {
      await adminDb(testEnv).doc('trainees/t1').set({ name: 'X' });
      await expired();
      await assert.isFulfilled(authedDb(testEnv, CC).doc('trainees/t1').get());
    });
    it('expired: reading the licence still works (renewal screen)', async () => {
      await expired();
      await assert.isFulfilled(authedDb(testEnv, CC).doc('subscription/current').get());
    });
    it('expired: reading finance history still works', async () => {
      await adminDb(testEnv).doc('mess_fund_expenses/e1').set({ amount: 1 });
      await expired();
      await assert.isFulfilled(authedDb(testEnv, QM).doc('mess_fund_expenses/e1').get());
    });

    // ── GRACE and ACTIVE keep writing ──
    it('grace: trainee create still allowed', async () => {
      await inGrace();
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'G', chestNo: '2' }));
    });
    it('active: trainee create allowed', async () => {
      await active();
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'A', chestNo: '3' }));
    });
    it('active: finance write allowed', async () => {
      await active();
      await assert.isFulfilled(
        authedDb(testEnv, QM).collection('mess_fund_expenses').add({ amount: 100 }));
    });

    // ── LIFECYCLE: the renewal must actually restore writes ──
    it('LIFECYCLE: expired blocks, renewal restores writes immediately', async () => {
      await expired();
      // 1. business write denied
      await assert.isRejected(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'X', chestNo: '9' }));
      // 2. the client still cannot self-renew (b839025 holds)
      await assert.isRejected(
        authedDb(testEnv, CC).doc('subscription/current')
          .set({ planId: 'monthly', endMillis: Date.now() + 60 * DAY }));
      // 3. the server (Admin SDK) renews, as the callable does
      await adminDb(testEnv).doc('subscription/current').set({
        planId: 'monthly', endDate: new Date(Date.now() + 60 * DAY).toISOString(),
        endMillis: Date.now() + 60 * DAY,
      });
      // 4. the same write now succeeds
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'X', chestNo: '9' }));
    });

    // ── EDGE CASES ──
    it('licence with no endMillis (legacy doc) does not lock the company out', async () => {
      await adminDb(testEnv).doc('subscription/current').set({
        planId: 'monthly', endDate: '2020-01-01T00:00:00.000Z',
      });
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'L', chestNo: '4' }));
    });
    it('no licence at all (subscription disabled) keeps writes working', async () => {
      await adminDb(testEnv).doc('config/firstRun').set({ done: true });
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'N', chestNo: '5' }));
    });
    it('expiry exactly at the grace boundary is still writable', async () => {
      await setLicence(Date.now() - GRACE + 60000); // 1 min inside grace
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('trainees').add({ name: 'B', chestNo: '6' }));
    });
    it('expired: firstRun latch still immutable', async () => {
      await expired();
      await assert.isRejected(authedDb(testEnv, CC).doc('config/firstRun').delete());
    });
    it('expired: users/config bootstrap paths still writable', async () => {
      await expired();
      await assert.isFulfilled(
        authedDb(testEnv, CC).doc('config/activeBatch').set({ batchId: 'b1' }));
    });
  });


});
