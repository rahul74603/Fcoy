// src/features/developer/api/testBatchSeed.api.ts
// ─────────────────────────────────────────────
// 🧪 FULL TEST BATCH GENERATOR
// Ek realistic "completed batch" seed karta hai:
//   • 100 trainees (religion, state, mobile, medical — sab details)
//   • 8 staff + 8 subjects + assignments
//   • 3 training tests (FPT + 2 weekly) — pass/fail results
//   • absent / medical / attendance / leave / duty / schedule / programs
// HAR document tagged: isDevData: true
//   → Sirf DEVELOPER account ko dikhega, baaki kisi ko kabhi nahi.
// ─────────────────────────────────────────────

import {
  collection, doc, getDocs, query, where, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';

const DEV_TAG = 'isDevData';
const CHUNK = 450;

export const DEV_BATCH_ID = 'batch_DEV_TEST_01';
export const DEV_BATCH_NUMBER = 'TEST-77';
export const DEV_BATCH_NAME = 'Dev Testing Batch (Demo)';
const BATCH_START = '2026-02-02';
const BATCH_END = '2026-07-24';

/** Jin collections me test batch ka data jata hai */
export const SEEDED_COLLECTIONS = [
  'batches', 'trainees', 'staff', 'subject_master', 'staff_subjects',
  'training_tests', 'absentRecords', 'medicalRecords', 'staff_attendance',
  'staff_leave', 'staff_duty', 'training_schedule', 'deputation_records',
  'weeklyPrograms',
];

// ─────────────────────────────────────────────
// RANDOM HELPERS
// ─────────────────────────────────────────────
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)];
const chance = (pct: number) => Math.random() * 100 < pct;

const weighted = <T,>(pairs: readonly (readonly [T, number])[]): T => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [val, w] of pairs) { r -= w; if (r <= 0) return val; }
  return pairs[0][0];
};

const digits = (n: number) => Array.from({ length: n }, () => rand(0, 9)).join('');
const mobile = () => pick(['98', '97', '96', '86', '87', '70', '63', '81'] as const) + digits(8);
const pad2 = (n: number) => String(n).padStart(2, '0');

const randomDateStr = (fromISO: string, toISO: string): string => {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  return new Date(a + Math.random() * (b - a)).toISOString().slice(0, 10);
};

