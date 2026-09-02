// ═══════════════════════════════════════════════════════════
// SYLLABUS TRACKING TYPES (Pathyakram Anurekhan)
// ═══════════════════════════════════════════════════════════

export type SyllabusStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface SyllabusTopic {
  id: string;
  batchId: string;
  subject: string;
  topic: string;
  totalHours: number;
  completedHours: number;
  instructorId: string;
  instructorName: string;
  status: SyllabusStatus;
  startDate: string;
  endDate: string;
  remarks: string;
  createdAt: string;
}

export const SYLLABUS_SUBJECTS = [
  'PT (Physical Training)', 'Drill', 'Weapon Training', 'Firing',
  'Law', 'Tactics', 'Map Reading', 'Field Craft', 'Battle Craft',
  'First Aid', 'Communication', 'Computer', 'Swimming', 'Other',
];

export const SYLLABUS_STATUS_CONFIG: Record<SyllabusStatus, { color: string; bg: string; icon: string }> = {
  'Not Started': { color: 'text-slate-600', bg: 'bg-slate-100', icon: '⬜' },
  'In Progress': { color: 'text-blue-600', bg: 'bg-blue-100', icon: '🔵' },
  'Completed': { color: 'text-green-600', bg: 'bg-green-100', icon: '✅' },
};
