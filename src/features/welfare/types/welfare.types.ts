// ═══════════════════════════════════════════════════════════
// WELFARE & DEMOGRAPHICS — TYPES
// ───────────────────────────────────────────────────────────
// PURPOSE (Niyam):
//   Ye module trainees ki PEHLE SE MAUJOOD registration details
//   (Trainee Profile Registration Form) ko hi read karta hai.
//   Koi bhi NAYI personal detail alag se nahi maangi jaati.
//
//   Iska ekmatr uddeshya WELFARE PLANNING hai —
//   festival/holiday par ration, mithai, chhutti, puja arrangement,
//   mess menu aur extra welfare grant plan karna.
//
//   ⚠ Ye kisi bhi prakar ke bhedbhav (discrimination) ke liye
//     istemaal nahi hoga. Sirf aggregate counts + welfare planning.
// ═══════════════════════════════════════════════════════════

/** Trainee shape jo Firestore `trainees` collection se aata hai */
export interface WelfareTrainee {
  id: string;

  // Identity
  name?: string;
  chestNo?: string;
  regNo?: string;
  rank?: string;
  photoURL?: string;

  // Batch link
  batchId?: string;
  batchNumber?: string;
  batchName?: string;

  // Personal (registration form Step-1)
  gender?: string;
  religion?: string;
  category?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  dob?: string;
  age?: string;
  fatherName?: string;

  // Address (registration form Step-2)
  village?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  mobileNo?: string;
  emergencyContact?: string;

  // Education (Step-3)
  education?: string;

  // Training (Step-4)
  platoon?: string;
  section?: string;
  joinDate?: string;
  medStat?: string;

  [key: string]: any;
}

/** Har wo dimension jispar count/filter lag sakta hai */
export type DimensionKey =
  | 'state'
  | 'religion'
  | 'language'
  | 'zone'
  | 'district'
  | 'category'
  | 'gender'
  | 'bloodGroup'
  | 'education'
  | 'maritalStatus'
  | 'ageBand'
  | 'platoon'
  | 'section'
  | 'medStat';

export interface DimensionDef {
  key: DimensionKey;
  /** Firestore field jisse value aati hai ('-' = derived) */
  sourceField: string;
  label: string;
  hindiLabel: string;
  /** true = hamesha screen par dikhega, hataya nahi ja sakta */
  pinned: boolean;
  /** true = ye field form me nahi hai, state se auto-derive hoti hai */
  derived: boolean;
  /** Tailwind accent colour token */
  accent: string;
  hint: string;
}

export interface BucketStat {
  /** Normalised display value, e.g. 'West Bengal' */
  value: string;
  count: number;
  /** % of KNOWN (non-missing) records */
  percent: number;
  /** true = 'Not Recorded' bucket */
  isMissing?: boolean;
}

export interface DimensionStat {
  key: DimensionKey;
  label: string;
  hindiLabel: string;
  /** kitne trainees is set me the */
  total: number;
  /** jinke paas value thi */
  known: number;
  /** jinke paas value nahi thi */
  missing: number;
  /** distinct value count (missing ko chhod kar) */
  distinct: number;
  buckets: BucketStat[];
}

/** Active filter state */
export interface WelfareFilters {
  /** 'ALL' ya koi batch id */
  batchId: string;
  search: string;
  /** dimension -> selected values (OR within, AND across dimensions) */
  selections: Partial<Record<DimensionKey, string[]>>;
}

// ─────────────────────────────────────────────
// FESTIVAL / WELFARE CALENDAR
// ─────────────────────────────────────────────

export type FestivalKind =
  | 'National'
  | 'Religious'
  | 'Regional'
  | 'Harvest';

export interface FestivalDef {
  id: string;
  name: string;
  hindiName: string;
  /** ISO yyyy-mm-dd */
  date: string;
  kind: FestivalKind;
  /** khaali = sabhi dharm */
  religions: string[];
  /** khaali = poora Bharat */
  states: string[];
  /**
   * ANY  → religion match YA state match (jaise Baisakhi)
   * ALL  → dono match zaroori (jaise Chhath = Hindu + Bihar/UP/JH)
   */
  mode: 'ANY' | 'ALL';
  /** Welfare officer ke liye suggestion */
  welfareNote: string;
  emoji: string;
}

export interface FestivalPlan {
  festival: FestivalDef;
  /** aaj se kitne din baad */
  daysAway: number;
  eligibleCount: number;
  eligible: WelfareTrainee[];
  /** eligible trainees ka state-wise breakup (top few) */
  topStates: BucketStat[];
  estimatedBudget: number;
}

export interface WelfareSummary {
  totalTrainees: number;
  filteredTrainees: number;
  statesCovered: number;
  religionsCovered: number;
  languagesCovered: number;
  /** 0-100, kitna % personal data bhara hua hai */
  dataCompleteness: number;
  /** jinki state ya religion missing hai */
  incompleteRecords: number;
}
