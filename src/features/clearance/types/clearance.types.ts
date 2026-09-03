// ═══════════════════════════════════════════════════════════
// CLEARANCE SYSTEM TYPES (Klirans Prabandhan)
// ═══════════════════════════════════════════════════════════

export type ClearanceDept = 'Kit Store' | 'Mess' | 'Medical' | 'Documents' | 'Library' | 'Arms Room' | 'QM Store' | 'Sports' | 'Training' | 'Discipline';

export type ClearanceItemStatus = 'Pending' | 'Cleared' | 'Exempted';

export interface ClearanceItem {
  department: ClearanceDept;
  status: ClearanceItemStatus;
  clearedBy: string;
  date: string;
  remarks: string;
}

export interface ClearanceRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  batchId: string;
  items: ClearanceItem[];
  overallStatus: 'Pending' | 'In Progress' | 'Cleared';
  remarks: string;
  createdAt: string;
}

export const CLEARANCE_DEPARTMENTS: ClearanceDept[] = [
  'Kit Store', 'Mess', 'Medical', 'Documents', 'Library',
  'Arms Room', 'QM Store', 'Sports', 'Training', 'Discipline',
];

export const DEPT_ICONS: Record<ClearanceDept, string> = {
  'Kit Store': '📦', 'Mess': '🍽️', 'Medical': '🏥', 'Documents': '📄',
  'Library': '📚', 'Arms Room': '🔫', 'QM Store': '🏪', 'Sports': '⚽',
  'Training': '📋', 'Discipline': '⚖️',
};
