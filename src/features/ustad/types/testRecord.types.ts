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

export type FiringScoringMode = 'grouping' | 'application';
export type FiringRegisterKind = 'classification' | 'grouping' | 'tactical';
export type FiringGrading = 'MM' | 'FC' | 'SS' | 'FAIL' | '';

export interface FiringConfig {
  weaponType: string;
  practiceType: string;
  exerciseName: string;
  exerciseNo?: string;
  distance: string;
  targetType: string;
  totalRounds: number;
  scoringMode: FiringScoringMode;
  registerKind?: FiringRegisterKind;
  firingPosition?: string;
  detailNo?: string;
}

export interface FiringDetails {
  laneNo?: string;
  weaponNo?: string;
  firingPosition?: string;
  roundsIssued?: number;
  roundsFired?: number;
  emptyCasesReturned?: number;
  misfires?: number;
  hitsOnTarget?: number;
  groupSizeInches?: number;
  groupSizeCm?: number;
  zeroingAction?: string;
  timeSeconds?: number;
  penalties?: number;
  score?: number;
  maxScore?: number;
  grading?: FiringGrading;
  reFiringNeeded?: boolean;
  remarksCode?: string;
  remarks?: string;
  ringValues?: number[];
  totalRounds?: number;
  actualScore?: number;
  groupSize?: number;
  classification?: string;
}

export interface FiringPracticeOption {
  name: string;
  distance: string;
  target: string;
  mode: FiringScoringMode;
  rounds: number;
  exerciseNo: string;
}

export const FIRING_PRACTICE_TYPES: FiringPracticeOption[] = [
  { name: 'Grouping (25m)', distance: '25 Mtrs', target: 'Grouping Target', mode: 'grouping', rounds: 5, exerciseNo: 'I' },
  { name: 'Application (100m)', distance: '100 Mtrs', target: 'Figure 11', mode: 'application', rounds: 5, exerciseNo: 'II' },
  { name: 'Application (200m)', distance: '200 Mtrs', target: 'Figure 11', mode: 'application', rounds: 5, exerciseNo: 'III' },
  { name: 'Application (300m)', distance: '300 Mtrs', target: 'Figure 11', mode: 'application', rounds: 5, exerciseNo: 'IV' },
  { name: 'Classification Fire', distance: '100 Mtrs', target: 'Figure 11', mode: 'application', rounds: 10, exerciseNo: 'V' },
  { name: 'Night Firing', distance: '50 Mtrs', target: 'Figure 12', mode: 'application', rounds: 5, exerciseNo: 'VI' },
  { name: 'Snap Shooting', distance: '100 Mtrs', target: 'Figure 11', mode: 'application', rounds: 5, exerciseNo: 'VII' },
  { name: 'Battle Range', distance: '300 Mtrs', target: 'Figure 12', mode: 'application', rounds: 10, exerciseNo: 'VIII' },
  { name: 'Other', distance: '100 Mtrs', target: 'Figure 11', mode: 'application', rounds: 5, exerciseNo: '' },
];

export const FIRING_REGISTER_KINDS: { id: FiringRegisterKind; label: string; help: string }[] = [
  { id: 'classification', label: 'Classification & Annual Range Course', help: 'Hits + score + MM / FC / SS / FAIL' },
  { id: 'grouping', label: 'Grouping & Zeroing', help: 'Group size in cm + sight adjustment' },
  { id: 'tactical', label: 'Reflex / Tactical / Commando', help: 'Time taken + hits + penalties' },
];

export const FIRING_POSITIONS = ['Lying', 'Kneeling', 'Standing', 'Sitting'];
export const FIRING_ZEROING = [
  'Nil — Zeroed',
  '1 Click Clock',
  '2 Clicks Clock',
  '1 Click Anti-clock',
  '2 Clicks Anti-clock',
  'Elevation Up',
  'Elevation Down',
  'Re-group required',
];

export const DEFAULT_FIRING_CONFIG: FiringConfig = {
  weaponType: '5.56mm INSAS Rifle',
  practiceType: 'Classification Fire',
  exerciseName: 'Classification Fire',
  exerciseNo: 'V',
  distance: '100 Mtrs',
  targetType: 'Figure 11',
  totalRounds: 10,
  scoringMode: 'application',
  registerKind: 'classification',
  firingPosition: 'Lying',
  detailNo: '1',
};

