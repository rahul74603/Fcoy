// ============================================
// useDeputation HOOK
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  DeputationRecord, DeputationFormData,
} from '../types/deputation.types';
import {
  addDeputation, getDeputationsByBatch,
  markDeputationReturned, cancelDeputation,
  deleteDeputation, getDeputationSummary,
} from '../api/deputation.api';
import { updateStaffStatus } from '../api/staff.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';
import { actorName } from '../../../utils/actorName';
import { useBatch } from '../../../contexts/BatchContext';

interface Summary {
  total: number;
  activeIncoming: number;
  activeOutgoing: number;
  returned: number;
  cancelled: number;
}

interface UseDeputationReturn {
  deputations: DeputationRecord[];
  summary: Summary;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  hasBatch: boolean;

  fetchDeputations: () => Promise<void>;
  handleAdd: (formData: DeputationFormData) => Promise<boolean>;
  handleMarkReturned: (id: string, returnDate: string) => Promise<boolean>;
  handleCancel: (id: string) => Promise<boolean>;
  handleDelete: (id: string) => Promise<boolean>;
  clearError: () => void;
}

const DEFAULT_SUMMARY: Summary = {
  total: 0, activeIncoming: 0, activeOutgoing: 0, returned: 0, cancelled: 0,
};

export const useDeputation = (): UseDeputationReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  const [deputations, setDeputations] = useState<DeputationRecord[]>([]);
  const [summary, setSummary] = useState<Summary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeputations = useCallback(async () => {
    if (!activeBatch) {
      setDeputations([]);
      setSummary(DEFAULT_SUMMARY);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [data, summaryData] = await Promise.all([
        getDeputationsByBatch(activeBatch.id),
        getDeputationSummary(activeBatch.id),
      ]);
      setDeputations(data);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deputations');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  useEffect(() => {
    fetchDeputations();
  }, [fetchDeputations]);

  const handleAdd = async (formData: DeputationFormData): Promise<boolean> => {
    if (!activeBatch) {
      setError('Please activate a batch first');
      return false;
    }

    setSubmitting(true);
    setError(null);
    try {
      const depId = await addDeputation(
        formData,
        activeBatch.id,
        activeBatch.batchNumber,
        user?.uid ?? ''
      );

      // 🆕 AUTO-UPDATE STAFF STATUS
      if (formData.direction === 'outgoing' && formData.staffId) {
        try {
          await updateStaffStatus(formData.staffId, 'deputed_out');
        } catch (err) {
          console.warn('Failed to update staff status:', err);
        }
      }

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Deputation',
        formData.direction === 'incoming' ? 'Personnel Received' : 'Personnel Deputed Out',
        {
          staff: formData.staffName,
          from: formData.fromCompany,
          to: formData.toCompany,
          purpose: formData.purpose,
        },
        depId
      );

      await fetchDeputations();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add deputation');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReturned = async (id: string, returnDate: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      const dep = deputations.find(d => d.id === id);
      await markDeputationReturned(id, returnDate);

      // 🆕 AUTO-UPDATE STAFF STATUS (outgoing return → active)
      if (dep?.direction === 'outgoing' && dep.staffId) {
        try {
          await updateStaffStatus(dep.staffId, 'active');
        } catch (err) {
          console.warn('Failed to reactivate staff:', err);
        }
      }

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Deputation',
        'Marked Returned',
        { staffName: dep?.staffName, returnDate },
        id
      );

      await fetchDeputations();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark returned');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      const dep = deputations.find(d => d.id === id);
      await cancelDeputation(id);

      // 🆕 Reactivate staff if outgoing was active
      if (dep?.direction === 'outgoing' && dep.status === 'active' && dep.staffId) {
        try {
          await updateStaffStatus(dep.staffId, 'active');
        } catch (err) {
          console.warn('Failed to reactivate:', err);
        }
      }

      await fetchDeputations();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await deleteDeputation(id);
      await fetchDeputations();
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
    deputations, summary, loading, submitting, error, hasBatch,
    fetchDeputations, handleAdd, handleMarkReturned, handleCancel, handleDelete,
    clearError,
  };
};