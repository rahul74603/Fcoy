// ============================================
// ATTENDANCE TYPES
// ============================================

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'td'
  | 'hospital'
  | 'course'
  | 'attachment'
  | 'weekly_off';

// ─── Staff Attendance ────────────────────────
export interface StaffAttendance {
  id: string;
  staffId: string;
  staffName: string;               // denormalized
  forceNumber: string;             // denormalized
  date: Date | null;
  status: AttendanceStatus;
  remarks: string;
  markedBy: string;
  markedAt: Date | null;
  updatedAt: Date | null;
}

// ─── Daily Attendance Entry ──────────────────
// Used for bulk attendance marking
export interface DailyAttendanceEntry {
  staffId: string;
  staffName: string;
  forceNumber: string;
  rank: string;
  status: AttendanceStatus;
  remarks: string;
}

// ─── Attendance Summary ──────────────────────
export interface AttendanceSummary {
  staffId: string;
  staffName: string;
  month: number;
  year: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  tdDays: number;
  hospitalDays: number;
  courseDays: number;
  weeklyOffDays: number;
  attendancePercent: number;
}

// ─── Labels & Colors ─────────────────────────
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Leave',
  td: 'Temp. Duty',
  hospital: 'Hospital',
  course: 'Course',
  attachment: 'Attachment',
  weekly_off: 'Weekly Off',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  leave: 'bg-yellow-100 text-yellow-800',
  td: 'bg-blue-100 text-blue-800',
  hospital: 'bg-pink-100 text-pink-800',
  course: 'bg-purple-100 text-purple-800',
  attachment: 'bg-orange-100 text-orange-800',
  weekly_off: 'bg-gray-100 text-gray-800',
};

// Short codes for attendance sheet display
export const ATTENDANCE_STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  td: 'TD',
  hospital: 'H',
  course: 'C',
  attachment: 'AT',
  weekly_off: 'WO',
};