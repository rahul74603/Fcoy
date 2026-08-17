// tests/rules.test.mjs
// ═══════════════════════════════════════════════════════════════
// 🔒 FIRESTORE SECURITY RULES TEST — Firebase Emulator ke against
//
// Chalane ka tarika (2 terminals):
//   Terminal 1:  firebase emulators:start --only firestore
//   Terminal 2:  npm run test:rules
//
// Ye script FINAL SECURITY CHECK (Section 49) ki har line verify
// karti hai: Clerk finance nahi chhu sakta, Ustad documents nahi,
// QM personal data nahi, inactive user kuch nahi, waghera.
// ═══════════════════════════════════════════════════════════════

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { setDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';

const PROJECT = 'demo-fcoy-rules-test';

let env;
let passed = 0;
let failed = 0;
const failures = [];

const check = async (name, promise) => {
  try {
    await promise;
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}`);
    console.log(`      ${String(e.message).split('\n')[0]}`);
  }
};

const main = async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  // ── Seed: role profiles + sample data (rules bypass karke) ──
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = new Date().toISOString();
    await setDoc(doc(db, 'users/cc1'),    { name: 'CC',    email: 'cc@f.coy',    role: 'Company Commander', isActive: true });
    await setDoc(doc(db, 'users/clerk1'), { name: 'Clerk', email: 'clerk@f.coy', role: 'Clerk',             isActive: true });
    await setDoc(doc(db, 'users/qm1'),    { name: 'QM',    email: 'qm@f.coy',    role: 'Quarter Master',    isActive: true });
    await setDoc(doc(db, 'users/ustad1'), { name: 'Ustad', email: 'ustad@f.coy', role: 'Ustad',             isActive: true });
    await setDoc(doc(db, 'users/dead1'),  { name: 'Dead',  email: 'dead@f.coy',  role: 'Clerk',             isActive: false });
    // legacy lowercase role bhi test karo
    await setDoc(doc(db, 'users/qm2'),    { name: 'QM2',   email: 'qm2@f.coy',   role: 'qm',                isActive: true });
    await setDoc(doc(db, 'config/firstRun'), { at: now });
    await setDoc(doc(db, 'batches/batch_2026_01'), { batchNumber: '2026-01', status: 'active', totalTrainees: 1, createdAt: now, createdBy: 'cc' });
    await setDoc(doc(db, 'trainees/t1'), { name: 'Ram', regNo: 'R001', chestNo: '5', batchId: 'batch_2026_01', aadharNo: '123412341234', issuedKitItems: [] });
    await setDoc(doc(db, 'mess_fund_expenses/e1'), { amount: 500, date: now });
    await setDoc(doc(db, 'issue_records/i1'), { traineeId: 't1', chestNo: '5' });
    await setDoc(doc(db, 'medicalRecords/m1'), { traineeId: 't1', status: 'Active', category: 'Sick Report', batchId: 'batch_2026_01', date: now });
    await setDoc(doc(db, 'item_master/it1'), { name: 'DM Shoes' });
    await setDoc(doc(db, 'staff_leave/l1'), { staffId: 's1', status: 'pending' });
    await setDoc(doc(db, 'unitConfig/main'), { companyShort: 'F-COY' });
  });

  const cc     = env.authenticatedContext('cc1',    { email: 'cc@f.coy'    }).firestore();
  const clerk  = env.authenticatedContext('clerk1', { email: 'clerk@f.coy' }).firestore();
  const qm     = env.authenticatedContext('qm1',    { email: 'qm@f.coy'    }).firestore();
  const qm2    = env.authenticatedContext('qm2',    { email: 'qm2@f.coy'   }).firestore();
  const ustad  = env.authenticatedContext('ustad1', { email: 'ustad@f.coy' }).firestore();
  const dead   = env.authenticatedContext('dead1',  { email: 'dead@f.coy'  }).firestore();
  const anon   = env.unauthenticatedContext().firestore();

  const now = new Date().toISOString();

  console.log('\n═══ SECTION 49 — FINAL SECURITY CHECK ═══\n');

  console.log('Clerk vs Finance:');
  await check('Clerk CANNOT read finance',   assertFails(getDoc(doc(clerk, 'mess_fund_expenses/e1'))));
  await check('Clerk CANNOT write finance',  assertFails(setDoc(doc(clerk, 'mess_fund_expenses/e2'), { amount: 1 })));
  await check('Clerk CANNOT modify inventory (item_master)', assertFails(updateDoc(doc(clerk, 'item_master/it1'), { name: 'X' })));
  await check('Clerk CANNOT write issue_records', assertFails(setDoc(doc(clerk, 'issue_records/i2'), { x: 1 })));

  console.log('\nUstad restrictions:');
  await check('Ustad CANNOT modify trainee (documents live yahan)', assertFails(updateDoc(doc(ustad, 'trainees/t1'), { documents: {} })));
  await check('Ustad CANNOT read finance',   assertFails(getDoc(doc(ustad, 'mess_fund_expenses/e1'))));
  await check('Ustad CANNOT write finance',  assertFails(setDoc(doc(ustad, 'mess_fund_expenses/e3'), { amount: 1 })));
  await check('Ustad CANNOT create batch',   assertFails(setDoc(doc(ustad, 'batches/b_x'), { batchNumber: 'X' })));
  await check('Ustad CANNOT manage users',   assertFails(setDoc(doc(ustad, 'users/hacker'), { role: 'Company Commander', isActive: true })));
  await check('Ustad CAN read trainees',     assertSucceeds(getDoc(doc(ustad, 'trainees/t1'))));
  await check('Ustad CAN apply own leave',   assertSucceeds(setDoc(doc(ustad, 'staff_leave/l2'), { staffId: 's2', status: 'pending' })));
  await check('Ustad CANNOT approve leave',  assertFails(updateDoc(doc(ustad, 'staff_leave/l1'), { status: 'approved' })));

  console.log('\nQM restrictions:');
  await check('QM CANNOT modify trainee personal data (name)',    assertFails(updateDoc(doc(qm, 'trainees/t1'), { name: 'Hacked' })));
  await check('QM CANNOT modify trainee personal data (aadhaar)', assertFails(updateDoc(doc(qm, 'trainees/t1'), { aadharNo: '999' })));
  await check('QM CAN update kit fields only', assertSucceeds(updateDoc(doc(qm, 'trainees/t1'), { issuedKitItems: [{ itemName: 'DM Shoes' }], lastKitIssueDate: now })));
  await check('QM CAN write finance',          assertSucceeds(setDoc(doc(qm, 'mess_fund_expenses/e4'), { amount: 100, date: now })));
  await check('QM CAN write issue_records',    assertSucceeds(setDoc(doc(qm, 'issue_records/i3'), { traineeId: 't1' })));
  await check('QM CANNOT create batch',        assertFails(setDoc(doc(qm, 'batches/b_qm'), { batchNumber: 'QM-1' })));
  await check('QM CANNOT modify unitConfig',   assertFails(updateDoc(doc(qm, 'unitConfig/main'), { companyShort: 'HACK' })));
  await check('QM legacy lowercase role ("qm") works', assertSucceeds(getDoc(doc(qm2, 'mess_fund_expenses/e1'))));

  console.log('\nInactive & unauthenticated:');
  await check('Inactive user CANNOT read trainees',  assertFails(getDoc(doc(dead, 'trainees/t1'))));
  await check('Inactive user CANNOT write anything', assertFails(setDoc(doc(dead, 'absentRecords/a1'), { x: 1 })));
  await check('Unauthenticated CANNOT read trainees', assertFails(getDoc(doc(anon, 'trainees/t1'))));
  await check('Unauthenticated CANNOT read users',    assertFails(getDocs(collection(anon, 'users'))));
  await check('Unauthenticated CANNOT read finance',  assertFails(getDoc(doc(anon, 'mess_fund_expenses/e1'))));

  console.log('\nRole escalation & direct-write bypass:');
  await check('Clerk CANNOT self-escalate role',   assertFails(updateDoc(doc(clerk, 'users/clerk1'), { role: 'Company Commander' })));
  await check('Clerk CANNOT create users',         assertFails(setDoc(doc(clerk, 'users/newguy'), { role: 'Clerk', isActive: true })));
  await check('Clerk CAN edit own name/phone',     assertSucceeds(updateDoc(doc(clerk, 'users/clerk1'), { name: 'Clerk Ji', phone: '99999', updatedAt: now })));
  await check('Clerk CANNOT write unknown/legacy collection (catch-all)', assertFails(setDoc(doc(clerk, 'randomCollection/x'), { a: 1 })));

  console.log('\n═══ BUSINESS RULES ═══\n');

  console.log('Batch lifecycle (Commander-only):');
  await check('CC CAN create batch',           assertSucceeds(setDoc(doc(cc, 'batches/batch_2026_02'), { batchNumber: '2026-02', status: 'active', totalTrainees: 0, createdAt: now, createdBy: 'cc' })));
  await check('Clerk CANNOT create batch',     assertFails(setDoc(doc(clerk, 'batches/batch_clerk'), { batchNumber: 'CL-1', status: 'active' })));
  await check('Clerk CAN update ONLY totalTrainees', assertSucceeds(updateDoc(doc(clerk, 'batches/batch_2026_01'), { totalTrainees: 2 })));
  await check('Clerk CANNOT change batch status',    assertFails(updateDoc(doc(clerk, 'batches/batch_2026_01'), { status: 'completed' })));
  await check('CC CAN update config/activeBatch',    assertSucceeds(setDoc(doc(cc, 'config/activeBatch'), { batchId: 'batch_2026_02' })));

  console.log('\nClerk trainee administration (allowed work):');
  await check('Clerk CAN create trainee (chest optional)', assertSucceeds(setDoc(doc(clerk, 'trainees/t2'), { name: 'Shyam', regNo: 'R002', chestNo: '', batchId: 'batch_2026_01', createdAt: now })));
  await check('Clerk CAN assign chest later',              assertSucceeds(updateDoc(doc(clerk, 'trainees/t2'), { chestNo: '6', chestAssignedAt: now, chestAssignedBy: 'clerk@f.coy' })));
  await check('Clerk CAN write medicalRecords',            assertSucceeds(setDoc(doc(clerk, 'medicalRecords/m2'), { traineeId: 't2', status: 'Active', category: 'Sick Report', batchId: 'batch_2026_01', date: now })));
  await check('Clerk CAN void medical (update)',           assertSucceeds(updateDoc(doc(clerk, 'medicalRecords/m1'), { status: 'Void / Corrected', voidedAt: now })));
  await check('Clerk CANNOT hard-delete medicalRecords',   assertFails(deleteDoc(doc(clerk, 'medicalRecords/m1'))));
  await check('Clerk CAN write weeklyPrograms',            assertSucceeds(setDoc(doc(clerk, 'weeklyPrograms/w1'), { weekName: 'W1', batchId: 'batch_2026_01', fromDate: '2026-01-01' })));
  await check('Clerk CAN write absentRecords',             assertSucceeds(setDoc(doc(clerk, 'absentRecords/a1'), { traineeId: 't2', batchId: 'batch_2026_01', status: 'Active' })));
  await check('Clerk CAN read batches',                    assertSucceeds(getDoc(doc(clerk, 'batches/batch_2026_01'))));

  console.log('\nCommander full access:');
  await check('CC CAN read finance',        assertSucceeds(getDoc(doc(cc, 'mess_fund_expenses/e1'))));
  await check('CC CAN manage users',        assertSucceeds(setDoc(doc(cc, 'users/staff9'), { name: 'S9', email: 's9@f.coy', role: 'Clerk', isActive: true })));
  await check('CC CAN deactivate user',     assertSucceeds(updateDoc(doc(cc, 'users/staff9'), { isActive: false })));
  await check('CC CAN write unitConfig',    assertSucceeds(setDoc(doc(cc, 'unitConfig/main'), { companyShort: 'F-COY', updatedAt: now })));
  await check('CC CAN access legacy collection (catch-all)', assertSucceeds(setDoc(doc(cc, 'randomCollection/y'), { a: 1 })));

  await env.cleanup();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFAILED CHECKS:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    console.log('\n⛔ DO NOT DEPLOY RULES until these pass.');
    process.exit(1);
  } else {
    console.log('✅ ALL SECURITY CHECKS PASSED — rules deploy karne ke liye safe hain.');
  }
};

main().catch(e => { console.error('Test runner error:', e); process.exit(1); });
