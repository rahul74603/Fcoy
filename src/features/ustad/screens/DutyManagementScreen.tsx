// ============================================
// DUTY MANAGEMENT SCREEN
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import { useDuty } from '../hooks/useDuty';
import { useStaff } from '../hooks/useStaff';
import { useLeave } from '../hooks/useLeave';
import {
  StaffDuty,
  DutyFormData,
  DUTY_STATUS_COLORS,
  DUTY_STATUS_LABELS,
  DEFAULT_DUTY_FORM,
} from '../types/duty.types';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const TABS = [
  { key: 'today', label: "Today's Duties", icon: '📋' },
  { key: 'assign', label: 'Assign Duty', icon: '➕' },
  { key: 'types', label: 'Duty Types', icon: '⚙️' },
];

const DutyManagementScreen: React.FC = () => {
     const {
    duties,
    dutyTypes,
    activeDutyTypes,
    loading,
    submitting,
    error,
    fetchDutiesByDate,
    handleAssignDuty,
    handleCompleteDuty,
    handleTransferDuty,
    handleAddDutyType,
    handleToggleDutyType,
    clearError,
  } = useDuty();

  const { staffList, loading: staffLoading } = useStaff();
  // ─── UI State ────────────────────────────
  const [activeTab, setActiveTab] = useState('today');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDutyTypeModal, setShowDutyTypeModal] = useState(false);
  const [selectedDuty, setSelectedDuty] = useState<StaffDuty | null>(null);

  // Form States
  const [dutyForm, setDutyForm] = useState<DutyFormData>({
    ...DEFAULT_DUTY_FORM,
    date: new Date().toISOString().split('T')[0],
  });
    // ═══════════════════════════════════════════
  // 🆕 GET LEAVE DATA FOR AVAILABILITY CHECK
  // ═══════════════════════════════════════════
  const { allLeaves, fetchAllLeaves } = useLeave();

  // Fetch leaves when date changes
  useEffect(() => {
    fetchAllLeaves();
  }, [fetchAllLeaves]);

  // ═══════════════════════════════════════════
  // 🆕 STAFF AVAILABILITY CHECKER
  // ═══════════════════════════════════════════
  const getStaffAvailability = (staffId: string, forDate: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
      return { status: 'unknown', label: 'Unknown', color: 'gray', canAssign: false, reason: '' };
    }

    // Check permanent status
    if (staff.status === 'inactive') {
      return { status: 'inactive', label: '⭕ Inactive', color: 'gray', canAssign: false, reason: 'Staff is inactive' };
    }
    if (staff.status === 'hospital') {
      return { status: 'hospital', label: '🏥 Hospital', color: 'red', canAssign: false, reason: 'Currently in hospital' };
    }
    if (staff.status === 'course') {
      return { status: 'course', label: '📖 On Course', color: 'purple', canAssign: false, reason: 'Attending course' };
    }
    if (staff.status === 'attachment') {
      return { status: 'attachment', label: '🔗 Attachment', color: 'orange', canAssign: false, reason: 'On attachment' };
    }
    if (staff.status === 'deputed_out') {
      return { status: 'deputed_out', label: '↗️ Deputed Out', color: 'pink', canAssign: false, reason: 'Deputed to another unit' };
    }

    // Check active leave for this date
    const checkDate = new Date(forDate);
    checkDate.setHours(12, 0, 0, 0); // Middle of day to avoid timezone issues

    const activeLeave = allLeaves.find(l =>
      l.staffId === staffId &&
      l.status === 'approved' &&
      l.fromDate && l.toDate &&
      checkDate >= l.fromDate &&
      checkDate <= l.toDate
    );

    if (activeLeave) {
      return {
        status: 'leave',
        label: `🏖️ On Leave (${activeLeave.leaveTypeCode})`,
        color: 'yellow',
        canAssign: false,
        reason: `On ${activeLeave.leaveTypeName} from ${activeLeave.fromDate?.toLocaleDateString('en-IN')} to ${activeLeave.toDate?.toLocaleDateString('en-IN')}`
      };
    }

    // Check existing duty on same date
    const existingDuty = duties.find(d =>
      d.staffId === staffId &&
      d.status !== 'cancelled' &&
      d.status !== 'transferred'
    );

    if (existingDuty) {
      return {
        status: 'busy',
        label: `🎖️ On Duty (${existingDuty.dutyTypeName})`,
        color: 'amber',
        canAssign: true, // Can assign but warn
        reason: `Already assigned to ${existingDuty.dutyTypeName}${existingDuty.startTime ? ` at ${existingDuty.startTime}` : ''}`
      };
    }

    // Available!
    return {
      status: 'available',
      label: '✅ Available',
      color: 'green',
      canAssign: true,
      reason: ''
    };
  };

  // ═══════════════════════════════════════════
  // 🆕 CATEGORIZE ALL STAFF
  // ═══════════════════════════════════════════
  const staffAvailability = useMemo(() => {
    const available: typeof staffList = [];
    const busy: typeof staffList = [];
    const unavailable: typeof staffList = [];

    staffList.forEach(staff => {
      const info = getStaffAvailability(staff.id, dutyForm.date);
      if (info.status === 'available') {
        available.push(staff);
      } else if (info.status === 'busy') {
        busy.push(staff);
      } else {
        unavailable.push(staff);
      }
    });

    return { available, busy, unavailable };
  }, [staffList, allLeaves, duties, dutyForm.date]);

  // Get selected staff availability
  const selectedStaffInfo = dutyForm.staffId
    ? getStaffAvailability(dutyForm.staffId, dutyForm.date)
    : null;
  const [transferStaffId, setTransferStaffId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Duty Type Form
  const [dtName, setDtName] = useState('');
  const [dtDescription, setDtDescription] = useState('');

  // ─── Auto Fetch ──────────────────────────
  useEffect(() => {
    fetchDutiesByDate(selectedDate);
  }, [selectedDate, fetchDutiesByDate]);

  // ─── Active Staff ─────────────────────────
  const activeStaff = staffList.filter((s) => s.status === 'active');

    // ─── Assign Submit (with conflict check) ─
  const handleAssignSubmit = async () => {
    if (!dutyForm.staffId || !dutyForm.dutyTypeId || !dutyForm.date) return;

    const staff = staffList.find((s) => s.id === dutyForm.staffId);
    if (!staff) return;

    // 🆕 CHECK AVAILABILITY BEFORE SUBMIT
    const availability = getStaffAvailability(dutyForm.staffId, dutyForm.date);

    // Block if unavailable
    if (!availability.canAssign) {
      alert(
        `❌ Cannot Assign Duty!\n\n` +
        `${staff.rank} ${staff.name} is ${availability.label}.\n\n` +
        `Reason: ${availability.reason}\n\n` +
        `Please select a different staff member.`
      );
      return;
    }

    // Warning for busy staff
    if (availability.status === 'busy') {
      const confirmed = window.confirm(
        `⚠️ Warning: Double Booking!\n\n` +
        `${staff.rank} ${staff.name} is already assigned to a duty:\n${availability.reason}\n\n` +
        `Do you still want to assign this new duty?\n\n` +
        `Recommendation: Transfer existing duty first or choose different staff.`
      );
      if (!confirmed) return;
    }

    // 🆕 CONFIRM ASSIGNMENT
    const dutyType = activeDutyTypes.find(dt => dt.id === dutyForm.dutyTypeId);
    const confirmed = window.confirm(
      `Assign this duty?\n\n` +
      `Duty: ${dutyType?.name}\n` +
      `Staff: ${staff.rank} ${staff.name}\n` +
      `Date: ${new Date(dutyForm.date).toLocaleDateString('en-IN')}\n` +
      `${dutyForm.startTime ? `Time: ${dutyForm.startTime} - ${dutyForm.endTime}\n` : ''}` +
      `${dutyForm.venue ? `Venue: ${dutyForm.venue}` : ''}`
    );

    if (!confirmed) return;

    const success = await handleAssignDuty(
      dutyForm,
      staff.name,
      staff.forceNumber,
      staff.rank
    );

    if (success) {
      setShowAssignModal(false);
      setDutyForm({
        ...DEFAULT_DUTY_FORM,
        date: new Date().toISOString().split('T')[0],
      });
      fetchDutiesByDate(selectedDate);
    }
  };

  // ─── Transfer Submit ──────────────────────
  const handleTransferSubmit = async () => {
    if (!selectedDuty || !transferStaffId || !transferReason) return;

    const newStaff = staffList.find((s) => s.id === transferStaffId);
    if (!newStaff) return;

    const success = await handleTransferDuty(
      selectedDuty.id,
      transferStaffId,
      newStaff.name,
      transferReason
    );

    if (success) {
      setShowTransferModal(false);
      setSelectedDuty(null);
      setTransferStaffId('');
      setTransferReason('');
      fetchDutiesByDate(selectedDate);
    }
  };

  // ─── Complete Confirm ─────────────────────
  const handleCompleteConfirm = async () => {
    if (!selectedDuty) return;
    const success = await handleCompleteDuty(selectedDuty.id);
    if (success) {
      setShowCompleteDialog(false);
      setSelectedDuty(null);
    }
  };

  // ─── Add Duty Type ────────────────────────
  const handleDutyTypeSubmit = async () => {
    if (!dtName) return;
    const success = await handleAddDutyType(dtName, dtDescription);
    if (success) {
      setDtName('');
      setDtDescription('');
    }
  };

  const groupedDuties: Record<string, StaffDuty[]> = duties.reduce(
  (acc: Record<string, StaffDuty[]>, duty: StaffDuty) => {
    const typeName = duty.dutyTypeName || 'Other';
    if (!acc[typeName]) acc[typeName] = [];
    acc[typeName].push(duty);
    return acc;
  },
  {}
);

  const isLoading = loading || staffLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Duty Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Assign and track daily duties
            </p>
          </div>
          <button
            onClick={() => {
              setShowAssignModal(true);
              setActiveTab('today');
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Assign Duty
          </button>
        </div>
      </div>

            <div className="p-6 space-y-5">

        {/* 🆕 Batch Indicator */}
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <span className="text-lg">🎓</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-red-900">
              Duties assigned to current batch only
            </p>
            <p className="text-[10px] text-red-700 mt-0.5">
              Batch changes will show respective duties automatically
            </p>
          </div>
        </div>
        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError} className="text-red-400">✕</button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-2
                py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            TODAY'S DUTIES TAB
        ══════════════════════════════════════ */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            {/* Date Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                📅 Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">
                {duties.length} duties assigned
              </span>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Total Assigned',
                  value: duties.length,
                  color: 'bg-blue-50 text-blue-700',
                  icon: '📋',
                },
                {
                  label: 'Completed',
                  value: duties.filter((d) => d.status === 'completed').length,
                  color: 'bg-green-50 text-green-700',
                  icon: '✅',
                },
                {
                  label: 'Pending',
                  value: duties.filter((d) => d.status === 'assigned').length,
                  color: 'bg-yellow-50 text-yellow-700',
                  icon: '⏳',
                },
                {
                  label: 'Transferred',
                  value: duties.filter((d) => d.status === 'transferred').length,
                  color: 'bg-purple-50 text-purple-700',
                  icon: '🔄',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`rounded-xl p-4 border border-current/10 ${card.color}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{card.icon}</span>
                    <div>
                      <p className="text-xl font-bold">{card.value}</p>
                      <p className="text-xs font-medium opacity-80">
                        {card.label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Duties List */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : duties.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
                <p className="text-5xl mb-3">📋</p>
                <p className="text-gray-500 font-medium">
                  No duties assigned for this date
                </p>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  + Assign First Duty
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedDuties).map(([typeName, typeDuties]) => (
                  <div key={typeName}>
                    {/* Duty Type Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-bold text-gray-700">
                        {typeName}
                      </h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {typeDuties.length}
                      </span>
                    </div>

                    {/* Duty Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {typeDuties.map((duty) => (
                        <div
                          key={duty.id}
                          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                        >
                          {/* Top */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                                {duty.staffName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {duty.rank} {duty.staffName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {duty.forceNumber}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`
                                text-xs font-medium px-2 py-0.5 rounded-full
                                ${DUTY_STATUS_COLORS[duty.status]}
                              `}
                            >
                              {DUTY_STATUS_LABELS[duty.status]}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="space-y-1 mb-3">
                            {duty.startTime && (
                              <p className="text-xs text-gray-600 flex items-center gap-1">
                                <span>🕐</span>
                                {duty.startTime} - {duty.endTime}
                              </p>
                            )}
                            {duty.venue && (
                              <p className="text-xs text-gray-600 flex items-center gap-1">
                                <span>📍</span>
                                {duty.venue}
                              </p>
                            )}
                            {duty.remarks && (
                              <p className="text-xs text-gray-500 italic">
                                {duty.remarks}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          {duty.status === 'assigned' && (
                            <div className="flex gap-2 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => {
                                  setSelectedDuty(duty);
                                  setShowCompleteDialog(true);
                                }}
                                className="flex-1 text-xs text-green-600 hover:text-green-800 font-medium py-1 hover:bg-green-50 rounded transition-colors"
                              >
                                ✓ Complete
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDuty(duty);
                                  setShowTransferModal(true);
                                }}
                                className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-1 hover:bg-blue-50 rounded transition-colors"
                              >
                                🔄 Transfer
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            DUTY TYPES TAB
        ══════════════════════════════════════ */}
        {activeTab === 'types' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-gray-700">
                Duty Types Master
              </h2>
              <button
                onClick={() => setShowDutyTypeModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              >
                + Add Duty Type
              </button>
            </div>

            <div className="space-y-2">
              {dutyTypes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">⚙️</p>
                  <p className="text-sm">No duty types configured</p>
                  <button
                    onClick={() => setShowDutyTypeModal(true)}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"
                  >
                    Add Duty Type
                  </button>
                </div>
              ) : (
                dutyTypes.map((dt) => (
                  <div
                    key={dt.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dt.name}
                      </p>
                      {dt.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {dt.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          dt.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {dt.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <div
                        onClick={() =>
                          handleToggleDutyType(dt.id, !dt.isActive)
                        }
                        className={`
                          relative w-9 h-5 rounded-full cursor-pointer transition-colors
                          ${dt.isActive ? 'bg-green-500' : 'bg-gray-300'}
                        `}
                      >
                        <div
                          className={`
                            absolute top-0.5 w-4 h-4 bg-white rounded-full
                            shadow transition-transform
                            ${dt.isActive ? 'translate-x-4' : 'translate-x-0.5'}
                          `}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          MODALS
      ════════════════════════════════════════ */}

      {/* Assign Duty Modal */}
      <FormModal
        isOpen={showAssignModal}
        title="Assign Duty"
        subtitle="Assign a duty to a staff member"
        onClose={() => setShowAssignModal(false)}
        size="md"
      >
        <div className="space-y-4">
          {/* Duty Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duty Type <span className="text-red-500">*</span>
            </label>
            <select
              value={dutyForm.dutyTypeId}
              onChange={(e) =>
                setDutyForm((prev) => ({
                  ...prev,
                  dutyTypeId: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Duty Type --</option>
              {activeDutyTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </select>
          </div>

                    {/* ═══════════════════════════════════════════
              🆕 SMART STAFF SELECTOR
          ═══════════════════════════════════════════ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign To <span className="text-red-500">*</span>
            </label>

            {/* Availability Summary */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                <p className="text-lg font-black text-green-700">{staffAvailability.available.length}</p>
                <p className="text-[9px] font-bold text-green-600 uppercase">Available</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                <p className="text-lg font-black text-amber-700">{staffAvailability.busy.length}</p>
                <p className="text-[9px] font-bold text-amber-600 uppercase">Already Busy</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                <p className="text-lg font-black text-red-700">{staffAvailability.unavailable.length}</p>
                <p className="text-[9px] font-bold text-red-600 uppercase">Unavailable</p>
              </div>
            </div>

            <select
              value={dutyForm.staffId}
              onChange={(e) =>
                setDutyForm((prev) => ({
                  ...prev,
                  staffId: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Staff --</option>

              {/* AVAILABLE STAFF */}
              {staffAvailability.available.length > 0 && (
                <optgroup label={`✅ AVAILABLE (${staffAvailability.available.length})`}>
                  {staffAvailability.available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rank} {s.name} ({s.forceNumber}) — {s.category || 'N/A'}
                    </option>
                  ))}
                </optgroup>
              )}

              {/* BUSY BUT ASSIGNABLE */}
              {staffAvailability.busy.length > 0 && (
                <optgroup label={`⚠️ ALREADY ON DUTY (${staffAvailability.busy.length})`}>
                  {staffAvailability.busy.map((s) => {
                    const info = getStaffAvailability(s.id, dutyForm.date);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.rank} {s.name} — {info.label}
                      </option>
                    );
                  })}
                </optgroup>
              )}

              {/* UNAVAILABLE (DISABLED) */}
              {staffAvailability.unavailable.length > 0 && (
                <optgroup label={`❌ NOT AVAILABLE (${staffAvailability.unavailable.length})`}>
                  {staffAvailability.unavailable.map((s) => {
                    const info = getStaffAvailability(s.id, dutyForm.date);
                    return (
                      <option key={s.id} value={s.id} disabled>
                        {s.rank} {s.name} — {info.label}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>

            {/* SELECTED STAFF INFO CARD */}
            {selectedStaffInfo && dutyForm.staffId && (
              <div className={`
                mt-2 rounded-lg p-3 border-2
                ${selectedStaffInfo.status === 'available'
                  ? 'bg-green-50 border-green-300'
                  : selectedStaffInfo.status === 'busy'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-red-50 border-red-300'
                }
              `}>
                <div className="flex items-start gap-2">
                  <span className="text-xl">
                    {selectedStaffInfo.status === 'available' && '✅'}
                    {selectedStaffInfo.status === 'busy' && '⚠️'}
                    {selectedStaffInfo.status !== 'available' && selectedStaffInfo.status !== 'busy' && '❌'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold uppercase
                      ${selectedStaffInfo.status === 'available' ? 'text-green-800'
                        : selectedStaffInfo.status === 'busy' ? 'text-amber-800'
                        : 'text-red-800'
                      }
                    `}>
                      {selectedStaffInfo.label}
                    </p>
                    {selectedStaffInfo.reason && (
                      <p className={`text-[11px] mt-0.5
                        ${selectedStaffInfo.status === 'available' ? 'text-green-700'
                          : selectedStaffInfo.status === 'busy' ? 'text-amber-700'
                          : 'text-red-700'
                        }
                      `}>
                        {selectedStaffInfo.reason}
                      </p>
                    )}
                    {selectedStaffInfo.status === 'busy' && (
                      <p className="text-[10px] text-amber-800 font-bold mt-1 bg-amber-100 px-2 py-1 rounded">
                        ⚠️ Double booking! Consider transferring existing duty first.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

                    {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dutyForm.date}
              onChange={(e) => {
                const newDate = e.target.value;
                setDutyForm((prev) => ({
                  ...prev,
                  date: newDate,
                  staffId: '', // Reset staff selection when date changes
                }));
                fetchDutiesByDate(newDate); // 🆕 Refresh duties for new date
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              📅 Staff availability updates based on selected date
            </p>
          </div>

          {/* Timings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={dutyForm.startTime}
                onChange={(e) =>
                  setDutyForm((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={dutyForm.endTime}
                onChange={(e) =>
                  setDutyForm((prev) => ({
                    ...prev,
                    endTime: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue / Location
            </label>
            <input
              type="text"
              value={dutyForm.venue}
              onChange={(e) =>
                setDutyForm((prev) => ({
                  ...prev,
                  venue: e.target.value,
                }))
              }
              placeholder="e.g., Parade Ground, Armoury"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={dutyForm.remarks}
              onChange={(e) =>
                setDutyForm((prev) => ({
                  ...prev,
                  remarks: e.target.value,
                }))
              }
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowAssignModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>

             <button
              onClick={handleAssignSubmit}
              disabled={Boolean(
                submitting ||
                !dutyForm.dutyTypeId ||
                !dutyForm.staffId ||
                !dutyForm.date ||
                (selectedStaffInfo && !selectedStaffInfo.canAssign)
              )}

              title={
                selectedStaffInfo && !selectedStaffInfo.canAssign
                  ? `Cannot assign: ${selectedStaffInfo.reason}`
                  : 'Assign this duty'
              }
              className={`
                px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors
                ${selectedStaffInfo && !selectedStaffInfo.canAssign
                  ? 'bg-red-600 hover:bg-red-700 cursor-not-allowed'
                  : selectedStaffInfo?.status === 'busy'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Assigning...
                </>
              ) : selectedStaffInfo && !selectedStaffInfo.canAssign ? (
                <>❌ Not Available</>
              ) : selectedStaffInfo?.status === 'busy' ? (
                <>⚠️ Assign Anyway</>
              ) : (
                <>✓ Assign Duty</>
              )}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Transfer Modal */}
      <FormModal
        isOpen={showTransferModal}
        title="Transfer Duty"
        subtitle={
          selectedDuty
            ? `Duty: ${selectedDuty.dutyTypeName}`
            : ''
        }
        onClose={() => {
          setShowTransferModal(false);
          setSelectedDuty(null);
        }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-700">
              Transferring duty from{' '}
              <strong>{selectedDuty?.staffName}</strong>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transfer To <span className="text-red-500">*</span>
            </label>
            <select
              value={transferStaffId}
              onChange={(e) => setTransferStaffId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Staff --</option>
              {activeStaff
                .filter((s) => s.id !== selectedDuty?.staffId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rank} {s.name} ({s.forceNumber})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transfer Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={3}
              placeholder="Reason for transferring this duty..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowTransferModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleTransferSubmit}
              disabled={submitting || !transferStaffId || !transferReason}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Transferring...' : 'Transfer Duty'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Add Duty Type Modal */}
      <FormModal
        isOpen={showDutyTypeModal}
        title="Add Duty Type"
        subtitle="Create a new duty category"
        onClose={() => setShowDutyTypeModal(false)}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duty Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dtName}
              onChange={(e) => setDtName(e.target.value)}
              placeholder="e.g., Weapon Ustad, Guard Commander"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={dtDescription}
              onChange={(e) => setDtDescription(e.target.value)}
              rows={2}
              placeholder="Brief description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowDutyTypeModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDutyTypeSubmit}
              disabled={submitting || !dtName}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Add Duty Type'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Complete Dialog */}
      <ConfirmDialog
        isOpen={showCompleteDialog}
        title="Mark Duty Complete"
        message={`Mark ${selectedDuty?.dutyTypeName} duty of ${selectedDuty?.staffName} as completed?`}
        confirmLabel="Yes, Complete"
        confirmColor="green"
        onConfirm={handleCompleteConfirm}
        onCancel={() => {
          setShowCompleteDialog(false);
          setSelectedDuty(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default DutyManagementScreen;