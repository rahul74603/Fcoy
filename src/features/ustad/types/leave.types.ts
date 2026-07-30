// ============================================
// LEAVE MANAGEMENT TYPES
// ============================================

export type LeaveStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'cancelled';

// ─── Leave Type Master ───────────────────────
// Dynamic - Admin creates these
export interface LeaveType {
  id: string;
  name: string;                        // e.g., "Casual Leave"
  code: string;                        // e.g., "CL"
  maxDaysPerYear: number;
  isPaid: boolean;
  isActive: boolean;
  description: string;
  createdAt: Date | null;
}

// ─── Leave Application ───────────────────────
export interface StaffLeave {
  id: string;
  leaveNumber: string;                 // Auto-generated e.g., "LV-2024-001"
  staffId: string;
  staffName: string;                   // denormalized
  forceNumber: string;                 // denormalized
  rank: string;                        // denormalized
  leaveTypeId: string;
  leaveTypeName: string;               // denormalized
  leaveTypeCode: string;               // denormalized
  fromDate: Date | null;
  toDate: Date | null;
  numberOfDays: number;
  reason: string;
  leaveAddress: string;
  contactNumber: string;
  // ★ Emergency contact during leave (backward compatible — old docs: '')
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  status: LeaveStatus;
  appliedAt: Date | null;
  appliedBy: string;                   // userId - self or clerk
  approvedBy: string;
  approvedByName: string;
  approvalDate: Date | null;
  rejectionReason: string;
  returnDate: Date | null;             // Actual return date
  joiningReportSubmitted: boolean;
  delayReason: string;                 // If returned late
  remarks: string;
}

// ─── Leave Form Data ─────────────────────────
export interface LeaveFormData {
  staffId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  leaveAddress: string;
  contactNumber: string;
  emergencyContactName: string;    // ★
  emergencyContactPhone: string;   // ★
  emergencyContactRelation: string;// ★
  remarks: string;
}

// ─── Leave Balance ───────────────────────────
export interface LeaveBalance {
  staffId: string;
  year: number;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  entitled: number;
  taken: number;
  pending: number;                     // Applied but not approved
  balance: number;
}

// ─── Leave Statistics ────────────────────────
export interface LeaveStatistics {
  totalStaff: number;
  currentlyOnLeave: number;
  pendingApprovals: number;
  upcomingReturns: number;             // Returning in next 3 days
  monthlyLeaveCount: number;
}

// ─── Default Values ──────────────────────────
export const DEFAULT_LEAVE_FORM: LeaveFormData = {
  staffId: '',
  leaveTypeId: '',
  fromDate: '',
  toDate: '',
  reason: '',
  leaveAddress: '',
  contactNumber: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  remarks: '',
};

// ─── Status Labels & Colors ──────────────────
export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};