// ============================================
// STAFF ATTENDANCE SCREEN
// ============================================

import React, { useState, useEffect } from 'react';
import { useAttendance } from '../hooks/useAttendance';
import { useStaff } from '../hooks/useStaff';
import { useLeave } from '../hooks/useLeave';
import {
  AttendanceStatus,
  DailyAttendanceEntry,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_SHORT,
} from '../types/attendance.types';

// ─── Tab Config ───────────────────────────────
const TABS = [
  { key: 'daily', label: 'Daily Attendance', icon: '📅' },
  { key: 'monthly', label: 'Monthly Report', icon: '📊' },
];

// ─── Status Options for Dropdown ─────────────
const STATUS_OPTIONS: AttendanceStatus[] = [
  'present',
  'absent',
  'leave',
  'td',
  'hospital',
  'course',
  'attachment',
  'weekly_off',
];

const AttendanceScreen: React.FC = () => {
      const {
    dailyAttendance,
    allMonthlyAttendance,
    loading,
    submitting,
    error,
    fetchDailyAttendance,
    fetchAllMonthly,
    handleMarkBulkAttendance,
    getTodaySummary,
    clearError,
  } = useAttendance();

  const { staffList, loading: staffLoading } = useStaff();

  // 🆕 IMPORT LEAVES FOR AUTO-DETECTION
  const { allLeaves, fetchAllLeaves } = useLeave();

  useEffect(() => {
    fetchAllLeaves();
  }, [fetchAllLeaves]);

  // ─── UI State ────────────────────────────
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );
  const [attendanceEntries, setAttendanceEntries] = useState<
    DailyAttendanceEntry[]
  >([]);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── Years List ──────────────────────────
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  const months = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ];

  // ─── Fetch daily attendance ───────────────
    // 🆕 AUTO-SAVE detected leave/hospital status
  useEffect(() => {
    const autoSaveDetected = async () => {
      if (attendanceEntries.length === 0 || isEditing) return;

      // Find entries with auto-status but not saved
      const needsSaving = attendanceEntries.filter(entry => {
        const existing = dailyAttendance.find(a => a.staffId === entry.staffId);
        // Save if:
        // 1. No existing record AND
        // 2. Status is NOT 'present' (auto-detected something)
        return !existing && entry.status !== 'present';
      });

      if (needsSaving.length > 0) {
        console.log(`🔄 Auto-saving ${needsSaving.length} auto-detected attendance...`);
        try {
          await handleMarkBulkAttendance(needsSaving, selectedDate);
        } catch (err) {
          console.warn('Auto-save failed:', err);
        }
      }
    };

    // Delay to avoid rapid saves
    const timer = setTimeout(autoSaveDetected, 2000);
    return () => clearTimeout(timer);
  }, [attendanceEntries, dailyAttendance, selectedDate, isEditing, handleMarkBulkAttendance]);

  // ─── Fetch monthly attendance ─────────────
  useEffect(() => {
    if (activeTab === 'monthly') {
      fetchAllMonthly(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear, activeTab, fetchAllMonthly]);

    // ═══════════════════════════════════════════
  // 🆕 SMART ATTENDANCE BUILDER
  // Auto-detects leaves and pre-marks status
  // ═══════════════════════════════════════════
   useEffect(() => {
    if (staffList.length > 0) {
      const checkDate = new Date(selectedDate);
      checkDate.setHours(12, 0, 0, 0);

      // Get all active leaves for this date
      const activeLeavesOnDate = allLeaves.filter(l =>
        l.status === 'approved' &&
        l.fromDate && l.toDate &&
        checkDate >= l.fromDate &&
        checkDate <= l.toDate &&
        !l.returnDate
      );

      const activeStaff = staffList.filter(s => s.status !== 'inactive');

      const entries = activeStaff.map(staff => {
        const existing = dailyAttendance.find(a => a.staffId === staff.id);
        const onLeave = activeLeavesOnDate.find(l => l.staffId === staff.id);

        // ⭐ PRIORITY LOGIC:
        // 1. Active Leave (highest priority) → Always override
        // 2. Staff status (hospital/td/course) → Override if no existing
        // 3. Existing attendance (if manually marked)
        // 4. Default: Present

        let autoStatus: any = 'present';
        let autoRemarks = '';

        // Priority 1: On Leave (FORCE OVERRIDE)
        if (onLeave) {
          autoStatus = 'leave';
          autoRemarks = `📋 Auto: ${onLeave.leaveTypeName} (${onLeave.leaveNumber})`;
        }
        // Priority 2: Staff status
        else if (staff.status === 'hospital') {
          autoStatus = 'hospital';
          autoRemarks = '🏥 Auto: Staff in hospital';
        }
        else if (staff.status === 'td') {
          autoStatus = 'td';
          autoRemarks = '🚗 Auto: On Temporary Duty';
        }
        else if (staff.status === 'course') {
          autoStatus = 'course';
          autoRemarks = '📖 Auto: On Course';
        }
        else if (staff.status === 'attachment') {
          autoStatus = 'attachment';
          autoRemarks = '🔗 Auto: On Attachment';
        }
        else if (staff.status === 'deputed_out' || staff.status === 'on_deputation') {
          autoStatus = 'td';
          autoRemarks = '🎖️ Auto: On Deputation';
        }
        // Priority 3: Use existing if available
        else if (existing) {
          autoStatus = existing.status;
          autoRemarks = existing.remarks;
        }
        // Priority 4: Default present

        return {
          staffId: staff.id,
          staffName: staff.name,
          forceNumber: staff.forceNumber,
          rank: staff.rank,
          status: autoStatus,
          remarks: autoRemarks,
        };
      });

      setAttendanceEntries(entries);
    }
  }, [staffList, dailyAttendance, allLeaves, selectedDate]);

  // ─── Today Summary ───────────────────────
  const todaySummary = getTodaySummary(dailyAttendance);

  // ─── Filtered Entries ────────────────────
  const filteredEntries = attendanceEntries.filter(
    (entry) =>
      !searchQuery ||
      entry.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.forceNumber.includes(searchQuery)
  );

  // ─── Update Entry Status ──────────────────
  const updateEntryStatus = (
    staffId: string,
    status: AttendanceStatus
  ) => {
    setAttendanceEntries((prev) =>
      prev.map((e) =>
        e.staffId === staffId ? { ...e, status } : e
      )
    );
  };

  // ─── Update Entry Remarks ─────────────────
  const updateEntryRemarks = (staffId: string, remarks: string) => {
    setAttendanceEntries((prev) =>
      prev.map((e) =>
        e.staffId === staffId ? { ...e, remarks } : e
      )
    );
  };

  // ─── Mark All Present ─────────────────────
  const markAllPresent = () => {
    setAttendanceEntries((prev) =>
      prev.map((e) => ({ ...e, status: 'present' as AttendanceStatus }))
    );
  };

  // ─── Save Attendance ──────────────────────
  const handleSave = async () => {
    const success = await handleMarkBulkAttendance(
      attendanceEntries,
      selectedDate
    );
    if (success) {
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // ─── Monthly Report Calculation ───────────
  const getMonthlyStaffSummary = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    return staffList
      .filter((s) => s.status !== 'inactive')
      .map((staff) => {
        const records = allMonthlyAttendance.filter(
          (a) => a.staffId === staff.id
        );

        const present = records.filter((r) => r.status === 'present').length;
        const absent = records.filter((r) => r.status === 'absent').length;
        const leave = records.filter((r) => r.status === 'leave').length;
        const td = records.filter((r) => r.status === 'td').length;
        const weeklyOff = records.filter(
          (r) => r.status === 'weekly_off'
        ).length;
        const workingDays = daysInMonth - weeklyOff;
        const percent =
          workingDays > 0 ? Math.round((present / workingDays) * 100) : 0;

        return {
          staffId: staff.id,
          name: staff.name,
          rank: staff.rank,
          forceNumber: staff.forceNumber,
          present,
          absent,
          leave,
          td,
          weeklyOff,
          other: records.length - present - absent - leave - td - weeklyOff,
          percent,
          totalMarked: records.length,
        };
      });
  };

  const monthlyData = activeTab === 'monthly' ? getMonthlyStaffSummary() : [];

  // ─── Get Status Color for cell ────────────
  const getStatusCellColor = (status: AttendanceStatus): string => {
    const map: Record<AttendanceStatus, string> = {
      present: 'bg-green-100 text-green-700',
      absent: 'bg-red-100 text-red-700',
      leave: 'bg-yellow-100 text-yellow-700',
      td: 'bg-blue-100 text-blue-700',
      hospital: 'bg-pink-100 text-pink-700',
      course: 'bg-purple-100 text-purple-700',
      attachment: 'bg-orange-100 text-orange-700',
      weekly_off: 'bg-gray-100 text-gray-600',
    };
    return map[status];
  };

  const isLoading = loading || staffLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Staff Attendance
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Mark and track daily attendance
            </p>
          </div>

          {/* Action Buttons */}
          {activeTab === 'daily' && (
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ✏️ Mark Attendance
                </button>
              ) : (
                <>
                  <button
                    onClick={markAllPresent}
                    className="px-3 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors"
                  >
                    ✓ All Present
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      '💾 Save Attendance'
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

            <div className="p-6 space-y-5">

        {/* 🆕 Batch Indicator */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-lg">🎓</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-blue-900">
              Showing data for current batch only
            </p>
            <p className="text-[10px] text-blue-700 mt-0.5">
              Attendance is batch-wise. Old batch data preserved separately.
            </p>
          </div>
        </div>
        {/* ── Success Message ── */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-green-500 text-xl">✅</span>
            <p className="text-sm text-green-700 font-medium">
              Attendance saved successfully!
            </p>
          </div>
        )}

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
              onClick={() => {
                setActiveTab(tab.key);
                setIsEditing(false);
              }}
              className={`
                flex-1 flex items-center justify-center gap-2
                py-2 px-4 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            DAILY ATTENDANCE TAB
        ══════════════════════════════════════ */}
        {activeTab === 'daily' && (
          <div className="space-y-5">
            {/* Date Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    📅 Date:
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Search */}
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            {/* 🆕 AUTO-DETECTION BANNER */}
            {(() => {
              const checkDate = new Date(selectedDate);
              checkDate.setHours(12, 0, 0, 0);
              const leavesOnDate = allLeaves.filter(l =>
                l.status === 'approved' &&
                l.fromDate && l.toDate &&
                checkDate >= l.fromDate &&
                checkDate <= l.toDate
              );

              if (leavesOnDate.length === 0) return null;

              return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
                  <span className="text-blue-600 text-lg">💡</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-900">
                      {leavesOnDate.length} staff auto-detected as On Leave for {new Date(selectedDate).toLocaleDateString('en-IN')}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {leavesOnDate.slice(0, 5).map(l => (
                        <span key={l.id} className="text-[10px] bg-white text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {l.rank} {l.staffName} ({l.leaveTypeCode})
                        </span>
                      ))}
                      {leavesOnDate.length > 5 && (
                        <span className="text-[10px] text-blue-600 font-bold">
                          +{leavesOnDate.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            
            {/* Today Summary Cards */}
            {dailyAttendance.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <div
                    key={status}
                    className={`
                      rounded-xl p-3 text-center
                      ${ATTENDANCE_STATUS_COLORS[status]}
                    `}
                  >
                    <p className="text-lg font-bold">
                      {todaySummary[status] ?? 0}
                    </p>
                    <p className="text-xs font-medium mt-0.5">
                      {ATTENDANCE_STATUS_SHORT[status]}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Attendance Table */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
                <p className="text-5xl mb-3">📅</p>
                <p className="text-gray-500">No staff found</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Table Header */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">
                    Attendance Register
                  </h3>
                  <p className="text-xs text-gray-500">
                    {filteredEntries.length} staff members
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Force No
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Name & Rank
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Status
                        </th>
                        {isEditing && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                            Remarks
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredEntries.map((entry, index) => (
                        <tr
                          key={entry.staffId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Index */}
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {index + 1}
                          </td>

                          {/* Force Number */}
                          <td className="px-4 py-3 text-sm font-mono text-gray-700">
                            {entry.forceNumber}
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">
                              {entry.staffName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {entry.rank}
                            </p>
                          </td>

                                                   <td className="px-4 py-3">
                            {isEditing ? (
                              <select
                                value={entry.status}
                                onChange={(e) =>
                                  updateEntryStatus(
                                    entry.staffId,
                                    e.target.value as AttendanceStatus
                                  )
                                }
                                className={`
                                  px-2 py-1.5 rounded-lg text-xs font-medium
                                  border focus:outline-none focus:ring-2
                                  focus:ring-blue-500 cursor-pointer
                                  ${getStatusCellColor(entry.status)}
                                `}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {ATTENDANCE_STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`
                                    inline-flex items-center px-2.5 py-1
                                    rounded-full text-xs font-medium
                                    ${ATTENDANCE_STATUS_COLORS[entry.status]}
                                  `}
                                >
                                  {ATTENDANCE_STATUS_LABELS[entry.status]}
                                </span>
                                {entry.remarks?.startsWith('📋 Auto') ||
                                 entry.remarks?.startsWith('🏥 Auto') ||
                                 entry.remarks?.startsWith('🚗 Auto') ||
                                 entry.remarks?.startsWith('📖 Auto') ||
                                 entry.remarks?.startsWith('🎖️ Auto') ? (
                                  <span
                                    title={entry.remarks}
                                    className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full cursor-help"
                                  >
                                    AUTO
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>

                          {/* Remarks - Only in Edit Mode */}
                          {isEditing && (
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={entry.remarks}
                                onChange={(e) =>
                                  updateEntryRemarks(
                                    entry.staffId,
                                    e.target.value
                                  )
                                }
                                placeholder="Optional remarks..."
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Date: {new Date(selectedDate).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  {isEditing && (
                    <button
                      onClick={handleSave}
                      disabled={submitting}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : '💾 Save'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            MONTHLY REPORT TAB
        ══════════════════════════════════════ */}
        {activeTab === 'monthly' && (
          <div className="space-y-5">
            {/* Month + Year Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Month:
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) =>
                      setSelectedMonth(Number(e.target.value))
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {months.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Year:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(Number(e.target.value))
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Monthly Summary Table */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-700">
                    Monthly Attendance Report — {months[selectedMonth - 1]}{' '}
                    {selectedYear}
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {[
                          '#',
                          'Force No',
                          'Name',
                          'Rank',
                          'Present',
                          'Absent',
                          'Leave',
                          'TD',
                          'WO',
                          'Other',
                          'Attendance %',
                        ].map((col) => (
                          <th
                            key={col}
                            className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyData.map((row, index) => (
                        <tr
                          key={row.staffId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-3 py-3 text-sm text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3 text-sm font-mono text-gray-700">
                            {row.forceNumber}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">
                            {row.name}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            {row.rank}
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              {row.present}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                              {row.absent}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
                              {row.leave}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                              {row.td}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm text-gray-600">
                              {row.weeklyOff}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm text-gray-600">
                              {row.other}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {/* Progress Bar */}
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    row.percent >= 90
                                      ? 'bg-green-500'
                                      : row.percent >= 75
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${row.percent}%` }}
                                />
                              </div>
                              <span
                                className={`text-sm font-bold ${
                                  row.percent >= 90
                                    ? 'text-green-700'
                                    : row.percent >= 75
                                    ? 'text-yellow-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {row.percent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'P = Present', color: 'text-green-600' },
                      { label: 'A = Absent', color: 'text-red-600' },
                      { label: 'L = Leave', color: 'text-yellow-600' },
                      { label: 'TD = Temp Duty', color: 'text-blue-600' },
                      { label: 'WO = Weekly Off', color: 'text-gray-600' },
                    ].map((item) => (
                      <span
                        key={item.label}
                        className={`text-xs font-medium ${item.color}`}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceScreen;