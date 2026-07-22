// ============================================
// DUTY MANAGEMENT TYPES
// ============================================

export type DutyStatus =
  | 'assigned'
  | 'completed'
  | 'transferred'
  | 'cancelled';

// ─── Duty Type Master ────────────────────────
export interface DutyType {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date | null;
}

// ─── Duty Assignment ─────────────────────────
export interface StaffDuty {
  id: string;
  dutyTypeId: string;
  dutyTypeName: string;
  staffId: string;
  staffName: string;
  forceNumber: string;
  rank: string;
  date: Date | null;
  startTime: string;
  endTime: string;
  venue: string;
  status: DutyStatus;
  remarks: string;
  assignedBy: string;
  assignedAt: Date | null;
  completedAt: Date | null;
  transferredTo: string;
  transferReason: string;
}

// ─── Duty Form Data ──────────────────────────
export interface DutyFormData {
  dutyTypeId: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  remarks: string;
}

// ─── Default Values ──────────────────────────
export const DEFAULT_DUTY_FORM: DutyFormData = {
  dutyTypeId: '',
  staffId: '',
  date: '',
  startTime: '',
  endTime: '',
  venue: '',
  remarks: '',
};

// ─── Status Labels & Colors ──────────────────
export const DUTY_STATUS_LABELS: Record<DutyStatus, string> = {
  assigned: 'Assigned',
  completed: 'Completed',
  transferred: 'Transferred',
  cancelled: 'Cancelled',
};

export const DUTY_STATUS_COLORS: Record<DutyStatus, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  transferred: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};