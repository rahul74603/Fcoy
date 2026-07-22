// ============================================
// BATCH PROGRESS TYPES
// ============================================

export interface SubjectProgress {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  category: string;
  totalHours: number;              // Planned hours
  completedHours: number;          // Done hours
  totalClasses: number;            // Planned classes
  completedClasses: number;        // Done classes
  percentComplete: number;         // Auto-calculated
  lastUpdated: Date | null;
}

export interface BatchProgress {
  id: string;
  batchId: string;
  batchNumber: string;
  batchName: string;

  // Batch Duration
  startDate: Date | null;
  endDate: Date | null;
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;

  // Overall
  overallPercent: number;

  // Subject-wise
  subjectProgress: SubjectProgress[];

  // Weekly Trend
  weeklyTrend: {
    week: number;
    percent: number;
    date: Date | null;
  }[];

  // Milestones
  milestones: {
    name: string;
    targetDate: Date | null;
    completed: boolean;
    completedDate: Date | null;
  }[];

  createdAt: Date | null;
  updatedAt: Date | null;
}

// ─── Form Data ───────────────────────────────
export interface SubjectPlanFormData {
  subjectId: string;
  totalHours: number;
  totalClasses: number;
}

// ─── Progress Update ─────────────────────────
export interface ProgressUpdateData {
  subjectId: string;
  hoursCompleted: number;
  classesCompleted: number;
}

// ─── Default Milestones ──────────────────────
export const DEFAULT_MILESTONES = [
  'Basic Training Complete',
  'Weapon Handling Complete',
  'First Firing Practice',
  'Drill Perfect',
  'FPT Level 1 Pass',
  'FPT Level 2 Pass',
  'Passing Out Parade',
];

// ─── Progress Color by Percent ───────────────
export const getProgressColor = (percent: number): string => {
  if (percent >= 80) return 'bg-green-500';
  if (percent >= 60) return 'bg-blue-500';
  if (percent >= 40) return 'bg-yellow-500';
  if (percent >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

export const getProgressLabel = (percent: number): string => {
  if (percent >= 80) return 'Excellent';
  if (percent >= 60) return 'Good';
  if (percent >= 40) return 'On Track';
  if (percent >= 20) return 'Needs Focus';
  return 'Behind Schedule';
};