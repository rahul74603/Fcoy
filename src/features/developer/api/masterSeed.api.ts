// src/features/developer/api/masterSeed.api.ts
// ─────────────────────────────────────────────
// 🏗️ MASTER COY — PERMANENT DATA FACTORY
//
// Owner ka order:
//   1. wipeAllMasterData()   — master app ka SARA purana business data
//      permanent DELETE (saare batches/trainees/funds/stock sab saaf).
//      SIRF billing ledger + users + config + subscription SAFE rehte hain.
//   2. seedMasterPermanentBatch() — EK ready-made PERMANENT batch:
//      CT (GD) Basic Batch No. 01 (ACTIVE) — 150 trainees (4 Platoons,
//      har jagah 'Platoon 1/2/3/4'), mobile/state/address/religion sab
//      REALISTIC (koi DEV/waha-waha text nahi), 20 staff + 10 subjects +
//      tests + absent/medical + attendance/leave/duty + schedule + programs.
//
// ⛔ SAFETY: sirf MASTER project (training-command-erp) pe chalega —
//    kisi company app pe galti se bhi data delete nahi hoga.
// 🧪 Kanun #1: master = dev sandbox — har doc isDevData tagged rehta hai
//    (real companies me kabhi nahi dikhega), par MASTER pe PERMANENT hai:
//    practice-cleanup/session se nahi udta.
// ─────────────────────────────────────────────

import {
  collection, doc, getDocs, query, where, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../../../config/firebase';
import { COLLECTIONS } from '../../aiAgent/knowledge/collectionRegistry';
import {
  rand, pick, chance, weighted, digits, mobile, pad2, randomDateStr, dayAfter,
  NAME_POOLS, RELIGION_PICK, STATES, VILLAGES, EDUCATION, BLOOD, CATEGORY,
  REC_CENTERS, KIT_ITEMS, ABSENT_REASONS, COMPLAINTS,
  SEEDED_COLLECTIONS, ProgressCb,
} from './testBatchSeed.api';

export const MASTER_BATCH_ID = 'batch_MASTER_COY_01';
export const MASTER_BATCH_NUMBER = 'CT(GD)-01';
export const MASTER_BATCH_NAME = 'CT (GD) Basic Batch No. 01';
const BATCH_START = '2026-04-06';
const BATCH_END = '2026-10-02';
const TOTAL_TRAINEES = 150;
const CHUNK = 450;
const TAG = { isDevData: true }; // 🧪 dev sandbox kanun — master ka data tagged

// ─── ⛔ GUARD: sirf MASTER app pe ───
const guardMaster = () => {
  if (firebaseConfig.projectId !== 'training-command-erp') {
    throw new Error('⛔ Ye feature SIRF MASTER app pe chalta hai — company app ka data yahan se kabhi delete nahi hota. RUKO!');
  }
};

// ═════════════════════════════════════════════
// WIPE — sara business data (ledger/users/config SAFE)
// ═════════════════════════════════════════════
const PROTECTED = new Set([
  'users', 'config', 'unitConfig',
  'subscription', 'subscriptionPlans', 'subscriptionHistory',
  'customers', 'customerSubscriptions',
  'devTools', 'notifications', 'activity_logs',
]);

export const MASTER_WIPE_COLLECTIONS: string[] = Array.from(
  new Set([...COLLECTIONS.map(c => c.name), ...SEEDED_COLLECTIONS, 'activity_logs']),
).filter(n => !PROTECTED.has(n));

type DocOp = { col: string; id?: string; data: Record<string, unknown> };

export const estimateWipe = async (): Promise<number> => {
  guardMaster();
  let total = 0;
  for (const col of MASTER_WIPE_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, col));
      total += snap.size;
    } catch { /* collection na ho to skip */ }
  }
  return total;
};

