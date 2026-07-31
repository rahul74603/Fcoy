// ═══════════════════════════════════════════════════════════════════════════
// DEV SEED ENGINE — Developer-only test data (150 fake trainees + 20 staff)
// ═══════════════════════════════════════════════════════════════════════════
// Design (owner requirements):
//  • Test batch status:'test' + isTestData:true — BatchContext ise normal users
//    ko dikhata hi nahi (hidden). Sirf Dev Mode ON (localStorage flag) hone par
//    developer ko dikhta hai. Naye aadmi ke browser me flag nahi = kabhi na dikhe.
//  • Har fake doc par marker: isTestData:true + testBatchId — delete 100% safe,
//    real data kabhi touch nahi hota.
//  • Handover = "Delete Test Data" → clean version ready.
// Page gate: /seed-staff route CC-only hai + enableSeedTools flag gated (existing).
// ═══════════════════════════════════════════════════════════════════════════
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export const DEV_MODE_KEY = 'fcoy_dev_mode';
export const DEV_TEST_BATCH_ID = 'batch_test';
const TRAINEE_PREFIX = 'TEST-T-';
const STAFF_PREFIX = 'TEST-S-';

// ─── Dev Mode (localStorage only — server pe kuch nahi jata) ──────────────
export const isDevMode = (): boolean => {
  try { return localStorage.getItem(DEV_MODE_KEY) === '1'; } catch { return false; }
};
export const setDevMode = (on: boolean): void => {
  try { on ? localStorage.setItem(DEV_MODE_KEY, '1') : localStorage.removeItem(DEV_MODE_KEY); } catch { /* private mode */ }
};

// ─── Fake name pools (deterministic combos — koi real nahi) ───────────────
const FIRST = ['Aarav','Arjun','Bhavesh','Chandan','Deepak','Farhan','Gaurav','Harish','Imran','Jitendra',
  'Karan','Laxman','Manoj','Nikhil','Omkar','Praveen','Rahul','Sachin','Tarun','Umesh',
  'Varun','Wasim','Yash','Zahir','Abhishek','Bikram','Chetan','Dushyant','Eklavya','Feroz'];
const LAST = ['Yadav','Thakur','Choudhary','Meena','Gurjar','Pawar','Rathore','Solanki','Bisht','Negi',
  'Rawat','Tomar','Chauhan','Bhadoria','Sengar','Baghel','Kujur','Lakra','Tirkey','Soren'];
const BLOODS = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const PLATOONS = ['A', 'B', 'C'];
const STAFF_RANKS = ['Constable','Head Constable','ASI','Sub Inspector','Inspector'] as const;
const STAFF_CATS = ['PT Instructor','Drill Instructor','Weapon Instructor','FPT Instructor','Map Reading','First Aid','Admin Staff'] as const;

