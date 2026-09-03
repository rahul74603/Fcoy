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

export type AbsenceReportKind = 'sick' | 'hospital' | 'pt_miss' | 'rest' | 'leave' | 'other';
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
}

export type TraineeUpdateCategory =
  | 'Medical Issue'
  | 'Leave Request'
  | 'Absent Report'
  | 'Discipline Issue'
  | 'Equipment Problem'
  | 'Personal Issue'
  | 'Training Feedback'
  | 'Other';

export interface TraineeNotice {
  id: string;
  batchId: string;
  title: string;
  content: string;
  category: NoticeCategory;
  priority: 'normal' | 'important' | 'urgent';
  targetPlatoon: string;
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
