// ═══════════════════════════════════════════════════════════
// TRAINEE MODULE TYPES
// ═══════════════════════════════════════════════════════════

export interface TraineeAccount {
  id: string;
  traineeId: string;
  username: string;
  password: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export type AbsenceReportKind =
  // ── Trainee-specific (kisi ek trainee par lagta hai) ──
  | 'sick' | 'hospital' | 'pt_miss' | 'rest' | 'leave' | 'other'
  // ── General (kisi trainee ko select karne ki zaroorat nahi) ──
  | 'general_info' | 'complaint' | 'mess' | 'kit_issue' | 'maintenance'
  | 'suggestion' | 'urgent_help';
export type AbsenceActivity = 'PT' | 'Parade' | 'Class' | 'Full Day';
export type AbsentTypeCode = 'A' | 'L' | 'S' | 'H' | 'R' | 'M';

export interface TraineeUpdate {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo?: string;
  batchId: string;
  platoon: string;
  category: TraineeUpdateCategory;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  submittedBy: string;
  submittedByRole: string;
  submittedByUid?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  /** Trainee self-report: sick / PT miss / rest / leave */
  reportKind?: AbsenceReportKind;
  fromDate?: string;
  toDate?: string;
  activity?: AbsenceActivity;
  absentType?: AbsentTypeCode;
  appliedToAbsentId?: string;
  appliedToMedicalId?: string;
  appliedToNoticeId?: string;
  /** true = senior ne kisi aur trainee ke liye report ki */
  onBehalf?: boolean;
  reportedForChestNo?: string;
  /** true = general report — kisi ek trainee par nahi, poore group/company ke liye */
  isGeneral?: boolean;
}

export type TraineeUpdateCategory =
  | 'Medical Issue'
  | 'Leave Request'
  | 'Absent Report'
  | 'Discipline Issue'
  | 'Equipment Problem'
  | 'Personal Issue'
  | 'Training Feedback'
  | 'General Information'
  | 'Complaint'
  | 'Mess / Food'
  | 'Maintenance'
  | 'Suggestion'
  | 'Urgent Help'
  | 'Other';

export interface TraineeNotice {
  id: string;
  batchId: string;
  title: string;
  content: string;
  category: NoticeCategory;
  priority: 'normal' | 'important' | 'urgent';
  targetPlatoon: string;
  /** Specific trainees ko hi bhejna ho to unke ids. Khaali = poora platoon/batch. */
  targetTraineeIds?: string[];
  /** Display ke liye — "1092 Thomas Ekka, 1005 Sunil Sharma" */
  targetTraineeLabel?: string;
  publishedBy: string;
  publishedAt: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export type NoticeCategory =
  | 'Weekly Program'
  | 'Upcoming Exam'
  | 'Special Event'
  | 'Holiday'
  | 'General Notice'
  | 'Emergency'
  | 'Training Update';

export interface TraineeSession {
  accountId: string;
  traineeId: string;
  username: string;
  chestNo: string;
  name: string;
  platoon: string;
  batchId: string;
  batchName: string;
  loginTime: string;
}

// ─── RELEGATION ───────────────────────────────────────────
export interface RelegationRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;

  // From batch
  fromBatchId: string;
  fromBatchName: string;
  fromPlatoon: string;

  // To batch
  toBatchId: string;
  toBatchName: string;
  toPlatoon: string;

  // Relegation details
  reason: RelegationReason;
  reasonDetail: string;
  medicalCertificate: boolean;  // MC attached?
  authorityName: string;        // Who ordered relegation
  authorityRank: string;
  orderNumber: string;          // Order/letter reference

  // Status
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  completedAt?: string;

  // Remaining training
  remainingSubjects: string[];  // What training is left
  completedTraining: string[];  // What was completed before relegation