const dayAfter = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ─────────────────────────────────────────────
// DATA POOLS (realistic Indian profiles)
// ─────────────────────────────────────────────
const NAME_POOLS: Record<string, { male: string[]; female: string[]; surnames: string[]; mothers: string[] }> = {
  Hindu: {
    male: ['Arjun', 'Rohit', 'Amit', 'Vikram', 'Suresh', 'Ramesh', 'Deepak', 'Ankit', 'Manoj', 'Sunil', 'Pradeep', 'Sanjay', 'Nitin', 'Gaurav', 'Sachin', 'Dinesh', 'Kunal', 'Ashok', 'Vijay', 'Santosh', 'Pankaj', 'Yash', 'Himanshu', 'Tushar'],
    female: ['Priya', 'Anjali', 'Pooja', 'Kajal', 'Neha', 'Ritu', 'Sapna'],
    surnames: ['Sharma', 'Verma', 'Yadav', 'Singh', 'Chauhan', 'Rathore', 'Meena', 'Gurjar', 'Solanki', 'Thakur', 'Patel', 'Joshi', 'Tiwari', 'Mishra', 'Pandey', 'Choudhary', 'Rawat', 'Kumar'],
    mothers: ['Sunita', 'Rekha', 'Geeta', 'Kamla', 'Savita', 'Pushpa', 'Anita'],
  },
  Muslim: {
    male: ['Imran', 'Salman', 'Arif', 'Mohammad', 'Irfan', 'Wasim', 'Rizwan', 'Firoz', 'Shakil', 'Nasir', 'Adil', 'Shoaib'],
    female: ['Shabnam', 'Rukhsar', 'Farheen', 'Sana'],
    surnames: ['Khan', 'Ansari', 'Sheikh', 'Qureshi', 'Pathan', 'Malik'],
    mothers: ['Shabana', 'Ruksana', 'Naseem', 'Farida'],
  },
  Sikh: {
    male: ['Gurpreet', 'Harpreet', 'Jaspreet', 'Manpreet', 'Kuldeep', 'Balwinder', 'Harjinder', 'Sukhdev', 'Ranjit', 'Jagtar'],
    female: ['Simran', 'Harleen', 'Jasleen'],
    surnames: ['Singh'],
    mothers: ['Gurmeet Kaur', 'Baljit Kaur', 'Manjit Kaur'],
  },
  Christian: {
    male: ['John', 'David', 'Joseph', 'Samuel', 'Thomas', 'Emmanuel', 'Rohan', 'Alwin', 'Peter', 'Victor'],
    female: ['Mary', 'Rose', 'Anita'],
    surnames: ['Masih', 'D\'Souza', 'Fernandes', 'Tirkey', 'Kujur', 'Beck', 'Ekka'],
    mothers: ['Mary', 'Elizabeth', 'Rita'],
  },
  Buddhist: {
    male: ['Tenzin', 'Karma', 'Dorjee', 'Phunchok', 'Stanzin', 'Nawang'],
    female: ['Pema', 'Tsering'],
    surnames: ['Bhutia', 'Lepcha', 'Sherpa', 'Lama'],
    mothers: ['Dolma', 'Pema'],
  },
  Jain: {
    male: ['Harsh', 'Nirav', 'Paras', 'Dhruv', 'Jinesh', 'Chirag'],
    female: ['Riddhi', 'Siddhi'],
    surnames: ['Jain', 'Shah', 'Doshi', 'Mehta'],
    mothers: ['Rekha', 'Minal'],
  },
};

const RELIGION_PICK = [
  ['Hindu', 58], ['Muslim', 14], ['Sikh', 11], ['Christian', 8], ['Buddhist', 4], ['Jain', 5],
] as const;

