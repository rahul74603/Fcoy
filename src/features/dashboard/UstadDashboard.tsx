// src/features/dashboard/UstadDashboard.tsx
// ───────────────────────────────────────────────────────────
// USTAD COMMAND DASHBOARD — read-only live view
// Existing collections se data laata hai:
//   staff, staff_attendance, staff_leave, staff_duty,
//   training_schedule, deputation_records
// Kuch bhi WRITE nahi karta → existing flows pe zero impact.
// ───────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import {
  Shield, Users, UserCheck, Calendar, ClipboardList,
  CalendarDays, AlertCircle, Repeat, RefreshCw, ChevronRight,
  Loader2, Clock,
} from 'lucide-react';

// ─── DATE HELPERS (Timestamp / seconds / ISO string sab handle) ───
const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') { try { return v.toDate(); } catch { return null; } }
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const sameDay = (a: Date | null, b: Date): boolean =>
  !!a &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

interface DashData {
  totalStaff: number;
  activeStaff: number;
  presentToday: number;
  attendanceMarked: boolean;
  onLeaveToday: { name: string; type: string }[];
  pendingLeaves: { id: string; name: string; type: string; days: number }[];
  dutiesToday: { name: string; duty: string }[];
  scheduleToday: { subject: string; instructor: string; time: string; status: string }[];
  onDeputation: { name: string; fromTo: string }[];
}

