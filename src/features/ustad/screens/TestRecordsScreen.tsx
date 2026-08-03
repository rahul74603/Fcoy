// ============================================
// UNIFIED TEST RECORDS SCREEN
// Merged: WeeklyTest + FPT + Modern Cards
// ============================================

import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck, Plus, X, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Award, Target,
  Edit3, PlayCircle, Search, Eye,
  Settings2, BarChart3,
  ChevronDown, ChevronUp,  Save,
} from 'lucide-react';
import { useTestRecords } from '../hooks/useTestRecords';
import { useStaff } from '../hooks/useStaff';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useBatch } from '../../../contexts/BatchContext';
import {
  TestRecord, TestFormData, TestType, TraineeResult, FPTEvent,
  RunningGrade, DEFAULT_TEST_FORM, TEST_TYPE_INFO,
  STATUS_COLORS, STATUS_LABELS, GRADE_COLORS, calculateGrade,
  BSF_SUBJECTS, DEFAULT_FPT_EVENTS, RUNNING_GRADES, GRADE_STYLE,
  gradeToMarks, BSF_PLATOONS,  // 🆕
} from '../types/testRecord.types';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const TestResultDetailsPanel: React.FC<{ test: TestRecord }> = ({ test }) => {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const sortedResults = [...test.results].sort((a, b) => {
    const order = { fail: 0, absent: 1, pass: 2 } as Record<string, number>;
    return (order[a.status] ?? 3) - (order[b.status] ?? 3) || Number(a.chestNo) - Number(b.chestNo);
  });

  const toggleRow = (id: string) => {
    setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groups = [
    { key: 'fail', label: 'Failed', color: 'red', list: sortedResults.filter(r => r.status === 'fail') },
    { key: 'absent', label: 'Absent', color: 'slate', list: sortedResults.filter(r => r.status === 'absent') },
    { key: 'pass', label: 'Passed', color: 'green', list: sortedResults.filter(r => r.status === 'pass') },
  ];

  return (
    <div className="pt-3 border-t border-slate-200 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-center">
          <p className="text-lg font-black text-green-700">{test.passCount}</p>
          <p className="text-[9px] font-bold text-green-600 uppercase">Pass</p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-center">
          <p className="text-lg font-black text-red-700">{test.failCount}</p>
          <p className="text-[9px] font-bold text-red-600 uppercase">Fail</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
          <p className="text-lg font-black text-slate-600">{test.absentCount}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase">Absent</p>
        </div>
      </div>

      {groups.map(group => (
        <div key={group.key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-black uppercase ${
              group.color === 'green' ? 'text-green-700' : group.color === 'red' ? 'text-red-700' : 'text-slate-600'
            }`}>
              {group.label} List ({group.list.length})
            </p>
            <p className="text-[9px] text-slate-400 font-bold">Click trainee row for full detail</p>
          </div>

          {group.list.length === 0 ? (
            <div className="text-[10px] text-slate-400 bg-white rounded-lg border border-slate-100 px-3 py-2">
              No {group.label.toLowerCase()} trainees
            </div>
          ) : (
            group.list.map((r, idx) => {
              const rowId = `${test.id}_${r.traineeId}_${group.key}_${idx}`;
              const isOpen = !!openRows[rowId];
              const isPass = r.status === 'pass';
              const isFail = r.status === 'fail';
              const maxMarks = test.testType === 'fpt' && r.events
                ? r.events.reduce((sum, event) => sum + Number(event.maxMarks || 0), 0)
                : test.totalMarks;
              const pct = maxMarks > 0 ? Math.round((Number(r.marks || 0) / maxMarks) * 100) : 0;

              return (
                <div key={rowId} className={`rounded-lg border overflow-hidden ${
                  isPass ? 'bg-green-50 border-green-200' : isFail ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => toggleRow(rowId)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span className="text-[10px] font-mono font-black bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {r.chestNo || '—'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-800 truncate">{r.traineeName}</p>
                        <p className="text-[9px] text-slate-500">
                          {r.platoon || '—'} · {r.marks}/{maxMarks} · {pct}%
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg flex-shrink-0 ${
                      isPass ? 'bg-green-600 text-white' : isFail ? 'bg-red-600 text-white' : 'bg-slate-500 text-white'
                    }`}>
                      {r.status.toUpperCase()}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="bg-white border-t border-white/70 px-3 py-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Chest No', r.chestNo || '—'],
                          ['Reg No', r.regNo || '—'],
                          ['Platoon', r.platoon || '—'],
                          ['Marks', `${r.marks}/${maxMarks}`],
                          ['Percentage', `${pct}%`],
                          ['Grade', r.grade || '—'],
                          ['Status', r.status.toUpperCase()],
                          ['Remarks', r.remarks || '—'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded bg-slate-50 border border-slate-100 px-2 py-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
                            <p className="text-[10px] font-bold text-slate-800 break-words">{String(value)}</p>
                          </div>
                        ))}
                      </div>

                      {test.testType === 'fpt' && r.events && r.events.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-500 uppercase">FPT Event-wise Pass / Fail</p>
                          {r.events.map((event, eventIdx) => (
                            <div key={`${rowId}_event_${eventIdx}`} className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 ${
                              event.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}>
                              <div>
                                <p className="text-[10px] font-black text-slate-800">{event.name || `Event ${eventIdx + 1}`}</p>
                                <p className="text-[8px] text-slate-500">
                                  Passing {event.passingMarks} · Max {event.maxMarks}
                                  {event.runningGrade ? ` · ${event.runningGrade}` : ''}
                                </p>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                                event.passed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                              }`}>
                                {event.marks}/{event.maxMarks} {event.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {r.weakAreas && r.weakAreas.length > 0 && (
                        <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1.5">
                          <p className="text-[8px] font-black text-amber-600 uppercase">Weak Areas</p>
                          <p className="text-[10px] font-bold text-amber-800">{r.weakAreas.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
};

const TestRecordsScreen: React.FC = () => {
  const {
    tests, loading, submitting, error, hasBatch,
    handleCreate, handleUpdateStatus, handleSaveResults, handleDelete,
     clearError,
  } = useTestRecords();

  const { staffList } = useStaff();
  const { activeBatch } = useBatch();

  // ─── UI State ────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const [selectedTest, setSelectedTest] = useState<TestRecord | null>(null);
  const [filterType, setFilterType] = useState<TestType | 'all'>('all');
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // ─── Config Lock ─────────────────────────
  // ─── Form State ──────────────────────────
    // ─── Form State ──────────────────────────
  const [testForm, setTestForm] = useState<TestFormData>(DEFAULT_TEST_FORM);
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);  // 🆕

  // ─── FPT Events ──────────────────────────
  const [fptEvents, setFptEvents] = useState<FPTEvent[]>(DEFAULT_FPT_EVENTS);
  const [overallPassPercent, setOverallPassPercent] = useState(50);

  // ─── Results State ───────────────────────
  const [trainees, setTrainees] = useState<any[]>([]);
  const [results, setResults] = useState<TraineeResult[]>([]);
  const [searchTrainee, setSearchTrainee] = useState('');

  // ─── Fetch Trainees ──────────────────────
  useEffect(() => {
    const fetchTrainees = async () => {
      if (!activeBatch) return;
      try {
        const q = query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id));
        const snap = await getDocs(q);
        setTrainees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Failed to fetch trainees:', err);
      }
    };
    fetchTrainees();
  }, [activeBatch]);

  // ─── Auto-fill subject code on type change ─
  useEffect(() => {
    const info = TEST_TYPE_INFO[testForm.testType];
    if (info) {
      setTestForm(prev => ({ ...prev, subjectCode: info.code }));
    }
    // Set FPT defaults
    if (testForm.testType === 'fpt' && !testForm.fptEvents) {
      setTestForm(prev => ({
        ...prev,
        fptEvents: DEFAULT_FPT_EVENTS,
        overallPassPercent: 50,
      }));
      setFptEvents(DEFAULT_FPT_EVENTS);
    }
  }, [testForm.testType]);

  // ─── Auto sync marks ↔ percent ───────────
  const handleFormChange = (field: keyof TestFormData, value: any) => {
    setTestForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'passingMarks') {
        updated.passingPercent = updated.totalMarks > 0
          ? Math.round((Number(value) / updated.totalMarks) * 100) : 0;
      }
      if (field === 'passingPercent') {
        updated.passingMarks = Math.round((Number(value) / 100) * updated.totalMarks);
      }
      if (field === 'totalMarks') {
        updated.passingMarks = Math.round((updated.passingPercent / 100) * Number(value));
      }
      return updated;
    });
  };

  // ═══════════════════════════════════════════
  // FPT EVENT MANAGEMENT
  // ═══════════════════════════════════════════
  const addFPTEvent = () => {
    setFptEvents([...fptEvents, { name: '', maxMarks: 10, passingMarks: 5, isRunning: false }]);
  };

  const removeFPTEvent = (idx: number) => {
    setFptEvents(fptEvents.filter((_, i) => i !== idx));
  };

  const updateFPTEvent = (idx: number, field: keyof FPTEvent, value: any) => {
    setFptEvents(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // ═══════════════════════════════════════════
  // CREATE TEST
  // ═══════════════════════════════════════════
  const handleCreateSubmit = async () => {
    if (!testForm.testName) {
      alert('Please fill test name');
      return;
    }
    if (selectedInstructorIds.length === 0) {
      alert('Please select at least one instructor/officer');
      return;
    }

    // Build instructors list
    const instructorsList = selectedInstructorIds.map(id => {
      const s = staffList.find(x => x.id === id);
      return {
        id: s?.id ?? '',
        name: s?.name ?? '',
        rank: s?.rank ?? '',
        forceNumber: s?.forceNumber ?? '',
        category: s?.category ?? '',
      };
    });

    // Primary instructor (first one)
    const primaryInstructor = instructorsList[0];
    const instructorName = instructorsList.length > 1
      ? `${primaryInstructor.rank} ${primaryInstructor.name} +${instructorsList.length - 1} more`
      : `${primaryInstructor.rank} ${primaryInstructor.name}`;

    // Prepare form with FPT if needed
    const finalForm = {
      ...testForm,
      instructorId: primaryInstructor.id,  // Set primary
      instructorIds: selectedInstructorIds, // All IDs
    };

    if (testForm.testType === 'fpt') {
      const totalMarks = fptEvents.reduce((s, e) => s + e.maxMarks, 0);
      const totalPassing = fptEvents.reduce((s, e) => s + e.passingMarks, 0);
      finalForm.fptEvents = fptEvents;
      finalForm.overallPassPercent = overallPassPercent;
      finalForm.totalMarks = totalMarks;
      finalForm.passingMarks = totalPassing;
      finalForm.passingPercent = overallPassPercent;
    }

    const testId = await handleCreate(finalForm, instructorName, instructorsList);

    if (testId) {
      setMessage(`✅ Test "${finalForm.testName}" created with ${instructorsList.length} instructor(s)!`);
      setShowCreateModal(false);
      setTestForm(DEFAULT_TEST_FORM);
      setSelectedInstructorIds([]);  // 🆕 Reset
      setTimeout(() => setMessage(''), 3000);
    }
  };


  // ═══════════════════════════════════════════
  // RESULTS ENTRY
  // ═══════════════════════════════════════════
  const openResultsModal = (test: TestRecord, bulk: boolean = false) => {
    setSelectedTest(test);

    if (test.results.length > 0) {
      setResults(test.results);
    } else {
      const emptyResults: TraineeResult[] = trainees.map((t: any) => {
        const base: TraineeResult = {
          traineeId: t.id,
          traineeName: t.name || '',
          chestNo: t.chestNo || '',
          regNo: t.regNo || '',
          platoon: t.platoon || '',
          marks: 0,
          grade: 'F',
          status: 'fail',
          remarks: '',
          weakAreas: [],
        };

        // Add FPT events for FPT tests
        if (test.testType === 'fpt' && test.fptEvents) {
          base.events = test.fptEvents.map(e => ({
            name: e.name,
            maxMarks: e.maxMarks,
            passingMarks: e.passingMarks,
            marks: 0,
            passed: false,
            isRunning: e.isRunning || false,
            runningGrade: '' as RunningGrade,
          }));
          base.eventsPassed = 0;
          base.eventsFailed = 0;
        }

        return base;
      });
      setResults(emptyResults);
    }

    if (bulk) setShowBulkModal(true);
    else setShowResultsModal(true);
  };

  const updateMarks = (traineeId: string, marks: number) => {
    setResults(prev => prev.map(r => {
      if (r.traineeId === traineeId) {
        const percent = selectedTest ? (marks / selectedTest.totalMarks) * 100 : 0;
        return {
          ...r,
          marks,
          grade: calculateGrade(percent),
          status: marks < 0
            ? 'absent' as const
            : selectedTest && marks >= selectedTest.passingMarks
              ? 'pass' as const
              : 'fail' as const,
        };
      }
      return r;
    }));
  };

  // Update FPT event marks
  const updateFPTEventMark = (traineeId: string, eventIdx: number, marks: number) => {
    setResults(prev => prev.map(r => {
      if (r.traineeId === traineeId && r.events) {
        const updatedEvents = [...r.events];
        updatedEvents[eventIdx] = {
          ...updatedEvents[eventIdx],
          marks,
          passed: marks >= updatedEvents[eventIdx].passingMarks,
        };
        const totalMarks = updatedEvents.reduce((s, e) => s + e.marks, 0);
        const eventsPassed = updatedEvents.filter(e => e.passed).length;
        const eventsFailed = updatedEvents.filter(e => !e.passed).length;
        const totalMax = updatedEvents.reduce((s, e) => s + e.maxMarks, 0);
        const percent = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;

        return {
          ...r,
          events: updatedEvents,
          marks: totalMarks,
          eventsPassed,
          eventsFailed,
          grade: calculateGrade(percent),
          status: selectedTest && percent >= (selectedTest.overallPassPercent || 50)
            ? 'pass' as const
            : 'fail' as const,
        };
      }
      return r;
    }));
  };

  // Update running grade
  const updateRunningGrade = (traineeId: string, eventIdx: number, grade: RunningGrade) => {
    setResults(prev => prev.map(r => {
      if (r.traineeId === traineeId && r.events) {
        const updatedEvents = [...r.events];
        const evt = updatedEvents[eventIdx];
        const marks = gradeToMarks(grade, evt.maxMarks, evt.passingMarks);
        updatedEvents[eventIdx] = {
          ...evt,
          runningGrade: grade,
          marks,
          passed: grade !== 'Fail' && grade !== '',
        };
        const totalMarks = updatedEvents.reduce((s, e) => s + e.marks, 0);
        const eventsPassed = updatedEvents.filter(e => e.passed).length;
        const eventsFailed = updatedEvents.filter(e => !e.passed).length;
        const totalMax = updatedEvents.reduce((s, e) => s + e.maxMarks, 0);
        const percent = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;

        return {
          ...r,
          events: updatedEvents,
          marks: totalMarks,
          eventsPassed,
          eventsFailed,
          grade: calculateGrade(percent),
          status: selectedTest && percent >= (selectedTest.overallPassPercent || 50)
            ? 'pass' as const
            : 'fail' as const,
        };
      }
      return r;
    }));
  };

  const markAbsent = (traineeId: string) => {
    setResults(prev => prev.map(r =>
      r.traineeId === traineeId
        ? { ...r, marks: -1, status: 'absent' as const, grade: 'F' as const }
        : r
    ));
  };

  const handleSaveResultsSubmit = async () => {
    if (!selectedTest) return;
    const success = await handleSaveResults(
      selectedTest.id,
      results,
      selectedTest.totalMarks,
      selectedTest.passingMarks
    );
    if (success) {
      setMessage(`✅ Results saved!`);
      setShowResultsModal(false);
      setShowBulkModal(false);
      setSelectedTest(null);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTest) return;
    const success = await handleDelete(selectedTest.id);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedTest(null);
    }
  };

  
  // ═══════════════════════════════════════════
  // FILTERED DATA
  // ═══════════════════════════════════════════
  const filteredTests = filterType === 'all'
    ? tests
    : tests.filter(t => t.testType === filterType);

  const filteredResults = results.filter(r =>
    !searchTrainee ||
    r.traineeName.toLowerCase().includes(searchTrainee.toLowerCase()) ||
    r.chestNo.includes(searchTrainee)
  );

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // ═══════════════════════════════════════════
  // ANALYTICS DATA
  // ═══════════════════════════════════════════
  const totalPassed = tests.reduce((s, t) => s + t.passCount, 0);
  const totalFailed = tests.reduce((s, t) => s + t.failCount, 0);
  const totalRecords = totalPassed + totalFailed;
  const overallPassRate = totalRecords > 0 ? Math.round((totalPassed / totalRecords) * 100) : 0;
  // ═══════════════════════════════════════════
  // 🆕 ENHANCED ANALYTICS DATA
  // ═══════════════════════════════════════════

  // Week-wise stats (from all completed tests)
  const weekStats: Record<number, { total: number; passed: number; failed: number; avgPct: number; totalPct: number }> = {};
  tests.filter(t => t.status === 'completed').forEach(t => {
    const wk = t.weekNumber || 0;
    if (!weekStats[wk]) weekStats[wk] = { total: 0, passed: 0, failed: 0, avgPct: 0, totalPct: 0 };
    weekStats[wk].total += t.results.length;
    weekStats[wk].passed += t.passCount;
    weekStats[wk].failed += t.failCount;
    const avgForTest = t.totalMarks > 0 ? Math.round((t.averageScore / t.totalMarks) * 100) : 0;
    weekStats[wk].totalPct += avgForTest;
  });
  Object.keys(weekStats).forEach(w => {
    const ws = weekStats[Number(w)];
    const testCount = tests.filter(t => t.weekNumber === Number(w) && t.status === 'completed').length;
    ws.avgPct = testCount > 0 ? Math.round(ws.totalPct / testCount) : 0;
  });

  // Top failers across all tests
  const traineeFailMap: Record<string, { name: string; chestNo: string; platoon: string; failCount: number; totalTests: number }> = {};
  tests.filter(t => t.status === 'completed').forEach(t => {
    t.results.forEach(r => {
      if (!traineeFailMap[r.traineeId]) {
        traineeFailMap[r.traineeId] = { name: r.traineeName, chestNo: r.chestNo, platoon: r.platoon, failCount: 0, totalTests: 0 };
      }
      traineeFailMap[r.traineeId].totalTests++;
      if (r.status === 'fail') traineeFailMap[r.traineeId].failCount++;
    });
  });
  const topFailers = Object.entries(traineeFailMap)
    .filter(([, d]) => d.failCount > 0)
    .sort(([, a], [, b]) => b.failCount - a.failCount)
    .slice(0, 10);

  // Running grade stats (FPT only)
  const runningGradeStats: Record<string, number> = { 'Excellent': 0, 'Very Good': 0, 'Good': 0, 'Fail': 0 };
  let totalRunningRecords = 0;
  tests.filter(t => t.testType === 'fpt' && t.status === 'completed').forEach(t => {
    t.results.forEach(r => {
      if (r.events) {
        r.events.forEach(evt => {
          if (evt.isRunning && evt.runningGrade && runningGradeStats[evt.runningGrade] !== undefined) {
            runningGradeStats[evt.runningGrade]++;
            totalRunningRecords++;
          }
        });
      }
    });
  });
  // Type-wise stats
  const typeStats = (Object.keys(TEST_TYPE_INFO) as TestType[]).map(type => ({
    type,
    info: TEST_TYPE_INFO[type],
    count: tests.filter(t => t.testType === type).length,
    passRate: (() => {
      const typeTests = tests.filter(t => t.testType === type);
      const totalP = typeTests.reduce((s, t) => s + t.passCount, 0);
      const totalF = typeTests.reduce((s, t) => s + t.failCount, 0);
      return totalP + totalF > 0 ? Math.round((totalP / (totalP + totalF)) * 100) : 0;
    })(),
  })).filter(s => s.count > 0);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ═══════════════════════════════════════
          HEADER
      ═══════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-6 py-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider flex items-center gap-3">
              <ClipboardCheck size={28} />
              Test Records System
            </h1>
            <p className="text-purple-200 text-sm mt-1">
              Complete: Drill, Weapon, Firing, FPT, Weekly & Custom Tests
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`px-3 py-2 text-xs font-bold uppercase rounded-lg flex items-center gap-1 ${
                showAnalytics ? 'bg-white text-purple-700' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <BarChart3 size={14} /> Analytics
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!hasBatch}
              className="px-5 py-2.5 bg-white text-purple-700 text-sm font-black rounded-lg hover:bg-purple-50 disabled:opacity-40 flex items-center gap-2"
            >
              <Plus size={18} /> Create Test
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {!hasBatch && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-700" />
            <p className="text-sm font-bold text-amber-900">Activate a batch first</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <XCircle size={18} className="text-red-500" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError}><X size={14} className="text-red-400" /></button>
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-green-500" />
            <p className="text-sm text-green-700 flex-1">{message}</p>
            <button onClick={() => setMessage('')}><X size={14} className="text-green-400" /></button>
          </div>
        )}

        {/* SUMMARY CARDS */}
        {hasBatch && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-blue-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck size={14} className="text-blue-600" />
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Tests</p>
              </div>
              <p className="text-2xl font-black text-blue-700">{tests.length}</p>
              <p className="text-[10px] text-slate-500">{totalRecords} records</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-green-600" />
                <p className="text-[10px] font-bold text-slate-500 uppercase">Passed</p>
              </div>
              <p className="text-2xl font-black text-green-700">{totalPassed}</p>
              <p className="text-[10px] text-green-500">{overallPassRate}% rate</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={14} className="text-red-600" />
                <p className="text-[10px] font-bold text-slate-500 uppercase">Failed</p>
              </div>
              <p className="text-2xl font-black text-red-700">{totalFailed}</p>
              <p className="text-[10px] text-red-400">{100 - overallPassRate}% rate</p>
            </div>
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award size={14} className="text-amber-600" />
                <p className="text-[10px] font-bold text-slate-500 uppercase">Completed</p>
              </div>
              <p className="text-2xl font-black text-amber-700">
                {tests.filter(t => t.status === 'completed').length}
              </p>
              <p className="text-[10px] text-slate-500">Of {tests.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-purple-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-purple-600" />
                <p className="text-[10px] font-bold text-slate-500 uppercase">Test Types</p>
              </div>
              <p className="text-2xl font-black text-purple-700">
                {new Set(tests.map(t => t.testType)).size}
              </p>
              <p className="text-[10px] text-slate-500">Active types</p>
            </div>
          </div>
        )}

        {/* QUICK GUIDE — makes the dashboard readable at a glance */}
        {hasBatch && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-700">Quick guide</p><p className="text-[10px] text-slate-500">Green = good performance · Amber = needs review · Red = immediate attention</p></div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold"><span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">✓ Pass</span><span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">✕ Fail</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">● Review</span><span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Blue = test information</span></div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            ANALYTICS PANEL
        ═══════════════════════════════════════ */}
        {showAnalytics && hasBatch && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                <BarChart3 size={16} className="text-amber-600" />
                Test Analytics
              </h2>
            </div>

            <div className="p-5 space-y-4">
                            {/* 🆕 RUNNING GRADE DISTRIBUTION (FPT) */}
              {totalRunningRecords > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-cyan-700 uppercase mb-3">🏃 Running Grade Distribution</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {RUNNING_GRADES.filter(g => g !== '').map(g => {
                      const count = runningGradeStats[g] || 0;
                      const pct = totalRunningRecords > 0 ? Math.round((count / totalRunningRecords) * 100) : 0;
                      const style = GRADE_STYLE[g];
                      return (
                        <div key={g} className={`border-2 ${style.border} ${style.bg} p-3 rounded-xl text-center`}>
                          <span className="text-2xl">{style.emoji}</span>
                          <p className={`text-lg font-black mt-1 ${style.text}`}>{count}</p>
                          <p className={`text-[10px] font-bold ${style.text}`}>{g}</p>
                          <div className="w-full bg-white/50 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className={`h-full rounded-full ${
                              g === 'Fail' ? 'bg-red-500' : g === 'Good' ? 'bg-amber-500' : g === 'Very Good' ? 'bg-blue-500' : 'bg-emerald-500'
                            }`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[9px] text-slate-500 mt-1">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 🆕 WEEK-WISE PERFORMANCE */}
              {Object.keys(weekStats).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-blue-700 uppercase mb-3">📅 Week-wise Performance</h4>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100">
                      <tr>
                        {['Week', 'Total', 'Pass', 'Fail', 'Pass%', 'Avg'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(weekStats).sort(([a], [b]) => Number(a) - Number(b)).map(([w, s]) => {
                        const passRate = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
                        return (
                          <tr key={w} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-blue-700">Week {w}</td>
                            <td className="px-3 py-2">{s.total}</td>
                            <td className="px-3 py-2"><span className="bg-green-100 text-green-700 px-2 py-0.5 text-[9px] font-bold rounded">{s.passed}</span></td>
                            <td className="px-3 py-2"><span className="bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-bold rounded">{s.failed}</span></td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${passRate >= 70 ? 'bg-green-500' : passRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${passRate}%` }} />
                                </div>
                                <span className={`font-bold text-[10px] ${passRate >= 70 ? 'text-green-600' : passRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{passRate}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-bold">{s.avgPct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 🆕 TOP FAILERS */}
              {topFailers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-red-700 uppercase mb-3">❌ Most Failed Trainees</h4>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100">
                      <tr>
                        {['#', 'Chest', 'Name', 'Platoon', 'Total Tests', 'Fails', 'Fail Rate'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topFailers.map(([id, d], idx) => (
                        <tr key={id} className={`hover:bg-slate-50 ${idx < 3 ? 'bg-red-50/20' : ''}`}>
                          <td className="px-3 py-2 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold">{d.chestNo}</td>
                          <td className="px-3 py-2 font-bold">{d.name}</td>
                          <td className="px-3 py-2 text-slate-500">{d.platoon}</td>
                          <td className="px-3 py-2">{d.totalTests}</td>
                          <td className="px-3 py-2">
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold rounded">{d.failCount}x</span>
                          </td>
                          <td className="px-3 py-2 font-bold text-red-600">
                            {Math.round((d.failCount / d.totalTests) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Type-wise Performance */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">Type-wise Performance</h4>
                {typeStats.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No test data yet</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {typeStats.map(({ type, info, count, passRate }) => (
                      <div key={type} className={`${info.bgColor} border-2 ${info.borderColor} rounded-xl p-3`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{info.icon}</span>
                          <span className={`text-[10px] font-bold ${info.color}`}>{info.label}</span>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{count}</p>
                        <p className="text-[10px] text-slate-500 mb-2">tests</p>
                        <div className="w-full bg-white h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${
                            passRate >= 70 ? 'bg-green-500' :
                            passRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`} style={{ width: `${passRate}%` }} />
                        </div>
                        <p className={`text-[10px] font-bold mt-1 ${
                          passRate >= 70 ? 'text-green-600' :
                          passRate >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {passRate}% Pass Rate
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TYPE FILTER TABS */}
        <div className="bg-white rounded-xl border border-slate-200 p-2">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-2 rounded-lg text-xs font-bold ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({tests.length})
            </button>
            {(Object.keys(TEST_TYPE_INFO) as TestType[]).map(type => {
              const info = TEST_TYPE_INFO[type];
              const count = tests.filter(t => t.testType === type).length;
              if (count === 0 && filterType !== type) return null;
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    filterType === type
                      ? `${info.bgColor} ${info.color} border-2 ${info.borderColor}`
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{info.icon}</span>
                  {info.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            TESTS GRID
        ═══════════════════════════════════════ */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-purple-600" />
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <ClipboardCheck size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-gray-500 font-medium">No tests found</p>
                        <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={!hasBatch}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40"
              >
                + Create First Test
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTests.map(test => {
              const info = TEST_TYPE_INFO[test.testType];
              const totalTrainees = test.results.length;
              const passPercent = totalTrainees > 0
                ? Math.round((test.passCount / totalTrainees) * 100)
                : 0;
              const isExpanded = expandedTest === test.id;

              return (
                <div
                  key={test.id}
                  className={`bg-white rounded-2xl border-2 ${info.borderColor} overflow-hidden hover:shadow-lg transition-shadow`}
                >
                  {/* Card Header */}
                  <div className={`bg-gradient-to-br ${info.gradient} px-4 py-3 text-white`}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{info.icon}</span>
                        <span className="text-[9px] font-black uppercase bg-white/20 px-2 py-0.5 rounded">
                          {info.code}
                        </span>
                        {test.weekNumber > 0 && (
                          <span className="text-[9px] font-black uppercase bg-white/20 px-2 py-0.5 rounded">
                            W{test.weekNumber}
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[test.status]}`}>
                        {STATUS_LABELS[test.status]}
                      </span>
                    </div>
                    <p className="text-sm font-black">
                      {test.testName}
                    </p>
                    <p className="text-[10px] opacity-80 mt-0.5">
                      {info.label} · {formatDate(test.testDate)}
                    </p>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Meta Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Marks</p>
                        <p className="text-lg font-black text-slate-800">{test.totalMarks}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2">
                        <p className="text-[10px] font-bold text-amber-600 uppercase">Passing</p>
                        <p className="text-lg font-black text-amber-700">{test.passingMarks}</p>
                      </div>
                    </div>

                    {/*                     {/* Instructors (Multiple) */}
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600 flex items-start gap-1">
                        <span className="mt-0.5">👤</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {test.instructors && test.instructors.length > 0 ? (
                              test.instructors.map((inst, idx) => (
                                <span
                                  key={inst.id}
                                  className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                                    idx === 0
                                      ? 'bg-blue-100 text-blue-800 font-bold'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                  title={`${inst.rank} ${inst.name} (${inst.category})`}
                                >
                                  {idx === 0 && '⭐ '}
                                  {inst.rank} {inst.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500 truncate">
                                {test.instructorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Platoon Badge */}
                      {(test as any).platoon && (
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            (test as any).platoon.includes('All Platoons')
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {(test as any).platoon.includes('All Platoons') ? '🏢 All Platoons' : `📍 ${(test as any).platoon}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* FPT Events indicator */}
                    {test.testType === 'fpt' && test.fptEvents && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                        <p className="text-[10px] font-bold text-green-700 uppercase mb-1">
                          FPT Events ({test.fptEvents.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {test.fptEvents.slice(0, 3).map((e, i) => (
                            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${
                              e.isRunning ? 'bg-cyan-100 text-cyan-700' : 'bg-white text-slate-600'
                            }`}>
                              {e.isRunning ? '🏃' : '🔢'} {e.name}
                            </span>
                          ))}
                          {test.fptEvents.length > 3 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              +{test.fptEvents.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Results Summary */}
                    {test.status === 'completed' && test.results.length > 0 ? (
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Pass Rate
                          </span>
                          <span className={`text-lg font-black ${
                            passPercent >= 70 ? 'text-green-600' :
                            passPercent >= 40 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {passPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              passPercent >= 70 ? 'bg-green-500' :
                              passPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${passPercent}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-black text-green-600">{test.passCount}</p>
                            <p className="text-[9px] text-slate-500">Pass</p>
                          </div>
                          <div>
                            <p className="text-lg font-black text-red-600">{test.failCount}</p>
                            <p className="text-[9px] text-slate-500">Fail</p>
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-400">{test.absentCount}</p>
                            <p className="text-[9px] text-slate-500">Absent</p>
                          </div>
                        </div>
                        <div className="text-center text-xs pt-2 border-t border-slate-200">
                          <span className="text-slate-500">Average: </span>
                          <span className="font-black text-slate-800">
                            {test.averageScore}/{test.totalMarks}
                          </span>
                        </div>

                        {/* Full Details Toggle */}
                        <button
                          onClick={() => setExpandedTest(isExpanded ? null : test.id)}
                          className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 pt-1"
                        >
                          {isExpanded ? (
                            <><ChevronUp size={12} /> Hide Full Pass/Fail Details</>
                          ) : (
                            <><Eye size={12} /> View Full Pass/Fail Details</>
                          )}
                        </button>

                        {isExpanded && <TestResultDetailsPanel test={test} />}
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-700 font-medium">
                          Results not entered yet
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => openResultsModal(test, test.testType === 'fpt' || trainees.length > 5)}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                      >
                        <Edit3 size={12} /> {test.status === 'completed' ? 'Edit' : 'Enter'} Marks
                      </button>
                      {test.status === 'scheduled' && (
                        <button
                          onClick={() => handleUpdateStatus(test.id, 'in_progress')}
                          className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600"
                          title="Start"
                        >
                          <PlayCircle size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedTest(test);
                          setShowDeleteDialog(true);
                        }}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded hover:bg-red-200"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          CREATE TEST MODAL
      ═══════════════════════════════════════ */}
      <FormModal
        isOpen={showCreateModal}
        title="Create New Test"
        subtitle={testForm.testType === 'fpt' ? 'FPT with events + running grades' : 'Schedule test'}
        onClose={() => setShowCreateModal(false)}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Test Type Grid */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Test Type *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(TEST_TYPE_INFO) as TestType[]).map(type => {
                const info = TEST_TYPE_INFO[type];
                const isSelected = testForm.testType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTestForm(prev => ({ ...prev, testType: type }))}
                    className={`
                      p-3 rounded-lg border-2 text-center transition-all
                      ${isSelected
                        ? `${info.bgColor} border-current ${info.color}`
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      }
                    `}
                  >
                    <div className="text-2xl mb-1">{info.icon}</div>
                    <p className="text-[10px] font-bold">{info.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Test Name *
              </label>
              <input
                type="text"
                value={testForm.testName}
                onChange={e => handleFormChange('testName', e.target.value)}
                placeholder="e.g., Weekly Weapon Test 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Week Number
              </label>
              <input
                type="number"
                min={1}
                max={52}
                value={testForm.weekNumber}
                onChange={e => handleFormChange('weekNumber', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                value={testForm.testDate}
                onChange={e => handleFormChange('testDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Start</label>
              <input
                type="time"
                value={testForm.startTime}
                onChange={e => handleFormChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">End</label>
              <input
                type="time"
                value={testForm.endTime}
                onChange={e => handleFormChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Subject / Topic
            </label>
            <input
              type="text"
              list="subjects-list"
              value={testForm.subjectCode}
              onChange={e => handleFormChange('subjectCode', e.target.value)}
              placeholder="Select or type..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <datalist id="subjects-list">
              {BSF_SUBJECTS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Marks (only for non-FPT) */}
          {testForm.testType !== 'fpt' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Total Marks *
                </label>
                <input
                  type="number"
                  value={testForm.totalMarks}
                  onChange={e => handleFormChange('totalMarks', Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Passing Marks *
                </label>
                <input
                  type="number"
                  value={testForm.passingMarks}
                  onChange={e => handleFormChange('passingMarks', Number(e.target.value))}
                  min={1}
                  max={testForm.totalMarks}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-green-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Pass % (auto)
                </label>
                <input
                  type="number"
                  value={testForm.passingPercent}
                  onChange={e => handleFormChange('passingPercent', Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-amber-700"
                />
              </div>
            </div>
          )}

          {/* FPT EVENTS CONFIGURATION */}
          {testForm.testType === 'fpt' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-green-800 uppercase flex items-center gap-1">
                  <Settings2 size={12} /> FPT Events Configuration
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-green-800">Overall Pass %:</label>
                  <input
                    type="number"
                    value={overallPassPercent}
                    onChange={e => setOverallPassPercent(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-16 px-2 py-1 border border-green-300 rounded text-xs font-bold text-center"
                  />
                </div>
              </div>

              {/* Info about running grades */}
              <div className="bg-cyan-50 border border-cyan-200 rounded p-2 text-[10px] text-cyan-800">
                🏃 Running events use grades (Excellent/Very Good/Good/Fail) auto-converted to marks.
                🔢 Normal events use direct marks.
              </div>

              {/* Events List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {fptEvents.map((evt, idx) => (
                  <div key={idx} className={`bg-white border rounded-lg p-2 ${
                    evt.isRunning ? 'border-cyan-300' : 'border-slate-200'
                  }`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => updateFPTEvent(idx, 'isRunning', !evt.isRunning)}
                          className={`text-lg ${evt.isRunning ? 'text-cyan-600' : 'text-slate-400'}`}
                          title={evt.isRunning ? 'Running (Grade)' : 'Normal (Marks)'}
                        >
                          {evt.isRunning ? '🏃' : '🔢'}
                        </button>
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={evt.name}
                          onChange={e => updateFPTEvent(idx, 'name', e.target.value)}
                          placeholder="Event name"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={evt.maxMarks}
                          onChange={e => updateFPTEvent(idx, 'maxMarks', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-xs font-bold text-blue-700 text-center"
                          placeholder="Max"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={evt.passingMarks}
                          onChange={e => updateFPTEvent(idx, 'passingMarks', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-amber-300 rounded text-xs font-bold text-amber-700 text-center"
                          placeholder="Pass"
                        />
                      </div>
                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={() => removeFPTEvent(idx)}
                          className="w-full py-1 bg-red-100 text-red-600 rounded text-[10px] font-bold hover:bg-red-200"
                        >
                          <Trash2 size={10} className="inline" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addFPTEvent}
                className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Add Event
              </button>

              <div className="bg-white border border-green-200 rounded p-2 flex justify-between text-xs">
                <span>Total Events: <strong>{fptEvents.length}</strong></span>
                <span>Running: <strong className="text-cyan-600">{fptEvents.filter(e => e.isRunning).length}</strong></span>
                <span>Total Marks: <strong className="text-blue-600">{fptEvents.reduce((s, e) => s + e.maxMarks, 0)}</strong></span>
              </div>
            </div>
          )}

                    {/* 🆕 MULTIPLE INSTRUCTORS */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Assigned Instructors / Officers *
              <span className="text-slate-400 font-normal ml-1">
                (Add multiple for large batches)
              </span>
            </label>

            {/* Selected Instructors Pills */}
            {selectedInstructorIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                {selectedInstructorIds.map((id, idx) => {
                  const staff = staffList.find(s => s.id === id);
                  if (!staff) return null;
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                        idx === 0
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-700 border border-blue-300'
                      }`}
                    >
                      {idx === 0 && <span className="text-[9px] bg-white/20 px-1 rounded">PRIMARY</span>}
                      <span>{staff.rank} {staff.name}</span>
                      <span className="text-[9px] opacity-75">({staff.category})</span>
                      <button
                        onClick={() => setSelectedInstructorIds(prev => prev.filter(i => i !== id))}
                        className="hover:text-red-200 ml-1"
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Instructor Dropdown */}
            <div className="flex gap-2">
              <select
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onChange={(e) => {
                  if (e.target.value && !selectedInstructorIds.includes(e.target.value)) {
                    setSelectedInstructorIds([...selectedInstructorIds, e.target.value]);
                    e.target.value = ''; // Reset
                  }
                }}
                value=""
              >
                <option value="">+ Add Instructor / Officer</option>
                {staffList
                  .filter(s => s.status === 'active' && !selectedInstructorIds.includes(s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.rank} {s.name} — {s.category}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  // Add all active instructors
                  const allActive = staffList
                    .filter(s => s.status === 'active')
                    .map(s => s.id);
                  setSelectedInstructorIds(allActive);
                }}
                className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200"
                title="Add all active staff"
              >
                All
              </button>
              {selectedInstructorIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedInstructorIds([])}
                  className="px-3 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200"
                  title="Clear all"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              💡 For 180+ trainees, add multiple instructors. First one is primary. Officers bhi add kar sakte hain.
            </p>
          </div>

          {/* 🆕 PLATOON SELECT */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Platoon / Group *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {BSF_PLATOONS.map(platoon => {
                const isSelected = testForm.platoon === platoon;
                const isAll = platoon.includes('All Platoons');
                return (
                  <button
                    key={platoon}
                    type="button"
                    onClick={() => handleFormChange('platoon', platoon)}
                    className={`
                      px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all
                      ${isSelected
                        ? isAll
                          ? 'bg-purple-100 border-purple-500 text-purple-800'
                          : 'bg-blue-100 border-blue-500 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      }
                    `}
                  >
                    {isAll ? '🏢 All' : platoon.replace('Platoon ', 'Pl ')}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              📍 {testForm.platoon === 'All Platoons (Whole Company)'
                ? 'Test for entire company (all trainees)'
                : `Test for ${testForm.platoon} only`}
            </p>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Venue</label>
            <input
              type="text"
              value={testForm.venue}
              onChange={e => handleFormChange('venue', e.target.value)}
              placeholder="e.g., Parade Ground, Firing Range"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Description
            </label>
            <textarea
              value={testForm.description}
              onChange={e => handleFormChange('description', e.target.value)}
              rows={2}
              placeholder="Special instructions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t sticky bottom-0 bg-white">
                        <button
              onClick={() => {
                setShowCreateModal(false);
                setSelectedInstructorIds([]);  // 🆕 Reset
                setTestForm(DEFAULT_TEST_FORM); // 🆕 Reset
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubmit}
              disabled={submitting || !testForm.testName || selectedInstructorIds.length === 0}
              className="px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 flex items-center gap-2"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <>✓ Create Test</>}
            </button>
          </div>
        </div>
      </FormModal>

      {/* ═══════════════════════════════════════
          RESULTS ENTRY MODAL (Simple/Non-FPT)
      ═══════════════════════════════════════ */}
      <FormModal
        isOpen={showResultsModal}
        title={`Enter Marks — ${selectedTest?.testName}`}
        subtitle={`Total: ${selectedTest?.totalMarks} | Passing: ${selectedTest?.passingMarks}`}
        onClose={() => setShowResultsModal(false)}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTrainee}
                onChange={e => setSearchTrainee(e.target.value)}
                placeholder="Search trainee..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                Pass: {results.filter(r => r.status === 'pass').length}
              </span>
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                Fail: {results.filter(r => r.status === 'fail').length}
              </span>
              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full font-bold">
                Absent: {results.filter(r => r.status === 'absent').length}
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Chest</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Platoon</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">Marks</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">Grade</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map(r => (
                  <tr key={r.traineeId} className={`hover:bg-slate-50 ${
                    r.status === 'pass' ? 'bg-green-50/30' :
                    r.status === 'fail' && r.marks > 0 ? 'bg-red-50/30' : ''
                  }`}>
                    <td className="px-3 py-2 font-mono text-xs font-bold">{r.chestNo}</td>
                    <td className="px-3 py-2 text-xs font-medium">{r.traineeName}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.platoon || '—'}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={r.marks < 0 ? '' : r.marks}
                        onChange={e => updateMarks(r.traineeId, Number(e.target.value))}
                        disabled={r.status === 'absent'}
                        min={0}
                        max={selectedTest?.totalMarks}
                        placeholder="0"
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-bold"
                      />
                      <span className="text-[10px] text-slate-400 ml-1">/{selectedTest?.totalMarks}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.status !== 'absent' && r.marks > 0 && (
                        <span className={`inline-block px-2 py-1 rounded text-xs font-black ${GRADE_COLORS[r.grade]}`}>
                          {r.grade}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'pass' ? 'bg-green-100 text-green-700' :
                        r.status === 'fail' && r.marks > 0 ? 'bg-red-100 text-red-700' :
                        r.status === 'absent' ? 'bg-slate-100 text-slate-500' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => markAbsent(r.traineeId)}
                        className="text-[10px] font-bold text-red-600 hover:text-red-800"
                      >
                        Absent
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={() => setShowResultsModal(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSaveResultsSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 flex items-center gap-2"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save All Results</>}
            </button>
          </div>
        </div>
      </FormModal>

      {/* ═══════════════════════════════════════
          BULK/FPT RESULTS ENTRY MODAL
      ═══════════════════════════════════════ */}
      <FormModal
        isOpen={showBulkModal}
        title={`${selectedTest?.testType === 'fpt' ? 'FPT ' : ''}Bulk Entry — ${selectedTest?.testName}`}
        subtitle={
          selectedTest?.testType === 'fpt'
            ? `${selectedTest.fptEvents?.length || 0} events • Overall Pass: ${selectedTest.overallPassPercent}%`
            : `Total: ${selectedTest?.totalMarks} | Passing: ${selectedTest?.passingMarks}`
        }
        onClose={() => setShowBulkModal(false)}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTrainee}
                onChange={e => setSearchTrainee(e.target.value)}
                placeholder="Search trainee..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                Pass: {results.filter(r => r.status === 'pass').length}
              </span>
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                Fail: {results.filter(r => r.status === 'fail' && r.marks > 0).length}
              </span>
            </div>
          </div>

          {/* FPT Event Headers */}
          {selectedTest?.testType === 'fpt' && selectedTest.fptEvents && (
            <div className="bg-cyan-50 border border-cyan-200 rounded p-2 text-[10px] text-cyan-800">
              🏃 = Running (grade dropdown) · 🔢 = Normal (number input) · Auto grade & pass/fail calculation
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-[9px] font-bold text-slate-500 uppercase sticky left-0 bg-slate-100 z-20">
                    Chest
                  </th>
                  <th className="px-2 py-2 text-left text-[9px] font-bold text-slate-500 uppercase">Name</th>

                  {selectedTest?.testType === 'fpt' && selectedTest.fptEvents ? (
                    selectedTest.fptEvents.map((e, i) => (
                      <th key={i} className="px-2 py-2 text-center text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap min-w-[100px]">
                        <div>{e.isRunning ? '🏃' : '🔢'} {e.name}</div>
                        <div className="text-[8px] text-slate-400 font-normal">/{e.maxMarks} P:{e.passingMarks}</div>
                      </th>
                    ))
                  ) : (
                    <th className="px-2 py-2 text-center text-[9px] font-bold text-slate-500 uppercase">
                      Marks (/{selectedTest?.totalMarks})
                    </th>
                  )}

                  <th className="px-2 py-2 text-center text-[9px] font-bold text-slate-500 uppercase">Total</th>
                  <th className="px-2 py-2 text-center text-[9px] font-bold text-slate-500 uppercase">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map(r => (
                  <tr key={r.traineeId} className={
                    r.status === 'pass' ? 'bg-green-50/30' :
                    r.status === 'fail' && r.marks > 0 ? 'bg-red-50/30' : ''
                  }>
                    <td className="px-2 py-1.5 font-mono font-bold text-xs sticky left-0 bg-white">{r.chestNo}</td>
                    <td className="px-2 py-1.5 text-xs font-medium max-w-[120px] truncate">{r.traineeName}</td>

                    {/* FPT Event Cells */}
                    {selectedTest?.testType === 'fpt' && r.events ? (
                      r.events.map((evt, evtIdx) => (
                        <td key={evtIdx} className="px-2 py-1.5 text-center">
                          {evt.isRunning ? (
                            <select
                              value={evt.runningGrade || ''}
                              onChange={e => updateRunningGrade(r.traineeId, evtIdx, e.target.value as RunningGrade)}
                              className={`w-full text-[10px] border-2 px-1 py-1 font-bold rounded ${
                                evt.runningGrade === 'Excellent' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :
                                evt.runningGrade === 'Very Good' ? 'border-blue-400 bg-blue-50 text-blue-700' :
                                evt.runningGrade === 'Good' ? 'border-amber-400 bg-amber-50 text-amber-700' :
                                evt.runningGrade === 'Fail' ? 'border-red-400 bg-red-50 text-red-700' :
                                'border-slate-300 bg-white'
                              }`}
                            >
                              <option value="">—</option>
                              <option value="Excellent">🏆 Excellent</option>
                              <option value="Very Good">⭐ V.Good</option>
                              <option value="Good">👍 Good</option>
                              <option value="Fail">❌ Fail</option>
                            </select>
                          ) : (
                            <input
                              type="number"
                              value={evt.marks}
                              onChange={e => updateFPTEventMark(r.traineeId, evtIdx, Math.min(Number(e.target.value), evt.maxMarks))}
                              min={0}
                              max={evt.maxMarks}
                              className={`w-14 text-xs border-2 px-1 py-1 font-mono font-black text-center rounded ${
                                evt.marks > 0 && evt.passed ? 'border-green-400 bg-green-50 text-green-700' :
                                evt.marks > 0 && !evt.passed ? 'border-red-400 bg-red-50 text-red-700' :
                                'border-slate-300 bg-white'
                              }`}
                            />
                          )}
                        </td>
                      ))
                    ) : (
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          value={r.marks < 0 ? '' : r.marks}
                          onChange={e => updateMarks(r.traineeId, Number(e.target.value))}
                          min={0}
                          max={selectedTest?.totalMarks}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-xs font-bold"
                        />
                      </td>
                    )}

                    <td className="px-2 py-1.5 text-center text-xs font-bold">
                      {r.marks > 0 ? `${r.marks}/${selectedTest?.totalMarks || (r.events?.reduce((s, e) => s + e.maxMarks, 0) || 0)}` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {r.marks > 0 ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          r.status === 'pass' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          {r.status === 'pass' ? '✅' : '❌'} {r.grade}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={() => setShowBulkModal(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSaveResultsSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 flex items-center gap-2"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save All ({trainees.length})</>}
            </button>
          </div>
        </div>
      </FormModal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Test"
        message={`Delete "${selectedTest?.testName}"? All results will be lost.`}
        confirmLabel="Yes, Delete"
        confirmColor="red"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedTest(null);
        }}
        loading={submitting}
      />

      
    </div>
  );
};

export default TestRecordsScreen;