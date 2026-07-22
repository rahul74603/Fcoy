// ============================================
// TRAINING SCHEDULE TYPES
// ============================================

export type ScheduleStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'postponed';

// ─── Training Schedule ───────────────────────
export interface TrainingSchedule {
  id: string;
  batchId: string;
  batchNumber: string;

  // Date & Time
  date: Date | null;
  dayOfWeek: string;              // "Monday", "Tuesday", etc
  startTime: string;              // "06:00"
  endTime: string;                // "07:30"
  duration: number;               // in minutes

  // Ustad
  ustadId: string;                // Staff ID
  ustadName: string;              // Denormalized
  ustadRank: string;              // Denormalized
  ustadForceNumber: string;

  // Subject
  subjectId: string;              // Subject ID
  subjectName: string;            // Denormalized
  subjectCode: string;

  // Location
  company: string;                // A Coy, B Coy, etc
  platoon: string;                // Platoon 1, 2, etc
  venue: string;                  // Parade Ground, Class Room 1, etc

  // Status
  status: ScheduleStatus;
  remarks: string;

  // Meta
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
}

// ─── Schedule Form ───────────────────────────
export interface ScheduleFormData {
  date: string;
  startTime: string;
  endTime: string;
  ustadId: string;
  subjectId: string;
  company: string;
  platoon: string;
  venue: string;
  remarks: string;
}

// ─── Default Values ──────────────────────────
export const DEFAULT_SCHEDULE_FORM: ScheduleFormData = {
  date: new Date().toISOString().split('T')[0],
  startTime: '06:00',
  endTime: '07:30',
  ustadId: '',
  subjectId: '',
  company: '',
  platoon: '',
  venue: '',
  remarks: '',
};

// ─── Status Labels & Colors ──────────────────
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  postponed: 'bg-orange-100 text-orange-800 border-orange-300',
};

// ─── Days of Week ────────────────────────────
export const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

// ─── Time Slots (for calendar view) ──────────
export const TIME_SLOTS = [
  '05:00', '06:00', '07:00', '08:00', '09:00',
  '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00',
];

// ─── Platoons ────────────────────────────────
export const PLATOONS = [
  'All Platoons (Whole Company)',
  'Platoon 1',
  'Platoon 2',
  'Platoon 3',
  'Platoon 4',
] as const;

// ─── Common Venues ───────────────────────────
export const COMMON_VENUES = [
  'Parade Ground',
  'PT Ground',
  'Class Room 1',
  'Class Room 2',
  'Class Room 3',
  'Firing Range',
  'Obstacle Course',
  'Auditorium',
  'Weapon Store',
  'Field Area',
] as const;