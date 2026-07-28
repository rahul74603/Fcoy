// ============================================
// SUBJECT ASSIGNMENT SCREEN
// ============================================

import React, { useState, useEffect } from 'react';
import { useStaff } from '../hooks/useStaff';
import { useSubjects } from '../hooks/useSubjects';
import { Staff } from '../types/staff.types';
import { StaffSubjectAssignment } from '../types/subject.types';
import SubjectBadge from '../components/shared/SubjectBadge';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const SubjectAssignmentScreen: React.FC = () => {
  const { staffList, loading: staffLoading } = useStaff();
  const {
    activeSubjects,
    staffAssignments,
    loading: subjectLoading,
    submitting,
    error,
    fetchStaffAssignments,
    handleAssignSubjects,
    handleRemoveAssignment,
    clearError,
  } = useSubjects();

  // ─── UI State ────────────────────────────
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<StaffSubjectAssignment | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [searchStaff, setSearchStaff] = useState('');
  const [assignDate, setAssignDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [assignRemarks, setAssignRemarks] = useState('');

  // ─── Filtered Staff List ──────────────────
  const filteredStaff = staffList.filter(
    (s) =>
      s.status === 'active' &&
      (searchStaff === '' ||
        s.name.toLowerCase().includes(searchStaff.toLowerCase()) ||
        s.forceNumber.includes(searchStaff))
  );

  // ─── When Staff Selected ──────────────────
  useEffect(() => {
    if (selectedStaff) {
      fetchStaffAssignments(selectedStaff.id);
    }
  }, [selectedStaff, fetchStaffAssignments]);

  // ─── Already assigned subject IDs ────────
  const assignedSubjectIds = staffAssignments.map((a) => a.subjectId);

  // ─── Available subjects (not yet assigned) ─
  const availableSubjects = activeSubjects.filter(
    (s) => !assignedSubjectIds.includes(s.id)
  );

  // ─── Toggle Subject Selection ─────────────
  const toggleSubjectSelect = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  // ─── Assign Submit ────────────────────────
  const handleAssignSubmit = async () => {
    if (!selectedStaff || selectedSubjectIds.length === 0) return;

    const success = await handleAssignSubjects(
      {
        staffId: selectedStaff.id,
        subjectIds: selectedSubjectIds,
        assignedDate: assignDate,
        remarks: assignRemarks,
      },
      selectedStaff.name,
      selectedStaff.forceNumber
    );

    if (success) {
      setShowAssignModal(false);
      setSelectedSubjectIds([]);
      setAssignRemarks('');
      await fetchStaffAssignments(selectedStaff.id);
    }
  };

  // ─── Remove Assignment ────────────────────
  const handleRemoveConfirm = async () => {
    if (!selectedAssignment) return;
    const success = await handleRemoveAssignment(selectedAssignment.id);
    if (success) {
      setShowRemoveDialog(false);
      setSelectedAssignment(null);
    }
  };

  const loading = staffLoading || subjectLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Subject Assignment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Assign multiple subjects to instructors
          </p>
        </div>
      </div>

      <div className="p-6">
        {/* ── Error ── */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError} className="text-red-400">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── LEFT: Staff List Panel ── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Panel Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-bold text-gray-700 mb-3">
                  👥 Select Instructor
                </h2>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchStaff}
                    onChange={(e) => setSearchStaff(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Staff List */}
              <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-3xl mb-2">👥</p>
                    <p className="text-sm">No active staff found</p>
                  </div>
                ) : (
                  filteredStaff.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => setSelectedStaff(staff)}
                      className={`
                        w-full text-left p-4 border-b border-gray-100
                        hover:bg-blue-50 transition-colors
                        ${
                          selectedStaff?.id === staff.id
                            ? 'bg-blue-50 border-l-4 border-l-blue-600'
                            : ''
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {staff.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {staff.rank} {staff.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {staff.forceNumber}
                          </p>
                        </div>
                        {selectedStaff?.id === staff.id && (
                          <span className="text-blue-600 text-sm">✓</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Assignment Panel ── */}
          <div className="lg:col-span-2">
            {!selectedStaff ? (
              /* No Staff Selected */
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-64">
                <div className="text-center text-gray-400">
                  <p className="text-5xl mb-3">👈</p>
                  <p className="text-sm font-medium">
                    Select an instructor from the left panel
                  </p>
                  <p className="text-xs mt-1">
                    to view and manage their subject assignments
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Staff Info Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                        {selectedStaff.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">
                          {selectedStaff.rank} {selectedStaff.name}
                        </h2>
                        <p className="text-blue-200 text-sm">
                          {selectedStaff.forceNumber} •{' '}
                          {selectedStaff.company}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center bg-white/10 rounded-lg p-3">
                        <p className="text-2xl font-bold">
                          {staffAssignments.length}
                        </p>
                        <p className="text-xs text-blue-200">Subjects</p>
                      </div>
                      {availableSubjects.length > 0 && (
                        <button
                          onClick={() => setShowAssignModal(true)}
                          className="px-4 py-2 bg-white text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          + Assign Subject
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assigned Subjects */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span>📚</span>
                    Assigned Subjects
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {staffAssignments.length}
                    </span>
                  </h3>

                  {staffAssignments.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <p className="text-4xl mb-2">📚</p>
                      <p className="text-sm">No subjects assigned yet</p>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Assign First Subject
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {staffAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <SubjectBadge
                              name=""
                              code={assignment.subjectCode}
                              color="blue"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {assignment.subjectName}
                              </p>
                              <p className="text-xs text-gray-500">
                                Assigned:{' '}
                                {assignment.assignedDate
                                  ? assignment.assignedDate.toLocaleDateString(
                                      'en-IN'
                                    )
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setShowRemoveDialog(true);
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Subjects Preview */}
                {availableSubjects.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <span>➕</span>
                      Available to Assign
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                        {availableSubjects.length}
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {availableSubjects.map((subject) => (
                        <SubjectBadge
                          key={subject.id}
                          name={subject.name}
                          code={subject.code}
                          color="green"
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="mt-4 w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 text-sm font-medium rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      + Click to Assign Subjects
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Assign Modal ── */}
      <FormModal
        isOpen={showAssignModal}
        title="Assign Subjects"
        subtitle={
          selectedStaff
            ? `To: ${selectedStaff.rank} ${selectedStaff.name}`
            : ''
        }
        onClose={() => {
          setShowAssignModal(false);
          setSelectedSubjectIds([]);
        }}
        size="lg"
      >
        <div className="space-y-5">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              Select one or more subjects to assign. Already assigned subjects
              are not shown.
            </p>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assignment Date
            </label>
            <input
              type="date"
              value={assignDate}
              onChange={(e) => setAssignDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Subject Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Subjects{' '}
              {selectedSubjectIds.length > 0 && (
                <span className="text-blue-600">
                  ({selectedSubjectIds.length} selected)
                </span>
              )}
            </label>

            {availableSubjects.length === 0 ? (
              <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-sm">All subjects are already assigned</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {availableSubjects.map((subject) => {
                  const isSelected = selectedSubjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => toggleSubjectSelect(subject.id)}
                      className={`
                        flex items-center gap-2 p-3 rounded-lg border
                        text-left transition-all
                        ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }
                      `}
                    >
                      <div
                        className={`
                          w-4 h-4 rounded border flex items-center
                          justify-center flex-shrink-0 transition-colors
                          ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-400'
                          }
                        `}
                      >
                        {isSelected && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase">
                          {subject.code}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {subject.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              value={assignRemarks}
              onChange={(e) => setAssignRemarks(e.target.value)}
              placeholder="Any notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAssignModal(false);
                setSelectedSubjectIds([]);
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignSubmit}
              disabled={submitting || selectedSubjectIds.length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Assigning...
                </>
              ) : (
                `Assign ${selectedSubjectIds.length} Subject${selectedSubjectIds.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </FormModal>

      {/* ── Remove Dialog ── */}
      <ConfirmDialog
        isOpen={showRemoveDialog}
        title="Remove Subject Assignment"
        message={`Remove "${selectedAssignment?.subjectName}" from ${selectedStaff?.name}?`}
        confirmLabel="Yes, Remove"
        confirmColor="red"
        onConfirm={handleRemoveConfirm}
        onCancel={() => {
          setShowRemoveDialog(false);
          setSelectedAssignment(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default SubjectAssignmentScreen;