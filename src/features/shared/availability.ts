// ═══════════════════════════════════════════════════════════════════════
// AVAILABILITY ENGINE — POORE APP KA SINGLE SOURCE OF TRUTH
// ───────────────────────────────────────────────────────────────────────
// Problem jo ye fix karta hai:
//   Trainee dashboard sirf `periodAttendance` padh raha tha. Jis din
//   period attendance mark nahi hui (ya hoti hi nahi), us din har trainee
//   "available / present" dikh raha tha — chahe clerk ne uski sick report
//   approve karke MI room register me daal diya ho. Yani ek hi trainee
//   CC dashboard par "Sick" aur trainee dashboard par "Present" tha.
//
// Ab har screen yahi engine use karti hai. Ek trainee ka aaj ka status
// teen source se nikalta hai, is priority me:
//
//   1. medicalRecords  — Active record aur aaj ki date uske andar
//      (MI room / hospital / B-C rest / medical board)
//   2. absentRecords   — Active record aur aaj ki date fromDate..toDate me
//      (absent / leave / sick / hospital / rest)
//   3. trainees.attn   — live nominal-roll field (fallback)
//
// Jo bhi milta hai wahi code sab jagah dikhta hai: CC dashboard, clerk
// dashboard, trainee dashboard, report picker, platoon view — sab sync.
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

/** Ek trainee ka duty status. 'P' = poori tarah available. */
export type AttnCode = 'P' | 'A' | 'L' | 'S' | 'H' | 'R' | 'M';

export interface AttnMeta {
  code: AttnCode;
  label: string;
  shortLabel: string;
  /** Duty ke liye uplabdh hai? 'P' ke alawa sab false. */
  available: boolean;
  icon: string;
  color: string;
  bgColor: string;
  /** Tailwind border for list rows */
  rowBorder: string;
}