export const FIRING_WEAPONS = [
  '5.56mm INSAS Rifle',
  'INSAS Rifle',
  '7.62mm SLR',
  'SLR',
  'AK-47',
  'AK-203',
  '9mm Pistol',
  '9mm Carbine',
  'LMG',
  'Other',
];
export const FIRING_EXERCISES = FIRING_PRACTICE_TYPES.map(p => p.name);
export const FIRING_DISTANCES = ['25 Mtrs', '50 Mtrs', '100 Mtrs', '200 Mtrs', '300 Mtrs'];
export const FIRING_TARGETS = ['Grouping Target', 'Figure 11', 'Figure 12', 'Ring Target', 'Bullseye', 'Running Target', 'Other'];
export const FIRING_ROUND_OPTIONS = [5, 10, 15, 18, 20];
export const FIRING_GRADINGS: FiringGrading[] = ['MM', 'FC', 'SS', 'FAIL'];

export const FIRING_REMARK_OPTIONS: { id: string; label: string }[] = [
  { id: '', label: '— Auto remarks —' },
  { id: 'qualified_mm', label: 'Qualified MM' },
  { id: 'qualified_fc', label: 'Qualified FC' },
  { id: 'qualified_ss', label: 'Qualified SS' },
  { id: 'misfire', label: 'Misfire accounted to Kote' },
  { id: 'failed_retest', label: 'FAIL — remedial + re-test' },
  { id: 'refire', label: 'Re-firing required' },
];

export const applyFiringPractice = (name: string, prev: FiringConfig): FiringConfig => {
  const p = FIRING_PRACTICE_TYPES.find(x => x.name === name);
  if (!p) {
    return { ...prev, practiceType: name, exerciseName: name };
  }
  return {
    ...prev,
    practiceType: p.name,
    exerciseName: p.name,
    exerciseNo: p.exerciseNo,
    distance: p.distance,
    targetType: p.target,
    scoringMode: p.mode,
    totalRounds: p.rounds,
    registerKind: p.mode === 'grouping' ? 'grouping' : (name.toLowerCase().includes('snap') ? 'tactical' : 'classification'),
  };
};

export const applyFiringRegisterKind = (kind: FiringRegisterKind, prev: FiringConfig): FiringConfig => {
  if (kind === 'grouping') {
    return {
      ...prev,
      registerKind: 'grouping',
      scoringMode: 'grouping',
      practiceType: 'Grouping (25m)',
      exerciseName: 'Grouping (25m)',
      exerciseNo: 'I',
      distance: '25 Mtrs',
      targetType: 'Grouping Target',
      totalRounds: 5,
      firingPosition: prev.firingPosition || 'Lying',
    };
  }
  if (kind === 'tactical') {
    return {
      ...prev,
      registerKind: 'tactical',
      scoringMode: 'application',
      practiceType: 'Snap Shooting',
      exerciseName: 'Snap Shooting',
      exerciseNo: 'VII',
      distance: '100 Mtrs',
      targetType: 'Figure 11',
      totalRounds: 5,
      firingPosition: 'Standing',
    };
  }
  return {
    ...prev,
    registerKind: 'classification',
    scoringMode: 'application',
    practiceType: 'Classification Fire',
    exerciseName: 'Classification Fire',
    exerciseNo: 'V',
    distance: '100 Mtrs',
    targetType: 'Figure 11',
    totalRounds: 10,
    firingPosition: prev.firingPosition || 'Lying',
  };
};

export const firingScoringMode = (cfg?: FiringConfig): FiringScoringMode => {
  if (!cfg) return 'application';
  if (cfg.registerKind === 'grouping' || cfg.scoringMode === 'grouping') return 'grouping';
  if (cfg.scoringMode) return cfg.scoringMode;
  const fromName = (cfg.practiceType || cfg.exerciseName || '').toLowerCase();
  if (fromName.includes('group')) return 'grouping';
  return 'application';
};

