import { useState, useEffect, useCallback } from 'react';
import {
  StaffLeave, LeaveFormData, LeaveType, LeaveStatistics,
} from '../types/leave.types';
import {
  getAllLeaves, getPendingLeaves, getCurrentLeaves,
  getLeaveByStaff, applyLeave, approveLeave, rejectLeave,
  cancelLeave, recordLeaveReturn, getAllLeaveTypes,
  getActiveLeaveTypes, addLeaveType, toggleLeaveTypeStatus,
} from '../api/leave.api';
import { logActivity } from '../api/activityLog.api';
import { updateStaffStatus } from '../api/staff.api';  // 🆕 ADD
import { markBulkAttendance } from '../api/attendance.api';  // 🆕 ADD
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';
interface UseLeaveReturn {
  allLeaves: StaffLeave[];
  pendingLeaves: StaffLeave[];
  currentLeaves: StaffLeave[];
  staffLeaves: StaffLeave[];
  leaveTypes: LeaveType[];
  activeLeaveTypes: LeaveType[];
  statistics: LeaveStatistics;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  fetchAllLeaves: () => Promise<void>;
  fetchPendingLeaves: () => Promise<void>;
  fetchCurrentLeaves: () => Promise<void>;
  fetchStaffLeaves: (staffId: string) => Promise<void>;
  handleApplyLeave: (
    formData: LeaveFormData,
    staffName: string,
    forceNumber: string,
    rank: string
  ) => Promise<boolean>;
  handleApproveLeave: (leaveId: string) => Promise<boolean>;
  handleRejectLeave: (leaveId: string, reason: string) => Promise<boolean>;
  handleCancelLeave: (leaveId: string) => Promise<boolean>;
  handleRecordReturn: (
    leaveId: string,
    returnDate: string,
    joiningReport: boolean,
    delayReason: string
  ) => Promise<boolean>;
  fetchLeaveTypes: () => Promise<void>;
  handleAddLeaveType: (
    name: string,
    code: string,
    maxDays: number,
    isPaid: boolean,
    description: string
  ) => Promise<boolean>;
  handleToggleLeaveType: (typeId: string, isActive: boolean) => Promise<boolean>;
  getLeaveTypeName: (typeId: string) => string;
  clearError: () => void;
}

const DEFAULT_STATISTICS: LeaveStatistics = {
  totalStaff: 0,
  currentlyOnLeave: 0,
  pendingApprovals: 0,
  upcomingReturns: 0,
  monthlyLeaveCount: 0,
};