const STATES: Record<string, string[]> = {
  Rajasthan: ['Jaipur', 'Sikar', 'Jhunjhunu', 'Alwar', 'Bikaner'],
  'Uttar Pradesh': ['Agra', 'Mathura', 'Kanpur Nagar', 'Lucknow', 'Etawah'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur', 'Darbhanga'],
  'Madhya Pradesh': ['Gwalior', 'Bhind', 'Morena', 'Indore', 'Bhopal'],
  Haryana: ['Hisar', 'Rohtak', 'Bhiwani', 'Karnal'],
  Punjab: ['Amritsar', 'Ludhiana', 'Patiala', 'Bathinda'],
  Maharashtra: ['Nagpur', 'Pune', 'Nashik', 'Chhatrapati Sambhajinagar'],
  'West Bengal': ['Kolkata', 'Howrah', 'Darjeeling'],
  Assam: ['Kamrup', 'Dibrugarh'],
  Uttarakhand: ['Dehradun', 'Almora', 'Pauri Garhwal'],
  'Tamil Nadu': ['Chennai', 'Madurai'],
  Kerala: ['Ernakulam', 'Thrissur'],
};

const VILLAGES = ['Rampur', 'Shyampur', 'Kishangarh', 'Shivpuri', 'Hanuman Nagar', 'Gopalpura', 'Bhojpur', 'Devnagar', 'Madhoganj', 'Surajgarh', 'Laxmipur', 'Chandpur'];
const EDUCATION = ['10th Pass', '12th Pass', '12th Pass', 'BA', 'BA', 'BSc', 'BCom', 'ITI'] as const;
const BLOOD = ['O+', 'O+', 'B+', 'B+', 'A+', 'AB+', 'O-', 'A-'] as const;
const CATEGORY = [['General', 38], ['OBC', 32], ['SC', 15], ['ST', 8], ['EWS', 7]] as const;
const REC_CENTERS = ['STC Tekanpur', 'RTC Delhi', 'BTC Bhanu', 'STT Kashmir'] as const;
const KIT_ITEMS = ['OG Uniform', 'BPT Dress', 'PT Shoes', 'Beret Cap', 'Belt', 'Kit Bag', 'Water Bottle', 'Bedding Set'];

const STAFF_SEED = [
  { name: 'Rajendra Prasad', rank: 'Insp', spec: 'DEV Law & Order', status: 'active' },
  { name: 'Devi Singh Rathore', rank: 'SI', spec: 'DEV Field Craft', status: 'active' },
  { name: 'Suresh Yadav', rank: 'HC', spec: 'DEV Weapon Handling', status: 'active' },
  { name: 'Anil Sharma', rank: 'HC', spec: 'DEV First Aid', status: 'active' },
  { name: 'Vikram Singh', rank: 'HC', spec: 'DEV PT', status: 'active' },
  { name: 'Sanjeev Kumar', rank: 'HC', spec: 'DEV Drill', status: 'active' },
  { name: 'Pramod Kumar', rank: 'NK', spec: 'DEV Drill', status: 'leave' },
  { name: 'Rohit Verma', rank: 'CT', spec: 'DEV BSF Ethics', status: 'td' },
  { name: 'Manoj Kumar', rank: 'NK', spec: 'DEV Map Reading', status: 'active' },
  { name: 'Gurmeet Singh', rank: 'CT', spec: 'DEV Field Craft', status: 'active' },
  { name: 'Deepak Choudhary', rank: 'CT', spec: 'DEV PT', status: 'active' },
  { name: 'Sachin Kumar', rank: 'CT', spec: 'DEV Weapon Handling', status: 'active' },
  { name: 'Ramesh Chandra', rank: 'NK', spec: 'DEV First Aid', status: 'active' },
  { name: 'Anuj Pratap Singh', rank: 'HC', spec: 'DEV Map Reading', status: 'active' },
  { name: 'Mohan Lal', rank: 'CT', spec: 'DEV Drill', status: 'hospital' },
  { name: 'Harish Rawat', rank: 'CT', spec: 'DEV BSF Ethics', status: 'active' },
  { name: 'Kishor Singh', rank: 'NK', spec: 'DEV PT', status: 'leave' },
  { name: 'Irfan Khan', rank: 'CT', spec: 'DEV Weapon Handling', status: 'active' },
  { name: 'Baldev Singh', rank: 'HC', spec: 'DEV Field Craft', status: 'active' },
  { name: 'Nitin Tyagi', rank: 'CT', spec: 'DEV Map Reading', status: 'active' },
] as const;

const SUBJECTS_SEED = [
  { name: 'DEV PT', code: 'DEV-PT', category: 'Outdoor', description: 'Physical training & endurance' },
  { name: 'DEV Drill', code: 'DEV-DRL', category: 'Outdoor', description: 'Squad drill with/without arms' },
  { name: 'DEV Weapon Handling', code: 'DEV-WP', category: 'Practical', description: 'INSAS/AK handling, stripping, assembling' },
  { name: 'DEV Map Reading', code: 'DEV-MAP', category: 'Theory', description: 'Map reading & GPS navigation' },
  { name: 'DEV First Aid', code: 'DEV-FA', category: 'Theory', description: 'Battlefield first aid & evacuation' },
  { name: 'DEV Law & Order', code: 'DEV-LAW', category: 'Indoor', description: 'BSF Act, BSF Rules, duties' },
  { name: 'DEV Field Craft', code: 'DEV-FC', category: 'Outdoor', description: 'Camouflage, concealment, patrolling' },
  { name: 'DEV BSF Ethics', code: 'DEV-ETH', category: 'Indoor', description: 'Force history, ethics & values' },
] as const;

const ABSENT_REASONS: Record<string, string[]> = {
  L: ['Ghar par urgent kaam', 'Shaadi attend karni thi', 'Matlab ka kaam ghar par'],
  S: ['Fever & weakness', 'Viral infection', 'Stomach infection', 'Body ache & cold'],
  A: ['Bina information ke absent', 'Roll call me gayab'],
  H: ['MH Gwalior refer', 'Knee injury — rest advised', 'Sprain — physio advised'],
};

const COMPLAINTS = [
  ['Fever & weakness', 'Viral fever', 'Paracetamol + rest 48 hrs'],
  ['Ankle sprain (PT)', 'Grade-I sprain', 'Crepe bandage, ice pack, no PT 3 days'],
  ['Cold & cough', 'URTI', 'Syrup + steam, light duty'],
  ['Stomach ache', 'Gastritis', 'Antacid, bland diet 2 days'],
  ['Headache', 'Tension headache', 'Analgesic + hydration'],
  ['Skin allergy (hands)', 'Contact dermatitis', 'Ointment + avoid detergent'],
  ['Knee pain', 'Overuse strain', 'Analgesic gel, no running 5 days'],
] as const;

// ─────────────────────────────────────────────
// PROGRESS TYPE
// ─────────────────────────────────────────────
export interface SeedProgress {
  step: string;
  done: number;
  total: number;
}

export type ProgressCb = (p: SeedProgress) => void;

// ─────────────────────────────────────────────
// COUNT / WIPE
// ─────────────────────────────────────────────

export const countDevSeedData = async (): Promise<{ collection: string; count: number }[]> => {
  const out: { collection: string; count: number }[] = [];
  for (const col of SEEDED_COLLECTIONS) {
    try {
      const q = query(collection(db, col), where(DEV_TAG, '==', true));
      const snap = await getDocs(q);
      if (snap.size > 0) out.push({ collection: col, count: snap.size });
    } catch { /* ignore */ }
  }
  return out;
};

export const wipeTestBatch = async (onProgress?: ProgressCb): Promise<number> => {
  let deleted = 0;
  let done = 0;
  for (const col of SEEDED_COLLECTIONS) {
    try {
      const q = query(collection(db, col), where(DEV_TAG, '==', true));
      const snap = await getDocs(q);
      const ids = snap.docs.map(d => d.id);
      for (let i = 0; i < ids.length; i += CHUNK) {
        const wb = writeBatch(db);
        ids.slice(i, i + CHUNK).forEach(id => wb.delete(doc(db, col, id)));
        await wb.commit();
        deleted += Math.min(CHUNK, ids.length - i);
      }
    } catch (err) { console.warn(`Wipe skip ${col}:`, err); }
    done += 1;
    onProgress?.({ step: `Wiping ${col}`, done, total: SEEDED_COLLECTIONS.length });
  }
  return deleted;
};

// ─────────────────────────────────────────────
// GENERATE
// ─────────────────────────────────────────────

type DocOp = { col: string; id?: string; data: Record<string, unknown> };

const writeAll = async (docs: DocOp[], onProgress?: ProgressCb): Promise<void> => {
  let done = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const wb = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(op => {
      const ref = op.id ? doc(db, op.col, op.id) : doc(collection(db, op.col));
      wb.set(ref, op.data);
    });
    await wb.commit();
    done += Math.min(CHUNK, docs.length - i);
    onProgress?.({ step: `Writing ${docs[Math.min(i, docs.length - 1)].col}`, done, total: docs.length });
  }
};

