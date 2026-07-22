// ============================================
// useAttendance HOOK - FIXED
// ============================================

import { useState, useCallback } from 'react';
import {
  StaffAttendance,
  AttendanceStatus,
  DailyAttendanceEntry,
  AttendanceSummary,
  ATTENDANCE_STATUS_LABELS,
} from '../types/attendance.types';
import { Staff } from '../types/staff.types';
import {
  markBulkAttendance,
  getAttendanceByDate,
  getStaffAttendanceByMonth,
  getAllAttendanceByMonth,
  updateAttendance,
  calculateAttendanceSummary,
} from '../api/attendance.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';

import { useBatch } from '../../../contexts/BatchContext';
interface UseAttendanceReturn {
  dailyAttendance: StaffAttendance[];
  monthlyAttendance: StaffAttendance[];
  allMonthlyAttendance: StaffAttendance[];
  attendanceSummaries: AttendanceSummary[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  fetchDailyAttendance: (date: string) => Promise<void>;
  fetchStaffMonthly: (staffId: string, month: number, year: number) => Promise<void>;
  fetchAllMonthly: (month: number, year: number) => Promise<void>;
  handleMarkBulkAttendance: (entries: DailyAttendanceEntry[], date: string) => Promise<boolean>;
  handleUpdateAttendance: (attendanceId: string, status: AttendanceStatus, remarks: string) => Promise<boolean>;
  buildDailyEntries: (staffList: Staff[], existingAttendance: StaffAttendance[]) => DailyAttendanceEntry[];
  getTodaySummary: (attendance: StaffAttendance[]) => Record<AttendanceStatus, number>;
  clearError: () => void;
}

export const useAttendance = (): UseAttendanceReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();

  const [dailyAttendance, setDailyAttendance] = useState<StaffAttendance[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<StaffAttendance[]>([]);
  const [allMonthlyAttendance, setAllMonthlyAttendance] = useState<StaffAttendance[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const fetchDailyAttendance = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAttendanceByDate(date, activeBatch?.id);
      setDailyAttendance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily attendance');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  const fetchStaffMonthly = useCallback(
    async (staffId: string, month: number, year: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStaffAttendanceByMonth(staffId, month, year);
        setMonthlyAttendance(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch monthly attendance');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchAllMonthly = useCallback(async (month: number, year: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllAttendanceByMonth(month, year);
      setAllMonthlyAttendance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch all monthly attendance');
    } finally {
      setLoading(false);
    }
  }, []);

    const handleMarkBulkAttendance = async (
    entries: DailyAttendanceEntry[],
    date: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await markBulkAttendance(
        entries,
        date,
        user?.uid ?? '',
        activeBatch?.id,
        activeBatch?.batchNumber
      );

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Attendance',
        'Bulk Attendance Marked',
        {
          date,
          totalEntries: entries.length,
          present: entries.filter((e) => e.status === 'present').length,
          absent: entries.filter((e) => e.status === 'absent').length,
        }
      );

      await fetchDailyAttendance(date);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAttendance = async (
    attendanceId: string,
    status: AttendanceStatus,
    remarks: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await updateAttendance(attendanceId, status, remarks, user?.uid ?? '');

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Attendance',
        'Attendance Updated',
        { status: ATTENDANCE_STATUS_LABELS[status], remarks },
        attendanceId
      );

      setDailyAttendance((prev) =>
        prev.map((a) => (a.id === attendanceId ? { ...a, status, remarks } : a))
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const buildDailyEntries = (
    staffList: Staff[],
    existingAttendance: StaffAttendance[]
  ): DailyAttendanceEntry[] => {
    return staffList.map((staff) => {
      const existing = existingAttendance.find((a) => a.staffId === staff.id);
      return {
        staffId: staff.id,
        staffName: staff.name,
        forceNumber: staff.forceNumber,
        rank: staff.rank,
        status: existing?.status ?? 'present',
        remarks: existing?.remarks ?? '',
      };
    });
  };

  const getTodaySummary = (
    attendance: StaffAttendance[]
  ): Record<AttendanceStatus, number> => {
    const summary: Record<AttendanceStatus, number> = {
      present: 0, absent: 0, leave: 0, td: 0,
      hospital: 0, course: 0, attachment: 0, weekly_off: 0,
    };
    attendance.forEach((a) => {
      summary[a.status] = (summary[a.status] ?? 0) + 1;
    });
    return summary;
  };

  // suppress unused warning
  void setAttendanceSummaries;
  void calculateAttendanceSummary;

  const clearError = () => setError(null);

  return {
    dailyAttendance,
    monthlyAttendance,
    allMonthlyAttendance,
    attendanceSummaries,
    loading,
    submitting,
    error,
    fetchDailyAttendance,
    fetchStaffMonthly,
    fetchAllMonthly,
    handleMarkBulkAttendance,
    handleUpdateAttendance,
    buildDailyEntries,
    getTodaySummary,
    clearError,
  };
};