// ═══════════════════════════════════════════════════════════════════════════
// F COY ERP — FIRESTORE RULES TEST SUITE (Task 2)
// Run: npm run test:rules   (firebase emulators:exec --project demo-fcoy)
//
// Coverage: security matrix ki HAR row — kam se kam 1 allow + 1 deny case.
// ⭐ = production-critical proofs (Task-1 server enforcement, D1/D2 decisions).
// ═══════════════════════════════════════════════════════════════════════════
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  collection, serverTimestamp, arrayUnion, updateDoc as upd,
} from 'firebase/firestore';

const CC = 'uid-cc';
const CLERK = 'uid-clerk';
const QM = 'uid-qm';
const USTAD = 'uid-ustad';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-fcoy',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

// Har test se pehle: rules bypass karke fixture data seed karo
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', CC), { role: 'Company Commander', name: 'Cmdr' });
    await setDoc(doc(db, 'users', CLERK), { role: 'Clerk', name: 'Clerk' });
    await setDoc(doc(db, 'users', QM), { role: 'Quarter Master', name: 'QM' });
    await setDoc(doc(db, 'users', USTAD), { role: 'Ustad', name: 'Ustad' });
    await addDoc(collection(db, 'notifications'), {
      title: 'Seeded', message: 'hello', targetRole: 'ALL', readBy: [], createdBy: 'seed',
    });
    await setDoc(doc(db, 'unitConfig', 'main'), {
      parentUnit: '95 BN BSF', companyName: 'F Coy', companyShort: 'F', financialYear: '2026-27',
    });
    await setDoc(doc(db, 'system_config', 'flags'), { maintenanceMode: false });
    await addDoc(collection(db, 'staff_leave'), { staffId: 's1', status: 'pending' });
  });
});

const dbAs = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const dbAnon = () => testEnv.unauthenticatedContext().firestore();
const seededNotification = async () => (await testEnv.withSecurityRulesDisabled(async (ctx) =>
  (await getDocs(collection(ctx.firestore(), 'notifications'))).docs[0].id));
const seededLeave = async () => (await testEnv.withSecurityRulesDisabled(async (ctx) =>
  (await getDocs(collection(ctx.firestore(), 'staff_leave'))).docs[0].id));

// ─── 1) users — self-read sabko, list/manage sirf CC ─────────────────────
describe('users collection', () => {
  it('har staff apna doc padh sakta hai (AuthContext login flow)', async () => {
    await assertSucceeds(getDoc(doc(dbAs(USTAD), 'users', USTAD)));
    await assertSucceeds(getDoc(doc(dbAs(QM), 'users', QM)));
  });
  it('doosre ka doc sirf CC padh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(dbAs(CC), 'users', USTAD)));
    await assertFails(getDoc(doc(dbAs(USTAD), 'users', CC)));
    await assertFails(getDoc(doc(dbAs(CLERK), 'users', QM)));
  });
  it('user list sirf CC; create/update/delete sirf CC', async () => {
    await assertSucceeds(getDocs(collection(dbAs(CC), 'users')));
    await assertFails(getDocs(collection(dbAs(QM), 'users')));
    await assertFails(setDoc(doc(dbAs(CLERK), 'users', 'new1'), { role: 'Clerk' }));
    await assertSucceeds(setDoc(doc(dbAs(CC), 'users', 'new1'), { role: 'Clerk' }));
  });
  it('anonymous: bilkul blocked', async () => {
    await assertFails(getDoc(doc(dbAnon(), 'users', CC)));
  });
});