export const firingRegisterKind = (cfg?: FiringConfig): FiringRegisterKind => {
  if (cfg?.registerKind) return cfg.registerKind;
  if (firingScoringMode(cfg) === 'grouping') return 'grouping';
  const name = (cfg?.practiceType || cfg?.exerciseName || '').toLowerCase();
  if (name.includes('snap') || name.includes('tactical') || name.includes('reflex')) return 'tactical';
  return 'classification';
};

export const firingMaxScore = (cfg?: FiringConfig): number => {
  if (!cfg) return 40;
  if (firingRegisterKind(cfg) === 'grouping') return 100;
  return (cfg.totalRounds || 10) * 4;
};

export const resolvedFiringConfig = (cfg?: FiringConfig | null): FiringConfig =>
  cfg ? { ...DEFAULT_FIRING_CONFIG, ...cfg } : DEFAULT_FIRING_CONFIG;

export const firingPracticeLabel = (cfg?: FiringConfig): string =>
  cfg?.practiceType || cfg?.exerciseName || 'Firing practice';

export const getFiringClassification = (actualScore: number, maxScore: number): string => {
  if (maxScore <= 0) return 'FAIL';
  const pct = (actualScore / maxScore) * 100;
  if (pct >= 80) return 'MM';
  if (pct >= 60) return 'FC';
  if (pct >= 50) return 'SS';
  return 'FAIL';
};

export const legacyClassificationToGrading = (cls?: string): FiringGrading => {
  if (!cls) return '';
  const s = cls.toLowerCase();
  if (s === 'mm' || s.includes('marksman')) return 'MM';
  if (s === 'fc' || s.includes('1st') || s.includes('first')) return 'FC';
  if (s === 'ss' || s.includes('2nd') || s.includes('second') || s.includes('sharp')) return 'SS';
  if (s.includes('fail')) return 'FAIL';
  return '';
};

export const firingClassColor = (cls: string) => {
  const g = legacyClassificationToGrading(cls) || cls;
  if (g === 'MM') return 'bg-yellow-500 text-white';
  if (g === 'FC') return 'bg-green-600 text-white';
  if (g === 'SS') return 'bg-blue-600 text-white';
  return 'bg-red-600 text-white';
};

export const gradingToMarks = (grading: FiringGrading, maxScore: number): number => {
  switch (grading) {
    case 'MM': return maxScore;
    case 'FC': return Math.round(maxScore * 0.75);
    case 'SS': return Math.round(maxScore * 0.55);
    default: return 0;
  }
};

export const computeFiringGrading = (cfg: FiringConfig, d: FiringDetails): FiringGrading => {
  const kind = firingRegisterKind(cfg);
  const rounds = Number(d.roundsFired || cfg.totalRounds || 5);
  const hits = Number(d.hitsOnTarget || 0);
  if (kind === 'grouping') {
    const gs = Number(d.groupSizeCm ?? d.groupSizeInches ?? d.groupSize ?? 0);
    if (gs <= 0) return 'FAIL';
    if (gs <= 2.5) return 'MM';
    if (gs <= 4) return 'FC';
    if (gs <= 6) return 'SS';
    return 'FAIL';
  }
  const max = Number(d.maxScore || firingMaxScore(cfg));
  const score = Number(d.score ?? d.actualScore ?? 0);
  if (max <= 0) return 'FAIL';
  const pct = (score / max) * 100;
  if (pct >= 80) return 'MM';
  if (pct >= 60) return 'FC';
  if (pct >= 50) return 'SS';
  if (hits <= 0 && score <= 0) return 'FAIL';
  return 'FAIL';
};

