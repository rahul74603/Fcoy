// ============================================
// useBatchProgress HOOK
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  BatchProgress, SubjectProgress,
} from '../types/batchProgress.types';
import {
  getOrCreateBatchProgress, updateSubjectProgress,
  addSubjectToPlan, removeSubjectFromPlan,
  addMilestone, completeMilestone,
} from '../api/batchProgress.api';
import { useBatch } from '../../../contexts/BatchContext';

interface UseBatchProgressReturn {
  progress: BatchProgress | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;

  fetchProgress: () => Promise<void>;
  handleAddSubject: (subject: SubjectProgress) => Promise<boolean>;
  handleRemoveSubject: (subjectId: string) => Promise<boolean>;
  handleUpdateProgress: (subjectId: string, updates: Partial<SubjectProgress>) => Promise<boolean>;
  handleAddMilestone: (name: string, date: Date) => Promise<boolean>;
  handleCompleteMilestone: (index: number) => Promise<boolean>;
  clearError: () => void;
}

export const useBatchProgress = (): UseBatchProgressReturn => {
  const { activeBatch } = useBatch();

  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!activeBatch) {
      setProgress(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Get batch details for dates
      const startDate = activeBatch.startDate
        ? new Date(activeBatch.startDate)
        : new Date();
      const endDate = activeBatch.endDate
        ? new Date(activeBatch.endDate)
        : new Date(new Date().setMonth(new Date().getMonth() + 6));

      const data = await getOrCreateBatchProgress(
        activeBatch.id,
        activeBatch.batchNumber,
        activeBatch.batchName || '',
        startDate,
        endDate
      );

      // Recalculate days
      const today = new Date();
      const daysElapsed = Math.max(0, Math.ceil(
        (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const daysRemaining = Math.max(0, data.totalDays - daysElapsed);

      setProgress({
        ...data,
        daysElapsed,
        daysRemaining,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch progress');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const handleAddSubject = async (subject: SubjectProgress): Promise<boolean> => {
    if (!progress) return false;
    setSubmitting(true);
    try {
      await addSubjectToPlan(progress.id, subject);
      await fetchProgress();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subject');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSubject = async (subjectId: string): Promise<boolean> => {
    if (!progress) return false;
    setSubmitting(true);
    try {
      await removeSubjectFromPlan(progress.id, subjectId);
      await fetchProgress();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProgress = async (
    subjectId: string,
    updates: Partial<SubjectProgress>
  ): Promise<boolean> => {
    if (!progress) return false;
    setSubmitting(true);
    try {
      await updateSubjectProgress(progress.id, subjectId, updates);
      await fetchProgress();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMilestone = async (name: string, date: Date): Promise<boolean> => {
    if (!progress) return false;
    setSubmitting(true);
    try {
      await addMilestone(progress.id, name, date);
      await fetchProgress();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add milestone');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteMilestone = async (index: number): Promise<boolean> => {
    if (!progress) return false;
    setSubmitting(true);
    try {
      await completeMilestone(progress.id, index);
      await fetchProgress();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const clearError = () => setError(null);

  return {
    progress, loading, submitting, error,
    fetchProgress, handleAddSubject, handleRemoveSubject,
    handleUpdateProgress, handleAddMilestone, handleCompleteMilestone,
    clearError,
  };
};