// ─── 2) login_history — D1-FINAL: sirf authenticated, schema-locked, append-only
describe('login_history (D1-final)', () => {
  const valid = () => ({
    email: 'a@b.in', status: 'SUCCESS', role: 'Clerk', reason: '',
    userAgent: 'ua', module: 'AUTH', timestamp: serverTimestamp(),
  });
  it('authenticated create allowed (SUCCESS + FAILED dono)', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'login_history'), valid()));
    await assertSucceeds(addDoc(collection(dbAs(CC), 'login_history'), { ...valid(), status: 'FAILED', reason: 'Account disabled' }));
  });
  it('⭐ UNAUTHENTICATED create = DENIED (wrong-password logs Phase-2 CF tak nahi)', async () => {
    await assertFails(addDoc(collection(dbAnon(), 'login_history'), valid()));
  });
  it('extra field (schema violation) = DENIED', async () => {
    await assertFails(addDoc(collection(dbAs(CLERK), 'login_history'), { ...valid(), injected: 1 }));
  });
  it('append-only: update/delete kisi ko nahi, CC ko bhi nahi', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await addDoc(collection(ctx.firestore(), 'login_history'), { ...valid(), timestamp: undefined });
    });
    const db = dbAs(CC);
    const id = (await getDocs(collection(db, 'login_history'))).docs[0].id;
    await assertFails(updateDoc(doc(db, 'login_history', id), { status: 'SUCCESS' }));
    await assertFails(deleteDoc(doc(db, 'login_history', id)));
  });
  it('read sirf CC (system-health forensics)', async () => {
    await assertSucceeds(getDocs(collection(dbAs(CC), 'login_history')));
    await assertFails(getDocs(collection(dbAs(QM), 'login_history')));
  });
});

// ─── 3) Activity/search/error logs — create sab staff, read CC, immutable ──
describe('audit log collections (staff_activity_logs/search_logs/error_logs)', () => {
  for (const col of ['staff_activity_logs', 'search_logs', 'error_logs'] as const) {
    it(`${col}: staff create OK, staff read NO, CC read OK, update NO`, async () => {
      await assertSucceeds(addDoc(collection(dbAs(USTAD), col), { msg: 'x' }));
      await assertFails(getDocs(collection(dbAs(CLERK), col)));
      await assertSucceeds(getDocs(collection(dbAs(CC), col)));
      const id = (await getDocs(collection(dbAs(CC), col))).docs[0].id;
      await assertFails(updateDoc(doc(dbAs(CC), col, id), { msg: 'y' }));
      await assertFails(deleteDoc(doc(dbAs(CC), col, id)));
    });
  }
});

// ─── 4) Trainee domain ────────────────────────────────────────────────────
describe('trainees / trainee_attendance / absentRecords', () => {
  it('trainees: CC+Clerk full CRUD, QM sirf READ (kit-issue/welfare), Ustad NO', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'trainees'), { name: 'T1' }));
    await assertSucceeds(getDocs(collection(dbAs(QM), 'trainees')));
    await assertFails(addDoc(collection(dbAs(QM), 'trainees'), { name: 'T2' }));
    await assertFails(getDocs(collection(dbAs(USTAD), 'trainees')));
    await assertFails(getDocs(collection(dbAnon(), 'trainees')));
  });
  it('trainee_attendance + absentRecords: sirf CC/Clerk', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'trainee_attendance'), { status: 'P' }));
    await assertSucceeds(getDocs(collection(dbAs(CC), 'absentRecords')));
    await assertFails(getDocs(collection(dbAs(QM), 'trainee_attendance')));
    await assertFails(addDoc(collection(dbAs(USTAD), 'absentRecords'), { x: 1 }));
  });
});

