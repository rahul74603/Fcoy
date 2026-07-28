// ============================================
// BATCH PROGRESS SCREEN - REDESIGNED
// Individual semi-circle cards + Manual add
// ============================================

import React, { useState } from 'react';
import {
  TrendingUp, Calendar, Award, Plus, X,
  CheckCircle2, Clock, BarChart3, Loader2, Trash2,
  AlertTriangle, Zap, Edit3,
} from 'lucide-react';
import { useBatchProgress } from '../hooks/useBatchProgress';
import { useSubjects } from '../hooks/useSubjects';
import {
  SubjectProgress,
  getProgressLabel, DEFAULT_MILESTONES,
} from '../types/batchProgress.types';
import FormModal from '../components/shared/FormModal';

// ─── DEFAULT SUBJECTS (if not in master) ─────
const DEFAULT_SUBJECT_OPTIONS = [
  { code: 'DRILL', name: 'Drill', category: 'Physical Training', color: 'purple' },
  { code: 'PT', name: 'Physical Training', category: 'Physical Training', color: 'blue' },
  { code: 'WPN', name: 'Weapon Training', category: 'Weapon Training', color: 'red' },
  { code: 'FIRE', name: 'Firing Practice', category: 'Weapon Training', color: 'orange' },
  { code: 'FPT', name: 'Field Physical Training', category: 'Physical Training', color: 'green' },
  { code: 'MAP', name: 'Map Reading', category: 'Academic', color: 'cyan' },
  { code: 'FLD', name: 'Field Craft', category: 'Field Craft', color: 'amber' },
  { code: 'BTL', name: 'Battle Craft', category: 'Battle Craft', color: 'pink' },
  { code: 'YOGA', name: 'Yoga', category: 'Physical Training', color: 'teal' },
  { code: 'COMM', name: 'Communication', category: 'Technical', color: 'indigo' },
  { code: 'LAW', name: 'Law & Order', category: 'Academic', color: 'slate' },
  { code: 'FA', name: 'First Aid', category: 'Medical', color: 'rose' },
  { code: 'SWIM', name: 'Swimming', category: 'Physical Training', color: 'sky' },
  { code: 'PARADE', name: 'Parade Practice', category: 'Physical Training', color: 'violet' },
];

// ─── Card Color Themes ───────────────────────
const CARD_THEMES: Record<string, { bg: string; ring: string; text: string; light: string }> = {
  purple: { bg: 'from-purple-500 to-purple-700', ring: '#a855f7', text: 'text-purple-700', light: 'bg-purple-50' },
  blue: { bg: 'from-blue-500 to-blue-700', ring: '#3b82f6', text: 'text-blue-700', light: 'bg-blue-50' },
  red: { bg: 'from-red-500 to-red-700', ring: '#ef4444', text: 'text-red-700', light: 'bg-red-50' },
  orange: { bg: 'from-orange-500 to-orange-700', ring: '#f97316', text: 'text-orange-700', light: 'bg-orange-50' },
  green: { bg: 'from-green-500 to-green-700', ring: '#22c55e', text: 'text-green-700', light: 'bg-green-50' },
  cyan: { bg: 'from-cyan-500 to-cyan-700', ring: '#06b6d4', text: 'text-cyan-700', light: 'bg-cyan-50' },
  amber: { bg: 'from-amber-500 to-amber-700', ring: '#f59e0b', text: 'text-amber-700', light: 'bg-amber-50' },
  pink: { bg: 'from-pink-500 to-pink-700', ring: '#ec4899', text: 'text-pink-700', light: 'bg-pink-50' },
  teal: { bg: 'from-teal-500 to-teal-700', ring: '#14b8a6', text: 'text-teal-700', light: 'bg-teal-50' },
  indigo: { bg: 'from-indigo-500 to-indigo-700', ring: '#6366f1', text: 'text-indigo-700', light: 'bg-indigo-50' },
  slate: { bg: 'from-slate-500 to-slate-700', ring: '#64748b', text: 'text-slate-700', light: 'bg-slate-50' },
  rose: { bg: 'from-rose-500 to-rose-700', ring: '#f43f5e', text: 'text-rose-700', light: 'bg-rose-50' },
  sky: { bg: 'from-sky-500 to-sky-700', ring: '#0ea5e9', text: 'text-sky-700', light: 'bg-sky-50' },
  violet: { bg: 'from-violet-500 to-violet-700', ring: '#8b5cf6', text: 'text-violet-700', light: 'bg-violet-50' },
};

