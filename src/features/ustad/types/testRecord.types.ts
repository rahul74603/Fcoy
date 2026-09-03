// ============================================
// UNIFIED TEST RECORDS TYPES
// Merged: WeeklyTest + FPT + Modern Cards
// ============================================

export type TestType =
  | 'drill'
  | 'weapon'
  | 'firing'
  | 'pt'
  | 'fpt'           // Special: has grade system
  | 'map_reading'
  | 'field_craft'
  | 'battle_craft'
  | 'first_aid'
  | 'weekly'        // Weekly written test
  | 'custom';

export type TestStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';

// ─── Running Grades (FPT only) ────────────────
export type RunningGrade = 'Excellent' | 'Very Good' | 'Good' | 'Fail' | '';

export const RUNNING_GRADES: RunningGrade[] = ['Excellent', 'Very Good', 'Good', 'Fail'];

export const GRADE_STYLE: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  'Excellent':  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', emoji: '🏆' },
  'Very Good':  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300',    emoji: '⭐' },
  'Good':       { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   emoji: '👍' },
  'Fail':       { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300',     emoji: '❌' },
};

// Convert running grade to marks
export const gradeToMarks = (grade: RunningGrade, maxMarks: number, passingMarks: number): number => {
  switch (grade) {
    case 'Excellent':  return maxMarks;
    case 'Very Good':  return Math.round(maxMarks * 0.80);
    case 'Good':       return passingMarks;
    case 'Fail':       return 0;
    default:           return 0;
  }
};

// ─── FPT Event Structure ─────────────────────
export interface FPTEvent {
  name: string;
  maxMarks: number;
  passingMarks: number;
  isRunning?: boolean;
}

export interface FPTEventResult {
  name: string;
  maxMarks: number;
  passingMarks: number;
  marks: number;
  passed: boolean;
  isRunning?: boolean;
  runningGrade?: RunningGrade;
}

// ─── Trainee Result ──────────────────────────
export interface TraineeResult {
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;

  marks: number;                  // Total marks (for FPT = sum of events)
  grade: Grade;                   // Overall grade
  status: 'pass' | 'fail' | 'absent';
  remarks: string;
  weakAreas: string[];

  // FPT-specific
  events?: FPTEventResult[];      // For FPT tests
  eventsPassed?: number;
  eventsFailed?: number;

  // Firing Practice (BSF range register) — not a single number
  firingDetails?: FiringDetails;
}

// ─── Test Record (Unified) ───────────────────
export interface TestRecord {
  id: string;
  batchId: string;
  batchNumber: string;

  // Test Info
  testType: TestType;
  testName: string;
  subjectCode: string;
  description: string;
  weekNumber: number;             // For weekly tracking

  // Schedule
  testDate: Date | null;
  startTime: string;
  endTime: string;
  venue: string;

  // Marking
  totalMarks: number;
  passingMarks: number;
  passingPercent: number;

  // FPT-specific
  fptEvents?: FPTEvent[];         // Only for FPT
  overallPassPercent?: number;

  // Firing Practice (BSF range register)
  firingConfig?: FiringConfig;

    // Instructors (Multiple - Support for large batches)
  instructorId: string;              // Primary (backward compat)
  instructorName: string;             // Primary (backward compat)
  instructors?: InstructorInfo[];     // 🆕 Multiple instructors

  // Platoon
  platoon?: string;                   // 🆕 Selected platoon

  // Results
  results: TraineeResult[];
  averageScore: number;
  passCount: number;
  failCount: number;
  absentCount: number;

  // Status
  status: TestStatus;
  remarks: string;

  // Meta
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
}

// ─── Form Data ───────────────────────────────
export interface TestFormData {
  testType: TestType;
  testName: string;
  subjectCode: string;
  description: string;
  weekNumber: number;
  testDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  totalMarks: number;
  passingMarks: number;
  passingPercent: number;
    instructorId: string;               // Primary instructor
  instructorIds?: string[];           // 🆕 All selected instructors
  platoon?: string;                   // 🆕 Platoon
  remarks: string;

