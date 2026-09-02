// ═══════════════════════════════════════════════════════════
// PERIOD ATTENDANCE SCREEN (Kaksha Upasthiti)
// BSF STC — Mark attendance per period with reason + body pair
// Monthly/Weekly/Daily reports + Absent filter
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Loader2, Save, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Filter, Download,
  BarChart3, Users, FileText,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import { bulkMarkPeriodAttendance, getPeriodAttendanceByDate, getPeriodAttendanceByRange } from '../api/periodAttendance.api';
import { PERIODS, SUBJECTS, PERIOD_STATUS_CONFIG, ABSENT_REASONS, type PeriodStatus } from '../types/periodAttendance.types';

export const PeriodAttendanceScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0]);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, PeriodStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [bodyPairs, setBodyPairs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'mark' | 'daily' | 'weekly' | 'monthly' | 'absent'>('mark');
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Reason popup
  const [reasonPopup, setReasonPopup] = useState<{ traineeId: string; chestNo: string; name: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [bodyPairText, setBodyPairText] = useState('');

  // Fetch trainees
  useEffect(() => {
    if (!activeBatch) return;
    import('firebase/firestore').then(({ getDocs, collection: col, query: q, where: w }) => {
      import('../../../config/firebase').then(({ db }) => {
        getDocs(q(col(db, 'trainees'), w('batchId', '==', activeBatch.id))).then(snap => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || ''));
          setTrainees(list);
        });
      });
    });
  }, [activeBatch]);

  // Load existing attendance
  useEffect(() => {
    if (!activeBatch || viewMode !== 'mark') return;
    setLoading(true);
    getPeriodAttendanceByDate(activeBatch.id, selectedDate).then(records => {
      const periodRecords = records.filter(r => r.period === selectedPeriod);
      const existing: Record<string, PeriodStatus> = {};
      const existingReasons: Record<string, string> = {};
      const existingBodyPairs: Record<string, string> = {};
      periodRecords.forEach(r => {
        existing[r.traineeId] = r.status as PeriodStatus;
        if (r.reason) existingReasons[r.traineeId] = r.reason;
        if (r.bodyPairChestNo) existingBodyPairs[r.traineeId] = r.bodyPairChestNo;
      });
      setMarks(existing);
      setReasons(existingReasons);
      setBodyPairs(existingBodyPairs);
      setLoading(false);
    });
  }, [activeBatch, selectedDate, selectedPeriod, viewMode]);

  // Load report data
  useEffect(() => {
    if (!activeBatch || viewMode === 'mark' || trainees.length === 0) return;
    loadReport();
  }, [activeBatch, viewMode, selectedDate, trainees]);

  const loadReport = async () => {
    if (!activeBatch) return;
    setReportLoading(true);
    try {
      let startDate = selectedDate;
      let endDate = selectedDate;

      if (viewMode === 'weekly') {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 6);
        startDate = d.toISOString().split('T')[0];
      } else if (viewMode === 'monthly') {
        const d = new Date(selectedDate);
        d.setDate(1);
        startDate = d.toISOString().split('T')[0];
      }

      const records = await getPeriodAttendanceByRange(activeBatch.id, startDate, endDate);

      // Build report per trainee
      const report: any[] = trainees.map(t => {
        const tRecords = records.filter(r => r.traineeId === t.id);
        const totalPeriods = tRecords.length;
        const present = tRecords.filter(r => r.status === 'P').length;
        const absent = tRecords.filter(r => r.status === 'A').length;
        const leave = tRecords.filter(r => r.status === 'L').length;
        const sick = tRecords.filter(r => r.status === 'S' || r.status === 'H').length;
        const duty = tRecords.filter(r => r.status === 'Duty' || r.status === 'TD').length;
        const absentReasons = tRecords.filter(r => r.status === 'A').map(r => r.reason || 'No reason').join(', ');
        const bodyPair = tRecords.find(r => r.bodyPairChestNo)?.bodyPairChestNo || '';
        return {
          ...t, totalPeriods, present, absent, leave, sick, duty,
          absentReasons, bodyPair,
          percentage: totalPeriods > 0 ? Math.round((present / totalPeriods) * 100) : 0,
        };
      });

      // If absent filter, show only absent trainees
      if (viewMode === 'absent') {
        setReportData(report.filter(r => r.absent > 0));
      } else {
        setReportData(report);
      }
    } catch {}
    setReportLoading(false);
  };

  const toggleStatus = (traineeId: string) => {
    const statuses: PeriodStatus[] = ['P', 'A', 'L', 'S', 'H', 'Duty', 'BP'];
    const current = marks[traineeId] || 'P';
    const next = statuses[(statuses.indexOf(current) + 1) % statuses.length];
    setMarks(prev => ({ ...prev, [traineeId]: next }));

    // If changed to absent/leave/sick, show reason popup
    if (next === 'A' || next === 'L' || next === 'S') {
      const t = trainees.find(t => t.id === traineeId);
      if (t) {
        setReasonPopup({ traineeId, chestNo: t.chestNo, name: t.name });
        setReasonText(reasons[traineeId] || '');
        setBodyPairText(bodyPairs[traineeId] || '');
      }
    }
  };

  const markAll = (status: PeriodStatus) => {
    const all: Record<string, PeriodStatus> = {};
    trainees.forEach(t => { all[t.id] = status; });
    setMarks(all);
    if (status === 'A') {
      // Show reason popup for first absent
      if (trainees.length > 0) {
        setReasonPopup({ traineeId: trainees[0].id, chestNo: trainees[0].chestNo, name: trainees[0].name });
        setReasonText('');
        setBodyPairText('');
      }
    }
  };

  const saveReason = () => {
    if (reasonPopup) {
      setReasons(prev => ({ ...prev, [reasonPopup.traineeId]: reasonText }));
      setBodyPairs(prev => ({ ...prev, [reasonPopup.traineeId]: bodyPairText }));

      // Auto-mark body pair as "BP" (Body Pair - absent with them)
      if (bodyPairText) {
        const bodyPairTrainee = trainees.find(t => t.chestNo === bodyPairText);
        if (bodyPairTrainee && bodyPairTrainee.id !== reasonPopup.traineeId) {
          setMarks(prev => ({ ...prev, [bodyPairTrainee.id]: 'BP' }));
          setReasons(prev => ({ ...prev, [bodyPairTrainee.id]: `Body Pair with ${reasonPopup.chestNo}` }));
          setBodyPairs(prev => ({ ...prev, [bodyPairTrainee.id]: reasonPopup.chestNo }));
        }
      }

      setReasonPopup(null);
    }
  };

  const stats = useMemo(() => {
    const values = Object.values(marks);
    return {
      total: trainees.length,
      present: values.filter(v => v === 'P').length,
      absent: values.filter(v => v === 'A').length,
      leave: values.filter(v => v === 'L').length,
      sick: values.filter(v => v === 'S' || v === 'H').length,
      duty: values.filter(v => v === 'Duty' || v === 'TD').length,
      bodyPair: values.filter(v => v === 'BP').length,
      unmarked: trainees.length - values.length,
    };
  }, [marks, trainees]);

  const handleSave = async () => {
    if (!activeBatch || !user) return;
    setSaving(true);
    try {
      const markList = trainees.map(t => ({
        traineeId: t.id,
        traineeName: t.name || '',
        chestNo: t.chestNo || '',
        status: marks[t.id] || 'P' as PeriodStatus,
        reason: reasons[t.id] || '',
        bodyPairChestNo: bodyPairs[t.id] || '',
        bodyPairName: '',
      }));
      await bulkMarkPeriodAttendance(activeBatch.id, selectedDate, selectedPeriod, selectedSubject, markList, user.name || 'System');
      setMessage(`✅ Attendance saved for ${selectedPeriod} — ${selectedDate}`);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><Calendar size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-green-700 rounded-xl px-6 py-4">
        <h1 className="text-lg font-black text-white uppercase tracking-wider">📊 Kaksha Upasthiti</h1>
        <p className="text-[10px] text-green-200">Period-wise Attendance — BSF STC Pattern</p>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* View Mode Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'mark', label: '📝 Mark Attendance', icon: <CheckCircle2 size={14} /> },
          { key: 'daily', label: '📅 Daily Report', icon: <Calendar size={14} /> },
          { key: 'weekly', label: '📊 Weekly Report', icon: <BarChart3 size={14} /> },
          { key: 'monthly', label: '📋 Monthly Report', icon: <FileText size={14} /> },
          { key: 'absent', label: '❌ Only Absent', icon: <XCircle size={14} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setViewMode(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold ${
              viewMode === tab.key ? 'bg-green-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1">
            <button onClick={() => changeDate(-1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><ChevronLeft size={16} /></button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" />
            <button onClick={() => changeDate(1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><ChevronRight size={16} /></button>
          </div>

          {viewMode === 'mark' && (
            <>
              <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold">
                {PERIODS.map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold">
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </>
          )}
        </div>

        {/* Quick Mark All — only in mark mode */}
        {viewMode === 'mark' && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-500 self-center">Sab ko mark karo:</span>
            {(['P', 'A', 'L', 'S', 'H', 'Duty'] as PeriodStatus[]).map(s => (
              <button key={s} onClick={() => markAll(s)}
                className={`px-4 py-2 rounded-lg text-xs font-black border-2 ${PERIOD_STATUS_CONFIG[s].bg} ${PERIOD_STATUS_CONFIG[s].color} hover:opacity-80 active:scale-95`}>
                {PERIOD_STATUS_CONFIG[s].icon} All {PERIOD_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        {viewMode === 'mark' && (
          <div className="flex flex-wrap gap-3 text-sm font-bold">
            <span className="bg-slate-100 px-3 py-1.5 rounded-lg">Total: {stats.total}</span>
            <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg">✅ P: {stats.present}</span>
            <span className="bg-red-100 text-red-800 px-3 py-1.5 rounded-lg">❌ A: {stats.absent}</span>
            <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg">✈️ L: {stats.leave}</span>
            <span className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg">🏥 S/H: {stats.sick}</span>
            <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg">🛡️ Duty: {stats.duty}</span>
            {stats.bodyPair > 0 && <span className="bg-pink-100 text-pink-800 px-3 py-1.5 rounded-lg">👥 Body Pair: {stats.bodyPair}</span>}
            {stats.unmarked > 0 && <span className="bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg">Unmarked: {stats.unmarked}</span>}
          </div>
        )}
      </div>

      {/* MARK ATTENDANCE VIEW */}
      {viewMode === 'mark' && (
        <>
          {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-green-600 mx-auto" /></div>
          : <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Chest</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Reason / Body Pair</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trainees.map((t, idx) => {
                    const status = marks[t.id] || 'P';
                    const config = PERIOD_STATUS_CONFIG[status];
                    const hasReason = reasons[t.id];
                    const hasBodyPair = bodyPairs[t.id];
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 ${status === 'A' ? 'bg-red-50/50' : status === 'L' ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-sm font-black">{t.chestNo}</td>
                        <td className="px-4 py-3 text-sm font-bold">{t.name}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleStatus(t.id)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black border-2 transition-all active:scale-95 ${config.bg} ${config.color} border-current`}>
                            {config.icon} {config.label}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {(status === 'A' || status === 'L' || status === 'S') ? (
                            <div className="flex items-center gap-2">
                              {hasReason && <span className="bg-slate-100 px-2 py-1 rounded text-[10px]">{hasReason}</span>}
                              {hasBodyPair && <span className="bg-blue-100 px-2 py-1 rounded text-[10px]">👤 BP: {hasBodyPair}</span>}
                              <button onClick={() => {
                                setReasonPopup({ traineeId: t.id, chestNo: t.chestNo, name: t.name });
                                setReasonText(reasons[t.id] || '');
                                setBodyPairText(bodyPairs[t.id] || '');
                              }} className="text-blue-600 hover:underline text-[10px] font-bold">
                                {hasReason ? 'Edit' : '+ Reason / Body Pair'}
                              </button>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}

          {/* Save */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-8 py-4 bg-green-700 text-white text-base font-black rounded-xl flex items-center gap-2 hover:bg-green-800 disabled:opacity-50 active:scale-95">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Attendance — {selectedPeriod} ({selectedDate})
            </button>
          </div>
        </>
      )}

      {/* REPORT VIEWS */}
      {viewMode !== 'mark' && (
        <>
          {reportLoading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-green-600 mx-auto" /></div>
          : reportData.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <FileText size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-400">Koi data nahi is date range ke liye</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                <span className="text-sm font-black text-slate-700">
                  {viewMode === 'daily' && `📅 Daily Report — ${selectedDate}`}
                  {viewMode === 'weekly' && `📊 Weekly Report (Last 7 days)`}
                  {viewMode === 'monthly' && `📋 Monthly Report — ${new Date(selectedDate).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`}
                  {viewMode === 'absent' && `❌ Absent Trainees — ${selectedDate}`}
                </span>
                <span className="text-xs text-slate-500">{reportData.length} trainees</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Chest</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Name</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">Total</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-green-600 uppercase">Present</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-red-600 uppercase">Absent</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-amber-600 uppercase">Leave</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-orange-600 uppercase">Sick</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-blue-600 uppercase">Duty</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">%</th>
                    {(viewMode === 'absent' || viewMode === 'daily') && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Reason</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((r, idx) => (
                    <tr key={r.id} className={`hover:bg-slate-50 ${r.absent > 0 ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 text-xs font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs font-bold">{r.chestNo}</td>
                      <td className="px-3 py-2 text-xs font-bold">{r.name}</td>
                      <td className="px-3 py-2 text-center text-xs">{r.totalPeriods}</td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-green-700">{r.present}</td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-red-700">{r.absent}</td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-amber-700">{r.leave}</td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-orange-700">{r.sick}</td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-blue-700">{r.duty}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                          r.percentage >= 90 ? 'bg-green-100 text-green-800' :
                          r.percentage >= 75 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>{r.percentage}%</span>
                      </td>
                      {(viewMode === 'absent' || viewMode === 'daily') && (
                        <td className="px-3 py-2 text-[10px] text-slate-600 max-w-[200px] truncate">{r.absentReasons || '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* REASON + BODY PAIR POPUP */}
      {reasonPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="bg-red-800 px-4 py-3 rounded-t-2xl">
              <h3 className="text-sm font-black text-white">❌ {reasonPopup.chestNo} — {reasonPopup.name}</h3>
              <p className="text-[10px] text-red-200">Absent/Leave reason aur Body Pair do</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Reason *</label>
                <select value={reasonText} onChange={e => setReasonText(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- Select Reason --</option>
                  {ABSENT_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Body Pair (Buddy) — Optional</label>
                <select value={bodyPairText} onChange={e => setBodyPairText(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- No Body Pair --</option>
                  {trainees.filter(t => t.id !== reasonPopup.traineeId).map(t => (
                    <option key={t.chestNo} value={t.chestNo}>{t.chestNo} — {t.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-1">Agar kisi ke saath gaya hai to uska chest number select karo</p>
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setReasonPopup(null)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Skip</button>
                <button onClick={saveReason} className="px-6 py-2 bg-red-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-red-800">
                  <Save size={14} /> Save Reason
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
