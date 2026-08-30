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
// Senior Officer / Inspector — assigned batchA ONLY (batchB must be denied)
const SO    = { uid: 'soUid',   email: 'so@example.com' };

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
  await admin.doc('users/soUid').set({
    name: 'SO', email: SO.email, role: 'Senior Officer / Inspector',
    isActive: true, isDeveloper: false, assignedBatchIds: ['batchA'],
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
      await testEnv.firestoreAdmin().doc('inspections/i1').set(inspectionA('soUid'));
      await assert.isFulfilled(authedDb(testEnv, CC).doc('inspections/i1').get());
      await assert.isFulfilled(
        authedDb(testEnv, CC).collection('inspections')
          .add({ ...inspectionA('ccUid'), inspectorId: 'ccUid' }));
    });
    it('SO can verify-close a submitted finding in assigned batch', async () => {
      await testEnv.firestoreAdmin().doc('findings/f1').set({
        ...findingA('soUid'), status: 'submitted',
      });
      await assert.isFulfilled(
        authedDb(testEnv, SO).doc('findings/f1')
          .update({ status: 'closed', verifiedBy: 'soUid',
            verifiedByName: 'SO', verifiedAt: '2026-08-31T00:00:00Z' }));
    });
    it('SO CANNOT close a finding for an unassigned batch', async () => {
      await testEnv.firestoreAdmin().doc('findings/f2').set({
        ...findingA('soUid'), batchId: 'batchB', status: 'submitted',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('findings/f2')
          .update({ status: 'closed', verifiedBy: 'soUid' }));
    });
    it('Assigned Ustad can submit corrective action (submitted status)', async () => {
      await testEnv.firestoreAdmin().doc('findings/f3').set({
        ...findingA('soUid'), assignedToRole: 'Ustad', status: 'in_progress',
      });
      await assert.isFulfilled(
        authedDb(testEnv, USTAD).doc('findings/f3')
          .update({ status: 'submitted', submittedBy: 'ustadUid',
            submittedAt: '2026-08-31T00:00:00Z', updatedBy: 'ustadUid',
            updatedAt: '2026-08-31T00:00:00Z' }));
    });
    it('Ustad CANNOT close/verify a finding', async () => {
      await testEnv.firestoreAdmin().doc('findings/f4').set({
        ...findingA('soUid'), assignedToRole: 'Ustad', status: 'submitted',
      });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/f4')
          .update({ status: 'closed', verifiedBy: 'ustadUid' }));
    });
    it('Ustad cannot act on a finding assigned to another role', async () => {
      await testEnv.firestoreAdmin().doc('findings/f5').set({
        ...findingA('soUid'), assignedToRole: 'Clerk', status: 'open',
      });
      await assert.isRejected(
        authedDb(testEnv, USTAD).doc('findings/f5')
          .update({ status: 'in_progress', updatedBy: 'ustadUid' }));
    });

    // ── SO must NOT gain commander powers ──
    it('SO cannot approve leave', async () => {
      await testEnv.firestoreAdmin().doc('staff_leave/lv1').set({
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
      await testEnv.firestoreAdmin().doc('staff_leave/lv2').set({
        leaveNumber: 'LV-2', staffId: 's1', staffName: 'X',
        status: 'pending', approvedBy: '', approvedByName: '',
        approvalDate: null, rejectionReason: '', remarks: '',
      });
      await assert.isRejected(
        authedDb(testEnv, SO).doc('staff_leave/lv2')
          .update({ status: 'rejected', rejectionReason: 'nope' }));
    });
    it('SO can add non-approval leave recommendation fields', async () => {
      await testEnv.firestoreAdmin().doc('staff_leave/lv3').set({
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
      await testEnv.firestoreAdmin().doc('inspections/i2').set(inspectionA('ccUid'));
      await assert.isRejected(authedDb(testEnv, SO).doc('inspections/i2').delete());
    });
  });
});