export const UstadDashboard = () => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const navigate = useNavigate();

  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    const today = new Date();

    const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
      try { return await p; } catch { return fallback; }
    };
    const fetchCol = (name: string, max = 300) =>
      safe(getDocs(query(collection(db, name), limit(max))).then(s => s.docs), [] as any[]);

    try {
      const [staffSnap, attSnap, leaveSnap, dutySnap, schedSnap, depSnap] =
        await Promise.all([
          fetchCol('staff'),
          fetchCol('staff_attendance', 400),
          fetchCol('staff_leave', 300),
          fetchCol('staff_duty', 300),
          fetchCol('training_schedule', 300),
          fetchCol('deputation_records', 200),
        ]);

      // ── Staff ──
      const staffDocs = staffSnap.map(d => d.data() as any);
      const activeStaff = staffDocs.filter(s => (s.status ?? 'active') === 'active');

      // ── Attendance today ──
      const attToday = attSnap
        .map(d => d.data() as any)
        .filter(a => sameDay(toDate(a.date), today));
      const presentToday = attToday.filter(a => a.status === 'present').length;

      // ── Leave ──
      const leaves = leaveSnap.map(d => ({ id: d.id, ...(d.data() as any) }));
      const onLeaveToday = leaves
        .filter(l => {
          if (l.status !== 'approved') return false;
          const from = toDate(l.fromDate); const to = toDate(l.toDate);
          if (!from) return false;
          const end = to ?? from;
          const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
          const f0 = new Date(from); f0.setHours(0, 0, 0, 0);
          const e0 = new Date(end); e0.setHours(23, 59, 59, 999);
          return t0 >= f0 && t0 <= e0;
        })
        .map(l => ({ name: l.staffName || 'Staff', type: l.leaveTypeName || l.leaveType || 'Leave' }));

      const pendingLeaves = leaves
        .filter(l => l.status === 'pending')
        .slice(0, 6)
        .map(l => ({
          id: l.id,
          name: l.staffName || 'Staff',
          type: l.leaveTypeName || l.leaveType || 'Leave',
          days: Number(l.numberOfDays ?? l.totalDays ?? 0),
        }));

      // ── Duties today ──
      const dutiesToday = dutySnap
        .map(d => d.data() as any)
        .filter(x => sameDay(toDate(x.date), today))
        .slice(0, 8)
        .map(x => ({ name: x.staffName || 'Staff', duty: x.dutyTypeName || x.dutyTypeId || 'Duty' }));

      // ── Schedule today ──
      const scheduleToday = schedSnap
        .map(d => d.data() as any)
        .filter(x => sameDay(toDate(x.date), today))
        .slice(0, 8)
        .map(x => ({
          subject: x.subjectName || x.subject || '—',
          instructor: x.instructorName || x.instructor || '—',
          time: x.time || x.timeSlot || '',
          status: x.status || 'scheduled',
        }));

      // ── Deputation (active) ──
      const onDeputation = depSnap
        .map(d => d.data() as any)
        .filter(x => (x.status || '').toLowerCase() === 'active')
        .slice(0, 6)
        .map(x => ({
          name: x.staffName || x.ustadName || 'Staff',
          fromTo: `${x.fromCoy || '?'} → ${x.toCoy || '?'}`,
        }));

      setData({
        totalStaff: staffDocs.length,
        activeStaff: activeStaff.length,
        presentToday,
        attendanceMarked: attToday.length > 0,
        onLeaveToday,
        pendingLeaves,
        dutiesToday,
        scheduleToday,
        onDeputation,
      });
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err?.message || 'Dashboard load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [activeBatch?.id]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Total Instructors', value: data.totalStaff, sub: `${data.activeStaff} active`, icon: Users, color: 'text-blue-700 bg-blue-50 border-blue-300', path: '/staff' },
      { label: 'Present Today', value: data.attendanceMarked ? data.presentToday : '—', sub: data.attendanceMarked ? 'attendance marked' : 'not marked yet', icon: UserCheck, color: 'text-green-700 bg-green-50 border-green-300', path: '/staff-attendance' },
      { label: 'On Leave Today', value: data.onLeaveToday.length, sub: 'approved leave', icon: Calendar, color: 'text-amber-700 bg-amber-50 border-amber-300', path: '/staff-leave' },
      { label: 'Pending Leaves', value: data.pendingLeaves.length, sub: 'approval waiting', icon: AlertCircle, color: 'text-red-700 bg-red-50 border-red-300', path: '/staff-leave' },
      { label: 'Duties Today', value: data.dutiesToday.length, sub: 'assigned', icon: ClipboardList, color: 'text-purple-700 bg-purple-50 border-purple-300', path: '/duty-management' },
      { label: 'Periods Today', value: data.scheduleToday.length, sub: 'in schedule', icon: CalendarDays, color: 'text-cyan-700 bg-cyan-50 border-cyan-300', path: '/training-schedule' },
    ];
  }, [data]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider">Ustad Command</h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">
            Training Deployment &amp; Field Operations
            {activeBatch ? ` — ${activeBatch.batchNumber}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="bg-white border border-slate-300 text-slate-600 px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <span className="bg-military-100 text-military-800 px-3 py-1 text-[10px] border border-military-300 font-bold uppercase rounded-sm flex items-center">
            <Shield size={14} className="mr-1" /> {user?.role || 'Ustad'} Access
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={28} className="animate-spin mr-2" />
          <span className="text-xs font-bold uppercase tracking-wider">Loading field data...</span>
        </div>
      ) : data ? (
        <>
          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {cards.map((c) => (
              <div
                key={c.label}
                onClick={() => navigate(c.path)}
                className={`border rounded-sm p-3 cursor-pointer hover:shadow-md transition-shadow bg-white ${c.color.split(' ').slice(2).join(' ')}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <c.icon size={16} className={c.color.split(' ')[0]} />
                  <ChevronRight size={12} className="text-slate-300" />
                </div>
                <div className={`text-2xl font-black ${c.color.split(' ')[0]}`}>{c.value}</div>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{c.label}</div>
                <div className="text-[9px] text-slate-400 font-bold">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── TODAY'S TRAINING SCHEDULE ── */}
            <div className="bg-white border border-slate-300 shadow-flat">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-cyan-50 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-cyan-900 uppercase flex items-center gap-2">
                  <CalendarDays size={13} /> Today's Training Schedule
                </h3>
                <button onClick={() => navigate('/training-schedule')} className="text-[9px] font-black text-cyan-700 uppercase hover:underline">
                  Full Schedule →
                </button>
              </div>
              {data.scheduleToday.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.scheduleToday.map((s, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-16 flex-shrink-0 flex items-center gap-1">
                        <Clock size={9} /> {s.time || '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-military-900 truncate">{s.subject}</p>
                        <p className="text-[10px] text-slate-500 font-bold truncate">{s.instructor}</p>
                      </div>
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-[11px] font-bold text-slate-400 uppercase">
                  Aaj ke liye koi period scheduled nahi
                </p>
              )}
            </div>

            {/* ── PENDING LEAVE APPROVALS ── */}
            <div className="bg-white border border-slate-300 shadow-flat">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-red-50 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-red-900 uppercase flex items-center gap-2">
                  <AlertCircle size={13} /> Pending Leave Applications
                </h3>
                <button onClick={() => navigate('/staff-leave')} className="text-[9px] font-black text-red-700 uppercase hover:underline">
                  Manage →
                </button>
              </div>
              {data.pendingLeaves.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.pendingLeaves.map((l) => (
                    <div key={l.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-military-900 truncate">{l.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold truncate">{l.type}</p>
                      </div>
                      <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-300 rounded-sm px-1.5 py-0.5">
                        {l.days} DIN
                      </span>
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm bg-red-100 text-red-700 border border-red-300 animate-pulse">
                        PENDING
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-[11px] font-bold text-slate-400 uppercase">
                  Koi pending leave application nahi — All Clear ✓
                </p>
              )}
            </div>

            {/* ── ON LEAVE TODAY ── */}
            <div className="bg-white border border-slate-300 shadow-flat">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-amber-50">
                <h3 className="text-[11px] font-black text-amber-900 uppercase flex items-center gap-2">
                  <Calendar size={13} /> On Leave Today ({data.onLeaveToday.length})
                </h3>
              </div>
              {data.onLeaveToday.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.onLeaveToday.map((l, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                      <p className="text-xs font-black text-military-900">{l.name}</p>
                      <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-300 rounded-sm px-1.5 py-0.5 uppercase">
                        {l.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-[11px] font-bold text-slate-400 uppercase">
                  Aaj koi leave pe nahi — Full Strength ✓
                </p>
              )}
            </div>

            {/* ── DUTIES + DEPUTATION ── */}
            <div className="bg-white border border-slate-300 shadow-flat">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-purple-50">
                <h3 className="text-[11px] font-black text-purple-900 uppercase flex items-center gap-2">
                  <ClipboardList size={13} /> Today's Duties ({data.dutiesToday.length})
                </h3>
              </div>
              {data.dutiesToday.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.dutiesToday.map((d, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                      <p className="text-xs font-black text-military-900">{d.name}</p>
                      <span className="text-[9px] font-black text-purple-700 bg-purple-100 border border-purple-300 rounded-sm px-1.5 py-0.5 uppercase">
                        {d.duty}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-[11px] font-bold text-slate-400 uppercase">
                  Aaj koi duty assign nahi hai
                </p>
              )}

              <div className="px-4 py-2.5 border-t border-b border-slate-200 bg-indigo-50 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-indigo-900 uppercase flex items-center gap-2">
                  <Repeat size={13} /> On Deputation ({data.onDeputation.length})
                </h3>
                <button onClick={() => navigate('/deputation')} className="text-[9px] font-black text-indigo-700 uppercase hover:underline">
                  Register →
                </button>
              </div>
              {data.onDeputation.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.onDeputation.map((d, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between">
                      <p className="text-xs font-black text-military-900">{d.name}</p>
                      <span className="text-[9px] font-bold text-indigo-700">{d.fromTo}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-[11px] font-bold text-slate-400 uppercase">
                  Koi deputation active nahi
                </p>
              )}
            </div>
          </div>

          <p className="text-[9px] text-slate-400 font-bold text-right uppercase">
            Last refresh: {lastRefresh.toLocaleTimeString('en-GB')} — Read-only view, koi data change nahi hota
          </p>
        </>
      ) : null}
    </div>
  );
};
