// ============================================
// STAFF PERFORMANCE TYPES
// ============================================

// ─── Monthly Performance ─────────────────────
export interface StaffPerformance {
  id: string;
  staffId: string;
  staffName: string;
  forceNumber: string;
  rank: string;
  month: number;                        // 1-12
  year: number;
  classCount: number;
  trainingHours: number;
  subjectsCovered: string[];
  attendancePercent: number;
  leaveDaysTaken: number;
  pendingClasses: number;
  avgTraineeMarks: number;
  dutyCount: number;
  calculatedAt: Date | null;
}

// ─── Performance Summary ─────────────────────
export interface PerformanceSummary {
  bestInstructor: {
    staffId: string;
    staffName: string;
    score: number;
  };
  totalClassesConducted: number;
  totalTrainingHours: number;
  averageAttendance: number;
  monthlyComparison: MonthlyComparison[];
}

// ─── Monthly Comparison ──────────────────────
export interface MonthlyComparison {
  month: number;
  year: number;
  totalClasses: number;
  avgAttendance: number;
  totalHours: number;
}

// ─── Activity Log ────────────────────────────
export interface StaffActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  module: string;
  action: string;
  details: Record<string, unknown>;
  targetId: string;                     // staffId or recordId
  timestamp: Date | null;
}

// ─── Notification ────────────────────────────
export interface StaffNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  targetRoles: string[];
  targetStaffId: string;               // specific staff or ''
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date | null;
  expiresAt: Date | null;
}

export type NotificationType =
  | 'leave_return'
  | 'training_scheduled'
  | 'attendance_pending'
  | 'duty_assigned'
  | 'exam_scheduled'
  | 'report_pending'
  | 'leave_approved'
  | 'leave_rejected'
  | 'general';