// ─── 5) ⭐ staff_leave — TASK-1 SERVER-SIDE PROOF ──────────────────────────
describe('⭐ staff_leave (Task-1 server enforcement)', () => {
  it('USTAD leave READ kar sakta hai (view-only bell screen)', async () => {
    await assertSucceeds(getDocs(collection(dbAs(USTAD), 'staff_leave')));
  });
  it('⭐ USTAD leave APPROVE/UPDATE nahi kar sakta — DB-level block', async () => {
    const id = await seededLeave();
    await assertFails(updateDoc(doc(dbAs(USTAD), 'staff_leave', id), { status: 'approved' }));
  });
  it('USTAD leave create/delete bhi nahi kar sakta', async () => {
    const id = await seededLeave();
    await assertFails(addDoc(collection(dbAs(USTAD), 'staff_leave'), { status: 'pending' }));
    await assertFails(deleteDoc(doc(dbAs(USTAD), 'staff_leave', id)));
  });
  it('CLERK approve kar sakta hai (Task-1 workflow intact)', async () => {
    const id = await seededLeave();
    await assertSucceeds(updateDoc(doc(dbAs(CLERK), 'staff_leave', id), { status: 'approved' }));
  });
  it('COMMANDER approve kar sakta hai', async () => {
    const id = await seededLeave();
    await assertSucceeds(updateDoc(doc(dbAs(CC), 'staff_leave', id), { status: 'approved' }));
  });
  it('QM bhi write nahi kar sakta (sirf CC/Clerk)', async () => {
    const id = await seededLeave();
    await assertFails(updateDoc(doc(dbAs(QM), 'staff_leave', id), { status: 'approved' }));
  });
});

// ─── 6) Staff domain — read all staff (QM bell), write CC/Clerk ───────────
describe('staff domain (staff/ustads/staff_duty/duty_types/deputation/leave_types)', () => {
  for (const col of ['staff', 'ustads', 'staff_duty', 'duty_types', 'deputation_records', 'leave_types'] as const) {
    it(`${col}: Ustad+QM read OK (bell/view), write DENIED`, async () => {
      await assertSucceeds(getDocs(collection(dbAs(USTAD), col)));
      await assertSucceeds(getDocs(collection(dbAs(QM), col)));
      await assertFails(addDoc(collection(dbAs(USTAD), col), { x: 1 }));
      await assertFails(addDoc(collection(dbAs(QM), col), { x: 1 }));
      await assertSucceeds(addDoc(collection(dbAs(CLERK), col), { x: 1 }));
    });
  }
  it('staff_attendance: sirf CC/Clerk (read+write), Ustad/QM read NO', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'staff_attendance'), { status: 'present' }));
    await assertFails(getDocs(collection(dbAs(USTAD), 'staff_attendance')));
    await assertFails(getDocs(collection(dbAs(QM), 'staff_attendance')));
  });
});

// ─── 7) Training & Exam ───────────────────────────────────────────────────
describe('training_schedule/weeklyPrograms/weeklyTestRecords/fptRecords', () => {
  for (const col of ['training_schedule', 'weeklyPrograms', 'weeklyTestRecords', 'fptRecords'] as const) {
    it(`${col}: read all staff, write CC/Clerk only`, async () => {
      await assertSucceeds(getDocs(collection(dbAs(USTAD), col)));
      await assertSucceeds(getDocs(collection(dbAs(QM), col)));
      await assertFails(addDoc(collection(dbAs(USTAD), col), { x: 1 }));
      await assertSucceeds(addDoc(collection(dbAs(CLERK), col), { x: 1 }));
      await assertSucceeds(addDoc(collection(dbAs(CC), col), { x: 1 }));
    });
  }
  it('training_custom_items: QM read OK (kit flow), Ustad NO', async () => {
    await assertSucceeds(getDocs(collection(dbAs(QM), 'training_custom_items')));
    await assertFails(getDocs(collection(dbAs(USTAD), 'training_custom_items')));
  });
});

// ─── 8) Medical — sirf CC/Clerk (PII) ─────────────────────────────────────
describe('medicalRecords / medicine_txns', () => {
  it('Clerk+CC full access; QM+Ustad fully DENIED', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'medicalRecords'), { p: 1 }));
    await assertSucceeds(getDocs(collection(dbAs(CC), 'medicine_txns')));
    await assertFails(getDocs(collection(dbAs(QM), 'medicalRecords')));
    await assertFails(getDocs(collection(dbAs(USTAD), 'medicine_txns')));
  });
});