// ─── Get color for subject ─────────────────
const getSubjectColor = (code: string, category?: string): string => {
  const found = DEFAULT_SUBJECT_OPTIONS.find(s => s.code === code || s.name === code);
  if (found) return found.color;
  if (category?.includes('Weapon')) return 'red';
  if (category?.includes('Physical')) return 'blue';
  if (category?.includes('Field')) return 'amber';
  if (category?.includes('Battle')) return 'pink';
  return 'slate';
};

// ═══════════════════════════════════════════════════════════
// SEMI-CIRCLE PROGRESS COMPONENT
// ═══════════════════════════════════════════════════════════
const SemiCircleProgress: React.FC<{
  percent: number;
  color: string;
  size?: number;
}> = ({ percent, color, size = 140 }) => {
  const radius = size / 2 - 15;
  const circumference = Math.PI * radius; // Semi-circle
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 10 }}>
      <svg width={size} height={size / 2 + 10} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M 15 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 15} ${size / 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M 15 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 15} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-2xl font-black text-slate-900">{percent}%</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const BatchProgressScreen: React.FC = () => {
  const {
    progress, loading, submitting, error,
    handleAddSubject, handleRemoveSubject, handleUpdateProgress,
    handleAddMilestone, handleCompleteMilestone, clearError,
  } = useBatchProgress();

  const { activeSubjects } = useSubjects();

  // UI State
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [selectedSubjectProgress, setSelectedSubjectProgress] = useState<SubjectProgress | null>(null);

  // Form states
  const [subjectMode, setSubjectMode] = useState<'existing' | 'custom' | 'quick'>('quick');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedQuickSubject, setSelectedQuickSubject] = useState('');

  const [customSubject, setCustomSubject] = useState({
    name: '',
    code: '',
    category: '',
  });

  const [subjectPlan, setSubjectPlan] = useState({
    totalHours: 40,
    totalClasses: 20,
  });

  const [newMilestone, setNewMilestone] = useState({
    name: '',
    targetDate: new Date().toISOString().split('T')[0],
  });

  const [progressUpdate, setProgressUpdate] = useState({
    completedHours: 0,
    completedClasses: 0,
  });

  // Milestone custom name mode
  const [milestoneMode, setMilestoneMode] = useState<'preset' | 'custom'>('preset');

  // ─── Add Subject Handler ─────────────────
  const handleAddSubjectSubmit = async () => {
    let subject: SubjectProgress | null = null;

    if (subjectMode === 'quick') {
      // Quick add from defaults
      const quickSub = DEFAULT_SUBJECT_OPTIONS.find(s => s.code === selectedQuickSubject);
      if (!quickSub) {
        alert('Select a subject');
        return;
      }

      subject = {
        subjectId: `quick_${quickSub.code}_${Date.now()}`,
        subjectName: quickSub.name,
        subjectCode: quickSub.code,
        category: quickSub.category,
        totalHours: subjectPlan.totalHours,
        completedHours: 0,
        totalClasses: subjectPlan.totalClasses,
        completedClasses: 0,
        percentComplete: 0,
        lastUpdated: new Date(),
      };
    } else if (subjectMode === 'existing') {
      // From master
      const s = activeSubjects.find(s => s.id === selectedSubjectId);
      if (!s) {
        alert('Select a subject');
        return;
      }
      subject = {
        subjectId: s.id,
        subjectName: s.name,
        subjectCode: s.code,
        category: s.category,
        totalHours: subjectPlan.totalHours,
        completedHours: 0,
        totalClasses: subjectPlan.totalClasses,
        completedClasses: 0,
        percentComplete: 0,
        lastUpdated: new Date(),
      };
    } else if (subjectMode === 'custom') {
      // Custom subject
      if (!customSubject.name || !customSubject.code) {
        alert('Enter subject name and code');
        return;
      }
      subject = {
        subjectId: `custom_${customSubject.code}_${Date.now()}`,
        subjectName: customSubject.name,
        subjectCode: customSubject.code.toUpperCase(),
        category: customSubject.category || 'Other',
        totalHours: subjectPlan.totalHours,
        completedHours: 0,
        totalClasses: subjectPlan.totalClasses,
        completedClasses: 0,
        percentComplete: 0,
        lastUpdated: new Date(),
      };
    }

    if (!subject) return;

    const success = await handleAddSubject(subject);
    if (success) {
      setShowAddSubject(false);
      setSelectedSubjectId('');
      setSelectedQuickSubject('');
      setCustomSubject({ name: '', code: '', category: '' });
      setSubjectPlan({ totalHours: 40, totalClasses: 20 });
      setSubjectMode('quick');
    }
  };

  // ─── Milestone Handler ───────────────────
  const handleAddMilestoneSubmit = async () => {
    if (!newMilestone.name) {
      alert('Enter milestone name');
      return;
    }
    const success = await handleAddMilestone(newMilestone.name, new Date(newMilestone.targetDate));
    if (success) {
      setShowAddMilestone(false);
      setNewMilestone({ name: '', targetDate: new Date().toISOString().split('T')[0] });
      setMilestoneMode('preset');
    }
  };

  // ─── Update Progress ─────────────────────
  const handleUpdateProgressSubmit = async () => {
    if (!selectedSubjectProgress) return;
    const success = await handleUpdateProgress(selectedSubjectProgress.subjectId, {
      ...selectedSubjectProgress,
      completedHours: progressUpdate.completedHours,
      completedClasses: progressUpdate.completedClasses,
      totalHours: selectedSubjectProgress.totalHours,
    });
    if (success) {
      setShowUpdateProgress(false);
      setSelectedSubjectProgress(null);
    }
  };

  const openUpdateModal = (subject: SubjectProgress) => {
    setSelectedSubjectProgress(subject);
    setProgressUpdate({
      completedHours: subject.completedHours,
      completedClasses: subject.completedClasses,
    });
    setShowUpdateProgress(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3" />
          <p className="text-lg font-bold text-slate-700">No Active Batch</p>
          <p className="text-sm text-slate-500 mt-1">
            Activate a batch to view progress
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider flex items-center gap-3">
              <TrendingUp size={28} />
              Batch Progress Tracker
            </h1>
            <p className="text-purple-200 text-sm mt-1">
              Subject-wise training completion visualization
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-75">Batch</p>
            <p className="text-lg font-black">{progress.batchNumber}</p>
            <p className="text-[10px] opacity-75">{progress.batchName}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError}><X size={14} className="text-red-400" /></button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            OVERALL PROGRESS - COMPACT
        ═══════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Overall Batch Completion
              </p>
              <p className="text-5xl font-black text-slate-900 mt-1">
                {progress.overallPercent}
                <span className="text-2xl text-slate-400">%</span>
              </p>
              <p className={`text-sm font-bold mt-1 ${
                progress.overallPercent >= 60 ? 'text-green-600' :
                progress.overallPercent >= 40 ? 'text-blue-600' :
                progress.overallPercent >= 20 ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {getProgressLabel(progress.overallPercent)}
              </p>
            </div>

            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#e2e8f0" strokeWidth="12" fill="none" />
                <circle
                  cx="64" cy="64" r="56" fill="none"
                  stroke={progress.overallPercent >= 60 ? '#22c55e' :
                          progress.overallPercent >= 40 ? '#3b82f6' :
                          progress.overallPercent >= 20 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 - (progress.overallPercent / 100) * 2 * Math.PI * 56}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-slate-800">
                  {progress.overallPercent}%
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
              style={{ width: `${progress.overallPercent}%` }}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════
            TIMELINE
        ═══════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar size={16} className="text-blue-700" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">Total Days</p>
            </div>
            <p className="text-3xl font-black text-blue-700">{progress.totalDays}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {progress.startDate?.toLocaleDateString('en-IN')} to {progress.endDate?.toLocaleDateString('en-IN')}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 size={16} className="text-green-700" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">Days Elapsed</p>
            </div>
            <p className="text-3xl font-black text-green-700">{progress.daysElapsed}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {progress.totalDays > 0
                ? Math.round((progress.daysElapsed / progress.totalDays) * 100)
                : 0}% of batch
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-amber-700" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">Days Remaining</p>
            </div>
            <p className="text-3xl font-black text-amber-700">{progress.daysRemaining}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              Until batch completion
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            🎨 SEMI-CIRCLE SUBJECT CARDS
        ═══════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h2 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-600" />
                Subject-wise Progress ({progress.subjectProgress.length})
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Individual subject completion
              </p>
            </div>
            <button
              onClick={() => setShowAddSubject(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={12} /> Add Subject
            </button>
          </div>

          <div className="p-5">
            {progress.subjectProgress.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-500">No subjects added yet</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Add subjects to see beautiful progress cards
                </p>
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700"
                >
                  + Add First Subject
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {progress.subjectProgress.map(subject => {
                  const colorName = getSubjectColor(subject.subjectCode, subject.category);
                  const theme = CARD_THEMES[colorName] || CARD_THEMES.slate;

                  return (
                    <div
                      key={subject.subjectId}
                      className={`${theme.light} rounded-2xl p-4 border-2 border-white shadow-md hover:shadow-lg transition-all group relative`}
                    >
                      {/* Action Buttons - Top Right */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openUpdateModal(subject)}
                          className="p-1 bg-white rounded shadow hover:shadow-md"
                          title="Update"
                        >
                          <Edit3 size={12} className={theme.text} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${subject.subjectName}?`)) {
                              handleRemoveSubject(subject.subjectId);
                            }
                          }}
                          className="p-1 bg-white rounded shadow hover:shadow-md"
                          title="Delete"
                        >
                          <Trash2 size={12} className="text-red-500" />
                        </button>
                      </div>

                      {/* Semi-Circle Progress */}
                      <div className="flex justify-center mb-2">
                        <SemiCircleProgress
                          percent={subject.percentComplete}
                          color={theme.ring}
                          size={140}
                        />
                      </div>

                      {/* Subject Info */}
                      <div className="text-center">
                        <div className={`inline-flex items-center gap-1 ${theme.text} bg-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase mb-1`}>
                          {subject.subjectCode}
                        </div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">
                          {subject.subjectName}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {subject.category}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 pt-3 border-t border-white/50 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Hours:</span>
                          <span className="font-bold text-slate-800">
                            {subject.completedHours}/{subject.totalHours}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Classes:</span>
                          <span className="font-bold text-slate-800">
                            {subject.completedClasses}/{subject.totalClasses}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add More Card */}
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="bg-white border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[240px] transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors">
                    <Plus size={24} className="text-slate-400 group-hover:text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-500 group-hover:text-blue-700">
                    Add New Subject
                  </p>
                  <p className="text-[10px] text-slate-400 text-center">
                    Choose or create custom
                  </p>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            MILESTONES
        ═══════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
            <div>
              <h2 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                <Award size={16} className="text-amber-600" />
                Milestones ({progress.milestones.length})
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Key training achievements
              </p>
            </div>
            <button
              onClick={() => setShowAddMilestone(true)}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 flex items-center gap-1"
            >
              <Plus size={12} /> Add Milestone
            </button>
          </div>

          <div className="p-5">
            {progress.milestones.length === 0 ? (
              <div className="text-center py-8">
                <Award size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No milestones set</p>
                <button
                  onClick={() => setShowAddMilestone(true)}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg"
                >
                  + Add First Milestone
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {progress.milestones.map((milestone: any, i: number) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      milestone.completed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => !milestone.completed && handleCompleteMilestone(i)}
                      disabled={milestone.completed}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        milestone.completed
                          ? 'bg-green-500 text-white'
                          : 'bg-white border-2 border-slate-300 hover:border-green-500'
                      }`}
                    >
                      {milestone.completed && <CheckCircle2 size={14} />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${
                        milestone.completed ? 'text-green-800 line-through' : 'text-slate-800'
                      }`}>
                        {milestone.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Target: {milestone.targetDate?.toDate?.()?.toLocaleDateString?.('en-IN') ??
                                new Date(milestone.targetDate).toLocaleDateString('en-IN')}
                        {milestone.completed && ' • Completed'}
                      </p>
                    </div>
                    {milestone.completed && <Zap size={14} className="text-yellow-500" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          🆕 ADD SUBJECT MODAL - 3 MODES
      ═══════════════════════════════════════ */}
      <FormModal
        isOpen={showAddSubject}
        title="Add Subject to Progress"
        subtitle="Choose an option below"
        onClose={() => setShowAddSubject(false)}
        size="lg"
      >
        <div className="space-y-4">

          {/* MODE SELECTOR */}
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setSubjectMode('quick')}
              className={`py-2 rounded-md text-xs font-bold transition-all ${
                subjectMode === 'quick'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-slate-500'
              }`}
            >
              ⚡ Quick Add
            </button>
            <button
              onClick={() => setSubjectMode('existing')}
              className={`py-2 rounded-md text-xs font-bold transition-all ${
                subjectMode === 'existing'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-slate-500'
              }`}
            >
              📋 From Master
            </button>
            <button
              onClick={() => setSubjectMode('custom')}
              className={`py-2 rounded-md text-xs font-bold transition-all ${
                subjectMode === 'custom'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-slate-500'
              }`}
            >
              ✏️ Custom
            </button>
          </div>

          {/* MODE: QUICK ADD */}
          {subjectMode === 'quick' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Select Subject (14 Predefined)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                {DEFAULT_SUBJECT_OPTIONS.map(sub => {
                  const theme = CARD_THEMES[sub.color];
                  const isSelected = selectedQuickSubject === sub.code;
                  return (
                    <button
                      key={sub.code}
                      type="button"
                      onClick={() => setSelectedQuickSubject(sub.code)}
                      className={`
                        p-3 rounded-lg border-2 text-left transition-all
                        ${isSelected
                          ? `${theme.light} border-current ${theme.text}`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                        }
                      `}
                    >
                      <div className={`inline-block ${theme.text} bg-white px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1`}>
                        {sub.code}
                      </div>
                      <p className="text-xs font-bold text-slate-800">{sub.name}</p>
                      <p className="text-[10px] text-slate-500">{sub.category}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE: FROM MASTER */}
          {subjectMode === 'existing' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Select from Subject Master
              </label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Select --</option>
                {activeSubjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.category})
                  </option>
                ))}
              </select>
              {activeSubjects.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠️ No subjects in master. Use Quick Add or Custom.
                </p>
              )}
            </div>
          )}

          {/* MODE: CUSTOM */}
          {subjectMode === 'custom' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    value={customSubject.name}
                    onChange={e => setCustomSubject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Cross Country"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={customSubject.code}
                    onChange={e => setCustomSubject(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g., CC"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={customSubject.category}
                  onChange={e => setCustomSubject(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Physical Training, Weapon, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {/* HOURS + CLASSES (Common) */}
          <div className="border-t pt-4">
            <p className="text-xs font-bold text-slate-700 uppercase mb-2">Training Plan</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Total Hours
                </label>
                <input
                  type="number"
                  value={subjectPlan.totalHours}
                  onChange={e => setSubjectPlan(prev => ({ ...prev, totalHours: Number(e.target.value) }))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Total Classes
                </label>
                <input
                  type="number"
                  value={subjectPlan.totalClasses}
                  onChange={e => setSubjectPlan(prev => ({ ...prev, totalClasses: Number(e.target.value) }))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={() => setShowAddSubject(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleAddSubjectSubmit}
              disabled={submitting ||
                (subjectMode === 'quick' && !selectedQuickSubject) ||
                (subjectMode === 'existing' && !selectedSubjectId) ||
                (subjectMode === 'custom' && (!customSubject.name || !customSubject.code))
              }
              className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 flex items-center gap-2"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : <>✓ Add Subject</>}
            </button>
          </div>
        </div>
      </FormModal>

      {/* UPDATE PROGRESS MODAL */}
      <FormModal
        isOpen={showUpdateProgress}
        title="Update Progress"
        subtitle={selectedSubjectProgress?.subjectName}
        onClose={() => setShowUpdateProgress(false)}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Update completed hours/classes
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Completed Hours (of {selectedSubjectProgress?.totalHours})
            </label>
            <input
              type="number"
              value={progressUpdate.completedHours}
              onChange={e => setProgressUpdate(prev => ({ ...prev, completedHours: Number(e.target.value) }))}
              min={0}
              max={selectedSubjectProgress?.totalHours}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {selectedSubjectProgress && (
              <p className="text-[10px] text-slate-500 mt-1">
                Will be: {Math.round((progressUpdate.completedHours / selectedSubjectProgress.totalHours) * 100)}%
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Completed Classes (of {selectedSubjectProgress?.totalClasses})
            </label>
            <input
              type="number"
              value={progressUpdate.completedClasses}
              onChange={e => setProgressUpdate(prev => ({ ...prev, completedClasses: Number(e.target.value) }))}
              min={0}
              max={selectedSubjectProgress?.totalClasses}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={() => setShowUpdateProgress(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleUpdateProgressSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white text-sm font-bold rounded-lg disabled:opacity-40"
            >
              {submitting ? 'Updating...' : '✓ Update Progress'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* ADD MILESTONE MODAL */}
      <FormModal
        isOpen={showAddMilestone}
        title="Add Milestone"
        subtitle="Choose preset or enter custom"
        onClose={() => setShowAddMilestone(false)}
        size="md"
      >
        <div className="space-y-4">

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setMilestoneMode('preset')}
              className={`py-2 rounded-md text-xs font-bold ${
                milestoneMode === 'preset' ? 'bg-white text-amber-700 shadow' : 'text-slate-500'
              }`}
            >
              ⚡ Preset
            </button>
            <button
              onClick={() => setMilestoneMode('custom')}
              className={`py-2 rounded-md text-xs font-bold ${
                milestoneMode === 'custom' ? 'bg-white text-amber-700 shadow' : 'text-slate-500'
              }`}
            >
              ✏️ Custom
            </button>
          </div>

          {milestoneMode === 'preset' ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Choose from Presets
              </label>
              <div className="grid grid-cols-1 gap-2">
                {DEFAULT_MILESTONES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewMilestone(prev => ({ ...prev, name: m }))}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      newMilestone.name === m
                        ? 'bg-amber-50 border-amber-500 text-amber-800'
                        : 'bg-white border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <p className="text-sm font-bold">{m}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Custom Milestone Name *
              </label>
              <input
                type="text"
                value={newMilestone.name}
                onChange={e => setNewMilestone(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Complete NCC Certification"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Target Date *
            </label>
            <input
              type="date"
              value={newMilestone.targetDate}
              onChange={e => setNewMilestone(prev => ({ ...prev, targetDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={() => setShowAddMilestone(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleAddMilestoneSubmit}
              disabled={!newMilestone.name || submitting}
              className="px-6 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg disabled:opacity-40"
            >
              {submitting ? 'Adding...' : '🎯 Add Milestone'}
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export default BatchProgressScreen;