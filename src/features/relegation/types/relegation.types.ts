// ═══════════════════════════════════════════════════════════════
// RELEGATION — BSF trainee lifecycle
// ───────────────────────────────────────────────────────────────
// Fauj me jab trainee serious injury / medical / kisi wajah se
// current batch ki training puri nahi kar sakta, usko RELEGATE
// karte hain. Destination batch US TIME MALUM NAHI hota —
// kab thik honge, tab jo batch chal raha hoga usme aayenge.
//
// Phase 1  RELEGATE  → RelID milta hai, trainee current batch
//                      se strength se nikalta hai, data freeze.
// Phase 2  REJOIN    → naya batch RelID daalta hai, full data
//                      sync, chestNo + "R" (duplicate se bachaav),
//                      purane batch pe stamp: "is batch me aa gaya".
// ═══════════════════════════════════════════════════════════════

export const RELEGATION_REASONS = [
  'Medical — Injury',
  'Medical — Illness',
  'Medical — Hospitalization',
  'Medical Board / Unfit for current batch',
  'Discipline',
  'Poor Performance / Backlog',
  'Family Emergency',
  'Legal / Court',
  'Administrative',
  'Other',
] as const;

export type RelegationReason = (typeof RELEGATION_REASONS)[number];

export type RelegationStatus = 'awaiting_rejoin' | 'rejoined' | 'cancelled';

export type TrainingStatus = 'active' | 'relegated' | 'completed' | 'discharged';

export interface TraineeSnapshot {
  name?: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  age?: string;
  gender?: string;
  bloodGroup?: string;
  religion?: string;
  category?: string;
  maritalStatus?: string;
  regNo?: string;
  aadharNo?: string;
  panNo?: string;
  mobileNo?: string;
  emergencyContact?: string;
  emergencyContactName?: string;
  relationship?: string;
  village?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  education?: string;
  boardUniversity?: string;
  passingYear?: string;
  percentage?: string;
  recruitmentCenter?: string;
  height?: string;
  weight?: string;
  chest?: string;
  shoeSize?: string;
  dressSize?: string;
  photoURL?: string;
  photoPath?: string;
  documents?: Record<string, unknown>;
  rank?: string;
  medStat?: string;
  medRemarks?: string;
  fptResult?: string;
  fptScore?: string;
  weeklyExamResult?: string;
  weeklyExamMarks?: string;
  punishments?: string;
  weaponQual?: string;
  ptScore?: string;
}

export interface RejoinStamp {
  rejoinedAt: string;
  rejoinedBatchId: string;
  rejoinedBatchNumber: string;
  rejoinedBatchName?: string;
  rejoinedChestNo: string;
  rejoinedTraineeId: string;
  rejoinedBy?: string;
  rejoinedByName?: string;
}

export interface RelegationRecord {
  id: string;
  /** Human RelID, e.g. REL-2026-25-K7M2 — paper pe likhne wala. */
  relegateId: string;
  status: RelegationStatus;

  fromTraineeId: string;
  fromBatchId: string;
  fromBatchNumber: string;
  fromBatchName?: string;
  fromChestNo: string;
  fromPlatoon?: string;
  fromSection?: string;

  traineeName: string;
  fatherName?: string;
  regNo?: string;
  photoURL?: string;

  reason: RelegationReason | string;
  details: string;
  authority: string;
  orderNo: string;
  medicalNote?: string;
  completedSubjects?: string;
  remainingSubjects?: string;

  snapshot: TraineeSnapshot;

  relegatedAt: string;
  relegatedBy: string;
  relegatedByName: string;

  toBatchId?: string;
  toBatchNumber?: string;
  toBatchName?: string;
  toTraineeId?: string;
  toChestNo?: string;
  toPlatoon?: string;
  rejoinedAt?: string;
  rejoinedBy?: string;
  rejoinedByName?: string;

  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;

  isDevData?: boolean;
}

export interface RelegateInput {
  traineeId: string;
  reason: RelegationReason | string;
  details: string;
  authority: string;
  orderNo: string;
  medicalNote?: string;
  completedSubjects?: string;
  remainingSubjects?: string;
}

export interface RejoinInput {
  relegateId: string;
  platoon: string;
  section: string;
  /** Override auto chest (default = originalChest + "R"). */
  chestNo?: string;
  remarks?: string;
}

export interface RejoinResult {
  relegateId: string;
  newTraineeId: string;
  newChestNo: string;
  toBatchNumber: string;
  fromBatchNumber: string;
  traineeName: string;
}