// ─── 9) Inventory + Finance (QM domain) ───────────────────────────────────
describe('inventory (item_master/issue_records/stock_returns)', () => {
  for (const col of ['item_master', 'issue_records', 'stock_returns'] as const) {
    it(`${col}: QM full RW, Clerk/Ustad DENIED`, async () => {
      await assertSucceeds(getDocs(collection(dbAs(QM), col)));
      await assertSucceeds(addDoc(collection(dbAs(QM), col), { x: 1 }));
      await assertFails(getDocs(collection(dbAs(CLERK), col)));
      await assertFails(getDocs(collection(dbAs(USTAD), col)));
    });
  }
});
describe('finance collections (sample across families)', () => {
  const cols = [
    'general_fund_expenses', 'training_fund_recoveries', 'mess_fund_collections',
    'company_assets_custom_items', 'fund_transfers', 'vendors', 'vendor_entries',
    'vendor_payments', 'recoveries', 'collections', 'expenses', 'bills',
  ] as const;
  for (const col of cols) {
    it(`${col}: QM RW OK, Clerk/Ustad DENIED`, async () => {
      await assertSucceeds(getDocs(collection(dbAs(QM), col)));
      await assertSucceeds(addDoc(collection(dbAs(QM), col), { amt: 10 }));
      await assertFails(getDocs(collection(dbAs(CLERK), col)));
      await assertFails(addDoc(collection(dbAs(USTAD), col), { amt: 10 }));
    });
  }
  it('udhariRecords: Clerk READ OK (dashboard), write NO; QM write OK', async () => {
    await assertSucceeds(getDocs(collection(dbAs(CLERK), 'udhariRecords')));
    await assertFails(addDoc(collection(dbAs(CLERK), 'udhariRecords'), { a: 1 }));
    await assertSucceeds(addDoc(collection(dbAs(QM), 'udhariRecords'), { a: 1 }));
  });
});

// ─── 10) Mess ops ─────────────────────────────────────────────────────────
describe('mess_boys / mess_boy_salaries / mess_custom_categories', () => {
  for (const col of ['mess_boys', 'mess_boy_salaries', 'mess_custom_categories'] as const) {
    it(`${col}: QM RW OK, others DENIED`, async () => {
      await assertSucceeds(addDoc(collection(dbAs(QM), col), { x: 1 }));
      await assertFails(getDocs(collection(dbAs(CLERK), col)));
      await assertFails(addDoc(collection(dbAs(USTAD), col), { x: 1 }));
    });
  }
});

// ─── 11) Notifications — open read, validated create, readBy-only update ──
describe('notifications', () => {
  it('read: har authenticated (target-filter client-side); anon NO', async () => {
    await assertSucceeds(getDocs(collection(dbAs(USTAD), 'notifications')));
    await assertFails(getDocs(collection(dbAnon(), 'notifications')));
  });
  it('create: staff with title+message OK', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'notifications'),
      { title: 'T', message: 'M', targetRole: 'ALL', readBy: [] }));
  });
  it('update: sirf readBy me APNA uid add kar sakta hai', async () => {
    const id = await seededNotification();
    await assertSucceeds(updateDoc(doc(dbAs(USTAD), 'notifications', id), { readBy: arrayUnion(USTAD) }));
  });
  it('update: DOOSRE ka uid push = DENIED (receipt tampering block)', async () => {
    const id = await seededNotification();
    await assertFails(updateDoc(doc(dbAs(USTAD), 'notifications', id), { readBy: arrayUnion(CC) }));
  });
  it('update: koi aur field (title) = DENIED', async () => {
    const id = await seededNotification();
    await assertFails(updateDoc(doc(dbAs(CC), 'notifications', id), { title: 'hacked' }));
  });
  it('delete: sirf CC', async () => {
    const id1 = await seededNotification();
    await assertFails(deleteDoc(doc(dbAs(CLERK), 'notifications', id1)));
    const id2 = await seededNotification();
    await assertSucceeds(deleteDoc(doc(dbAs(CC), 'notifications', id2)));
  });
});

