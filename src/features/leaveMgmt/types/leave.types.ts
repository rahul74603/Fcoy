// ═══════════════════════════════════════════════════════════
// LEAVE MANAGEMENT TYPES (Chhutti Prabandhan)
// BSF STC Tekanpur Pattern
// ═══════════════════════════════════════════════════════════

export type LeaveType = 'Casual' | 'Medical' | 'Emergency' | 'Special' | 'Earned' | 'Maternity';

export type LeaveStatus = 'Applied' | 'Recommended' | 'Sanctioned' | 'Rejected' | 'Departed' | 'On Leave' | 'Returned' | 'Overstay' | 'Cancelled';

export interface LeaveApplication {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  batchId: string;

  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;

  // Sanction
  appliedTo: string;
  sanctionedBy: string;
  sanctionDate: string;
  status: LeaveStatus;

  // Tracking
  departureDate: string;
  returnDate: string;          // Expected return
  actualReturnDate: string;    // Actual return
  overstayDays: number;

  remarks: string;
  createdAt: string;
  createdBy: string;
}

export const LEAVE_TYPE_CONFIG: Record<LeaveType, { label: string; icon: string; color: string; maxDays: number }> = {
  Casual: { label: 'Samanya Chhutti (Casual)', icon: '🏖️', color: 'text-blue-700', maxDays: 30 },
  Medical: { label: 'Chikitsa Chhutti (Medical)', icon: '🏥', color: 'text-red-700', maxDays: 90 },
  Emergency: { label: 'Aapatkalin (Emergency)', icon: '🚨', color: 'text-orange-700', maxDays: 10 },
  Special: { label: 'Vishesh (Special)', icon: '⭐', color: 'text-purple-700', maxDays: 15 },
  Earned: { label: 'Arjit (Earned)', icon: '💰', color: 'text-green-700', maxDays: 30 },
  Maternity: { label: 'Maternity', icon: '👶', color: 'text-pink-700', maxDays: 180 },
};
