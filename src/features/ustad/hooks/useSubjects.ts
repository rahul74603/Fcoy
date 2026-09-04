// ============================================
// useSubjects HOOK - FIXED
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  Subject,
  SubjectFormData,
  StaffSubjectAssignment,
  AssignmentFormData,
} from '../types/subject.types';
import {
  getAllSubjects,
  getActiveSubjects,
  addSubject,
  updateSubject,
  deleteSubject,
  toggleSubjectStatus,
  assignSubjectsToStaff,
  getAssignmentsByStaff,
  getAllAssignments,
  removeSubjectAssignment,
} from '../api/subject.api';
import { logActivity } from '../api/activityLog.api';
import { useAuth } from '../../../contexts/AuthContext';
import { actorName } from '../../../utils/actorName';

interface UseSubjectsReturn {
  subjects: Subject[];
  activeSubjects: Subject[];
  assignments: StaffSubjectAssignment[];
  staffAssignments: StaffSubjectAssignment[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  fetchSubjects: () => Promise<void>;
  handleAddSubject: (formData: SubjectFormData) => Promise<boolean>;
  handleUpdateSubject: (subjectId: string, formData: Partial<SubjectFormData>) => Promise<boolean>;
  handleDeleteSubject: (subjectId: string) => Promise<boolean>;
  handleToggleStatus: (subjectId: string, isActive: boolean) => Promise<boolean>;
  fetchAllAssignments: () => Promise<void>;
  fetchStaffAssignments: (staffId: string) => Promise<void>;
  handleAssignSubjects: (
    formData: AssignmentFormData,
    staffName: string,
    forceNumber: string
  ) => Promise<boolean>;
  handleRemoveAssignment: (assignmentId: string) => Promise<boolean>;
  getSubjectById: (id: string) => Subject | undefined;
  getSubjectName: (id: string) => string;
  clearError: () => void;
}

export const useSubjects = (): UseSubjectsReturn => {
  // ✅ FIX: 'user' use karo
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjects, setActiveSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<StaffSubjectAssignment[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffSubjectAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, active] = await Promise.all([getAllSubjects(), getActiveSubjects()]);
      setSubjects(all);
      setActiveSubjects(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const fetchAllAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAssignments();
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaffAssignments = useCallback(async (staffId: string) => {
    setLoading(true);
    try {
      const data = await getAssignmentsByStaff(staffId);
      setStaffAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch staff assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddSubject = async (formData: SubjectFormData): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const id = await addSubject(formData, user?.uid ?? '');

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Subject',
        'Subject Added',
        { name: formData.name, code: formData.code },
        id
      );

      await fetchSubjects();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subject');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubject = async (
    subjectId: string,
    formData: Partial<SubjectFormData>
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await updateSubject(subjectId, formData);

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Subject',
        'Subject Updated',
        { updatedFields: Object.keys(formData) },
        subjectId
      );

      await fetchSubjects();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subject');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteSubject(subjectId);

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Subject',
        'Subject Deleted',
        {},
        subjectId
      );

      await fetchSubjects();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subject');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (
    subjectId: string,
    isActive: boolean
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await toggleSubjectStatus(subjectId, isActive);

      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId ? { ...s, isActive } : s))
      );
      setActiveSubjects((prev) =>
        isActive ? prev : prev.filter((s) => s.id !== subjectId)
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSubjects = async (
    formData: AssignmentFormData,
    staffName: string,
    forceNumber: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const subjectDetails = formData.subjectIds.map((id) => {
        const subject = subjects.find((s) => s.id === id);
        return { id, name: subject?.name ?? '', code: subject?.code ?? '' };
      });

      await assignSubjectsToStaff(
        formData,
        staffName,
        forceNumber,
        subjectDetails,
        user?.uid ?? ''
      );

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Subject Assignment',
        'Subjects Assigned',
        { staffName, subjects: subjectDetails.map((s) => s.name) },
        formData.staffId
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign subjects');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      await removeSubjectAssignment(assignmentId);

      await logActivity(
        user?.uid ?? '',
        actorName(user),
        user?.role ?? 'staff',
        'Subject Assignment',
        'Assignment Removed',
        {},
        assignmentId
      );

      setStaffAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const getSubjectById = (id: string) => subjects.find((s) => s.id === id);
  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Unknown';
  const clearError = () => setError(null);

  return {
    subjects,
    activeSubjects,
    assignments,
    staffAssignments,
    loading,
    submitting,
    error,
    fetchSubjects,
    handleAddSubject,
    handleUpdateSubject,
    handleDeleteSubject,
    handleToggleStatus,
    fetchAllAssignments,
    fetchStaffAssignments,
    handleAssignSubjects,
    handleRemoveAssignment,
    getSubjectById,
    getSubjectName,
    clearError,
  };
};