// ============================================
// TRAINING SCHEDULE SCREEN
// ============================================

import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, X, MapPin, Users,
  ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, PlayCircle,
  Loader2, Filter, Trash2,
} from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useStaff } from '../hooks/useStaff';
import { useSubjects } from '../hooks/useSubjects';
import {
  TrainingSchedule, ScheduleFormData, DEFAULT_SCHEDULE_FORM,
  SCHEDULE_STATUS_COLORS, SCHEDULE_STATUS_LABELS,
  DAYS_OF_WEEK, PLATOONS, COMMON_VENUES,
} from '../types/schedule.types';
``
import { COMPANIES } from '../types/staff.types';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const TrainingScheduleScreen: React.FC = () => {
  const {
    schedules, weekSchedules, loading, submitting, error, hasBatch,
    fetchDaily, fetchWeekly, handleAdd, handleUpdateStatus, handleDelete,
    checkConflict, clearError,
  } = useSchedule();

  const { staffList } = useStaff();
  const { activeSubjects } = useSubjects();

  // UI State
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<TrainingSchedule | null>(null);
  const [filterUstad, setFilterUstad] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');

  // Form
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
    ...DEFAULT_SCHEDULE_FORM,
    date: selectedDate,
  });

  const [conflict, setConflict] = useState<TrainingSchedule | null>(null);

  // ─── Fetch on Date Change ────────────────
  useEffect(() => {
    if (viewMode === 'daily') {
      fetchDaily(selectedDate);
    } else {
      // Weekly view - get Monday to Sunday
      const date = new Date(selectedDate);
      const day = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      fetchWeekly(
        monday.toISOString().split('T')[0],
        sunday.toISOString().split('T')[0]
      );
    }
  }, [selectedDate, viewMode, fetchDaily, fetchWeekly]);

  // ─── Check Conflict on Form Change ───────
  useEffect(() => {
    const checkForConflict = async () => {
      if (scheduleForm.ustadId && scheduleForm.date && scheduleForm.startTime && scheduleForm.endTime) {
        const conflictSchedule = await checkConflict(
          scheduleForm.ustadId,
          scheduleForm.date,
          scheduleForm.startTime,
          scheduleForm.endTime
        );
        setConflict(conflictSchedule);
      } else {
        setConflict(null);
      }
    };
    const timer = setTimeout(checkForConflict, 500);
    return () => clearTimeout(timer);
  }, [scheduleForm.ustadId, scheduleForm.date, scheduleForm.startTime, scheduleForm.endTime, checkConflict]);

  // ─── Handlers ────────────────────────────
  const handleSubmit = async () => {
    if (conflict) {
      alert(`❌ Conflict! ${conflict.ustadName} is already scheduled for ${conflict.subjectName} at ${conflict.startTime}-${conflict.endTime}`);
      return;
    }

    const ustad = staffList.find(s => s.id === scheduleForm.ustadId);
    const subject = activeSubjects.find(s => s.id === scheduleForm.subjectId);

    if (!ustad || !subject) {
      alert('Please select ustad and subject');
      return;
    }

    const success = await handleAdd(
      scheduleForm,
      { name: ustad.name, rank: ustad.rank, forceNumber: ustad.forceNumber },
      { name: subject.name, code: subject.code }
    );

    if (success) {
      setShowAddModal(false);
      setScheduleForm({ ...DEFAULT_SCHEDULE_FORM, date: selectedDate });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSchedule) return;
    const success = await handleDelete(selectedSchedule.id);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedSchedule(null);
    }
  };

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // ─── Filtered Schedules ──────────────────
  const filteredSchedules = schedules.filter(s => {
    if (filterUstad !== 'all' && s.ustadId !== filterUstad) return false;
    if (filterCompany !== 'all' && s.company !== filterCompany) return false;
    return true;
  });

  const filteredWeekSchedules = weekSchedules.filter(s => {
    if (filterUstad !== 'all' && s.ustadId !== filterUstad) return false;
    if (filterCompany !== 'all' && s.company !== filterCompany) return false;
    return true;
  });

  // ─── Group weekly by day ─────────────────
  const weekByDay = DAYS_OF_WEEK.map((day, idx) => {
    // Get date for this day of current week
    const date = new Date(selectedDate);
    const currentDay = date.getDay();
    const targetDate = new Date(date);
    targetDate.setDate(date.getDate() - currentDay + idx);
    const dateStr = targetDate.toISOString().split('T')[0];

    return {
      day,
      date: dateStr,
      displayDate: targetDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      schedules: filteredWeekSchedules.filter(s => s.dayOfWeek === day),
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={22} className="text-blue-600" />
              Training Schedule
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Konsa ustad kab kaun si class padhayega
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!hasBatch}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus size={16} /> Schedule Class
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* NO BATCH WARNING */}
        {!hasBatch && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">No Active Batch</p>
              <p className="text-xs text-amber-700 mt-0.5">Activate a batch to manage training schedule</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <XCircle size={18} className="text-red-500" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError}><X size={14} className="text-red-400" /></button>
          </div>
        )}

        {/* VIEW MODE + DATE NAV */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'daily' ? 'bg-white text-blue-700 shadow' : 'text-gray-600'
                }`}
              >
                📅 Daily
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'weekly' ? 'bg-white text-blue-700 shadow' : 'text-gray-600'
                }`}
              >
                📆 Weekly
              </button>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeDate(viewMode === 'daily' ? -1 : -7)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => changeDate(viewMode === 'daily' ? 1 : 7)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-200"
              >
                Today
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500 uppercase">Filters:</span>
            </div>
            <select
              value={filterUstad}
              onChange={e => setFilterUstad(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            >
              <option value="all">All Ustads</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.rank} {s.name}
                </option>
              ))}
            </select>
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            >
              <option value="all">All Companies</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filterUstad !== 'all' || filterCompany !== 'all') && (
              <button
                onClick={() => { setFilterUstad('all'); setFilterCompany('all'); }}
                className="text-xs text-blue-600 font-bold"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            DAILY VIEW
        ═══════════════════════════════════════ */}
        {viewMode === 'daily' && (
          <div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
                <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No classes scheduled</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(selectedDate).toLocaleDateString('en-IN', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  disabled={!hasBatch}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
                >
                  + Schedule First Class
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Date Header */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-bold text-blue-600 uppercase">
                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long' })}
                  </p>
                  <p className="text-lg font-black text-blue-900 mt-0.5">
                    {new Date(selectedDate).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {filteredSchedules.length} classes scheduled
                  </p>
                </div>

                {/* Schedule Cards */}
                {filteredSchedules.map(schedule => (
                  <div
                    key={schedule.id}
                    className={`bg-white rounded-xl border-l-4 border border-gray-200 p-4 hover:shadow-md transition-shadow ${
                      schedule.status === 'completed' ? 'border-l-green-500' :
                      schedule.status === 'cancelled' ? 'border-l-red-500' :
                      schedule.status === 'in_progress' ? 'border-l-amber-500' :
                      'border-l-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Time + Class */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="bg-blue-50 rounded-lg p-3 text-center min-w-[80px]">
                          <p className="text-xs font-bold text-blue-600 uppercase">Time</p>
                          <p className="text-sm font-black text-blue-900 mt-1">{schedule.startTime}</p>
                          <p className="text-[10px] text-blue-500">to</p>
                          <p className="text-sm font-black text-blue-900">{schedule.endTime}</p>
                          <p className="text-[9px] text-blue-500 mt-1">{schedule.duration} min</p>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">
                              {schedule.subjectCode}
                            </span>
                            <h3 className="text-lg font-bold text-gray-900">
                              {schedule.subjectName}
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Users size={12} className="text-blue-500" />
                              <span className="font-bold">{schedule.ustadRank} {schedule.ustadName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-red-500" />
                              <span>{schedule.company} · {schedule.platoon}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span>📍</span>
                              <span>{schedule.venue}</span>
                            </div>
                          </div>

                          {schedule.remarks && (
                            <p className="text-xs text-gray-500 mt-2 italic">💬 {schedule.remarks}</p>
                          )}
                        </div>
                      </div>

                      {/* Right: Status + Actions */}
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${SCHEDULE_STATUS_COLORS[schedule.status]}`}>
                          {SCHEDULE_STATUS_LABELS[schedule.status]}
                        </span>

                        <div className="flex gap-1">
                          {schedule.status === 'scheduled' && (
                            <button
                              onClick={() => handleUpdateStatus(schedule.id, 'in_progress')}
                              title="Start Class"
                              className="p-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                            >
                              <PlayCircle size={14} />
                            </button>
                          )}
                          {schedule.status === 'in_progress' && (
                            <button
                              onClick={() => handleUpdateStatus(schedule.id, 'completed')}
                              title="Mark Complete"
                              className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {(schedule.status === 'scheduled' || schedule.status === 'in_progress') && (
                            <button
                              onClick={() => handleUpdateStatus(schedule.id, 'cancelled')}
                              title="Cancel"
                              className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              setShowDeleteDialog(true);
                            }}
                            title="Delete"
                            className="p-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            WEEKLY VIEW
        ═══════════════════════════════════════ */}
        {viewMode === 'weekly' && (
          <div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                {weekByDay.map(({ day, date, displayDate, schedules: daySchedules }) => (
                  <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Day Header */}
                    <div className={`px-3 py-2 border-b border-gray-200 ${
                      date === new Date().toISOString().split('T')[0] ? 'bg-blue-50' : 'bg-gray-50'
                    }`}>
                      <p className="text-xs font-bold text-gray-700 uppercase">{day.slice(0, 3)}</p>
                      <p className="text-lg font-black text-gray-900">{displayDate}</p>
                      <p className="text-[10px] text-gray-500">{daySchedules.length} classes</p>
                    </div>

                    {/* Classes */}
                    <div className="p-2 space-y-1 min-h-[200px]">
                      {daySchedules.length === 0 ? (
                        <p className="text-[10px] text-gray-300 text-center py-4">No classes</p>
                      ) : (
                        daySchedules
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map(schedule => (
                            <div
                              key={schedule.id}
                              className={`p-2 rounded-lg text-[10px] border ${
                                SCHEDULE_STATUS_COLORS[schedule.status]
                              }`}
                            >
                              <p className="font-bold">{schedule.startTime}</p>
                              <p className="font-semibold truncate">{schedule.subjectCode}</p>
                              <p className="text-[9px] truncate">{schedule.ustadName}</p>
                              <p className="text-[9px] opacity-70">{schedule.company}</p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          ADD SCHEDULE MODAL
      ═══════════════════════════════════════ */}
      <FormModal
        isOpen={showAddModal}
        title="Schedule a Class"
        subtitle="Assign ustad, subject, time and company"
        onClose={() => {
          setShowAddModal(false);
          setConflict(null);
        }}
        size="lg"
      >
        <div className="space-y-4">

          {/* Date + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                value={scheduleForm.date}
                onChange={e => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Start Time *</label>
              <input
                type="time"
                value={scheduleForm.startTime}
                onChange={e => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">End Time *</label>
              <input
                type="time"
                value={scheduleForm.endTime}
                onChange={e => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Ustad */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Select Ustad *
            </label>
            <select
              value={scheduleForm.ustadId}
              onChange={e => setScheduleForm(prev => ({ ...prev, ustadId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">-- Select Ustad --</option>
              {staffList
                .filter(s => s.status === 'active')
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.rank} {s.name} — {s.category} ({s.company})
                  </option>
                ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Select Subject *
            </label>
            <select
              value={scheduleForm.subjectId}
              onChange={e => setScheduleForm(prev => ({ ...prev, subjectId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">-- Select Subject --</option>
              {activeSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Company + Platoon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Company *</label>
              <select
                value={scheduleForm.company}
                onChange={e => setScheduleForm(prev => ({ ...prev, company: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Select Company --</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Platoon</label>
              <select
                value={scheduleForm.platoon}
                onChange={e => setScheduleForm(prev => ({ ...prev, platoon: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Select Platoon --</option>
                {PLATOONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Venue</label>
            <select
              value={scheduleForm.venue}
              onChange={e => setScheduleForm(prev => ({ ...prev, venue: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">-- Select Venue --</option>
              {COMMON_VENUES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks</label>
            <input
              type="text"
              value={scheduleForm.remarks}
              onChange={e => setScheduleForm(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Any special notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* CONFLICT WARNING */}
          {conflict && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">⚠️ Schedule Conflict!</p>
                <p className="text-xs text-red-700 mt-1">
                  <strong>{conflict.ustadName}</strong> is already scheduled for{' '}
                  <strong>{conflict.subjectName}</strong> from{' '}
                  <strong>{conflict.startTime}</strong> to{' '}
                  <strong>{conflict.endTime}</strong>
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Please choose different time or ustad.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                submitting || !!conflict ||
                !scheduleForm.ustadId || !scheduleForm.subjectId ||
                !scheduleForm.company || !scheduleForm.date
              }
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 flex items-center gap-2 ${
                conflict ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : conflict ? (
                <>❌ Conflict Detected</>
              ) : (
                <>✓ Schedule Class</>
              )}
            </button>
          </div>
        </div>
      </FormModal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Schedule"
        message={`Delete ${selectedSchedule?.subjectName} class of ${selectedSchedule?.ustadName}?`}
        confirmLabel="Yes, Delete"
        confirmColor="red"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedSchedule(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default TrainingScheduleScreen;