export const wipeAllMasterData = async (onProgress?: ProgressCb): Promise<number> => {
  guardMaster();
  let deleted = 0;
  let done = 0;
  for (const col of MASTER_WIPE_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, col));
      const ids = snap.docs.map(d => d.id);
      for (let i = 0; i < ids.length; i += CHUNK) {
        const wb = writeBatch(db);
        ids.slice(i, i + CHUNK).forEach(id => wb.delete(doc(db, col, id)));
        await wb.commit();
        deleted += Math.min(CHUNK, ids.length - i);
      }
    } catch (err) { console.warn(`Wipe skip ${col}:`, err); }
    done += 1;
    onProgress?.({ step: `Deleting: ${col}`, done, total: MASTER_WIPE_COLLECTIONS.length });
  }
  return deleted;
};

// ═════════════════════════════════════════════
// COUNT (status badge ke liye)
// ═════════════════════════════════════════════
export const countMasterData = async (): Promise<{ trainees: number; batchExists: boolean }> => {
  try {
    const q1 = query(collection(db, 'trainees'), where('batchId', '==', MASTER_BATCH_ID));
    const snap = await getDocs(q1);
    return { trainees: snap.size, batchExists: snap.size > 0 };
  } catch {
    return { trainees: 0, batchExists: false };
  }
};

// ═════════════════════════════════════════════
// SEED — 150 TRAINEES · 4 PLATOONS · FULL DETAIL
// ═════════════════════════════════════════════

// Realistic PAN: ABCDE1234F pattern
const panNo = () => {
  const L = () => String.fromCharCode(65 + rand(0, 25));
  return `${L()}${L()}${L()}${L()}${L()}${digits(4)}${L()}`;
};

// 20 staff — realistic posts
const STAFF = [
  { name: 'Rajendra Prasad', rank: 'Insp', status: 'active' },
  { name: 'Devi Singh Rathore', rank: 'SI', status: 'active' },
  { name: 'Suresh Yadav', rank: 'HC', status: 'active' },
  { name: 'Anil Sharma', rank: 'HC', status: 'active' },
  { name: 'Vikram Singh Tomar', rank: 'HC', status: 'active' },
  { name: 'Sanjeev Kumar', rank: 'HC', status: 'active' },
  { name: 'Pramod Kumar Sah', rank: 'NK', status: 'leave' },
  { name: 'Rohit Verma', rank: 'CT', status: 'td' },
  { name: 'Manoj Kumar Singh', rank: 'NK', status: 'active' },
  { name: 'Gurmeet Singh', rank: 'CT', status: 'active' },
  { name: 'Deepak Choudhary', rank: 'CT', status: 'active' },
  { name: 'Sachin Kumar Jha', rank: 'CT', status: 'active' },
  { name: 'Ramesh Chandra Bhatt', rank: 'NK', status: 'active' },
  { name: 'Anuj Pratap Singh', rank: 'HC', status: 'active' },
  { name: 'Mohan Lal Meena', rank: 'CT', status: 'hospital' },
  { name: 'Harish Rawat', rank: 'CT', status: 'active' },
  { name: 'Kishor Singh Bist', rank: 'NK', status: 'leave' },
  { name: 'Irfan Khan', rank: 'CT', status: 'active' },
  { name: 'Baldev Singh', rank: 'HC', status: 'active' },
  { name: 'Nitin Tyagi', rank: 'CT', status: 'active' },
] as const;

// 10 subjects — realistic codes
const SUBJECTS = [
  { name: 'Physical Training', code: 'PT', category: 'Outdoor', description: 'PT, endurance, battle PT & games' },
  { name: 'Drill & Turnout', code: 'DRL', category: 'Outdoor', description: 'Squad drill with/without arms, ceremonial' },
  { name: 'Weapon Training', code: 'WPT', category: 'Practical', description: 'INSAS/AK handling, stripping & assembling' },
  { name: 'Map Reading & Navigation', code: 'MAP', category: 'Theory', description: 'Map reading, GPS & night navigation' },
  { name: 'First Aid & Battle Casualty', code: 'FA', category: 'Theory', description: 'Battlefield first aid & evacuation drills' },
  { name: 'BSF Law & Duties', code: 'LAW', category: 'Indoor', description: 'BSF Act, BSF Rules & border duties' },
  { name: 'Field Craft & Tactics', code: 'FCT', category: 'Outdoor', description: 'Camouflage, concealment, patrolling, ambush' },
  { name: 'Ethics & Force Values', code: 'ETH', category: 'Indoor', description: 'Force history, ethics & discipline values' },
  { name: 'Border Management', code: 'BMS', category: 'Theory', description: 'Border domination, fencing & surveillance' },
  { name: 'Range Firing Practice', code: 'FIRE', category: 'Practical', description: 'Range conduct & grouping practices' },
] as const;

