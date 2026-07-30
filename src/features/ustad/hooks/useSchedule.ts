// ============================================
// useSchedule HOOK
// ============================================

import { useState, useCallback } from 'react';
import {
  TrainingSchedule, ScheduleFormData, ScheduleStatus,
} from '../types/schedule.types';
import {
  addSchedule, getSchedulesByDate, getSchedulesByDateRange,
  updateSchedule, deleteSchedule, updateScheduleStatus,
  checkScheduleConflict,
} from '../api/schedule.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';

interface UseScheduleReturn {
  schedules: TrainingSchedule[];
  weekSchedules: TrainingSchedule[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  hasBatch: boolean;

  fetchDaily: (date: string) => Promise<void>;
  fetchWeekly: (fromDate: string, toDate: string) => Promise<void>;
  handleAdd: (
    formData: ScheduleFormData,
    ustadDetails: { name: string; rank: string; forceNumber: string },
    subjectDetails: { name: string; code: string }
  ) => Promise<boolean>;
  handleUpdate: (
    id: string,
    formData: Partial<ScheduleFormData>,
    extras?: {
      ustadDetails?: { name: string; rank: string; forceNumber: string };
      subjectDetails?: { name: string; code: string };
    }
  ) => Promise<boolean>;
  handleUpdateStatus: (id: string, status: ScheduleStatus) => Promise<boolean>;
  handleDelete: (id: string) => Promise<boolean>;
  checkConflict: (
    ustadId: string, date: string, startTime: string, endTime: string, excludeId?: string
  ) => Promise<TrainingSchedule | null>;
  clearError: () => void;
}

export const useSchedule = (): UseScheduleReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  const [schedules, setSchedules] = useState<TrainingSchedule[]>([]);
  const [weekSchedules, setWeekSchedules] = useState<TrainingSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDaily = useCallback(async (date: string) => {
    if (!activeBatch) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSchedulesByDate(activeBatch.id, date);
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  const fetchWeekly = useCallback(async (fromDate: string, toDate: string) => {
    if (!activeBatch) {
      setWeekSchedules([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSchedulesByDateRange(activeBatch.id, fromDate, toDate);
      setWeekSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weekly schedules');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  const handleAdd = async (
    formData: ScheduleFormData,
    ustadDetails: { name: string; rank: string; forceNumber: string },
    subjectDetails: { name: string; code: string }
  ): Promise<boolean> => {
    if (!activeBatch) {
      setError('Please activate a batch first');
      return false;
    }

    setSubmitting(true);
    setError(null);
    try {
      const scheduleId = await addSchedule(
        formData,
        activeBatch.id,
        activeBatch.batchNumber,
        ustadDetails,
        subjectDetails,
        user?.uid ?? ''
      );

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Schedule',
        'Class Scheduled',
        {
          ustad: ustadDetails.name,
          subject: subjectDetails.name,
          date: formData.date,
          time: `${formData.startTime}-${formData.endTime}`,
        },
        scheduleId
      );

      await fetchDaily(formData.date);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add schedule');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (
    id: string,
    formData: Partial<ScheduleFormData>,
    extras?: {
      ustadDetails?: { name: string; rank: string; forceNumber: string };
      subjectDetails?: { name: string; code: string };
    }
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await updateSchedule(id, formData, extras);   // ★ extras pass-through

      // ★ Activity log (reschedule/edit auditable rahe)
      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? '',
        user?.role ?? 'staff',
        'Schedule',
        'Class Rescheduled/Updated',
        {
          date: formData.date ?? '',
          time: `${formData.startTime ?? ''}-${formData.endTime ?? ''}`,
          ustad: extras?.ustadDetails?.name ?? '',
          subject: extras?.subjectDetails?.name ?? '',
        },
        id
      );

      if (formData.date) await fetchDaily(formData.date);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: ScheduleStatus
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await updateScheduleStatus(id, status);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const checkConflict = async (
    ustadId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<TrainingSchedule | null> => {
    if (!activeBatch) return null;
    return checkScheduleConflict(activeBatch.id, ustadId, date, startTime, endTime, excludeId);
  };

  const clearError = () => setError(null);

  return {
    schedules, weekSchedules, loading, submitting, error, hasBatch,
    fetchDaily, fetchWeekly, handleAdd, handleUpdate,
    handleUpdateStatus, handleDelete, checkConflict, clearError,
  };
};