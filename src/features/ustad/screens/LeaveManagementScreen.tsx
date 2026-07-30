// ============================================
// LEAVE MANAGEMENT SCREEN
// ============================================

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeave } from '../hooks/useLeave';
import { useStaff } from '../hooks/useStaff';
import {
  StaffLeave,
  LeaveFormData,
  LeaveStatus,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  DEFAULT_LEAVE_FORM,
} from '../types/leave.types';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

// ─── Tab Config ───────────────────────────────
const TABS = [
  { key: 'all', label: 'All Leaves', icon: '📋' },
  { key: 'pending', label: 'Pending Approval', icon: '⏳' },
  { key: 'current', label: 'Currently On Leave', icon: '🏖️' },
  { key: 'overstay', label: 'Overstay (Late Return)', icon: '🚨' },   // ★
  { key: 'types', label: 'Leave Types', icon: '⚙️' },
];

// ★ Overstay detector: approved, return recorded nahi, toDate beet chuki
export const isOverstayed = (leave: StaffLeave): boolean => {
  if (leave.status !== 'approved' || leave.returnDate || !leave.toDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(leave.toDate);
  due.setHours(23, 59, 59, 999);
  return today > due;
};

export const overstayDays = (leave: StaffLeave): number => {
  if (!isOverstayed(leave) || !leave.toDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(leave.toDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
};

const LeaveQuotaModal: React.FC<{
  leave: StaffLeave;
  allLeaves: StaffLeave[];
  leaveTypes: { id: string; name: string; code: string; maxDaysPerYear: number }[];
  onClose: () => void;
}> = ({ leave, allLeaves, leaveTypes, onClose }) => {
  const year = new Date().getFullYear();
  const staffLeaves = allLeaves.filter(l => l.staffId === leave.staffId);
  const approvedThisYear = staffLeaves.filter(l =>
    l.status === 'approved' && l.fromDate?.getFullYear() === year
  );
  const pendingThisYear = staffLeaves.filter(l =>
    l.status === 'pending' && l.fromDate?.getFullYear() === year
  );
  const lastApproved = approvedThisYear
    .filter(l => l.id !== leave.id)
    .sort((a, b) => (b.fromDate?.getTime() ?? 0) - (a.fromDate?.getTime() ?? 0))[0];

  const currentType = leaveTypes.find(t => t.id === leave.leaveTypeId)
    || { id: leave.leaveTypeId, name: leave.leaveTypeName, code: leave.leaveTypeCode, maxDaysPerYear: 0 };

  const quotaRows = leaveTypes.map(type => {
    const taken = approvedThisYear
      .filter(l => l.leaveTypeId === type.id)
      .reduce((sum, l) => sum + Number(l.numberOfDays || 0), 0);
    const pending = pendingThisYear
      .filter(l => l.leaveTypeId === type.id)
      .reduce((sum, l) => sum + Number(l.numberOfDays || 0), 0);
    const isCurrentType = type.id === leave.leaveTypeId;
    const afterApproval = isCurrentType
      ? type.maxDaysPerYear - taken - Number(leave.numberOfDays || 0)
      : type.maxDaysPerYear - taken;
    return {
      ...type,
      taken,
      pending,
      balance: type.maxDaysPerYear - taken,
      afterApproval,
      isCurrentType,
    };
  });

  const currentTaken = approvedThisYear
    .filter(l => l.leaveTypeId === leave.leaveTypeId)
    .reduce((sum, l) => sum + Number(l.numberOfDays || 0), 0);
  const currentBalance = Number(currentType.maxDaysPerYear || 0) - currentTaken;
  const afterThisLeave = currentBalance - Number(leave.numberOfDays || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-700 to-purple-700 text-white px-5 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">Leave Quota & History</h3>
            <p className="text-xs text-white/80 mt-1">
              {leave.rank} {leave.staffName} · {leave.forceNumber} · Year {year}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20">✕</button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)] space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-blue-600 uppercase">Applied Leave</p>
              <p className="text-lg font-black text-blue-900">{leave.leaveTypeName}</p>
              <p className="text-xs text-blue-700">{leave.numberOfDays} days requested</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-slate-500 uppercase">Quota</p>
              <p className="text-lg font-black text-slate-900">{currentType.maxDaysPerYear || '—'}</p>
              <p className="text-xs text-slate-500">days/year</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-amber-600 uppercase">Taken This Year</p>
              <p className="text-lg font-black text-amber-800">{currentTaken}</p>
              <p className="text-xs text-amber-700">approved days</p>
            </div>
            <div className={`${afterThisLeave < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-xl p-3`}>
              <p className={`text-[10px] font-black uppercase ${afterThisLeave < 0 ? 'text-red-600' : 'text-green-600'}`}>Balance After Approval</p>
              <p className={`text-lg font-black ${afterThisLeave < 0 ? 'text-red-800' : 'text-green-800'}`}>{afterThisLeave}</p>
              <p className="text-xs text-slate-500">remaining days</p>
            </div>
          </div>

          {lastApproved ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Last Approved Leave</p>
              <p className="text-sm font-bold text-indigo-900">
                {lastApproved.leaveTypeName} · {lastApproved.numberOfDays} days · {lastApproved.fromDate?.toLocaleDateString('en-IN')} to {lastApproved.toDate?.toLocaleDateString('en-IN')}
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">Reason: {lastApproved.reason || '—'}</p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm font-bold text-green-800">
              No approved leave found for this staff in {year} before this request.
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p className="text-xs font-black text-slate-700 uppercase">Leave Type Quota Ledger</p>
              <p className="text-[10px] text-slate-500">Quota is fetched from Leave Type Master dynamically</p>
            </div>
            {quotaRows.length === 0 ? (
              <div className="p-4 text-sm text-red-600 font-bold">
                Leave types are not configured. Add CL/EL/Special etc. from Leave Types tab first.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {quotaRows.map(row => (
                  <div key={row.id} className={`px-4 py-3 grid grid-cols-5 gap-2 items-center ${row.isCurrentType ? 'bg-blue-50' : ''}`}>
                    <div className="col-span-2">
                      <p className="text-sm font-black text-slate-800">{row.name}</p>
                      <p className="text-[10px] text-slate-500">{row.code}</p>
                    </div>
                    <div className="text-center"><p className="text-[9px] text-slate-400 uppercase">Quota</p><p className="font-black">{row.maxDaysPerYear}</p></div>
                    <div className="text-center"><p className="text-[9px] text-slate-400 uppercase">Taken</p><p className="font-black text-amber-700">{row.taken}</p></div>
                    <div className="text-center"><p className="text-[9px] text-slate-400 uppercase">Balance</p><p className={`font-black ${row.afterApproval < 0 ? 'text-red-700' : 'text-green-700'}`}>{row.isCurrentType ? row.afterApproval : row.balance}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs font-black text-slate-700 uppercase mb-2">This Staff Leave History ({year})</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {staffLeaves.filter(l => l.fromDate?.getFullYear() === year).length === 0 ? (
                <p className="text-xs text-slate-500">No leave history in this year.</p>
              ) : staffLeaves
                .filter(l => l.fromDate?.getFullYear() === year)
                .sort((a, b) => (b.fromDate?.getTime() ?? 0) - (a.fromDate?.getTime() ?? 0))
                .map(l => (
                  <div key={l.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${l.id === leave.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{l.leaveTypeName} · {l.numberOfDays} days</p>
                      <p className="text-[10px] text-slate-500">{l.fromDate?.toLocaleDateString('en-IN')} → {l.toDate?.toLocaleDateString('en-IN')} · {l.reason || '—'}</p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${LEAVE_STATUS_COLORS[l.status]}`}>{LEAVE_STATUS_LABELS[l.status]}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeaveManagementScreen: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    allLeaves,
    pendingLeaves,
    currentLeaves,
    leaveTypes,
    activeLeaveTypes,
    statistics,
    loading,
    submitting,
    error,
    fetchAllLeaves,
    handleApplyLeave,
    handleApproveLeave,
    handleRejectLeave,
    handleCancelLeave,
    handleRecordReturn,
    handleAddLeaveType,
    handleToggleLeaveType,
    clearError,
  } = useLeave();

  const { staffList } = useStaff();

  // ─── UI State ────────────────────────────
  const [activeTab, setActiveTab] = useState('all');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<StaffLeave | null>(null);
  const [quotaLeave, setQuotaLeave] = useState<StaffLeave | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');

  // Leave Form State
  const [leaveForm, setLeaveForm] = useState<LeaveFormData>(DEFAULT_LEAVE_FORM);

  // Reject Form State
  const [rejectReason, setRejectReason] = useState('');

  // Return Form State
  const [returnDate, setReturnDate] = useState('');
  const [joiningReport, setJoiningReport] = useState(true);
  const [delayReason, setDelayReason] = useState('');

  // Leave Type Form
  const [ltName, setLtName] = useState('');
  const [ltCode, setLtCode] = useState('');
  const [ltMaxDays, setLtMaxDays] = useState(10);
  const [ltIsPaid, setLtIsPaid] = useState(true);
  const [ltDescription, setLtDescription] = useState('');

  // ─── Auto Fetch ──────────────────────────
  useEffect(() => {
    fetchAllLeaves();
  }, [fetchAllLeaves]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const leaveId = searchParams.get('leaveId');
    if (tab) setActiveTab(tab);
    if (leaveId && allLeaves.length > 0) {
      const leave = allLeaves.find(l => l.id === leaveId);
      if (leave) {
        setQuotaLeave(leave);
        setSelectedLeave(leave);
      }
    }
  }, [searchParams, allLeaves]);

  // ─── Filtered Leaves ──────────────────────
  const getFilteredLeaves = (leaves: StaffLeave[]) => {
    return leaves.filter((leave) => {
      const matchSearch =
        !searchQuery ||
        leave.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        leave.forceNumber.includes(searchQuery) ||
        leave.leaveNumber.includes(searchQuery);

      const matchStatus =
        statusFilter === 'all' || leave.status === statusFilter;

      return matchSearch && matchStatus;
    });
  };

  // ★ Overstay list (computed from already-fetched data — no extra read)
  const overstayedLeaves = allLeaves.filter(isOverstayed);

  const displayLeaves =
    activeTab === 'pending'
      ? getFilteredLeaves(pendingLeaves)
      : activeTab === 'current'
      ? getFilteredLeaves(currentLeaves)
      : activeTab === 'overstay'
      ? getFilteredLeaves(overstayedLeaves)
      : getFilteredLeaves(allLeaves);

  // ─── Calculate Leave Days ─────────────────
  const calculateDays = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

    // ─── Apply Leave Submit (with validation) ─
  const handleApplySubmit = async () => {
    if (!leaveForm.staffId || !leaveForm.leaveTypeId) return;

    const staff = staffList.find((s) => s.id === leaveForm.staffId);
    if (!staff) return;

    // 🆕 DOUBLE CHECK BEFORE SUBMIT
    if (willExceed) {
      alert(
        `❌ Cannot Apply!\n\nYou are requesting ${requestedDays} days but only ${availableDays} days are available for ${selectedLeaveType?.name} in year ${new Date().getFullYear()}.\n\nPlease reduce the days or select a different leave type.`
      );
      return;
    }

    // 🆕 CONFIRM
    const confirmed = window.confirm(
      `Apply ${requestedDays} days of ${selectedLeaveType?.name} for ${staff.rank} ${staff.name}?\n\n` +
      `From: ${new Date(leaveForm.fromDate).toLocaleDateString('en-IN')}\n` +
      `To: ${new Date(leaveForm.toDate).toLocaleDateString('en-IN')}\n\n` +
      `Available after this: ${availableDays - requestedDays} days`
    );

    if (!confirmed) return;

    const success = await handleApplyLeave(
      leaveForm,
      staff.name,
      staff.forceNumber,
      staff.rank
    );

    if (success) {
      setShowApplyModal(false);
      setLeaveForm(DEFAULT_LEAVE_FORM);
    }
  };

  // ─── Approve ──────────────────────────────
  const handleApproveClick = (leave: StaffLeave) => {
    setSelectedLeave(leave);
    setShowApproveDialog(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedLeave) return;
    const success = await handleApproveLeave(selectedLeave.id);
    if (success) {
      setShowApproveDialog(false);
      setSelectedLeave(null);
    }
  };

  // ─── Reject ───────────────────────────────
  const handleRejectClick = (leave: StaffLeave) => {
    setSelectedLeave(leave);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedLeave || !rejectReason) return;
    const success = await handleRejectLeave(selectedLeave.id, rejectReason);
    if (success) {
      setShowRejectModal(false);
      setSelectedLeave(null);
      setRejectReason('');
    }
  };

  // ─── Cancel ───────────────────────────────
  const handleCancelClick = (leave: StaffLeave) => {
    setSelectedLeave(leave);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedLeave) return;
    const success = await handleCancelLeave(selectedLeave.id);
    if (success) {
      setShowCancelDialog(false);
      setSelectedLeave(null);
    }
  };

  // ─── Return ───────────────────────────────
  const handleReturnClick = (leave: StaffLeave) => {
    setSelectedLeave(leave);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setShowReturnModal(true);
  };

  const handleReturnSubmit = async () => {
    if (!selectedLeave || !returnDate) return;
    const success = await handleRecordReturn(
      selectedLeave.id,
      returnDate,
      joiningReport,
      delayReason
    );
    if (success) {
      setShowReturnModal(false);
      setSelectedLeave(null);
      setDelayReason('');
    }
  };

  // ─── Add Leave Type Submit ─────────────────
  const handleLeaveTypeSubmit = async () => {
    if (!ltName || !ltCode) return;
    const success = await handleAddLeaveType(
      ltName,
      ltCode,
      ltMaxDays,
      ltIsPaid,
      ltDescription
    );
    if (success) {
      setLtName('');
      setLtCode('');
      setLtMaxDays(10);
      setLtIsPaid(true);
      setLtDescription('');
    }
  };

  // ─── Format Date ──────────────────────────
  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString('en-IN') : 'N/A';

    // ═══════════════════════════════════════════
  // 🆕 LEAVE VALIDATION HELPERS
  // ═══════════════════════════════════════════

  // Calculate days used for a specific leave type by staff
  const calculateUsedDays = (staffId: string, leaveTypeId: string): number => {
    const currentYear = new Date().getFullYear();
    return allLeaves
      .filter(l =>
        l.staffId === staffId &&
        l.leaveTypeId === leaveTypeId &&
        l.status === 'approved' &&
        l.fromDate?.getFullYear() === currentYear
      )
      .reduce((sum, l) => sum + l.numberOfDays, 0);
  };

  // ★ PENDING days (approved hone ka wait kar rahi applications) —
  //   double-booking guard: inko bhi balance se ghataana zaroori hai
  const calculatePendingDays = (staffId: string, leaveTypeId: string): number => {
    const currentYear = new Date().getFullYear();
    return allLeaves
      .filter(l =>
        l.staffId === staffId &&
        l.leaveTypeId === leaveTypeId &&
        l.status === 'pending' &&
        l.fromDate?.getFullYear() === currentYear
      )
      .reduce((sum, l) => sum + l.numberOfDays, 0);
  };

  // Get selected leave type details
  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveForm.leaveTypeId);

  // Calculate current application days
  const requestedDays = leaveForm.fromDate && leaveForm.toDate
    ? calculateDays(leaveForm.fromDate, leaveForm.toDate)
    : 0;

  // Used days by selected staff for selected type
  const usedDays = leaveForm.staffId && leaveForm.leaveTypeId
    ? calculateUsedDays(leaveForm.staffId, leaveForm.leaveTypeId)
    : 0;

  // ★ Pending days (pehle se applied, approval pending) — double-booking guard
  const pendingDays = leaveForm.staffId && leaveForm.leaveTypeId
    ? calculatePendingDays(leaveForm.staffId, leaveForm.leaveTypeId)
    : 0;

  // ★ Available balance (approved used + pending dono ghata kar)
  const availableDays = selectedLeaveType
    ? selectedLeaveType.maxDaysPerYear - usedDays - pendingDays
    : 0;

  // Will this exceed limit?
  const willExceed = requestedDays > availableDays;

  // Overall form validation
  const isFormValid =
    !!leaveForm.staffId &&
    !!leaveForm.leaveTypeId &&
    !!leaveForm.fromDate &&
    !!leaveForm.toDate &&
    !!leaveForm.reason.trim() &&
    !willExceed &&
    requestedDays > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Leave Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Apply, approve and track staff leaves
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchAllLeaves()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              title="Refresh leave data"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Apply Leave
            </button>
          </div>
        </div>
      </div>

            <div className="p-6 space-y-6">

        {/* 🆕 Batch Indicator */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <span className="text-lg">🎓</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-yellow-900">
              Leaves filtered by current batch
            </p>
            <p className="text-[10px] text-yellow-700 mt-0.5">
              Only showing leaves applied during active batch cycle
            </p>
          </div>
        </div>
        {/* ── Error ── */}
                {error && !error.includes('No document to update') && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError} className="text-red-400">✕</button>
          </div>
        )}

        {/* Show info banner for orphan leave errors */}
        {error && error.includes('No document to update') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-amber-500 text-lg">🧹</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">
                Old Orphan Leaves Detected
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Some leaves reference staff that no longer exist. Use the "Clean Orphan Leaves" button
                in System → Seed Staff Data page to fix this.
              </p>
              <button
                onClick={() => window.location.href = '/seed-staff'}
                className="mt-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg"
              >
                Go to Cleanup Page →
              </button>
            </div>
            <button onClick={clearError} className="text-amber-400">✕</button>
          </div>
        )}
        {/* ★ OVERSTAY ALERT BANNER */}
        {overstayedLeaves.length > 0 && (
          <div className="bg-red-600 text-white rounded-xl p-4 flex items-start gap-3 shadow-lg shadow-red-200">
            <span className="text-2xl animate-pulse">🚨</span>
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-wider">
                {overstayedLeaves.length} Staff Overstay Par Hai!
              </p>
              <p className="text-xs text-red-100 mt-0.5">
                Leave ki wapsi date beet chuki hai lekin return record nahi hua.
                Turant "Record Return" karein ya duty officer ko inform karein.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {overstayedLeaves.slice(0, 4).map(l => (
                  <span key={l.id} className="bg-white/15 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {l.rank} {l.staffName} — {overstayDays(l)} din late
                  </span>
                ))}
                {overstayedLeaves.length > 4 && (
                  <span className="bg-white/15 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    +{overstayedLeaves.length - 4} aur
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('overstay')}
              className="bg-white text-red-700 text-xs font-black px-3 py-1.5 rounded-lg hover:bg-red-50 shrink-0"
            >
              View →
            </button>
          </div>
        )}

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'On Leave Now',
              value: statistics.currentlyOnLeave,
              icon: '🏖️',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Pending Approval',
              value: statistics.pendingApprovals,
              icon: '⏳',
              color: 'bg-orange-50 border-orange-200 text-orange-700',
            },
            {
              label: 'Returning Soon',
              value: statistics.upcomingReturns,
              icon: '🔔',
              color: 'bg-blue-50 border-blue-200 text-blue-700',
            },
            {
              label: 'This Month',
              value: statistics.monthlyLeaveCount,
              icon: '📅',
              color: 'bg-purple-50 border-purple-200 text-purple-700',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl p-4 border ${stat.color}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs font-medium opacity-80">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-2
                py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${
                  activeTab === tab.key
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.key === 'pending' && pendingLeaves.length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingLeaves.length}
                </span>
              )}
              {/* ★ Overstay badge */}
              {tab.key === 'overstay' && overstayedLeaves.length > 0 && (
                <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">
                  {overstayedLeaves.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Leave Types Tab ── */}
        {activeTab === 'types' ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700">
                Leave Types Master
              </h2>
              <button
                onClick={() => setShowLeaveTypeModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              >
                + Add Type
              </button>
            </div>

            <div className="space-y-2">
              {leaveTypes.map((lt) => (
                <div
                  key={lt.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {lt.code}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {lt.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Max {lt.maxDaysPerYear} days/year •{' '}
                        {lt.isPaid ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        lt.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {lt.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <div
                      onClick={() =>
                        handleToggleLeaveType(lt.id, !lt.isActive)
                      }
                      className={`
                        relative w-9 h-5 rounded-full cursor-pointer transition-colors
                        ${lt.isActive ? 'bg-green-500' : 'bg-gray-300'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-0.5 w-4 h-4 bg-white rounded-full
                          shadow transition-transform
                          ${lt.isActive ? 'translate-x-4' : 'translate-x-0.5'}
                        `}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {leaveTypes.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">⚙️</p>
                  <p className="text-sm">
                    No leave types configured yet.
                  </p>
                  <button
                    onClick={() => setShowLeaveTypeModal(true)}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"
                  >
                    Add Leave Type
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Leave List ── */
          <div className="space-y-4">
            {/* Search + Filter */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search by name, force number, leave number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {activeTab === 'all' && (
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as LeaveStatus | 'all')
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
            </div>

            {/* Leave Cards */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : displayLeaves.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
                <p className="text-5xl mb-3">🏖️</p>
                <p className="text-gray-500 font-medium">No leaves found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {leave.staffName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">
                            {leave.rank} {leave.staffName}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {leave.forceNumber} • {leave.leaveNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`
                            text-xs font-medium px-2.5 py-1 rounded-full
                            ${LEAVE_STATUS_COLORS[leave.status]}
                          `}
                        >
                          {LEAVE_STATUS_LABELS[leave.status]}
                        </span>
                        {/* ★ Overstay badge */}
                        {isOverstayed(leave) && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                            🚨 OVERSTAY {overstayDays(leave)} din
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Leave Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500 mb-0.5">
                          Leave Type
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {leave.leaveTypeName}
                        </p>
                        <p className="text-xs text-gray-400">
                          ({leave.leaveTypeCode})
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500 mb-0.5">
                          Duration
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {leave.numberOfDays} Days
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500 mb-0.5">
                          From Date
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDate(leave.fromDate)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500 mb-0.5">
                          To Date
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDate(leave.toDate)}
                        </p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="bg-gray-50 rounded-lg p-2.5 mb-4">
                      <p className="text-xs text-gray-500 mb-0.5">Reason</p>
                      <p className="text-sm text-gray-700">{leave.reason}</p>
                    </div>

                    {/* Contact During Leave */}
                    {leave.leaveAddress && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">
                            Leave Address
                          </p>
                          <p className="text-xs text-gray-700 mt-0.5">
                            {leave.leaveAddress}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            Contact Number
                          </p>
                          <p className="text-xs text-gray-700 mt-0.5">
                            {leave.contactNumber}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ★ Emergency Contact display */}
                    {(leave.emergencyContactName || leave.emergencyContactPhone) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-4 flex items-center gap-3">
                        <span className="text-red-500 text-base">🚨</span>
                        <div className="text-xs">
                          <span className="font-bold text-red-800">
                            {leave.emergencyContactName || '—'}
                            {leave.emergencyContactRelation ? ` (${leave.emergencyContactRelation})` : ''}
                          </span>
                          {leave.emergencyContactPhone && (
                            <span className="text-red-700 ml-2 font-mono font-bold">
                              📞 {leave.emergencyContactPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Approval Info */}
                    {leave.status === 'approved' && leave.approvedByName && (
                      <div className="text-xs text-green-600 bg-green-50 rounded-lg p-2 mb-3">
                        ✓ Approved by {leave.approvedByName} on{' '}
                        {formatDate(leave.approvalDate)}
                      </div>
                    )}

                    {/* Rejection Reason */}
                    {leave.status === 'rejected' && leave.rejectionReason && (
                      <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-3">
                        ✕ Rejected: {leave.rejectionReason}
                      </div>
                    )}

                    {/* Return Info */}
                    {leave.returnDate && (
                      <div className="text-xs text-blue-600 bg-blue-50 rounded-lg p-2 mb-3">
                        🔄 Returned on {formatDate(leave.returnDate)} •
                        Joining Report:{' '}
                        {leave.joiningReportSubmitted ? '✓' : '✕'}
                        {leave.delayReason &&
                          ` • Delay: ${leave.delayReason}`}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => setQuotaLeave(leave)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        👁 Leave Quota / History
                      </button>
                      {/* Pending Actions */}
                      {leave.status === 'pending' && (
                        <>
                                                    <button
                            onClick={() => handleApproveClick(leave)}
                            title="Approve leave & auto-update staff status + attendance"
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            ✓ Approve & Sync
                          </button>
                          <button
                            onClick={() => handleRejectClick(leave)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            ✕ Reject
                          </button>
                          <button
                            onClick={() => handleCancelClick(leave)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {/* Approved + On Leave - Record Return */}
                      {leave.status === 'approved' && !leave.returnDate && (
                        <button
                          onClick={() => handleReturnClick(leave)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          🔄 Record Return
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          MODALS
      ════════════════════════════════════════ */}

      {/* Apply Leave Modal */}
      <FormModal
        isOpen={showApplyModal}
        title="Apply Leave"
        subtitle="Submit a leave application"
        onClose={() => {
          setShowApplyModal(false);
          setLeaveForm(DEFAULT_LEAVE_FORM);
        }}
        size="lg"
      >
        <div className="space-y-4">
          {/* Staff Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Staff Member <span className="text-red-500">*</span>
            </label>
            <select
              value={leaveForm.staffId}
              onChange={(e) =>
                setLeaveForm((prev) => ({
                  ...prev,
                  staffId: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Staff --</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rank} {s.name} ({s.forceNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <select
              value={leaveForm.leaveTypeId}
              onChange={(e) =>
                setLeaveForm((prev) => ({
                  ...prev,
                  leaveTypeId: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Leave Type --</option>
              {activeLeaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code}) - Max {lt.maxDaysPerYear} days
                </option>
              ))}
            </select>
          </div>

                    {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={leaveForm.fromDate}
                onChange={(e) =>
                  setLeaveForm((prev) => ({
                    ...prev,
                    fromDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={leaveForm.toDate}
                min={leaveForm.fromDate}
                onChange={(e) =>
                  setLeaveForm((prev) => ({
                    ...prev,
                    toDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              🆕 REAL-TIME LEAVE BALANCE & VALIDATION
          ═══════════════════════════════════════════ */}
          {selectedLeaveType && leaveForm.staffId && (
            <div className={`
              rounded-xl p-4 border-2 space-y-3
              ${willExceed
                ? 'bg-red-50 border-red-300'
                : requestedDays > 0
                  ? 'bg-green-50 border-green-300'
                  : 'bg-blue-50 border-blue-200'
              }
            `}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider">
                  {selectedLeaveType.name} ({selectedLeaveType.code}) — Balance
                </p>
                <span className={`
                  text-xs font-bold px-2 py-0.5 rounded-full
                  ${willExceed ? 'bg-red-200 text-red-800' : 'bg-white text-slate-700'}
                `}>
                  Year {new Date().getFullYear()}
                </span>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">
                    Used (Approved): <strong>{usedDays}</strong>
                    {/* ★ Pending days — approval ke wait mein */}
                    {pendingDays > 0 && (
                      <span className="ml-2 text-orange-700 font-bold">
                        + Pending: <strong>{pendingDays}</strong>
                      </span>
                    )}
                  </span>
                  <span className="text-slate-600">Max: <strong>{selectedLeaveType.maxDaysPerYear}</strong> days</span>
                </div>
                <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className={`
                      h-full rounded-full transition-all duration-500
                      ${usedDays / selectedLeaveType.maxDaysPerYear > 0.8
                        ? 'bg-red-500'
                        : usedDays / selectedLeaveType.maxDaysPerYear > 0.5
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }
                    `}
                    style={{ width: `${Math.min((usedDays / selectedLeaveType.maxDaysPerYear) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Available</p>
                  <p className={`text-lg font-black ${availableDays > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {availableDays}
                  </p>
                  {/* ★ pending pehle se booked hain to batayein */}
                  <p className="text-[9px] text-slate-500">
                    days{pendingDays > 0 ? ' (pending included)' : ''}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Requesting</p>
                  <p className={`text-lg font-black ${willExceed ? 'text-red-700' : 'text-blue-700'}`}>
                    {requestedDays}
                  </p>
                  <p className="text-[9px] text-slate-500">days</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">After Approval</p>
                  <p className={`text-lg font-black ${willExceed ? 'text-red-700' : 'text-slate-700'}`}>
                    {availableDays - requestedDays}
                  </p>
                  <p className="text-[9px] text-slate-500">remaining</p>
                </div>
              </div>

              {/* Error Message */}
              {willExceed && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-red-600 text-lg">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-red-800">
                      Cannot Apply — Exceeds Limit!
                    </p>
                    <p className="text-[11px] text-red-700 mt-0.5">
                      Requesting {requestedDays} days but only {availableDays} days available for {selectedLeaveType.name}.
                      Reduce the days or choose different leave type.
                    </p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {!willExceed && requestedDays > 0 && (
                <div className="bg-green-100 border border-green-300 rounded-lg p-2 flex items-center gap-2">
                  <span className="text-green-600">✅</span>
                  <p className="text-xs font-bold text-green-800">
                    Valid application — {requestedDays} days within limit
                  </p>
                </div>
              )}
            </div>
          )}

          {/* If no leave type selected yet */}
          {leaveForm.staffId && !selectedLeaveType && leaveForm.fromDate && leaveForm.toDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-amber-600">💡</span>
              <p className="text-xs text-amber-800">
                Select a leave type to see balance and validation
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={leaveForm.reason}
              onChange={(e) =>
                setLeaveForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              rows={3}
              placeholder="Reason for leave..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Leave Address + Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leave Address
              </label>
              <input
                type="text"
                value={leaveForm.leaveAddress}
                onChange={(e) =>
                  setLeaveForm((prev) => ({
                    ...prev,
                    leaveAddress: e.target.value,
                  }))
                }
                placeholder="Address during leave"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                value={leaveForm.contactNumber}
                onChange={(e) =>
                  setLeaveForm((prev) => ({
                    ...prev,
                    contactNumber: e.target.value,
                  }))
                }
                placeholder="Mobile during leave"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ★ EMERGENCY CONTACT DURING LEAVE */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-red-800 uppercase tracking-wider">
                🚨 Emergency Contact (Leave Ke Dauraan)
              </p>
              <span className="text-[9px] font-bold text-red-500 uppercase">Optional lekin recommended</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-red-900 mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={leaveForm.emergencyContactName}
                  onChange={(e) =>
                    setLeaveForm((prev) => ({
                      ...prev,
                      emergencyContactName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Wife / Father name"
                  className="w-full px-3 py-2 border border-red-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-red-900 mb-1">
                  Relation
                </label>
                <select
                  value={leaveForm.emergencyContactRelation}
                  onChange={(e) =>
                    setLeaveForm((prev) => ({
                      ...prev,
                      emergencyContactRelation: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-red-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="">-- Relation --</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Brother">Brother</option>
                  <option value="Sister">Sister</option>
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-red-900 mb-1">
                  Emergency Phone
                </label>
                <input
                  type="tel"
                  value={leaveForm.emergencyContactPhone}
                  onChange={(e) =>
                    setLeaveForm((prev) => ({
                      ...prev,
                      emergencyContactPhone: e.target.value.replace(/[^0-9+\-\s]/g, ''),
                    }))
                  }
                  placeholder="10-digit mobile"
                  maxLength={13}
                  className="w-full px-3 py-2 border border-red-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={leaveForm.remarks}
              onChange={(e) =>
                setLeaveForm((prev) => ({
                  ...prev,
                  remarks: e.target.value,
                }))
              }
              placeholder="Any additional remarks..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowApplyModal(false);
                setLeaveForm(DEFAULT_LEAVE_FORM);
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
                        <button
              onClick={handleApplySubmit}
              disabled={submitting || !isFormValid}
              title={
                willExceed
                  ? `Cannot apply: Only ${availableDays} days available for ${selectedLeaveType?.name}`
                  : !isFormValid
                    ? 'Fill all required fields'
                    : 'Submit leave application'
              }
              className={`
                px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors
                ${willExceed
                  ? 'bg-red-600 hover:bg-red-700 cursor-not-allowed'
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
                  Submitting...
                </>
              ) : willExceed ? (
                <>❌ Exceeds Limit</>
              ) : (
                <>✓ Submit Leave Application</>
              )}
            </button>
          </div>
        </div>
      </FormModal>

      {quotaLeave && (
        <LeaveQuotaModal
          leave={quotaLeave}
          allLeaves={allLeaves}
          leaveTypes={leaveTypes}
          onClose={() => {
            setQuotaLeave(null);
            if (searchParams.get('leaveId')) {
              searchParams.delete('leaveId');
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}

      {/* Reject Modal */}
      <FormModal
        isOpen={showRejectModal}
        title="Reject Leave"
        subtitle={selectedLeave ? `Leave: ${selectedLeave.leaveNumber}` : ''}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
        }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              You are rejecting leave of{' '}
              <strong>{selectedLeave?.staffName}</strong> for{' '}
              {selectedLeave?.numberOfDays} days.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="State the reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={submitting || !rejectReason}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Rejecting...' : 'Reject Leave'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Return Modal */}
      <FormModal
        isOpen={showReturnModal}
        title="Record Leave Return"
        subtitle={selectedLeave?.staffName}
        onClose={() => setShowReturnModal(false)}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Return Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Joining Report */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              onClick={() => setJoiningReport(!joiningReport)}
              className={`
                relative w-10 h-6 rounded-full cursor-pointer transition-colors
                ${joiningReport ? 'bg-green-500' : 'bg-gray-300'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full shadow
                  transition-transform
                  ${joiningReport ? 'translate-x-5' : 'translate-x-1'}
                `}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Joining Report Submitted
              </p>
              <p className="text-xs text-gray-500">
                {joiningReport ? 'Yes, submitted' : 'Not yet submitted'}
              </p>
            </div>
          </div>

          {/* Delay Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay Reason (if any)
            </label>
            <input
              type="text"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Reason if returned after due date..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowReturnModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleReturnSubmit}
              disabled={submitting || !returnDate}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Record Return'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Add Leave Type Modal */}
      <FormModal
        isOpen={showLeaveTypeModal}
        title="Add Leave Type"
        subtitle="Create a new leave category"
        onClose={() => setShowLeaveTypeModal(false)}
        size="sm"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leave Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ltName}
                onChange={(e) => setLtName(e.target.value)}
                placeholder="e.g., Casual Leave"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ltCode}
                onChange={(e) => setLtCode(e.target.value.toUpperCase())}
                placeholder="e.g., CL"
                maxLength={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Days Per Year
            </label>
            <input
              type="number"
              value={ltMaxDays}
              onChange={(e) => setLtMaxDays(Number(e.target.value))}
              min={1}
              max={365}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              onClick={() => setLtIsPaid(!ltIsPaid)}
              className={`
                relative w-10 h-6 rounded-full cursor-pointer transition-colors
                ${ltIsPaid ? 'bg-green-500' : 'bg-gray-300'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full shadow
                  transition-transform
                  ${ltIsPaid ? 'translate-x-5' : 'translate-x-1'}
                `}
              />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {ltIsPaid ? 'Paid Leave' : 'Unpaid Leave'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={ltDescription}
              onChange={(e) => setLtDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowLeaveTypeModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveTypeSubmit}
              disabled={submitting || !ltName || !ltCode}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Add Leave Type'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Approve Dialog */}
      <ConfirmDialog
        isOpen={showApproveDialog}
        title="Approve Leave"
        message={`Approve ${selectedLeave?.numberOfDays} days ${selectedLeave?.leaveTypeName} for ${selectedLeave?.staffName}?`}
        confirmLabel="Yes, Approve"
        confirmColor="green"
        onConfirm={handleApproveConfirm}
        onCancel={() => {
          setShowApproveDialog(false);
          setSelectedLeave(null);
        }}
        loading={submitting}
      />

      {/* Cancel Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Cancel Leave Application"
        message={`Cancel leave application ${selectedLeave?.leaveNumber}?`}
        confirmLabel="Yes, Cancel"
        confirmColor="red"
        onConfirm={handleCancelConfirm}
        onCancel={() => {
          setShowCancelDialog(false);
          setSelectedLeave(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default LeaveManagementScreen;