const WRITE_ALL_CHUNK = async (docs: DocOp[], onProgress?: ProgressCb): Promise<void> => {
  let done = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const wb = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(op => {
      const ref = op.id ? doc(db, op.col, op.id) : doc(collection(db, op.col));
      wb.set(ref, op.data);
    });
    await wb.commit();
    done += Math.min(CHUNK, docs.length - i);
    onProgress?.({ step: `Writing: ${docs[Math.min(i, docs.length - 1)].col}`, done, total: docs.length });
  }
};

export const seedMasterPermanentBatch = async (onProgress?: ProgressCb): Promise<{ totalDocs: number }> => {
  guardMaster();
  const docs: DocOp[] = [];
  const createdAt = `${BATCH_START}T05:30:00.000Z`;

  // ═══ 1. BATCH — ACTIVE, permanent ═══
  docs.push({
    col: 'batches', id: MASTER_BATCH_ID,
    data: {
      batchNumber: MASTER_BATCH_NUMBER,
      batchName: MASTER_BATCH_NAME,
      status: 'active',
      startDate: BATCH_START,
      endDate: BATCH_END,
      description: 'MASTER COY ka permanent ready-made testing batch — 150 trainees, 4 Platoons, staff + subjects + tests sab full detail.',
      totalTrainees: TOTAL_TRAINEES,
      createdAt,
      createdBy: 'master-seed',
      ...TAG,
    },
  });

  // ═══ 2. TRAINEES (150 — 4 Platoons ~37/38 each) ═══
  interface TBasic { id: string; name: string; chestNo: string; regNo: string; platoon: string }
  const trainees: TBasic[] = [];

  for (let i = 0; i < TOTAL_TRAINEES; i++) {
    const religion = weighted(RELIGION_PICK);
    const pool = NAME_POOLS[religion];
    const isFemale = i % 15 === 14; // 10 female trainees
    const first = pick(isFemale ? pool.female : pool.male);
    const surname = pick(pool.surnames);
    const name = religion === 'Sikh'
      ? `${first} ${isFemale ? 'Kaur' : 'Singh'}`
      : `${first} ${surname}`;
    const fatherName = `${pick(pool.male)} ${religion === 'Sikh' ? 'Singh' : pick(pool.surnames)}`;
    const motherName = `${pick(pool.mothers)}${religion === 'Hindu' ? ' Devi' : ''}`;

    const state = pick(Object.keys(STATES));
    const district = pick(STATES[state]);
    const chestNo = String(1001 + i);
    const regNo = `26${String(310001 + i)}`;
    const platoon = `Platoon ${(i % 4) + 1}`; // 🎯 Platoon 1-4 har jagah
    const section = `Section ${Math.floor(i / 4) % 2 === 0 ? 'A' : 'B'}`;
    const dobYear = rand(1998, 2004);
    const dob = `${dobYear}-${pad2(rand(1, 12))}-${pad2(rand(1, 28))}`;
    const fptPass = chance(86);
    const weeklyPass = chance(82);

    const tRef = doc(collection(db, 'trainees'));
    trainees.push({ id: tRef.id, name, chestNo, regNo, platoon });

    docs.push({
      col: 'trainees', id: tRef.id,
      data: {
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER, batchName: MASTER_BATCH_NAME,
        name, fatherName, motherName,
        dob, age: String(2026 - dobYear),
        gender: isFemale ? 'Female' : 'Male',
        bloodGroup: pick(BLOOD),
        religion, category: weighted(CATEGORY),
        maritalStatus: weighted([['Unmarried', 76], ['Married', 24]] as const),
        regNo, chestNo,
        aadharNo: digits(12), panNo: chance(42) ? panNo() : '',
        mobileNo: mobile(),
        emergencyContact: mobile(),
        emergencyContactName: fatherName,
        relationship: 'Father',
        village: `Village ${pick(VILLAGES)}`,
        postOffice: district,
        tehsil: district, district, state,
        pinCode: digits(6),
        education: pick(EDUCATION),
        boardUniversity: pick(['RBSE', 'CBSE', 'UP Board', 'BSEB', 'MP Board', 'PSEB'] as const),
        passingYear: String(rand(2018, 2023)),
        percentage: String(rand(52, 88)),
        recruitmentCenter: pick(REC_CENTERS),
        joinDate: BATCH_START,
        platoon, section,
        height: String(rand(165, 183)),
        weight: String(rand(55, 79)),
        chest: `${rand(82, 97)}`,
        medStat: weighted([['SHAPE-1', 88], ['SHAPE-2', 9], ['Temporary Unfit', 3]] as const),
        medRemarks: '',
        attn: weighted([['P', 86], ['L', 5], ['S', 4], ['A', 2], ['M', 3]] as const),
        fptResult: fptPass ? 'Pass' : 'Fail',
        fptScore: `${rand(fptPass ? 60 : 25, fptPass ? 96 : 58)}/100`,
        weeklyExamResult: weeklyPass ? 'Pass' : 'Fail',
        weeklyExamMarks: `${rand(weeklyPass ? 45 : 15, weeklyPass ? 95 : 38)}/100`,
        punishments: chance(12) ? String(rand(1, 3)) : '',
        ptScore: `${rand(55, 95)}/100`,
        weaponQual: pick(['Marksman', 'First Class', 'Second Class'] as const),
        kitIssued: true,
        issuedItems: [], issuedKitItems: KIT_ITEMS,
        shoeSize: String(rand(6, 10)), dressSize: pick(['S', 'M', 'L', 'XL'] as const),
        weaponNo: `INSAS-${73001 + i}`,
        docsComplete: chance(94),
        documents: {},
        rank: 'RCT',
        photoURL: '', photoPath: '',
        remarks: '',
        createdAt, createdBy: 'master-seed',
        ...TAG,
      },
    });
  }

  // ═══ 3. STAFF (20) ═══
  const staffIds: { id: string; name: string; rank: string; forceNumber: string; status: string }[] = [];
  STAFF.forEach((s, i) => {
    const sRef = doc(collection(db, 'staff'));
    const forceNumber = `88${digits(6)}`;
    staffIds.push({ id: sRef.id, name: s.name, rank: s.rank, forceNumber, status: s.status });
    docs.push({
      col: 'staff', id: sRef.id,
      data: {
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        forceNumber, name: s.name, rank: s.rank,
        company: 'MASTER COY', category: 'Combatised', battalion: 'MASTER BN 01',
        mobile: mobile(), email: '',
        dateOfJoining: Timestamp.fromDate(new Date(`${rand(2012, 2020)}-${pad2(rand(1, 12))}-10T00:00:00`)),
        dateOfPosting: Timestamp.fromDate(new Date('2026-03-28T00:00:00')),
        experienceYears: rand(4, 16),
        qualification: pick(['Graduate', '12th Pass', 'B.P.Ed', 'MA'] as const),
        bloodGroup: pick(BLOOD),
        emergencyContact: { name: 'Family', relation: 'Self', mobile: mobile(), address: pick(STATES['Madhya Pradesh']) },
        status: s.status,
        photoURL: '', remarks: s.status === 'leave' ? 'EL par' : s.status === 'td' ? 'Cadre course — RTC Delhi' : s.status === 'hospital' ? 'MH Tekanpur refer' : '',
        createdAt, createdBy: 'master-seed',
        ...TAG,
      },
    });
    void i;
  });

  // ═══ 4. SUBJECTS (10) + ASSIGNMENTS ═══
  const subjectRefs: { id: string; name: string; code: string }[] = [];
  SUBJECTS.forEach(sub => {
    const ref = doc(collection(db, 'subject_master'));
    subjectRefs.push({ id: ref.id, name: sub.name, code: sub.code });
    docs.push({
      col: 'subject_master', id: ref.id,
      data: { ...sub, isActive: true, createdBy: 'master-seed', ...TAG },
    });
  });

  staffIds.forEach((st, i) => {
    const subj = subjectRefs[i % subjectRefs.length];
    docs.push({
      col: 'staff_subjects',
      data: {
        staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
        subjectId: subj.id, subjectName: subj.name, subjectCode: subj.code,
        assignedDate: Timestamp.fromDate(new Date(`${BATCH_START}T00:00:00`)), assignedBy: 'master-seed', isActive: true, remarks: '',
        ...TAG,
      },
    });
  });

  // ═══ 5. TRAINING TESTS (FPT + 2 weekly — pass/fail, platoon har result me) ═══
  const gradeOf = (pct: number): string =>
    pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';
  const instName = (i: number) => `${STAFF[i].rank} ${STAFF[i].name}`;

  const fptEvents = [
    { name: '5 KM Running', maxMarks: 40, passingMarks: 20, isRunning: true },
    { name: 'Push Ups (1 min)', maxMarks: 30, passingMarks: 12 },
    { name: 'Sit Ups (1 min)', maxMarks: 30, passingMarks: 12 },
  ];
  const fptResults = trainees.map((t, i) => {
    if (i % 34 === 33) {
      return {
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo, platoon: t.platoon,
        marks: 0, grade: 'F', status: 'absent', remarks: 'Absent on test day', weakAreas: [] as string[],
        events: fptEvents.map(e => ({ ...e, marks: 0, passed: false })), eventsPassed: 0, eventsFailed: 3,
      };
    }
    const ev = fptEvents.map(e => {
      const passed = chance(88);
      const marks = passed ? rand(e.passingMarks, e.maxMarks) : rand(0, e.passingMarks - 1);
      return { ...e, marks, passed, runningGrade: e.isRunning ? (marks >= 34 ? 'Excellent' : marks >= 28 ? 'Very Good' : marks >= 20 ? 'Good' : 'Fail') : '' };
    });
    const marks = ev.reduce((s, e) => s + e.marks, 0);
    const passed = ev.every(e => e.passed);
    return {
      traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo, platoon: t.platoon,
      marks, grade: gradeOf(marks), status: passed ? 'pass' : 'fail',
      remarks: '', weakAreas: ev.filter(e => !e.passed).map(e => e.name),
      events: ev, eventsPassed: ev.filter(e => e.passed).length, eventsFailed: ev.filter(e => !e.passed).length,
    };
  });

  const testDoc = (
    testType: string, testName: string, subjectCode: string, weekNumber: number,
    date: string, results: Record<string, unknown>[], totalMarks: number, passingMarks: number,
    instructor: string, venue: string,
  ) => {
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status === 'fail').length;
    const absent = results.filter(r => r.status === 'absent').length;
    const present = results.filter(r => r.status !== 'absent');
    const avg = present.length ? Math.round(present.reduce((s, r) => s + (r.marks as number), 0) / present.length) : 0;
    return {
      batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
      testType, testName, subjectCode,
      description: `${testName} — ${MASTER_BATCH_NAME}`,
      weekNumber, testDate: date,
      startTime: '0600', endTime: '0830', venue,
      platoon: 'All Platoons (Whole Company)',
      totalMarks, passingMarks, passingPercent: (passingMarks / totalMarks) * 100,
      ...(testType === 'fpt' ? { fptEvents, overallPassPercent: 50 } : {}),
      instructorId: '', instructorName: instructor,
      results, averageScore: avg, passCount: pass, failCount: fail, absentCount: absent,
      status: 'completed', remarks: '',
      createdAt, updatedAt: createdAt, createdBy: 'master-seed',
      ...TAG,
    };
  };

  docs.push({ col: 'training_tests', data: testDoc('fpt', 'FPT — Mid Course', 'PT', 16, '2026-07-24', fptResults as never[], 100, 60, instName(4), 'Athletics Track') });

  const weeklyTest = (name: string, code: string, week: number, date: string, instI: number) => {
    const results = trainees.map((t, i) => {
      if (i % 51 === 50) {
        return {
          traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo, platoon: t.platoon,
          marks: 0, grade: 'F', status: 'absent', remarks: 'MI Room', weakAreas: [] as string[],
        };
      }
      const passed = chance(84);
      const marks = passed ? rand(42, 96) : rand(14, 39);
      return {
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo, platoon: t.platoon,
        marks, grade: gradeOf(marks), status: passed ? 'pass' : 'fail', remarks: '',
        weakAreas: passed ? [] : ['Theory revision needed'],
      };
    });
    docs.push({ col: 'training_tests', data: testDoc('weekly', name, code, week, date, results as never[], 100, 40, instName(instI), 'Class Room 1') });
  };
  weeklyTest('Weapon Training — Written', 'WPT', 7, '2026-05-22', 2);
  weeklyTest('Map Reading — Theory', 'MAP', 12, '2026-06-26', 8);

  // ═══ 6. ABSENT + MEDICAL RECORDS (platoon ke saath) ═══
  for (let k = 0; k < 20; k++) {
    const t = trainees[rand(0, TOTAL_TRAINEES - 1)];
    const type = weighted([['L', 35], ['S', 35], ['A', 12], ['H', 18]] as const);
    const from = randomDateStr('2026-04-15', '2026-07-28');
    const days = rand(1, 9);
    docs.push({
      col: 'absentRecords',
      data: {
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo, platoon: t.platoon,
        type, reason: pick(ABSENT_REASONS[type]),
        fromDate: from, toDate: dayAfter(from, days), totalDays: days,
        status: 'Returned', remarks: '',
        enteredBy: 'master-seed', createdAt,
        ...TAG,
      },
    });
  }

  for (let k = 0; k < 15; k++) {
    const t = trainees[rand(0, TOTAL_TRAINEES - 1)];
    const [complaint, diagnosis, treatment] = pick([...COMPLAINTS]);
    docs.push({
      col: 'medicalRecords',
      data: {
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, platoon: t.platoon,
        complaint, diagnosis, treatment,
        category: 'Sick Report',
        date: randomDateStr('2026-04-10', '2026-07-31'),
        status: 'Recovered',
        doctorRemarks: 'Fit for duty after rest',
        enteredBy: 'master-seed', createdAt,
        ...TAG,
      },
    });
  }

  // ═══ 7. STAFF ATTENDANCE / LEAVE / DUTY ═══
  const attDates = ['2026-04-13', '2026-05-11', '2026-06-08', '2026-07-06', '2026-08-05'];
  staffIds.forEach(st => {
    attDates.forEach(dStr => {
      const status = st.status === 'leave' && (dStr === '2026-07-06') ? 'leave'
        : weighted([['present', 92], ['absent', 4], ['leave', 4]] as const);
      docs.push({
        col: 'staff_attendance',
        data: {
          staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
          date: Timestamp.fromDate(new Date(`${dStr}T00:00:00`)),
          status, remarks: '', markedBy: 'master-seed',
          markedAt: Timestamp.fromDate(new Date(`${dStr}T07:30:00`)),
          batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
          ...TAG,
        },
      });
    });
  });

  staffIds.slice(5, 8).forEach((st, i) => {
    const from = `2026-0${5 + i}-0${3 + i}`;
    const days = rand(3, 8);
    docs.push({
      col: 'staff_leave',
      data: {
        staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
        leaveType: pick(['CL', 'EL'] as const),
        fromDate: Timestamp.fromDate(new Date(`${from}T00:00:00`)),
        toDate: Timestamp.fromDate(new Date(`${dayAfter(from, days)}T00:00:00`)),
        totalDays: days,
        reason: 'Ghar par zaroori kaam',
        status: 'approved',
        appliedAt: Timestamp.fromDate(new Date(`${from}T08:00:00`)),
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        ...TAG,
      },
    });
  });

  const DUTIES = ['Gate Guard', 'Quarter Guard', 'Mess Duty', 'Night Check', 'Armoury Duty'] as const;
  staffIds.forEach((st, i) => {
    const dStr = dayAfter('2026-07-15', i);
    docs.push({
      col: 'staff_duty',
      data: {
        staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
        dutyTypeId: `duty_${i}`, dutyTypeName: DUTIES[i % DUTIES.length],
        date: Timestamp.fromDate(new Date(`${dStr}T00:00:00`)),
        status: 'completed', remarks: '',
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        ...TAG,
      },
    });
  });

  // ═══ 8. TRAINING SCHEDULE (12) ═══
  const SCHED = [
    ['0545-0630', 'Physical Training', 4], ['0700-0800', 'Drill & Turnout', 1],
    ['0900-1000', 'Weapon Training', 2], ['1030-1130', 'Map Reading & Navigation', 8],
    ['1200-1300', 'BSF Law & Duties', 0], ['1600-1700', 'Field Craft & Tactics', 3],
  ] as const;
  for (let w = 0; w < 12; w++) {
    const [time, subject, si] = SCHED[w % SCHED.length];
    docs.push({
      col: 'training_schedule',
      data: {
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        subject, instructor: instName(si),
        time, date: dayAfter('2026-04-07', w * 7),
        status: 'Completed', remarks: '',
        ...TAG,
      },
    });
  }

  // ═══ 9. DEPUTATION (1) ═══
  const deputed = staffIds[7];
  docs.push({
    col: 'deputation_records',
    data: {
      batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
      direction: 'outgoing', staffId: deputed.id, staffName: `${deputed.rank} ${deputed.name}`,
      staffRank: deputed.rank, staffForceNumber: deputed.forceNumber, staffCategory: 'Combatised',
      fromCompany: 'MASTER COY', toCompany: 'RTC Delhi',
      purpose: 'Cadre course', eventDetail: 'Weapon refresher course',
      fromDate: '2026-06-01', toDate: '2026-07-31', status: 'completed', remarks: '',
      ...TAG,
    },
  });

  // ═══ 10. WEEKLY PROGRAMS (4) ═══
  for (let w = 0; w < 4; w++) {
    const from = dayAfter(BATCH_START, w * 7);
    docs.push({
      col: 'weeklyPrograms',
      data: {
        batchId: MASTER_BATCH_ID, batchNumber: MASTER_BATCH_NUMBER,
        weekName: `Week ${w + 1}`, weekNumber: w + 1,
        fromDate: from, toDate: dayAfter(from, 5),
        displayDateRange: `${from} — ${dayAfter(from, 5)}`,
        admNco: instName(0), admSo: '', teaBreak: '1030-1045',
        gameTime: '1700-1800', rollCall: '0545', distribution: '2045',
        remarks: 'First month training program',
        schedule: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => ({
          day,
          sessions: SCHED.slice(0, 4).map(([time, subject, si], idx) => ({
            time, subject, instructor: instName((si + w) % 10), venue: idx < 2 ? 'Parade Ground' : 'Class Room 1',
          })),
        })),
        createdAt, createdBy: 'master-seed',
        ...TAG,
      },
    });
  }

  // ═══ WRITE ALL ═══
  await WRITE_ALL_CHUNK(docs, onProgress);
  return { totalDocs: docs.length };
};