export const firingRemarkText = (code: string, cfg: FiringConfig, d: FiringDetails): string => {
  const weapon = cfg.weaponType || 'service weapon';
  const practice = firingPracticeLabel(cfg);
  const practiceNo = cfg.exerciseNo ? `Practice No. ${cfg.exerciseNo}` : practice;
  const gs = d.groupSizeCm ?? d.groupSizeInches ?? d.groupSize;
  const misfires = Number(d.misfires || 0);
  const grading = d.grading || 'FAIL';
  const scoreBit = firingRegisterKind(cfg) === 'grouping'
    ? (gs ? `Achieved ${gs} cm grouping.` : 'Grouping recorded.')
    : `Score ${Number(d.score ?? d.actualScore ?? 0)}/${Number(d.maxScore || firingMaxScore(cfg))}, hits ${Number(d.hitsOnTarget || 0)}.`;

  if (code === 'qualified_mm') {
    return `Cleared ${practice} with ${weapon} on first attempt. ${scoreBit} Official grading Marksman (MM). Qualified.`;
  }
  if (code === 'qualified_fc' || code === 'qualified_1st') {
    return `Cleared ${practice} with ${weapon} on first attempt. ${scoreBit} Official grading First Class (FC). Qualified.`;
  }
  if (code === 'qualified_ss' || code === 'qualified_2nd') {
    return `Cleared ${practice} with ${weapon}. ${scoreBit} Official grading Sharpshooter (SS). Qualified.`;
  }
  if (code === 'misfire') {
    return `During ${practiceNo}, ${misfires || 1} round${(misfires || 1) > 1 ? 's' : ''} failed to ignite due to a mechanical misfire (defective firing pin mechanism/hard primer). The round was safely extracted following standard safety delays, accounted for by the Range Officer, and returned to the Armoury Kote. A fresh replacement round was issued.`;
  }
  if (code === 'failed_retest') {
    const reason = firingRegisterKind(cfg) === 'grouping'
      ? `Recruit failed to achieve the minimum required grouping size${gs ? ` (${gs} cm at ${cfg.distance || '25m'})` : ''}.`
      : `Recruit failed to achieve the minimum required score (${Number(d.score ?? 0)}/${Number(d.maxScore || firingMaxScore(cfg))}).`;
    return `${reason} Not Qualified (FAIL). Shifted to remedial dry-firing (Aiming Rest) for 48 hours. Scheduled for re-test.`;
  }
  if (code === 'refire') {
    return `Re-firing required for ${practice} with ${weapon}. ${scoreBit} Graded ${grading}.`;
  }
  if (grading === 'FAIL') {
    return firingRemarkText('failed_retest', cfg, { ...d, remarksCode: 'failed_retest' });
  }
  if (grading === 'MM') return firingRemarkText('qualified_mm', cfg, d);
  if (grading === 'FC') return firingRemarkText('qualified_fc', cfg, d);
  if (grading === 'SS') return firingRemarkText('qualified_ss', cfg, d);
  return '';
};

const AUTO_REMARK_CODES = new Set(['', 'qualified_mm', 'qualified_fc', 'qualified_ss', 'qualified_1st', 'qualified_2nd', 'failed_retest', 'misfire']);

export const autoRemarkCode = (d: FiringDetails): string => {
  if (Number(d.misfires || 0) > 0) return 'misfire';
  const g = legacyClassificationToGrading(d.grading) || d.grading;
  if (g === 'FAIL') return 'failed_retest';
  if (g === 'MM') return 'qualified_mm';
  if (g === 'FC') return 'qualified_fc';
  if (g === 'SS') return 'qualified_ss';
  return '';
};

export const emptyFiringDetails = (cfg: FiringConfig): FiringDetails => {
  const issued = cfg.totalRounds || 5;
  return {
    laneNo: '',
    roundsIssued: issued,
    roundsFired: issued,
    emptyCasesReturned: issued,
    misfires: 0,
    hitsOnTarget: 0,
    groupSizeInches: 0,
    groupSizeCm: 0,
    firingPosition: cfg.firingPosition || 'Lying',
    weaponNo: '',
    zeroingAction: '',
    timeSeconds: 0,
    penalties: 0,
    score: 0,
    maxScore: firingMaxScore(cfg),
    grading: '',
    reFiringNeeded: false,
    remarksCode: '',
    remarks: '',
    totalRounds: issued,
    actualScore: 0,
    classification: '',
  };
};

