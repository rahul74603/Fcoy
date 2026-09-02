// ═══════════════════════════════════════════════════════════
// USTAD DASHBOARD — Instructor's personal dashboard
// ───────────────────────────────────────────────────────────
// Shows: today's schedule, assigned corrective actions,
// batch progress, staff info, quick links.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Calendar, ClipboardCheck, Users, BookOpen,
  Clock, AlertTriangle, CheckCircle2, Loader2, ArrowRight,
  ChevronDown, ChevronUp, Activity, Layers, Target,
} from 'lucide-react';
import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';

interface ProgramSession {
  time: string;
  subject: string;
  customSubject: string;
  platoon: string;
  location: string;
  assignedPersons: { rank: string; name: string }[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const UstadDashboard: React.FC = () => {
  const navigate = useNavigate();
  const go = useCallback((path: string) => navigate(path), [navigate]);
  const { user } = useAuth();
  const { currentBatch: activeBatch } = useBatch();

  const [loading, setLoading] = useState(true);
  const [traineeCount, setTraineeCount] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [programs, setPrograms] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);

  const todayDayName = DAY_NAMES[new Date().getDay()];
  const todayStr = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true);
    try {
      const [traineesSnap, programSnap, findingsSnap, staffSnap] = await Promise.all([
        getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id))),
        getDocs(query(collection(db, 'weeklyPrograms'), where('batchId', '==', activeBatch.id))),
        getDocs(collection(db, 'findings')),
        getDocs(collection(db, 'staff')),
      ]);

      let total = 0, present = 0;
      traineesSnap.forEach(d => {
        total++;
        const data = d.data();
        if ((data.attn || 'P') === 'P') present++;
      });
      setTraineeCount(total);
      setPresentCount(present);

      const progList: any[] = [];
      programSnap.forEach(d => progList.push({ id: d.id, ...d.data() }));
      progList.sort((a, b) => new Date(b.fromDate || 0).getTime() - new Date(a.fromDate || 0).getTime());
      setPrograms(progList);

      // Findings assigned to this user's role
      const myRole = user?.role || 'Ustad';
      const fList: any[] = [];
      findingsSnap.forEach(d => {
        const data = d.data();
        if (data.assignedToRole === myRole && data.status !== 'closed') {
          fList.push({ id: d.id, ...data });
        }
      });
      setFindings(fList);

      setStaffCount(staffSnap.size);
    } catch (err) {
      console.error('UstadDashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeBatch, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Today's schedule
  const activeProgram = programs.find(p => p.fromDate <= todayStr && p.toDate >= todayStr) || programs[0] || null;
  const todaySchedule: ProgramSession[] = [];
  if (activeProgram?.schedule) {
    const todayData = activeProgram.schedule.find((d: any) => d.day === todayDayName);
    if (todayData) todaySchedule.push(...todayData.sessions);
  }

  // My assignments today
  const myName = (user?.name || '').trim().toLowerCase();
  const myAssignments = todaySchedule.filter(s =>
    (s.assignedPersons || []).some(p => (p.name || '').trim().toLowerCase() === myName)
  );

  const getSubjectDisplay = (s: ProgramSession) =>
    s.subject === 'Other (Manual)' && s.customSubject ? s.customSubject : s.subject;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-military-700" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl px-6 py-5 shadow-lg text-white">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">{greeting}, {user?.name || 'Ustad'}</p>
            <h1 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
              <Shield size={20} className="text-blue-300" />
              Ustad Dashboard
            </h1>
            <p className="text-[10px] text-white/50 mt-1 ml-8">
              Your schedule, duties & corrective actions
            </p>
          </div>
          {activeBatch && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
              <p className="text-[8px] text-white/50 font-bold uppercase">Active Batch</p>
              <p className="text-[11px] font-black text-white flex items-center gap-1.5">
                <Layers size={11} className="text-blue-300" />
                {activeBatch.batchNumber} {activeBatch.batchName || ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {!activeBatch && (
        <div className="bg-red-900/90 border border-red-600 px-5 py-4 flex items-center gap-3 rounded-2xl">
          <AlertTriangle size={20} className="text-red-300" />
          <p className="text-xs font-black text-red-200">No Active Batch! Ask Company Commander to activate a batch.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Trainees', value: traineeCount, icon: Users, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'Present Today', value: presentCount, icon: CheckCircle2, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: 'Away', value: traineeCount - presentCount, icon: Activity, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'My Corrective Actions', value: findings.length, icon: ClipboardCheck, color: findings.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200', text: findings.length > 0 ? 'text-red-700' : 'text-green-700' },
        ].map(s => (
          <div key={s.label} className={`bg-white border ${s.color} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.label}</span>
              <s.icon size={16} className={s.text} />
            </div>
            <p className={`text-2xl font-black mt-1 ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-blue-600" />
              <span className="text-[11px] font-black text-slate-700 uppercase">Today's Schedule — {todayDayName}</span>
            </div>
            <button onClick={() => go('/weekly-program')}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Full Program <ArrowRight size={10} />
            </button>
          </div>
          <div className="p-4">
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">
                  {['Sunday', 'Saturday'].includes(todayDayName) ? 'Off Day — No Classes' : 'No schedule for today'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {todaySchedule.map((s, i) => {
                  const isMyClass = (s.assignedPersons || []).some(p =>
                    (p.name || '').trim().toLowerCase() === myName
                  );
                  return (
                    <div key={i} className={`px-4 py-3 rounded-xl border ${
                      isMyClass ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[9px] font-mono font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{s.time}</span>
                          <span className="text-[11px] font-black text-slate-800">{getSubjectDisplay(s)}</span>
                          {isMyClass && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full">MY CLASS</span>}
                        </div>
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-bold">{s.platoon}</span>
                      </div>
                      {(s.location || s.assignedPersons?.length > 0) && (
                        <div className="flex items-center gap-3 mt-1.5 ml-[52px] text-[9px] text-slate-400">
                          {s.location && <span>📍 {s.location}</span>}
                          {s.assignedPersons?.length > 0 && s.assignedPersons[0].name && (
                            <span>👤 {s.assignedPersons.map(p => `${p.rank || ''} ${p.name}`.trim()).filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Corrective Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={14} className="text-amber-600" />
              <span className="text-[11px] font-black text-slate-700 uppercase">Assigned Corrective Actions ({findings.length})</span>
            </div>
            <button onClick={() => go('/so-inspections')}
              className="text-[10px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1">
              View All <ArrowRight size={10} />
            </button>
          </div>
          <div className="p-4">
            {findings.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 size={28} className="mx-auto text-green-300 mb-2" />
                <p className="text-xs font-bold text-green-600">No pending corrective actions! ✅</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {findings.map(f => (
                  <div key={f.id} className={`px-4 py-3 rounded-xl border ${
                    f.severity === 'critical' ? 'bg-red-50 border-red-300'
                    : f.severity === 'major' ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-800 truncate">{f.title}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          Due: {f.dueDate || '—'} · {f.responsibleArea || '—'}
                        </p>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
                        f.status === 'open' ? 'bg-red-100 text-red-700'
                        : f.status === 'in_progress' ? 'bg-amber-100 text-amber-700'
                        : f.status === 'rework' ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                        {f.status === 'open' ? 'OPEN' : f.status === 'in_progress' ? 'IN PROGRESS' : f.status === 'rework' ? 'REWORK' : f.status}
                      </span>
                    </div>
                    {f.correctiveAction && (
                      <p className="text-[9px] text-slate-600 mt-1.5"><b>Action:</b> {f.correctiveAction}</p>
                    )}
                    <button onClick={() => go('/so-inspections')}
                      className="text-[9px] font-bold text-blue-600 hover:text-blue-800 mt-1.5">
                      Respond →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-[11px] font-black text-slate-700 uppercase mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: 'Trainee 360°', path: '/trainee-360', icon: '👥', color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Batch Progress', path: '/batch-progress', icon: '📊', color: 'bg-purple-600 hover:bg-purple-700' },
            { label: 'Training Schedule', path: '/training-schedule', icon: '📅', color: 'bg-indigo-600 hover:bg-indigo-700' },
            { label: 'Test Records', path: '/test-records', icon: '📝', color: 'bg-teal-600 hover:bg-teal-700' },
            { label: 'Staff List', path: '/staff', icon: '👤', color: 'bg-cyan-600 hover:bg-cyan-700' },
            { label: 'Leave Apply', path: '/staff-leave', icon: '🏖️', color: 'bg-amber-600 hover:bg-amber-700' },
          ].map(btn => (
            <button key={btn.path} onClick={() => go(btn.path)}
              className={`${btn.color} text-white rounded-xl px-3 py-3 text-[10px] font-bold uppercase flex flex-col items-center gap-1.5 transition-colors`}>
              <span className="text-lg">{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-400 py-3">
        Ustad / Instructor Dashboard · BSF COY Training ERP
      </div>
    </div>
  );
};

export default UstadDashboard;