  // Meta
  createdAt: string;
  createdBy: string;
}

export type RelegationReason =
  | 'Medical - Injury'
  | 'Medical - Illness'
  | 'Medical - Hospitalization'
  | 'Discipline Issue'
  | 'Poor Performance'
  | 'Family Emergency'
  | 'Legal/Court Case'
  | 'Administrative'
  | 'Other';

// Config
export const UPDATE_CATEGORIES: { value: TraineeUpdateCategory; label: string; icon: string }[] = [
  { value: 'Medical Issue', label: 'Medical Issue', icon: '🏥' },
  { value: 'Leave Request', label: 'Leave Request', icon: '✈️' },
  { value: 'Absent Report', label: 'Absent Report', icon: '📋' },
  { value: 'Discipline Issue', label: 'Discipline Issue', icon: '⚖️' },
  { value: 'Equipment Problem', label: 'Equipment Problem', icon: '🔧' },
  { value: 'Personal Issue', label: 'Personal Issue', icon: '👤' },
  { value: 'Training Feedback', label: 'Training Feedback', icon: '📊' },
  { value: 'General Information', label: 'General Information', icon: 'ℹ️' },
  { value: 'Complaint', label: 'Complaint', icon: '📣' },
  { value: 'Mess / Food', label: 'Mess / Food', icon: '🍽️' },
  { value: 'Maintenance', label: 'Maintenance', icon: '🔨' },
  { value: 'Suggestion', label: 'Suggestion', icon: '💡' },
  { value: 'Urgent Help', label: 'Urgent Help', icon: '🚨' },
  { value: 'Other', label: 'Other', icon: '📝' },
];

export const NOTICE_CATEGORIES: { value: NoticeCategory; label: string; icon: string }[] = [
  { value: 'Weekly Program', label: 'Weekly Program', icon: '📅' },
  { value: 'Upcoming Exam', label: 'Upcoming Exam', icon: '📝' },
  { value: 'Special Event', label: 'Special Event', icon: '🎉' },
  { value: 'Holiday', label: 'Holiday', icon: '🏖️' },
  { value: 'General Notice', label: 'General Notice', icon: '📌' },
  { value: 'Emergency', label: 'Emergency', icon: '🚨' },
  { value: 'Training Update', label: 'Training Update', icon: '📚' },
];

export const RELEGATION_REASONS: { value: RelegationReason; label: string; icon: string }[] = [
  { value: 'Medical - Injury', label: 'Medical - Injury', icon: '🤕' },
  { value: 'Medical - Illness', label: 'Medical - Illness', icon: '🏥' },
  { value: 'Medical - Hospitalization', label: 'Medical - Hospitalization', icon: '🏨' },
  { value: 'Discipline Issue', label: 'Discipline Issue', icon: '⚖️' },
  { value: 'Poor Performance', label: 'Poor Performance', icon: '📉' },
  { value: 'Family Emergency', label: 'Family Emergency', icon: '👨‍👩‍👦' },
  { value: 'Legal/Court Case', label: 'Legal/Court Case', icon: '⚖️' },
  { value: 'Administrative', label: 'Administrative', icon: '📋' },
  { value: 'Other', label: 'Other', icon: '📝' },
];

export const PRIORITY_COLORS = {
  low: 'bg-blue-100 text-blue-700 border-blue-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  urgent: 'bg-red-100 text-red-700 border-red-300',
};

export const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export const RELEGATION_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-700',
};

export interface ReportKindMeta {
  value: AbsenceReportKind;
  label: string;
  icon: string;
  category: TraineeUpdateCategory;
  activity?: AbsenceActivity;
  absentType?: AbsentTypeCode;
  hint?: string;
  /** true = kisi trainee ko select karne ki zaroorat nahi (general baat) */
  general?: boolean;
  /** true = date range poochho (absence wale reports me) */
  needsDates?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export const ABSENCE_REPORT_KINDS: ReportKindMeta[] = [
  // ── Kisi ek trainee par ──
  { value: 'sick', label: 'Sick Report', icon: '🤒', category: 'Medical Issue', absentType: 'S', activity: 'Full Day', hint: 'Bimar hain — MI Room jayenge', needsDates: true, priority: 'high' },
  { value: 'hospital', label: 'Hospital', icon: '🏥', category: 'Medical Issue', absentType: 'H', activity: 'Full Day', hint: 'Hospital admit — long absence', needsDates: true, priority: 'urgent' },
  { value: 'pt_miss', label: 'PT Miss', icon: '🏃', category: 'Absent Report', absentType: 'A', activity: 'PT', hint: 'PT mein miss hua', needsDates: true, priority: 'medium' },
  { value: 'rest', label: 'Rest', icon: '🛌', category: 'Medical Issue', absentType: 'R', activity: 'Full Day', hint: 'B/C Rest — doctor ne diya', needsDates: true, priority: 'medium' },
  { value: 'leave', label: 'Leave', icon: '✈️', category: 'Leave Request', absentType: 'L', activity: 'Full Day', hint: 'Chutti chahiye', needsDates: true, priority: 'medium' },
  { value: 'other', label: 'Other (trainee)', icon: '📋', category: 'Other', hint: 'Kisi trainee se judi aur baat', needsDates: true, priority: 'medium' },

  // ── General — trainee select karna zaroori nahi ──
  { value: 'general_info', label: 'General Information', icon: 'ℹ️', category: 'General Information', hint: 'Clerk ko koi jaankari deni hai', general: true, priority: 'low' },
  { value: 'urgent_help', label: 'Urgent Help', icon: '🚨', category: 'Urgent Help', hint: 'Turant madad chahiye', general: true, priority: 'urgent' },
  { value: 'complaint', label: 'Complaint', icon: '📣', category: 'Complaint', hint: 'Shikayat darj karni hai', general: true, priority: 'high' },
  { value: 'mess', label: 'Mess / Food', icon: '🍽️', category: 'Mess / Food', hint: 'Khane / mess se judi baat', general: true, priority: 'medium' },
  { value: 'kit_issue', label: 'Kit / Equipment', icon: '🎒', category: 'Equipment Problem', hint: 'Kit ya saamaan ki dikkat', general: true, priority: 'medium' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔨', category: 'Maintenance', hint: 'Barrack / paani / bijli / repair', general: true, priority: 'medium' },
  { value: 'suggestion', label: 'Suggestion', icon: '💡', category: 'Suggestion', hint: 'Koi sujhav dena hai', general: true, priority: 'low' },
];

/** Sirf trainee-specific report kinds. */
export const TRAINEE_REPORT_KINDS = ABSENCE_REPORT_KINDS.filter(k => !k.general);
/** Sirf general report kinds (trainee select karne ki zaroorat nahi). */
export const GENERAL_REPORT_KINDS = ABSENCE_REPORT_KINDS.filter(k => k.general);