  // FPT-specific
  fptEvents?: FPTEvent[];
  overallPassPercent?: number;

  // Firing Practice (BSF range register)
  firingConfig?: FiringConfig;
}

export const DEFAULT_TEST_FORM: TestFormData = {
  testType: 'drill',
  testName: '',
  subjectCode: 'DRILL',
  description: '',
  weekNumber: 1,
  testDate: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '11:00',
  venue: '',
  totalMarks: 100,
  passingMarks: 40,
  passingPercent: 40,
  instructorId: '',
  instructorIds: [],           // 🆕
  platoon: 'All Platoons (Whole Company)', // 🆕
  remarks: '',
};

export interface FiringConfig {
  weaponType: string;
  exerciseName: string;
  exerciseNo?: string;
  distance: string;
  targetType: string;
  totalRounds: number;
}

export interface FiringDetails {
  laneNo?: string;
  ringValues?: number[];
  totalRounds?: number;
  actualScore?: number;
  maxScore?: number;
  groupSize?: number;
  classification?: string;
}

export const DEFAULT_FIRING_CONFIG: FiringConfig = {
  weaponType: 'INSAS Rifle',
  exerciseName: 'Grouping Practice',
  exerciseNo: '1',
  distance: '100 Mtrs',
  targetType: 'Figure 11',
  totalRounds: 5,
};

export const FIRING_WEAPONS = ['INSAS Rifle', '9mm Pistol', 'AK-47', 'AK-203', 'SLR', 'LMG', 'Carbine', 'Other'];
export const FIRING_EXERCISES = ['Grouping Practice', 'Application Fire', 'Classification Fire', 'Night Firing', 'Snap Shooting', 'Battle Range', 'Other'];
export const FIRING_DISTANCES = ['25 Mtrs', '50 Mtrs', '100 Mtrs', '200 Mtrs', '300 Mtrs'];
export const FIRING_TARGETS = ['Figure 11', 'Figure 12', 'Ring Target', 'Bullseye', 'Running Target', 'Other'];
export const FIRING_ROUND_OPTIONS = [3, 5, 8, 10, 15, 20];

export const getFiringClassification = (actualScore: number, maxScore: number): string => {
  if (maxScore <= 0) return 'FAIL';
  const pct = (actualScore / maxScore) * 100;
  if (pct >= 80) return 'MM (Marksman)';
  if (pct >= 60) return 'FC (First Class)';
  if (pct >= 50) return 'SS (Sharpshooter)';
  return 'FAIL';
};

export const firingClassColor = (cls: string) => {
  if (cls.includes('Marksman')) return 'bg-yellow-500 text-white';
  if (cls.includes('First Class')) return 'bg-green-600 text-white';
  if (cls.includes('Sharpshooter')) return 'bg-blue-600 text-white';
  return 'bg-red-600 text-white';
};

export const DEFAULT_FPT_EVENTS: FPTEvent[] = [
  { name: '1.6 KM Run',    maxMarks: 20, passingMarks: 10, isRunning: true },
  { name: 'Long Jump',     maxMarks: 15, passingMarks: 8 },
  { name: 'High Jump',     maxMarks: 15, passingMarks: 8 },
  { name: 'Rope Climbing', maxMarks: 15, passingMarks: 8 },
  { name: 'Push Ups',      maxMarks: 10, passingMarks: 5 },
  { name: 'Sit Ups',       maxMarks: 10, passingMarks: 5 },
  { name: 'Chin Ups',      maxMarks: 15, passingMarks: 8 },
];