export const generateTestBatch = async (onProgress?: ProgressCb): Promise<{ totalDocs: number }> => {
  const docs: DocOp[] = [];
  const createdAt = `${BATCH_START}T05:30:00.000Z`;
  const tag = { [DEV_TAG]: true };

  // ═══ 1. BATCH (completed — purane batch jaisa) ═══
  docs.push({
    col: 'batches', id: DEV_BATCH_ID,
    data: {
      batchNumber: DEV_BATCH_NUMBER,
      batchName: DEV_BATCH_NAME,
      status: 'completed',
      startDate: BATCH_START,
      endDate: BATCH_END,
      description: '🧪 Developer testing batch — auto-generated demo data. SIRF dev account ko dikhta hai.',
      totalTrainees: 100,
      createdAt,
      createdBy: 'dev-seed',
      completedAt: `${BATCH_END}T10:00:00.000Z`,
      completedBy: 'dev-seed',
      ...tag,
    },
  });

  // ═══ 2. TRAINEES (100, full details) ═══
  interface TBasic { id: string; name: string; chestNo: string; regNo: string; platoon: string }
  const trainees: TBasic[] = [];

  for (let i = 0; i < 100; i++) {
    const religion = weighted(RELIGION_PICK);
    const pool = NAME_POOLS[religion];
    const isFemale = i % 13 === 0; // ~8 female trainees
    const first = pick(isFemale ? pool.female : pool.male);
    const surname = pick(pool.surnames);
    const name = religion === 'Sikh'
      ? `${first} ${isFemale ? 'Kaur' : 'Singh'}`
      : `${first} ${surname}`;
    const fatherName = `${pick(pool.male)} ${religion === 'Sikh' ? 'Singh' : pick(pool.surnames)}`;
    const motherName = `${pick(pool.mothers)}${religion === 'Hindu' ? ' Devi' : ''}`;

    const state = pick(Object.keys(STATES));
    const district = pick(STATES[state]);
    const chestNo = String(8801 + i);
    const regNo = `DEV26${String(i + 1).padStart(3, '0')}`;
    const platoon = `Platoon ${(i % 3) + 1}`;
    const section = `Section ${'ABC'[i % 3]}`;
    const dobYear = rand(1999, 2004);
    const dob = `${dobYear}-${pad2(rand(1, 12))}-${pad2(rand(1, 28))}`;
    const fptPass = chance(86);
    const weeklyPass = chance(82);

    const tRef = doc(collection(db, 'trainees'));
    trainees.push({ id: tRef.id, name, chestNo, regNo, platoon });

    docs.push({
      col: 'trainees', id: tRef.id,
      data: {
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER, batchName: DEV_BATCH_NAME,
        name, fatherName, motherName,
        dob, age: String(2026 - dobYear),
        gender: isFemale ? 'Female' : 'Male',
        bloodGroup: pick(BLOOD),
        religion, category: weighted(CATEGORY),
        maritalStatus: weighted([['Unmarried', 78], ['Married', 22]] as const),
        regNo, chestNo,
        aadharNo: digits(12), panNo: chance(40) ? `DEVPX${digits(4)}X` : '',
        mobileNo: mobile(),
        emergencyContact: mobile(),
        emergencyContactName: fatherName,
        relationship: 'Father',
        village: `Village ${pick(VILLAGES)}`,
        tehsil: district, district, state,
        pinCode: digits(6),
        education: pick(EDUCATION),
        boardUniversity: pick(['RBSE', 'CBSE', 'UP Board', 'BSEB', 'MP Board'] as const),
        passingYear: String(rand(2018, 2023)),
        percentage: String(rand(52, 88)),
        recruitmentCenter: pick(REC_CENTERS),
        joinDate: BATCH_START,
        platoon, section,
        height: String(rand(165, 182)),
        weight: String(rand(55, 78)),
        chest: `${rand(82, 96)}`,
        medStat: weighted([['SHAPE-1', 88], ['SHAPE-2', 9], ['Temporary Unfit', 3]] as const),
        medRemarks: '',
        attn: weighted([['P', 85], ['L', 5], ['S', 4], ['A', 3], ['M', 3]] as const),
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
        weaponNo: `DEVW-${8801 + i}`,
        docsComplete: chance(94),
        documents: {},
        rank: 'RCT',
        photoURL: '', photoPath: '',
        remarks: '',
        createdAt, createdBy: 'dev-seed',
        ...tag,
      },
    });
  }

  // ═══ 3. STAFF (8) ═══
  const staffIds: { id: string; name: string; rank: string; forceNumber: string; status: string }[] = [];
  STAFF_SEED.forEach((s, i) => {
    const sRef = doc(collection(db, 'staff'));
    const forceNumber = `88${digits(6)}`;
    staffIds.push({ id: sRef.id, name: s.name, rank: s.rank, forceNumber, status: s.status });
    docs.push({
      col: 'staff', id: sRef.id,
      data: {
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
        forceNumber, name: s.name, rank: s.rank,
        company: 'F Coy (DEV)', category: 'Combatised', battalion: 'DEV BN 01',
        mobile: mobile(), email: '',
        dateOfJoining: `${rand(2012, 2020)}-${pad2(rand(1, 12))}-10`,
        dateOfPosting: '2025-12-15',
        experienceYears: rand(4, 16),
        qualification: pick(['Graduate', '12th Pass', 'BP Ed', 'MA'] as const),
        bloodGroup: pick(BLOOD),
        emergencyContact: { name: 'Family', relation: 'Self', mobile: mobile(), address: district0() },
        status: s.status,
        photoURL: '', remarks: i === 6 ? 'EL par (demo)' : i === 7 ? 'Deputation/TD (demo)' : '',
        createdAt, createdBy: 'dev-seed',
        ...tag,
      },
    });
  });

  function district0(): string { return pick(STATES['Madhya Pradesh']); }

  // ═══ 4. SUBJECTS + ASSIGNMENTS ═══
  const subjectRefs: { id: string; name: string; code: string }[] = [];
  SUBJECTS_SEED.forEach(sub => {
    const ref = doc(collection(db, 'subject_master'));
    subjectRefs.push({ id: ref.id, name: sub.name, code: sub.code });
    docs.push({
      col: 'subject_master', id: ref.id,
      data: { ...sub, isActive: true, createdBy: 'dev-seed', ...tag },
    });
  });

  staffIds.forEach((st, i) => {
    const subj = subjectRefs[i % subjectRefs.length];
    docs.push({
      col: 'staff_subjects',
      data: {
        staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
        subjectId: subj.id, subjectName: subj.name, subjectCode: subj.code,
        assignedDate: BATCH_START, assignedBy: 'dev-seed', isActive: true, remarks: '',
        ...tag,
      },
    });
  });

  // ═══ 5. TRAINING TESTS (FPT + 2 Weekly — pass/fail) ═══
  const gradeOf = (pct: number): string =>
    pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';

  const instName = (i: number) => `${STAFF_SEED[i].rank} ${STAFF_SEED[i].name}`;

  // ── 5a. FPT (week 12) ──
  const fptEvents = [
    { name: '5 KM Running', maxMarks: 40, passingMarks: 20, isRunning: true },
    { name: 'Push Ups (1 min)', maxMarks: 30, passingMarks: 12 },
    { name: 'Sit Ups (1 min)', maxMarks: 30, passingMarks: 12 },
  ];
  const fptDate = '2026-04-24';
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
      return { ...e, marks, passed, runningGrade: e.isRunning ? (marks >= 34 ? 'Excellent' : marks >= 28 ? 'Very Good' : marks >= 20 ? 'Good' : 'Fail') : undefined };
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

  docs.push({
    col: 'training_tests',
    data: testDoc('fpt', 'FPT — April (Pass/Fail)', 'DEV-PT', 12, fptDate, fptResults as never[], 100, 60, instName(0)),
  });

  // ── 5b/5c. Weekly tests ──
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
    return { col: 'training_tests', data: testDoc('weekly', name, code, week, date, results as never[], 100, 40, instName(instI)) };
  };

  docs.push(weeklyTest('Weapon Handling — Written', 'DEV-WP', 8, '2026-03-27', 1));
  docs.push(weeklyTest('Map Reading — Theory', 'DEV-MAP', 15, '2026-06-12', 2));

  function testDoc(
    testType: string, testName: string, subjectCode: string, weekNumber: number,
    date: string, results: Record<string, unknown>[], totalMarks: number, passingMarks: number,
    instructor: string,
  ) {
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status === 'fail').length;
    const absent = results.filter(r => r.status === 'absent').length;
    const present = results.filter(r => r.status !== 'absent');
    const avg = present.length ? Math.round(present.reduce((s, r) => s + (r.marks as number), 0) / present.length) : 0;
    return {
      batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
      testType, testName, subjectCode,
      description: 'Dev seeded demo test',
      weekNumber, testDate: date,
      startTime: '0600', endTime: '0830', venue: 'DEV Parade Ground',
      platoon: 'All Platoons (Whole Company)',
      totalMarks, passingMarks, passingPercent: (passingMarks / totalMarks) * 100,
      ...(testType === 'fpt' ? { fptEvents, overallPassPercent: 50 } : {}),
      instructorId: '', instructorName: instructor,
      results, averageScore: avg, passCount: pass, failCount: fail, absentCount: absent,
      status: 'completed', remarks: 'Auto-generated demo',
      createdAt, updatedAt: createdAt, createdBy: 'dev-seed',
      ...tag,
    };
  }

  // ═══ 6. ABSENT + MEDICAL RECORDS ═══
  for (let i = 0; i < 20; i++) {
    const t = trainees[rand(0, 99)];
    const type = weighted([['L', 35], ['S', 35], ['A', 12], ['H', 18]] as const);
    const from = randomDateStr('2026-03-01', '2026-06-30');
    const days = rand(1, 9);
    docs.push({
      col: 'absentRecords',
      data: {
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo, platoon: t.platoon,
        type, reason: pick(ABSENT_REASONS[type]),
        fromDate: from, toDate: dayAfter(from, days), totalDays: days,
        status: 'Returned', remarks: '',
        enteredBy: 'dev-seed', createdAt,
        ...tag,
      },
    });
  }

  for (let i = 0; i < 15; i++) {
    const t = trainees[rand(0, 99)];
    const [complaint, diagnosis, treatment] = pick([...COMPLAINTS]);
    docs.push({
      col: 'medicalRecords',
      data: {
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, platoon: t.platoon,
        complaint, diagnosis, treatment,
        category: 'Sick Report',
        date: randomDateStr('2026-02-10', '2026-07-15'),
        status: 'Recovered',
        doctorRemarks: 'Fit for duty after rest',
        enteredBy: 'dev-seed', createdAt,
        ...tag,
      },
    });
  }

  // ═══ 7. STAFF ATTENDANCE / LEAVE / DUTY  (Timestamps!) ═══
  const attDates = ['2026-03-02', '2026-03-09', '2026-04-06', '2026-05-04'];
  staffIds.forEach(st => {
    attDates.forEach(dStr => {
      const status = st.status === 'leave' && (dStr === '2026-04-06') ? 'leave'
        : weighted([['present', 92], ['absent', 4], ['leave', 4]] as const);
      docs.push({
        col: 'staff_attendance',
        data: {
          staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
          date: Timestamp.fromDate(new Date(`${dStr}T00:00:00`)),
          status, remarks: '', markedBy: 'dev-seed',
          markedAt: Timestamp.fromDate(new Date(`${dStr}T07:30:00`)),
          batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
          ...tag,
        },
      });
    });
  });

  staffIds.slice(0, 3).forEach((st, i) => {
    const from = `2026-0${4 + i}-0${3 + i}`;
    const days = rand(3, 8);
    docs.push({
      col: 'staff_leave',
      data: {
        staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
        leaveType: pick(['CL', 'EL'] as const),
        fromDate: Timestamp.fromDate(new Date(`${from}T00:00:00`)),
        toDate: Timestamp.fromDate(new Date(`${dayAfter(from, days)}T00:00:00`)),
        totalDays: days,
        reason: 'Personal work (demo)',
        status: 'approved',
        appliedAt: Timestamp.fromDate(new Date(`${from}T08:00:00`)),
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
        ...tag,
      },
    });
  });

  const DUTIES = ['Gate Guard', 'Quarter Guard', 'Mess Duty', 'Night Check', 'Armoury Duty'] as const;
  staffIds.forEach((st, i) => {
    const dStr = dayAfter('2026-03-15', i);
    docs.push({
      col: 'staff_duty',
      data: {
        staffId: st.id, staffName: `${st.rank} ${st.name}`, forceNumber: st.forceNumber,
        dutyTypeId: `dev_duty_${i}`, dutyTypeName: DUTIES[i % DUTIES.length],
        date: Timestamp.fromDate(new Date(`${dStr}T00:00:00`)),
        status: 'completed', remarks: '',
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
        ...tag,
      },
    });
  });

  // ═══ 8. TRAINING SCHEDULE (12) ═══
  const SCHED = [
    ['0545-0630', 'DEV PT', 0], ['0700-0800', 'DEV Drill', 6],
    ['0900-1000', 'DEV Weapon Handling', 1], ['1030-1130', 'DEV Map Reading', 2],
    ['1200-1300', 'DEV Law & Order', 3], ['1600-1700', 'DEV Field Craft', 5],
  ] as const;
  for (let w = 0; w < 12; w++) {
    const [time, subject, si] = SCHED[w % SCHED.length];
    docs.push({
      col: 'training_schedule',
      data: {
        batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
        subject, instructor: instName(si),
        time, date: dayAfter('2026-02-03', w * 7),
        status: 'Completed', remarks: '',
        ...tag,
      },
    });
  }

  // ═══ 9. DEPUTATION (3) ═══
  const deputed = staffIds[7];
  docs.push({
    col: 'deputation_records',
    data: {
      batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
      direction: 'outgoing', staffId: deputed.id, staffName: `${deputed.rank} ${deputed.name}`,
      staffRank: deputed.rank, staffForceNumber: deputed.forceNumber, staffCategory: 'Combatised',
      fromCompany: 'F Coy (DEV)', toCompany: 'D Coy (DEV)',
      purpose: 'Training support (demo)', eventDetail: 'Weapon refresher course',
      fromDate: '2026-05-01', toDate: '2026-06-30', status: 'completed', remarks: '',
      ...tag,
    },
  });

  // ═══ 10. WEEKLY PROGRAMS (4) ═══
  for (let w = 0; w < 4; w++) {
    const from = dayAfter('2026-02-02', w * 7);
    const program: Record<string, unknown> = {
      batchId: DEV_BATCH_ID, batchNumber: DEV_BATCH_NUMBER,
      weekName: `Week ${w + 1}`, weekNumber: w + 1,
      fromDate: from, toDate: dayAfter(from, 5),
      displayDateRange: `${from} — ${dayAfter(from, 5)}`,
      admNco: instName(0), admSo: '', teaBreak: '1030-1045',
      gameTime: '1700-1800', rollCall: '0545', distribution: '2045',
      remarks: 'Dev seeded program',
      schedule: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => ({
        day,
        sessions: SCHED.slice(0, 4).map(([time, subject, si], idx) => ({
          time, subject, instructor: instName((si + w) % 8), venue: idx < 2 ? 'Parade Ground' : 'Class Room 2',
        })),
      })),
      createdAt, createdBy: 'dev-seed',
      ...tag,
    };
    docs.push({ col: 'weeklyPrograms', data: program });
  }

  // ═══ WRITE ALL ═══
  await writeAll(docs, onProgress);
  return { totalDocs: docs.length };
};