export const ATTN_META: Record<AttnCode, AttnMeta> = {
  P: { code: 'P', label: 'Present / Available', shortLabel: 'Present', available: true,
       icon: '✅', color: 'text-emerald-700', bgColor: 'bg-emerald-100 border-emerald-300', rowBorder: 'border-l-emerald-500' },
  A: { code: 'A', label: 'Absent (Unauthorized)', shortLabel: 'Absent', available: false,
       icon: '🚫', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', rowBorder: 'border-l-red-500' },
  L: { code: 'L', label: 'Leave / Chutti', shortLabel: 'Leave', available: false,
       icon: '✈️', color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300', rowBorder: 'border-l-amber-500' },
  S: { code: 'S', label: 'Sick / MI Room', shortLabel: 'Sick', available: false,
       icon: '🤒', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', rowBorder: 'border-l-orange-500' },
  H: { code: 'H', label: 'Hospital Admitted', shortLabel: 'Hospital', available: false,
       icon: '🏥', color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-300', rowBorder: 'border-l-purple-500' },
  R: { code: 'R', label: 'B/C Rest (Light Duty)', shortLabel: 'Rest', available: false,
       icon: '🛌', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', rowBorder: 'border-l-blue-500' },
  M: { code: 'M', label: 'Medical Appointment / Board', shortLabel: 'Med Appt', available: false,
       icon: '🩺', color: 'text-teal-700', bgColor: 'bg-teal-100 border-teal-300', rowBorder: 'border-l-teal-500' },
};

export const attnMeta = (code?: string): AttnMeta =>
  ATTN_META[(code || 'P') as AttnCode] || ATTN_META.P;

/** Kisi bhi gande/purane string ko saaf code me badalta hai. */
export const normalizeAttn = (value?: string): AttnCode => {
  const v = String(value ?? 'P').trim().toLowerCase();
  if (!v) return 'P';
  if (v === 'p' || v.includes('present') || v.includes('available') || v === 'fit') return 'P';
  if (v === 'a' || v.includes('absent')) return 'A';
  if (v === 'l' || v.includes('leave') || v.includes('chutti') || v.includes('away')) return 'L';
  if (v === 'h' || v.includes('hospital') || v.includes('admit')) return 'H';
  if (v === 'r' || v.includes('rest')) return 'R';
  if (v === 'm' || v.includes('board') || v.includes('appoint')) return 'M';
  if (v === 's' || v.includes('sick') || v.includes('mi')) return 'S';
  return 'P';
};

/** Medical register ki category → duty code. */
export const attnFromMedicalCategory = (category?: string): AttnCode => {
  const c = String(category || '').toLowerCase();
  if (c.includes('hospital')) return 'H';
  if (c.includes('rest')) return 'R';
  if (c.includes('board') || c.includes('appoint')) return 'M';
  return 'S';
};

const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Date-range check. Records me toDate blank ho sakti hai (open-ended
 * leave/hospital) — us case me record aaj bhi chal raha maana jayega.
 */
const coversDate = (from: string | undefined, to: string | undefined, date: string): boolean => {
  const f = (from || '').slice(0, 10);
  const t = (to || '').slice(0, 10);
  if (f && date < f) return false;   // abhi shuru hi nahi hua
  if (t && date > t) return false;   // khatam ho chuka
  return true;
};

export interface AvailabilityEntry {
  traineeId: string;
  code: AttnCode;
  meta: AttnMeta;
  available: boolean;
  /** Kyun away hai — reason / diagnosis / category */
  reason: string;
  fromDate: string;
  toDate: string;
  totalDays: number | null;
  /** Kis collection se aaya — debugging + UI hint ke liye */
  source: 'medical' | 'absent' | 'roster';
}

export interface AvailabilityInput {
  trainees: Array<Record<string, any>>;
  absentRecords: Array<Record<string, any>>;
  medicalRecords: Array<Record<string, any>>;
  /** Kis din ka status chahiye. Default = aaj. */
  date?: string;
}

/**
 * Har trainee ka aaj ka asli status nikaalta hai.
 * Return: { [traineeId]: AvailabilityEntry }
 */
export const buildAvailabilityMap = (
  { trainees, absentRecords, medicalRecords, date }: AvailabilityInput,
): Record<string, AvailabilityEntry> => {
  const day = (date || todayISO()).slice(0, 10);
  const map: Record<string, AvailabilityEntry> = {};

  // ── 1. Medical sabse upar. MI room / hospital ka record ho to wahi sach. ──
  const medByTrainee: Record<string, any> = {};
  for (const m of medicalRecords) {
    const tid = m.traineeId;
    if (!tid) continue;
    const status = String(m.status || '').toLowerCase();
    // 'Fit / Discharged' ya 'Closed' wale khatam ho chuke hain
    if (status.includes('fit') || status.includes('discharg') || status.includes('closed')) continue;
    // Record ki date aaj se aage ki hai to abhi lagu nahi
    const mFrom = (m.date || m.fromDate || '').slice(0, 10);
    if (mFrom && day < mFrom) continue;
    // Recommended days se end date nikaalo (agar toDate na ho)
    let mTo = (m.toDate || '').slice(0, 10);
    if (!mTo && mFrom && Number(m.recommendedDays) > 0) {
      const d = new Date(mFrom);
      d.setDate(d.getDate() + Number(m.recommendedDays) - 1);
      mTo = d.toISOString().split('T')[0];
    }
    if (mTo && day > mTo) continue;
    // Ek trainee ke multiple active record ho to sabse naya lo
    const prev = medByTrainee[tid];
    if (!prev || String(m.date || '') > String(prev.date || '')) medByTrainee[tid] = { ...m, _to: mTo };
  }

  // ── 2. Absent records ──
  const absByTrainee: Record<string, any> = {};
  for (const r of absentRecords) {
    const tid = r.traineeId;
    if (!tid) continue;
    const status = String(r.status || 'Active').toLowerCase();
    if (status.includes('return') || status.includes('closed') || status.includes('cancel')) continue;
    if (!coversDate(r.fromDate, r.toDate, day)) continue;
    const prev = absByTrainee[tid];
    if (!prev || String(r.fromDate || '') > String(prev.fromDate || '')) absByTrainee[tid] = r;
  }

  // ── 3. Har trainee par resolve ──
  for (const t of trainees) {
    const tid = t.id;
    if (!tid) continue;

    const med = medByTrainee[tid];
    if (med) {
      const code = attnFromMedicalCategory(med.category);
      map[tid] = {
        traineeId: tid, code, meta: ATTN_META[code], available: false,
        reason: med.diagnosis || med.category || 'Medical',
        fromDate: (med.date || med.fromDate || '').slice(0, 10),
        toDate: med._to || '',
        totalDays: Number(med.recommendedDays) || null,
        source: 'medical',
      };
      continue;
    }

    const abs = absByTrainee[tid];
    if (abs) {
      const code = normalizeAttn(abs.type);
      const resolved: AttnCode = code === 'P' ? 'A' : code; // record hai to available nahi
      map[tid] = {
        traineeId: tid, code: resolved, meta: ATTN_META[resolved], available: false,
        reason: abs.reason || abs.remarks || ATTN_META[resolved].label,
        fromDate: (abs.fromDate || '').slice(0, 10),
        toDate: (abs.toDate || '').slice(0, 10),
        totalDays: Number(abs.totalDays) || null,
        source: 'absent',
      };
      continue;
    }

    // ── 4. Fallback: nominal roll ka live attn field ──
    // Purana attn hamesha ke liye chipka na rahe — agar lastStatusTo nikal
    // chuki hai to trainee wapas available maana jayega. Warna ek baar ki
    // chutti ke baad wo hamesha "Leave" dikhta rehta tha.
    let code = normalizeAttn(t.attn);
    const rosterTo = String(t.lastStatusTo || '').slice(0, 10);
    const rosterFrom = String(t.lastStatusFrom || '').slice(0, 10);
    if (code !== 'P' && ((rosterTo && day > rosterTo) || (rosterFrom && day < rosterFrom))) code = 'P';
    map[tid] = {
      traineeId: tid, code, meta: ATTN_META[code], available: code === 'P',
      reason: code === 'P' ? '' : (t.lastStatusReason || ATTN_META[code].label),
      fromDate: (t.lastStatusFrom || '').slice(0, 10),
      toDate: (t.lastStatusTo || '').slice(0, 10),
      totalDays: null,
      source: 'roster',
    };
  }

  return map;
};

export interface AvailabilitySummary {
  total: number;
  present: number;
  away: number;
  byCode: Record<AttnCode, number>;
  attendancePct: number;
}

export const summarizeAvailability = (
  trainees: Array<Record<string, any>>,
  map: Record<string, AvailabilityEntry>,
): AvailabilitySummary => {
  const byCode: Record<AttnCode, number> = { P: 0, A: 0, L: 0, S: 0, H: 0, R: 0, M: 0 };
  for (const t of trainees) {
    const e = map[t.id];
    byCode[e ? e.code : 'P']++;
  }
  const total = trainees.length;
  const present = byCode.P;
  return {
    total, present, away: total - present, byCode,
    attendancePct: total > 0 ? Math.round((present / total) * 100) : 0,
  };
};

/**
 * Ek call me batch ka poora availability data — trainees, absent aur
 * medical records saath me. Jo screen sirf status chahti hai wo ye use kare.
 */
export const fetchBatchAvailability = async (
  batchId: string,
  date?: string,
): Promise<{
  trainees: any[];
  absentRecords: any[];
  medicalRecords: any[];
  availability: Record<string, AvailabilityEntry>;
  summary: AvailabilitySummary;
}> => {
  const [tSnap, aSnap, mSnap] = await Promise.all([
    getDocs(query(collection(db, 'trainees'), where('batchId', '==', batchId))),
    getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', batchId))),
    getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', batchId))),
  ]);
  const trainees: any[] = []; tSnap.forEach(d => trainees.push({ id: d.id, ...d.data() }));
  const absentRecords: any[] = []; aSnap.forEach(d => absentRecords.push({ id: d.id, ...d.data() }));
  const medicalRecords: any[] = []; mSnap.forEach(d => medicalRecords.push({ id: d.id, ...d.data() }));

  const availability = buildAvailabilityMap({ trainees, absentRecords, medicalRecords, date });
  return { trainees, absentRecords, medicalRecords, availability, summary: summarizeAvailability(trainees, availability) };
};