// ─── 12) Config & Masters ─────────────────────────────────────────────────
describe('batches (D3)', () => {
  it('read: saare staff (BatchContext universal)', async () => {
    await assertSucceeds(getDocs(collection(dbAs(USTAD), 'batches')));
    await assertSucceeds(getDocs(collection(dbAs(QM), 'batches')));
    await assertSucceeds(getDocs(collection(dbAs(CLERK), 'batches')));
  });
  it('write: sirf CC/Clerk — ⭐ Ustad batch create/edit DENIED (R2 fix)', async () => {
    await assertSucceeds(addDoc(collection(dbAs(CLERK), 'batches'), { batchNumber: '99' }));
    await assertFails(addDoc(collection(dbAs(USTAD), 'batches'), { batchNumber: '100' }));
    await assertFails(updateDoc(doc(dbAs(USTAD), 'batches', 'any'), { status: 'completed' }));
  });
});
describe('dropdown_masters / system_config', () => {
  it('dropdown_masters: read all auth; write sirf CC', async () => {
    await assertSucceeds(getDocs(collection(dbAs(USTAD), 'dropdown_masters')));
    await assertFails(setDoc(doc(dbAs(CLERK), 'dropdown_masters', 'medical_categories'), { items: [] }));
    await assertSucceeds(setDoc(doc(dbAs(CC), 'dropdown_masters', 'medical_categories'), { items: [] }));
  });
  it('system_config: read all auth (maintenance banner); write sirf CC', async () => {
    await assertSucceeds(getDoc(doc(dbAs(QM), 'system_config', 'flags')));
    await assertFails(updateDoc(doc(dbAs(CLERK), 'system_config', 'flags'), { maintenanceMode: true }));
    await assertSucceeds(updateDoc(doc(dbAs(CC), 'system_config', 'flags'), { maintenanceMode: true }));
  });
});
describe('unitConfig (D2 — public branding doc)', () => {
  it('⭐ main doc: ANONYMOUS bhi read kar sakta hai (login page branding)', async () => {
    await assertSucceeds(getDoc(doc(dbAnon(), 'unitConfig', 'main')));
  });
  it('sirf main doc — koi aur unitConfig doc public nahi', async () => {
    await assertFails(getDoc(doc(dbAnon(), 'unitConfig', 'other')));
  });
  it('write sirf CC + ⭐ SECRET KEYS block (D2 constraint)', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(CC), 'unitConfig', 'main'), { companyName: 'F Coy' }));
    await assertFails(updateDoc(doc(dbAs(CC), 'unitConfig', 'main'), { apiKey: 'sk-123' }));
    await assertFails(updateDoc(doc(dbAs(CC), 'unitConfig', 'main'), { password: 'x' }));
    await assertFails(updateDoc(doc(dbAs(CLERK), 'unitConfig', 'main'), { companyName: 'Y' }));
  });
});

// ─── 13) CC-only system collections ──────────────────────────────────────
describe('system_counters / automation_runs', () => {
  it('system_counters: sirf CC (BC numbering + masters manager)', async () => {
    await assertFails(getDocs(collection(dbAs(CLERK), 'system_counters')));
    await assertSucceeds(setDoc(doc(dbAs(CC), 'system_counters', 'BC'), { value: 1 }));
    await assertFails(setDoc(doc(dbAs(QM), 'system_counters', 'BC'), { value: 1 }));
  });
  it('automation_runs: sirf CC, delete kisi ko nahi', async () => {
    await assertFails(getDocs(collection(dbAs(USTAD), 'automation_runs')));
    await assertSucceeds(addDoc(collection(dbAs(CC), 'automation_runs'), { rule: 'R1' }));
    const id = (await getDocs(collection(dbAs(CC), 'automation_runs'))).docs[0].id;
    await assertFails(deleteDoc(doc(dbAs(CC), 'automation_runs', id)));
  });
});

// ─── 14) ⭐ DENY-BY-DEFAULT catch-all ────────────────────────────────────
describe('catch-all: unknown collections sabko band', () => {
  it('CC bhi koi unknown collection nahi padh/likh sakta', async () => {
    await assertFails(getDocs(collection(dbAs(CC), 'hack_attempt')));
    await assertFails(addDoc(collection(dbAs(CC), 'anything_new'), { x: 1 }));
  });
});