export const useLeave = (): UseLeaveReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();

  const [allLeaves, setAllLeaves] = useState<StaffLeave[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<StaffLeave[]>([]);
  const [currentLeaves, setCurrentLeaves] = useState<StaffLeave[]>([]);
  const [staffLeaves, setStaffLeaves] = useState<StaffLeave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [activeLeaveTypes, setActiveLeaveTypes] = useState<LeaveType[]>([]);
  const [statistics, setStatistics] = useState<LeaveStatistics>(DEFAULT_STATISTICS);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const calculateStatistics = useCallback(
    (
      pending: StaffLeave[],
      current: StaffLeave[],
      all: StaffLeave[]
    ) => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const threeDaysLater = new Date();
      threeDaysLater.setDate(today.getDate() + 3);
      threeDaysLater.setHours(23, 59, 59, 999);

      // Upcoming returns - returning within 3 days
      const upcomingReturns = current.filter((leave) => {
        if (!leave.toDate) return false;
        const toDate = new Date(leave.toDate);
        toDate.setHours(23, 59, 59, 999);
        return toDate >= today && toDate <= threeDaysLater;
      }).length;

      // This month's total applications
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const monthlyCount = all.filter((leave) => {
        if (!leave.appliedAt) return false;
        return (
          leave.appliedAt.getMonth() === currentMonth &&
          leave.appliedAt.getFullYear() === currentYear
        );
      }).length;

      console.log('📊 Leave Statistics:', {
        pending: pending.length,
        currentlyOnLeave: current.length,
        upcomingReturns,
        monthlyCount,
        currentLeavesData: current.map(l => ({
          name: l.staffName,
          type: l.leaveTypeCode,
          from: l.fromDate?.toLocaleDateString(),
          to: l.toDate?.toLocaleDateString(),
        })),
      });

      setStatistics({
        totalStaff: 0,
        currentlyOnLeave: current.length,
        pendingApprovals: pending.length,
        upcomingReturns,
        monthlyLeaveCount: monthlyCount,
      });
    },
    []
  );

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const [all, active] = await Promise.all([
        getAllLeaveTypes(),
        getActiveLeaveTypes(),
      ]);
      setLeaveTypes(all);
      setActiveLeaveTypes(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leave types');
    }
  }, []);

  useEffect(() => {
    fetchLeaveTypes();
  }, [fetchLeaveTypes]);

    const fetchAllLeaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, pending, current] = await Promise.all([
        getAllLeaves(activeBatch?.id),
        getPendingLeaves(),
        getCurrentLeaves(),
      ]);
      setAllLeaves(all);
      setPendingLeaves(pending);
      setCurrentLeaves(current);
      calculateStatistics(pending, current, all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
   }, [calculateStatistics, activeBatch]);

  const fetchPendingLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingLeaves();
      setPendingLeaves(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending leaves');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCurrentLeaves();
      setCurrentLeaves(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch current leaves');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaffLeaves = useCallback(async (staffId: string) => {
    setLoading(true);
    try {
      const data = await getLeaveByStaff(staffId);
      setStaffLeaves(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch staff leaves');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApplyLeave = async (
    formData: LeaveFormData,
    staffName: string,
    forceNumber: string,
    rank: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const leaveType = leaveTypes.find((lt) => lt.id === formData.leaveTypeId);
            const leaveId = await applyLeave(
        formData, staffName, forceNumber, rank,
        leaveType?.name ?? '', leaveType?.code ?? '',
        user?.uid ?? '',
        activeBatch?.id,
        activeBatch?.batchNumber
      );

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Leave', 'Leave Applied',
        { staffName, leaveType: leaveType?.name, from: formData.fromDate, to: formData.toDate },
        leaveId
      );

      await fetchAllLeaves();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply leave');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

    const handleApproveLeave = async (leaveId: string): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      // Find the leave record
      const leave = allLeaves.find(l => l.id === leaveId);
      if (!leave) {
        throw new Error('Leave record not found');
      }

      // 1. APPROVE THE LEAVE
      await approveLeave(
        leaveId,
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? ''
      );

                  // 2. AUTO-UPDATE STAFF STATUS (silently skip if staff not found)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (leave.fromDate && leave.fromDate <= today) {
        try {
          await updateStaffStatus(leave.staffId, 'leave');
        } catch (statusErr) {
          // Silent skip - staff may be from different batch or deleted
          console.debug(`Skipped status update for ${leave.staffName}`);
        }
      }
      // 3. 🆕 AUTO-CREATE ATTENDANCE RECORDS FOR LEAVE DATES
      if (leave.fromDate && leave.toDate) {
        const attendanceEntries = [];
        const currentDate = new Date(leave.fromDate);
        const endDate = new Date(leave.toDate);

        while (currentDate <= endDate) {
          attendanceEntries.push({
            staffId: leave.staffId,
            staffName: leave.staffName,
            forceNumber: leave.forceNumber,
            rank: leave.rank,
            status: 'leave' as const,
            remarks: `Auto: ${leave.leaveTypeName} (${leave.leaveNumber})`,
          });

          // Mark attendance for each day
          const dateStr = currentDate.toISOString().split('T')[0];
                    try {
            await markBulkAttendance(
              [{
                staffId: leave.staffId,
                staffName: leave.staffName,
                forceNumber: leave.forceNumber,
                rank: leave.rank,
                status: 'leave',
                remarks: `Auto: ${leave.leaveTypeName} (${leave.leaveNumber})`,
              }],
              dateStr,
              user?.uid ?? 'system'
            );
          } catch (attErr) {
            // Silent skip
            console.debug(`Skipped attendance marking for ${dateStr}`);
          }

          // Next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // 4. LOG THE APPROVAL
      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Leave',
        'Leave Approved (Auto-synced)',
        {
          leaveNumber: leave.leaveNumber,
          staffName: leave.staffName,
          days: leave.numberOfDays,
          attendanceUpdated: true,
          statusUpdated: true,
        },
        leaveId
      );

      await fetchAllLeaves();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve leave');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectLeave = async (
    leaveId: string, reason: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await rejectLeave(
        leaveId,
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        reason
      );

      await logActivity(
        user?.uid ?? '', user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff', 'Leave', 'Leave Rejected', { reason }, leaveId
      );

      await fetchAllLeaves();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject leave');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

    const handleCancelLeave = async (leaveId: string): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const leave = allLeaves.find(l => l.id === leaveId);

      await cancelLeave(leaveId);

      // 🆕 If leave was approved, reactivate staff
      if (leave?.status === 'approved' && leave.staffId) {
        try {
          await updateStaffStatus(leave.staffId, 'active');
        } catch (err) {
          console.warn('Failed to reactivate staff on cancel:', err);
        }
      }

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Leave',
        'Leave Cancelled',
        { leaveNumber: leave?.leaveNumber, staffName: leave?.staffName },
        leaveId
      );

      await fetchAllLeaves();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel leave');
      return false;
    } finally {
      setSubmitting(false);
    }
  };
    const handleRecordReturn = async (
    leaveId: string, returnDate: string,
    joiningReport: boolean, delayReason: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      // Find the leave record
      const leave = allLeaves.find(l => l.id === leaveId);
      if (!leave) {
        throw new Error('Leave record not found');
      }

      // 1. RECORD THE RETURN
      await recordLeaveReturn(leaveId, returnDate, joiningReport, delayReason);

      // 2. 🆕 AUTO-REACTIVATE STAFF STATUS
      await updateStaffStatus(leave.staffId, 'active');

      // 3. 🆕 MARK PRESENT FROM RETURN DATE
      const returnDateStr = returnDate;
      try {
        await markBulkAttendance(
          [{
            staffId: leave.staffId,
            staffName: leave.staffName,
            forceNumber: leave.forceNumber,
            rank: leave.rank,
            status: 'present',
            remarks: `Auto: Returned from ${leave.leaveTypeName}`,
          }],
          returnDateStr,
          user?.uid ?? 'system'
        );
      } catch (attErr) {
        console.warn('Failed to mark return day attendance:', attErr);
      }

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Leave',
        'Leave Return Recorded (Auto-synced)',
        {
          leaveNumber: leave.leaveNumber,
          staffName: leave.staffName,
          returnDate,
          joiningReport,
          delayReason,
          statusReactivated: true,
        },
        leaveId
      );

      await fetchAllLeaves();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record return');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLeaveType = async (
    name: string, code: string, maxDays: number,
    isPaid: boolean, description: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await addLeaveType(name, code, maxDays, isPaid, description);
      await fetchLeaveTypes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add leave type');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLeaveType = async (
    typeId: string, isActive: boolean
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await toggleLeaveTypeStatus(typeId, isActive);
      setLeaveTypes((prev) =>
        prev.map((lt) => (lt.id === typeId ? { ...lt, isActive } : lt))
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle leave type');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const getLeaveTypeName = (typeId: string) =>
    leaveTypes.find((lt) => lt.id === typeId)?.name ?? 'Unknown';

  const clearError = () => setError(null);

  return {
    allLeaves, pendingLeaves, currentLeaves, staffLeaves,
    leaveTypes, activeLeaveTypes, statistics,
    loading, submitting, error,
    fetchAllLeaves, fetchPendingLeaves, fetchCurrentLeaves, fetchStaffLeaves,
    handleApplyLeave, handleApproveLeave, handleRejectLeave,
    handleCancelLeave, handleRecordReturn,
    fetchLeaveTypes, handleAddLeaveType, handleToggleLeaveType,
    getLeaveTypeName, clearError,
  };
};