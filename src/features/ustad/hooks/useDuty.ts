// ============================================
// useDuty HOOK
// Batch-wise support included
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { StaffDuty, DutyFormData, DutyType } from '../types/duty.types';
import {
  assignDuty,
  completeDuty,
  transferDuty,
  getDutiesByDate,
  getDutiesByStaff,
  getAllDutyTypes,
  getActiveDutyTypes,
  addDutyType,
  toggleDutyTypeStatus,
} from '../api/duty.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';
import { actorName } from '../../../utils/actorName';
import { useBatch } from '../../../contexts/BatchContext';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface UseDutyReturn {
  // Data
  duties: StaffDuty[];
  staffDuties: StaffDuty[];
  dutyTypes: DutyType[];
  activeDutyTypes: DutyType[];

  // Loading States
  loading: boolean;
  submitting: boolean;
  error: string | null;

  // Batch
  hasBatch: boolean;

  // Fetchers
  fetchDutiesByDate: (date: string) => Promise<void>;
  fetchStaffDuties: (staffId: string) => Promise<void>;
  fetchDutyTypes: () => Promise<void>;

  // Actions
  handleAssignDuty: (
    formData: DutyFormData,
    staffName: string,
    forceNumber: string,
    rank: string
  ) => Promise<boolean>;
  handleCompleteDuty: (dutyId: string) => Promise<boolean>;
  handleTransferDuty: (
    dutyId: string,
    newStaffId: string,
    newStaffName: string,
    reason: string
  ) => Promise<boolean>;
  handleAddDutyType: (name: string, description: string) => Promise<boolean>;
  handleToggleDutyType: (
    typeId: string,
    isActive: boolean
  ) => Promise<boolean>;

  // Helpers
  getDutyTypeName: (typeId: string) => string;
  clearError: () => void;
}

// ═══════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════

export const useDuty = (): UseDutyReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  // ─── State ──────────────────────────────
  const [duties, setDuties] = useState<StaffDuty[]>([]);
  const [staffDuties, setStaffDuties] = useState<StaffDuty[]>([]);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [activeDutyTypes, setActiveDutyTypes] = useState<DutyType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch Duty Types ────────────────────
  const fetchDutyTypes = useCallback(async () => {
    try {
      const [all, active] = await Promise.all([
        getAllDutyTypes(),
        getActiveDutyTypes(),
      ]);
      setDutyTypes(all);
      setActiveDutyTypes(active);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch duty types'
      );
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchDutyTypes();
  }, [fetchDutyTypes]);

  // ─── Fetch Duties by Date (batch-filtered) ────
  const fetchDutiesByDate = useCallback(
    async (date: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDutiesByDate(date, activeBatch?.id);
        setDuties(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch duties'
        );
      } finally {
        setLoading(false);
      }
    },
    [activeBatch]
  );

  // ─── Fetch Staff Duties ──────────────────
  const fetchStaffDuties = useCallback(
    async (staffId: string) => {
      setLoading(true);
      try {
        const data = await getDutiesByStaff(staffId, activeBatch?.id);
        setStaffDuties(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch staff duties'
        );
      } finally {
        setLoading(false);
      }
    },
    [activeBatch]
  );

  // ─── Assign Duty ─────────────────────────
  const handleAssignDuty = async (
    formData: DutyFormData,
    staffName: string,
    forceNumber: string,
    rank: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const dutyType = dutyTypes.find((dt) => dt.id === formData.dutyTypeId);

      const dutyId = await assignDuty(
        formData,
        staffName,
        forceNumber,
        rank,
        dutyType?.name ?? '',
        user?.uid ?? '',
        activeBatch?.id,
        activeBatch?.batchNumber
      );

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Duty',
        'Duty Assigned',
        {
          duty: dutyType?.name,
          staff: staffName,
          date: formData.date,
          batch: activeBatch?.batchNumber,
        },
        dutyId
      );

      await fetchDutiesByDate(formData.date);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to assign duty'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Complete Duty ───────────────────────
  const handleCompleteDuty = async (dutyId: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await completeDuty(dutyId);
      setDuties((prev) =>
        prev.map((d) =>
          d.id === dutyId ? { ...d, status: 'completed' as const } : d
        )
      );
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to complete duty'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Transfer Duty ───────────────────────
  const handleTransferDuty = async (
    dutyId: string,
    newStaffId: string,
    newStaffName: string,
    reason: string
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await transferDuty(dutyId, newStaffId, newStaffName, reason);

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Duty',
        'Duty Transferred',
        { newStaff: newStaffName, reason },
        dutyId
      );

      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to transfer duty'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Add Duty Type ───────────────────────
  const handleAddDutyType = async (
    name: string,
    description: string
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      await addDutyType(name, description);
      await fetchDutyTypes();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add duty type'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Toggle Duty Type Status ─────────────
  const handleToggleDutyType = async (
    typeId: string,
    isActive: boolean
  ): Promise<boolean> => {
    try {
      await toggleDutyTypeStatus(typeId, isActive);
      setDutyTypes((prev) =>
        prev.map((dt) => (dt.id === typeId ? { ...dt, isActive } : dt))
      );
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to toggle duty type'
      );
      return false;
    }
  };

  // ─── Helpers ─────────────────────────────
  const getDutyTypeName = (typeId: string) =>
    dutyTypes.find((dt) => dt.id === typeId)?.name ?? 'Unknown';

  const clearError = () => setError(null);

  // ─── Return ──────────────────────────────
  return {
    duties,
    staffDuties,
    dutyTypes,
    activeDutyTypes,
    loading,
    submitting,
    error,
    hasBatch,
    fetchDutiesByDate,
    fetchStaffDuties,
    fetchDutyTypes,
    handleAssignDuty,
    handleCompleteDuty,
    handleTransferDuty,
    handleAddDutyType,
    handleToggleDutyType,
    getDutyTypeName,
    clearError,
  };
};