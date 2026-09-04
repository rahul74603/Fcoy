// ============================================
// useTestRecords HOOK - Enhanced
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { TestRecord, TestFormData, TestStatus, TraineeResult } from '../types/testRecord.types';
import {
  createTest, getTestsByBatch, updateTest, updateTestStatus,
  saveTestResults, deleteTest, checkDuplicateTest,
} from '../api/testRecord.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';
import { actorName } from '../../../utils/actorName';
import { useBatch } from '../../../contexts/BatchContext';

interface UseTestRecordsReturn {
  tests: TestRecord[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  hasBatch: boolean;

  fetchTests: () => Promise<void>;
  handleCreate: (formData: TestFormData, instructorName: string, instructorsList?: any[]) => Promise<string | false>;
  handleUpdate: (testId: string, formData: Partial<TestFormData>) => Promise<boolean>;
  handleUpdateStatus: (testId: string, status: TestStatus) => Promise<boolean>;
  handleSaveResults: (testId: string, results: TraineeResult[], totalMarks: number, passingMarks: number) => Promise<boolean>;
  handleDelete: (testId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useTestRecords = (): UseTestRecordsReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTests = useCallback(async () => {
    if (!activeBatch) { setTests([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await getTestsByBatch(activeBatch.id);
      setTests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tests');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

    const handleCreate = async (
    formData: TestFormData,
    instructorName: string,
    instructorsList?: any[]  // 🆕
  ): Promise<string | false> => {
    if (!activeBatch) return false;
    setSubmitting(true);
    setError(null);
    try {
      // Check duplicate
      const isDup = await checkDuplicateTest(
        activeBatch.id,
        formData.testName,
        formData.weekNumber
      );
      if (isDup) {
        setError(`Test "${formData.testName}" for Week ${formData.weekNumber} already exists!`);
        return false;
      }

      const testId = await createTest(
        formData, activeBatch.id, activeBatch.batchNumber,
        instructorName, user?.uid ?? '',
        instructorsList  // 🆕 Pass it
      );

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Test', 'Test Created',
        { name: formData.testName, type: formData.testType, week: formData.weekNumber },
        testId
      );

      await fetchTests();
      return testId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (
    testId: string,
    formData: Partial<TestFormData>
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await updateTest(testId, formData);
      await fetchTests();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    testId: string,
    status: TestStatus
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await updateTestStatus(testId, status);
      setTests(prev => prev.map(t => t.id === testId ? { ...t, status } : t));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveResults = async (
    testId: string,
    results: TraineeResult[],
    totalMarks: number,
    passingMarks: number
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await saveTestResults(testId, results, totalMarks, passingMarks);
      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Test', 'Results Saved',
        { count: results.length },
        testId
      );
      await fetchTests();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save results');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (testId: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await deleteTest(testId);
      setTests(prev => prev.filter(t => t.id !== testId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  

  const clearError = () => setError(null);

   return {
    tests, loading, submitting, error, hasBatch,
    fetchTests, handleCreate, handleUpdate,
    handleUpdateStatus, handleSaveResults, handleDelete,
    clearError,
  };
};