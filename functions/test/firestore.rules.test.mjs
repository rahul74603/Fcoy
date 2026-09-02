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

const PROJECT_ID = 'training-command-erp';

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
});
