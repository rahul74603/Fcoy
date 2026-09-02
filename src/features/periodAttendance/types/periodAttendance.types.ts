// ═══════════════════════════════════════════════════════════
// PERIOD ATTENDANCE TYPES (Kaksha Upasthiti)
// BSF STC Tekanpur — Per subject, per period attendance
// ═══════════════════════════════════════════════════════════

export type PeriodStatus = 'P' | 'A' | 'L' | 'S' | 'H' | 'Duty' | 'TD' | 'BP';

export interface PeriodAttendanceRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  batchId: string;
  date: string;
  period: string;
  subject: string;
  status: PeriodStatus;
  reason?: string;           // Reason for absent/leave/sick
  bodyPairChestNo?: string;  // Body pair (buddy) chest number
  bodyPairName?: string;     // Body pair name
  markedBy: string;
  remarks: string;
  createdAt: string;
}

export interface DailyAttendanceSummary {
  date: string;
  periods: {
    period: string;
    subject: string;
    present: number;
    absent: number;
    total: number;
  }[];
}

export const PERIODS = [
  'Morning PT', '1st Period', '2nd Period', '3rd Period',
  '4th Period', '5th Period', '6th Period', '7th Period', '8th Period', 'Evening Games',
];

export const SUBJECTS = [
  'PT (Physical Training)', 'Drill', 'Weapon Training', 'Firing',
  'Law', 'Tactics', 'Map Reading', 'Field Craft', 'Battle Craft',
  'First Aid', 'Communication', 'Computer', 'Swimming', 'Games',
  'Parade', 'Route March', 'Other',
];

export const PERIOD_STATUS_CONFIG: Record<PeriodStatus, { label: string; color: string; bg: string; icon: string }> = {
  P: { label: 'Present', color: 'text-green-800', bg: 'bg-green-100', icon: '✅' },
  A: { label: 'Absent', color: 'text-red-800', bg: 'bg-red-100', icon: '❌' },
  L: { label: 'Leave', color: 'text-amber-800', bg: 'bg-amber-100', icon: '✈️' },
  S: { label: 'Sick', color: 'text-orange-800', bg: 'bg-orange-100', icon: '🏥' },
  H: { label: 'Hospital', color: 'text-purple-800', bg: 'bg-purple-100', icon: '🏨' },
  Duty: { label: 'Duty', color: 'text-blue-800', bg: 'bg-blue-100', icon: '🛡️' },
  TD: { label: 'Temp Duty', color: 'text-cyan-800', bg: 'bg-cyan-100', icon: '📋' },
  BP: { label: 'Body Pair', color: 'text-pink-800', bg: 'bg-pink-100', icon: '👥' },
};

export const ABSENT_REASONS = [
  'Without Leave', 'Sick Report', 'Family Problem', 'Personal Work',
  'Medical Appointment', 'Hospital Visit', 'Duty Leave', 'Authorized Absence',
  'Late Coming', 'Other',
];