const makeName = (i: number) => `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;

// ─── Chunked batch-commit helper (Firestore limit 500/commit) ─────────────
const commitInChunks = async <T>(items: T[], apply: (b: ReturnType<typeof writeBatch>, item: T) => void, onStep?: (done: number, total: number) => void) => {
  const CHUNK = 450;
  for (let i = 0; i < items.length; i += CHUNK) {
    const part = items.slice(i, i + CHUNK);
    const b = writeBatch(db);
    part.forEach((it) => apply(b, it));
    await b.commit();
    onStep?.(Math.min(i + CHUNK, items.length), items.length);
  }
};

export interface DevSeedResult { created: Record<string, number>; batchId: string; }
export interface DevDeleteResult { deleted: Record<string, number>; total: number; }
export interface DevTestCounts { batch: boolean; trainees: number; staff: number; }

// ─── READ: current test-data counts (UI card) ─────────────────────────────
export const getDevTestCounts = async (): Promise<DevTestCounts> => {
  const batchSnap = await getDoc(doc(db, 'batches', DEV_TEST_BATCH_ID));
  const tSnap = await getDocs(query(collection(db, 'trainees'), where('testBatchId', '==', DEV_TEST_BATCH_ID)));
  const sSnap = await getDocs(query(collection(db, 'staff'), where('testBatchId', '==', DEV_TEST_BATCH_ID)));
  return { batch: batchSnap.exists(), trainees: tSnap.size, staff: sSnap.size };
};

// ─── CREATE: batch + 150 trainees + 20 staff (sab marker ke saath) ────────
export const seedDevTestData = async (
  createdByUid: string,
  onStep?: (msg: string) => void
): Promise<DevSeedResult> => {
  const created: Record<string, number> = { batches: 0, trainees: 0, staff: 0 };
  const today = new Date().toISOString().split('T')[0];

  // 1) Hidden test batch — status 'test' => kabhi auto-active nahi hota (dev ON par hi select)
  onStep?.('Test batch ban raha hai…');
  await setDoc(doc(db, 'batches', DEV_TEST_BATCH_ID), {
    batchNumber: '900',
    batchName: 'DEV TEST BATCH (Hidden)',
    startDate: today,
    endDate: today,
    description: 'Developer testing data — normal users se hidden. Delete Test Data se saaf hoga.',
    status: 'test',
    isTestData: true,
    testBatchId: DEV_TEST_BATCH_ID,
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
  }, { merge: true });
  created.batches = 1;

  // 2) 150 trainees — saari zaroori list-fields (name/regNo/rank/platoon/chestNo/batchId/status)
  await commitInChunks(
    Array.from({ length: 150 }, (_, i) => i + 1),
    (b, i) => {
      const ref = doc(collection(db, 'trainees'));
      b.set(ref, {
        name: makeName(i),
        regNo: `${TRAINEE_PREFIX}${String(i).padStart(4, '0')}`,
        fatherName: makeName(i + 77),
        rank: 'Trainee Constable',
        platoon: PLATOONS[i % PLATOONS.length],
        chestNo: `T${9000 + i}`,
        batchId: DEV_TEST_BATCH_ID,
        batchNumber: '900',
        status: 'active',
        mobile: `900000${String(1000 + i).slice(-4)}`,
        bloodGroup: BLOODS[i % BLOODS.length],
        admissionDate: today,
        documents: {},
        isTestData: true,
        testBatchId: DEV_TEST_BATCH_ID,
        createdBy: 'dev-seed',
        createdAt: serverTimestamp(),
      });
    },
    (done, total) => onStep?.(`Trainees: ${done}/${total}`)
  );
  created.trainees = 150;

  // 3) 20 staff
  await commitInChunks(
    Array.from({ length: 20 }, (_, i) => i + 1),
    (b, i) => {
      const ref = doc(collection(db, 'staff'));
      b.set(ref, {
        forceNumber: `${STAFF_PREFIX}${String(i).padStart(3, '0')}`,
        name: makeName(i * 3 + 11),
        rank: STAFF_RANKS[i % STAFF_RANKS.length],
        company: 'F Coy',
        category: STAFF_CATS[i % STAFF_CATS.length],
        battalion: 'DEV Test Unit',
        mobile: `911111${String(2000 + i).slice(-4)}`,
        experienceYears: 3 + (i % 18),
        qualification: 'Test Qualification',
        bloodGroup: BLOODS[(i + 3) % BLOODS.length],
        batchId: DEV_TEST_BATCH_ID,
        isTestData: true,
        testBatchId: DEV_TEST_BATCH_ID,
        createdBy: createdByUid,
        createdAt: serverTimestamp(),
      });
    },
    (done, total) => onStep?.(`Staff: ${done}/${total}`)
  );
  created.staff = 20;

  onStep?.('Done ✅');
  return { created, batchId: DEV_TEST_BATCH_ID };
};

// ─── DELETE: sirf marked test data (multi-collection, prefix-safe) ────────
export const deleteDevTestData = async (
  onStep?: (msg: string) => void
): Promise<DevDeleteResult> => {
  const deleted: Record<string, number> = {};
  let total = 0;

  const wipe = async (label: string, qry: ReturnType<typeof query>) => {
    const snap = await getDocs(qry);
    if (snap.empty) { deleted[label] = 0; return; }
    onStep?.(`${label}: ${snap.size} docs delete ho rahe hain…`);
    await commitInChunks(snap.docs, (b, d) => b.delete(d.ref));
    deleted[label] = snap.size;
    total += snap.size;
  };

  await wipe('trainees', query(collection(db, 'trainees'), where('testBatchId', '==', DEV_TEST_BATCH_ID)));
  await wipe('staff', query(collection(db, 'staff'), where('testBatchId', '==', DEV_TEST_BATCH_ID)));
  // Jo cheezein testing ke dauraan test-batch scope me bani hon (batchId stamp ke saath)
  for (const col of ['staff_leave', 'staff_attendance', 'trainee_attendance', 'weeklyTestRecords', 'fptRecords'] as const) {
    await wipe(col, query(collection(db, col), where('batchId', '==', DEV_TEST_BATCH_ID)));
  }
  // Test-trainee prefix (TEST-T-) wale side-records
  for (const col of ['issue_records', 'stock_returns', 'absentRecords', 'medicalRecords'] as const) {
    await wipe(col, query(
      collection(db, col),
      where('traineeId', '>=', TRAINEE_PREFIX),
      where('traineeId', '<=', TRAINEE_PREFIX + '\uf8ff')
    ));
  }
  // Batch doc aakhir me
  const batchRef = doc(db, 'batches', DEV_TEST_BATCH_ID);
  if ((await getDoc(batchRef)).exists()) { await deleteDoc(batchRef); deleted.batches = 1; total += 1; } else { deleted.batches = 0; }

  onStep?.(`Total ${total} docs saaf ✅`);
  return { deleted, total };
};