export const applyFiringFields = (
  cfg: FiringConfig,
  prev: FiringDetails,
  patch: Partial<FiringDetails>,
): FiringDetails => {
  const d: FiringDetails = { ...prev, ...patch };
  const issued = Math.max(0, Number(d.roundsIssued ?? cfg.totalRounds ?? 5));
  let fired = Number(d.roundsFired ?? issued);
  if (Number.isNaN(fired) || fired < 0) fired = 0;
  if (fired > issued) fired = issued;
  d.roundsIssued = issued;
  d.roundsFired = fired;

  const ammoChanged = patch.roundsFired !== undefined || patch.roundsIssued !== undefined;
  if (ammoChanged || d.misfires == null) {
    d.misfires = Math.max(0, issued - fired);
  }
  if ((ammoChanged && patch.emptyCasesReturned === undefined) || d.emptyCasesReturned == null) {
    d.emptyCasesReturned = fired;
  }

  const hitCap = fired || issued;
  let hits = Number(d.hitsOnTarget || 0);
  if (hits < 0) hits = 0;
  if (hits > hitCap) hits = hitCap;
  d.hitsOnTarget = hits;

  if (d.groupSizeCm == null && (d.groupSizeInches != null || d.groupSize != null)) {
    d.groupSizeCm = Number(d.groupSizeInches ?? d.groupSize ?? 0);
  }
  if (d.groupSizeInches == null && d.groupSize != null) d.groupSizeInches = d.groupSize;
  if (d.score == null && d.actualScore != null) d.score = d.actualScore;
  if (d.grading) d.grading = legacyClassificationToGrading(d.grading) || d.grading;
  if (!d.grading && d.classification) d.grading = legacyClassificationToGrading(d.classification);
  if (!d.firingPosition) d.firingPosition = cfg.firingPosition || 'Lying';

  const maxScore = firingMaxScore(cfg);
  d.maxScore = maxScore;
  d.totalRounds = cfg.totalRounds;

  const started = Number(d.hitsOnTarget || 0) > 0
    || Number(d.score || 0) > 0
    || Number(d.groupSizeCm || d.groupSizeInches || 0) > 0
    || Number(d.actualScore || 0) > 0
    || Number(d.timeSeconds || 0) > 0;

  if (patch.grading === undefined) {
    d.grading = started ? computeFiringGrading(cfg, d) : (d.grading || '');
  }

  if (patch.reFiringNeeded === undefined && (d.reFiringNeeded == null || AUTO_REMARK_CODES.has(d.remarksCode || ''))) {
    d.reFiringNeeded = d.grading === 'FAIL';
  }

  if (patch.remarksCode !== undefined) {
    d.remarksCode = patch.remarksCode;
    if (patch.remarksCode && patch.remarksCode !== 'custom') {
      d.remarks = firingRemarkText(patch.remarksCode, cfg, d);
    }
  } else if (started && (!d.remarksCode || AUTO_REMARK_CODES.has(d.remarksCode))) {
    d.remarksCode = autoRemarkCode(d);
    d.remarks = d.remarksCode ? firingRemarkText(d.remarksCode, cfg, d) : '';
  }

  d.classification = d.grading || '';
  if (firingScoringMode(cfg) === 'application') {
    d.score = Number(d.score || 0);
    d.actualScore = d.score;
  } else {
    d.actualScore = gradingToMarks(d.grading || 'FAIL', maxScore);
    d.score = d.actualScore;
  }
  return d;
};

export const finalizeFiringResult = (cfg: FiringConfig, details: FiringDetails) => {
  const d = applyFiringFields(cfg, details, {});
  const max = firingMaxScore(cfg);
  const marks = firingScoringMode(cfg) === 'application'
    ? Number(d.score || 0)
    : gradingToMarks(d.grading || 'FAIL', max);
  const percent = max > 0 ? (marks / max) * 100 : 0;
  const passed = d.grading === 'MM' || d.grading === 'FC' || d.grading === 'SS';
  return {
    firingDetails: d,
    marks,
    grade: calculateGrade(percent),
    status: (passed ? 'pass' : 'fail') as 'pass' | 'fail',
    remarks: d.remarks || '',
  };
};

export const firingConfigChips = (cfg?: FiringConfig): string[] => {
  if (!cfg) return [];
  return [
    cfg.detailNo ? `Detail ${cfg.detailNo}` : '',
    cfg.weaponType,
    firingPracticeLabel(cfg),
    cfg.exerciseNo ? `Practice ${cfg.exerciseNo}` : '',
    cfg.distance,
    cfg.targetType,
    `${cfg.totalRounds} Rds issued`,
    cfg.firingPosition || '',
    firingRegisterKind(cfg) === 'grouping' ? 'Grouping & Zeroing' : firingRegisterKind(cfg) === 'tactical' ? 'Tactical register' : 'Classification register',
  ].filter(Boolean);
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