// ─── BSF Subjects (from existing) ────────────
export const BSF_SUBJECTS = [
  'General Training',
  'Weapon Training (WT)',
  'Drill',
  'Physical Training (PT)',
  'Field Craft & Tactics',
  'Map Reading',
  'Firing (Theory)',
  'Firing (Practical)',
  'Internal Security (IS)',
  'Border Management',
  'BSF Act & Rules',
  'IPC / CrPC',
  'Law & Procedure',
  'Counter Insurgency (CI)',
  'Anti Infiltration',
  'NBC Defence',
  'Explosives & IED',
  'First Aid & Hygiene',
  'Wireless & Communication',
  'Field Punishment Training (FPT)',
  'Battle Obstacle Course (BOC)',
  'Human Rights',
  'Accounts & Store Procedure',
  'Ceremonial Drill',
  'Guard Duty & Sentry',
  'Ambush & Patrolling',
  'Riot Control / Mob Handling',
  'Swimming',
  'Rock Craft / Rope Work',
  'Cross Country',
  'Games & Sports Theory',
];

// ─── Test Type Info ──────────────────────────
export const TEST_TYPE_INFO: Record<TestType, {
  label: string;
  icon: string;
  code: string;
  color: string;
  bgColor: string;
  borderColor: string;
  gradient: string;
  isFPT?: boolean;
}> = {
  drill: {
    label: 'Drill Test',
    icon: '🎖️', code: 'DRILL',
    color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300',
    gradient: 'from-purple-500 to-purple-700',
  },
  weapon: {
    label: 'Weapon Test',
    icon: '🔫', code: 'WPN',
    color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300',
    gradient: 'from-red-500 to-red-700',
  },
  firing: {
    label: 'Firing Practice',
    icon: '🎯', code: 'FIRE',
    color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300',
    gradient: 'from-orange-500 to-orange-700',
  },
  pt: {
    label: 'PT Test',
    icon: '🏋️', code: 'PT',
    color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300',
    gradient: 'from-blue-500 to-blue-700',
  },
  fpt: {
    label: 'FPT (Field Physical)',
    icon: '⚡', code: 'FPT',
    color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300',
    gradient: 'from-green-500 to-green-700',
    isFPT: true,
  },
  map_reading: {
    label: 'Map Reading',
    icon: '🗺️', code: 'MAP',
    color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-300',
    gradient: 'from-cyan-500 to-cyan-700',
  },
  field_craft: {
    label: 'Field Craft',
    icon: '⛺', code: 'FLD',
    color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300',
    gradient: 'from-amber-500 to-amber-700',
  },
  battle_craft: {
    label: 'Battle Craft',
    icon: '⚔️', code: 'BTL',
    color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-300',
    gradient: 'from-pink-500 to-pink-700',
  },
  first_aid: {
    label: 'First Aid',
    icon: '🏥', code: 'FA',
    color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-300',
    gradient: 'from-rose-500 to-rose-700',
  },
  weekly: {
    label: 'Weekly Test',
    icon: '📅', code: 'WEEK',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300',
    gradient: 'from-indigo-500 to-indigo-700',
  },
  custom: {
    label: 'Custom Test',
    icon: '📝', code: 'CUSTOM',
    color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-300',
    gradient: 'from-slate-500 to-slate-700',
  },
};

// ─── Status Colors ───────────────────────────
export const STATUS_COLORS: Record<TestStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const STATUS_LABELS: Record<TestStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// ─── Grade Calculator ────────────────────────
export const calculateGrade = (percent: number): Grade => {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B+';
  if (percent >= 60) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 40) return 'D';
  return 'F';
};

export const GRADE_COLORS: Record<Grade, string> = {
  'A+': 'bg-green-500 text-white',
  'A':  'bg-green-400 text-white',
  'B+': 'bg-blue-500 text-white',
  'B':  'bg-blue-400 text-white',
  'C':  'bg-yellow-500 text-white',
  'D':  'bg-orange-500 text-white',
  'F':  'bg-red-500 text-white',
};
// ─── BSF Platoons (Standard: 4 Platoons per Company) ───
export const BSF_PLATOONS = [
  'All Platoons (Whole Company)',
  'Platoon 1',
  'Platoon 2',
  'Platoon 3',
  'Platoon 4',
] as const;

// ─── Instructor Selection ─────────────────────
export interface InstructorInfo {
  id: string;
  name: string;
  rank: string;
  forceNumber: string;
  category: string;
}