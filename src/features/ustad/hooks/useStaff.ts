// ============================================
// useStaff HOOK - Batch-aware
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  Staff,
  StaffFormData,
  StaffFilter,
  StaffStatus,
  DEFAULT_STAFF_FILTER,
} from '../types/staff.types';
import {
  getStaffByBatch,
  addStaff,
  updateStaff,
  deleteStaff,
  updateStaffStatus,
  filterStaff,
  getStaffSummary,
} from '../api/staff.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';

interface UseStaffReturn {
  staffList: Staff[];
  filteredStaff: Staff[];
  selectedStaff: Staff | null;
  summary: StaffSummary;
  filter: StaffFilter;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  hasBatch: boolean;
  fetchStaff: () => Promise<void>;
  handleAddStaff: (formData: StaffFormData) => Promise<boolean>;
  handleUpdateStaff: (staffId: string, formData: Partial<StaffFormData>) => Promise<boolean>;
  handleDeleteStaff: (staffId: string) => Promise<boolean>;
  handleUpdateStatus: (staffId: string, status: StaffStatus) => Promise<boolean>;
  setFilter: (filter: Partial<StaffFilter>) => void;
  resetFilter: () => void;
  selectStaff: (staff: Staff | null) => void;
  clearError: () => void;
}

interface StaffSummary {
  total: number;
  active: number;
  onLeave: number;
  onTD: number;
  inHospital: number;
  onCourse: number;
  inactive: number;
}

const DEFAULT_SUMMARY: StaffSummary = {
  total: 0, active: 0, onLeave: 0, onTD: 0,
  inHospital: 0, onCourse: 0, inactive: 0,
};

export const useStaff = (): UseStaffReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [summary, setSummary] = useState<StaffSummary>(DEFAULT_SUMMARY);
  const [filter, setFilterState] = useState<StaffFilter>(DEFAULT_STAFF_FILTER);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const filteredStaff = filterStaff(staffList, filter);

  const fetchStaff = useCallback(async () => {
    if (!activeBatch) {
      setStaffList([]);
      setSummary(DEFAULT_SUMMARY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [data, summaryData] = await Promise.all([
        getStaffByBatch(activeBatch.id),
        getStaffSummary(activeBatch.id),
      ]);
      setStaffList(data);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch staff data');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddStaff = async (formData: StaffFormData): Promise<boolean> => {
    if (!activeBatch) {
      setError('Please activate a batch first.');
      return false;
    }

    setSubmitting(true);
    setError(null);
    try {
      const staffId = await addStaff(
        formData,
        activeBatch.id,
        activeBatch.batchNumber,
        user?.uid ?? ''
      );

      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? 'Unknown',
        user?.role ?? 'staff',
        'Staff',
        'Staff Added',
        {
          forceNumber: formData.forceNumber,
          name: formData.name,
          rank: formData.rank,
          batchNumber: activeBatch.batchNumber,
        },
        staffId
      );

      await fetchStaff();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStaff = async (
    staffId: string,
    formData: Partial<StaffFormData>
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await updateStaff(staffId, formData);
      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? 'Unknown',
        user?.role ?? 'staff',
        'Staff',
        'Staff Updated',
        { updatedFields: Object.keys(formData) },
        staffId
      );
      await fetchStaff();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staffId: string): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const staffToDelete = staffList.find(s => s.id === staffId);
      await deleteStaff(staffId);
      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? 'Unknown',
        user?.role ?? 'staff',
        'Staff',
        'Staff Deleted',
        { forceNumber: staffToDelete?.forceNumber ?? '', name: staffToDelete?.name ?? '' },
        staffId
      );
      await fetchStaff();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    staffId: string,
    status: StaffStatus
  ): Promise<boolean> => {
    if (!activeBatch) return false;

    setSubmitting(true);
    setError(null);
    try {
      await updateStaffStatus(staffId, status);
      await logActivity(
        user?.uid ?? '',
        user?.displayName ?? user?.email ?? 'Unknown',
        user?.role ?? 'staff',
        'Staff',
        'Status Updated',
        { newStatus: status },
        staffId
      );

      setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, status } : s));
      const newSummary = await getStaffSummary(activeBatch.id);
      setSummary(newSummary);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const setFilter = (newFilter: Partial<StaffFilter>) => {
    setFilterState(prev => ({ ...prev, ...newFilter }));
  };

  const resetFilter = () => setFilterState(DEFAULT_STAFF_FILTER);
  const selectStaff = (staff: Staff | null) => setSelectedStaff(staff);
  const clearError = () => setError(null);

  return {
    staffList,
    filteredStaff,
    selectedStaff,
    summary,
    filter,
    loading,
    submitting,
    error,
    hasBatch,
    fetchStaff,
    handleAddStaff,
    handleUpdateStaff,
    handleDeleteStaff,
    handleUpdateStatus,
    setFilter,
    resetFilter,
    selectStaff,
    clearError,
  };
};