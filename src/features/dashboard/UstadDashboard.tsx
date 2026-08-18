// src/features/dashboard/UstadDashboard.tsx
// ═══════════════════════════════════════════════════════════
// 🎖️ USTAD DASHBOARD — "Today's Training Command Center"
//
// 5-second rule: Ustad screen kholte hi jaan le —
//   AAJ kya training hai? ABHI kya chal raha hai? AAGE kya hai?
//   KITNE trainees available hain? KISKO attention chahiye?
//
// DATA SOURCES (sab EXISTING collections — kuch naya nahi banaya):
//   • weeklyPrograms  → aaj ka + upcoming training schedule
//   • trainees        → strength / attn (P,A,L,S,H,R) / medStat
//   • medicalRecords  → active medical cases count
// Sab queries batchId-scoped hain (poora DB kabhi load nahi hota).
// Ustad ke liye READ-ONLY — koi write nahi (rules ke mutabik).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, UserX, HeartPulse, Calendar, Clock, MapPin,
  AlertCircle, CheckCircle2, Loader2, RefreshCw, ArrowRight,
  Target, PlayCircle, CalendarDays, Activity, X,
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';

// ─────────────────────────────────────────────
// TYPES (existing data shapes — ClerkDashboard/WeeklyProgram jaise hi)
// ─────────────────────────────────────────────
interface TraineeBasic {
  id: string;
  name?: string;
  chestNo?: string;
  regNo?: string;
  platoon?: string;
  attn?: string;     // P / A / L / S / H / R
  medStat?: string;
  [key: string]: any;
}

interface TodaySession {
  id: string;
  time: string;
  subject: string;
  customSubject?: string;
  platoon: string;
  location: string;
  assignedPersons?: { id: string; rank: string; name: string }[];
  ustadName?: string;
  lectureDetails?: { topic?: string; description?: string };
}

interface DaySchedule { day: string; sessions: TodaySession[]; }

interface WeeklyProgram {
  id: string;
  weekName: string;
  fromDate: string;
  toDate: string;
  schedule: DaySchedule[];
}

const DAYS_MAP: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday',
};
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ABSENT_LABELS: Record<string, string> = {
  A: 'Absent', L: 'On Leave', S: 'Sick / MI Room', H: 'Hospital', R: 'Rest / Excused',
};

// "0600-0630" / "06:00" jaise time strings → minutes-of-day (parse fail = null)
const parseStartMin = (time: string): number | null => {
  const m = /^(\d{1,2}):?(\d{2})/.exec((time || '').trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};
const parseEndMin = (time: string): number | null => {
  // "0600-0630" ke second hisse se; na mile to start+60min
  const m = /[-–]\s*(\d{1,2}):?(\d{2})/.exec((time || '').trim());
  if (m) {
    const h = Number(m[1]), min = Number(m[2]);
    if (h <= 23 && min <= 59) return h * 60 + min;
  }
  const s = parseStartMin(time);
  return s === null ? null : s + 60;
};

const sessionLabel = (s: TodaySession) =>
  s.subject === 'Other' && s.customSubject ? s.customSubject : (s.subject || '—');

const instructorLabel = (s: TodaySession) => {
  if (s.assignedPersons?.length) {
    const filled = s.assignedPersons.filter(p => p.name);
    if (filled.length) return filled.map(p => `${p.rank ? p.rank + ' ' : ''}${p.name}`).join(', ');
  }
  return s.ustadName || '—';
};

// ─────────────────────────────────────────────
// STAT CARD (ClerkDashboard jaisa hi pattern)
// ─────────────────────────────────────────────
const StatCard: React.FC<{
  title: string; value: React.ReactNode; subtitle: string;
  icon: React.ReactNode; color: string; borderColor: string;
  clickable?: boolean; onClick?: () => void;
}> = ({ title, value, subtitle, icon, color, borderColor, clickable, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white border border-slate-300 border-t-4 ${borderColor} shadow-flat p-4 flex items-start justify-between ${clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all' : ''}`}
  >
    <div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-400 font-bold mt-1">{subtitle}</p>
    </div>
    {icon}
  </div>
);

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export const UstadDashboard = () => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const navigate = useNavigate();

  const [trainees, setTrainees] = useState<TraineeBasic[]>([]);
  const [program, setProgram] = useState<WeeklyProgram | null>(null);
  const [activeMedical, setActiveMedical] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailModal, setUnavailModal] = useState(false);
  const [now, setNow] = useState(new Date());

  // Har minute time refresh — current/next training status sahi rahe
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const todayDayName = DAYS_MAP[now.getDay()];
  const todayISO = now.toISOString().split('T')[0];

  // ── Fetch (batch-scoped queries only) ──
  const fetchData = async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [tSnap, wpSnap, medSnap] = await Promise.all([
        getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id))),
        getDocs(query(
          collection(db, 'weeklyPrograms'),
          where('batchId', '==', activeBatch.id),
          orderBy('fromDate', 'desc'),
        )),
        getDocs(query(
          collection(db, 'medicalRecords'),
          where('batchId', '==', activeBatch.id),
          where('status', '==', 'Active'),
        )),
      ]);

      const tList: TraineeBasic[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as TraineeBasic));
      setTrainees(tList);
      setActiveMedical(medSnap.size);

      // Aaj ki date jis program ke range me aaye wo, warna latest
      let found: WeeklyProgram | null = null;
      wpSnap.forEach(d => {
        if (found) return;
        const raw = d.data();
        const p: WeeklyProgram = {
          id: d.id,
          weekName: raw.weekName || '',
          fromDate: raw.fromDate || '',
          toDate: raw.toDate || '',
          schedule: (raw.schedule || []) as DaySchedule[],
        };
        if (todayISO >= p.fromDate && todayISO <= p.toDate) found = p;
      });
      if (!found && !wpSnap.empty) {
        const raw = wpSnap.docs[0].data();
        found = {
          id: wpSnap.docs[0].id,
          weekName: raw.weekName || '',
          fromDate: raw.fromDate || '',
          toDate: raw.toDate || '',
          schedule: (raw.schedule || []) as DaySchedule[],
        };
      }
      setProgram(found);
    } catch (err) {
      console.error('Ustad dashboard fetch error:', err);
      setError('Data load nahi ho paya. Network/permission check karke Retry karein.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeBatch?.id]);

  // ── Computed: strength ──
  const total = trainees.length;
  const unavailable = trainees.filter(t => t.attn && t.attn !== 'P');
  const present = total - unavailable.length;
  const presentPct = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
  const breakdown = useMemo(() => {
    const b: Record<string, number> = {};
    unavailable.forEach(t => { const k = t.attn || 'A'; b[k] = (b[k] || 0) + 1; });
    return b;
  }, [unavailable]);

  // ── Computed: today's sessions (time-sorted, status attached) ──
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isProgramCurrent = program ? (todayISO >= program.fromDate && todayISO <= program.toDate) : false;

  const todaySessions = useMemo(() => {
    if (!program || !isProgramCurrent) return [];
    const day = program.schedule.find(s => s.day === todayDayName);
    const sessions = (day?.sessions || []).slice();
    sessions.sort((a, b) => (parseStartMin(a.time) ?? 9999) - (parseStartMin(b.time) ?? 9999));
    return sessions.map(s => {
      const start = parseStartMin(s.time);
      const end = parseEndMin(s.time);
      let status: 'DONE' | 'NOW' | 'UPCOMING' | 'UNTIMED' = 'UNTIMED';
      if (start !== null && end !== null) {
        status = nowMin >= end ? 'DONE' : nowMin >= start ? 'NOW' : 'UPCOMING';
      }
      return { ...s, _start: start, _status: status };
    });
  }, [program, isProgramCurrent, todayDayName, nowMin]);

  const currentSession = todaySessions.find(s => s._status === 'NOW');
  const nextSession = todaySessions.find(s => s._status === 'UPCOMING');
  const doneCount = todaySessions.filter(s => s._status === 'DONE').length;

  // ── Computed: upcoming (baaki hafte ke agle 3 din jinme sessions hain) ──
  const upcomingDays = useMemo(() => {
    if (!program || !isProgramCurrent) return [];
    const todayIdx = DAY_ORDER.indexOf(todayDayName);
    const out: { day: string; sessions: TodaySession[] }[] = [];
    for (let i = todayIdx + 1; i < DAY_ORDER.length && out.length < 3; i++) {
      const d = program.schedule.find(s => s.day === DAY_ORDER[i]);
      if (d && d.sessions?.length) out.push({ day: d.day, sessions: d.sessions.slice(0, 3) });
    }
    return out;
  }, [program, isProgramCurrent, todayDayName]);

  // ── Greeting ──
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // ── Attention items (sirf REAL non-zero cheezein) ──
  const attention: { label: string; count: number; onClick: () => void; tone: string }[] = [];
  if (breakdown['A']) attention.push({ label: 'Trainees Absent Today', count: breakdown['A'], onClick: () => setUnavailModal(true), tone: 'text-red-700 bg-red-50 border-red-200' });
  if (activeMedical) attention.push({ label: 'Active Medical Cases', count: activeMedical, onClick: () => setUnavailModal(true), tone: 'text-purple-700 bg-purple-50 border-purple-200' });
  if (nextSession && nextSession._start !== null && nextSession._start - nowMin <= 60 && nextSession._start - nowMin > 0) {
    attention.push({ label: `Next training starts in ${nextSession._start - nowMin} min — ${sessionLabel(nextSession)}`, count: 1, onClick: () => document.getElementById('todays-schedule')?.scrollIntoView({ behavior: 'smooth' }), tone: 'text-amber-700 bg-amber-50 border-amber-200' });
  }

  // ═══════════ RENDER ═══════════
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 size={30} className="animate-spin text-military-700 mb-3" />
        <p className="text-xs font-black text-military-800 uppercase tracking-wider">Training data load ho raha hai...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4 pb-8">

      {/* ══════════ HEADER ══════════ */}
      <div className="bg-military-900 px-4 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-widest">
            {greeting}, {user?.name || 'Ustad'}
          </h1>
          <p className="text-[10px] text-military-300 font-bold uppercase mt-0.5">
            Ustad · Training Staff — Today's Training Command Center
          </p>
          <p className="text-[10px] text-military-400 mt-1 flex items-center gap-2">
            <Calendar size={11} />
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeBatch ? (
            <span className="bg-green-900 text-green-300 border border-green-600 px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Active Batch: {activeBatch.batchNumber}
            </span>
          ) : (
            <span className="bg-red-900 text-red-300 border border-red-600 px-3 py-1.5 text-[10px] font-black uppercase">
              Koi Active Batch Nahi
            </span>
          )}
          <button onClick={fetchData}
            className="bg-military-800 text-white border border-military-600 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-military-700 flex items-center gap-1.5">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* ══════════ ERROR ══════════ */}
      {error && (
        <div className="bg-red-50 border border-red-300 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-red-700 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
          <button onClick={fetchData} className="bg-red-700 text-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-red-800">Retry</button>
        </div>
      )}

      {!activeBatch ? (
        <div className="bg-white border border-slate-300 shadow-flat p-10 text-center">
          <Shield size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-500 uppercase">Active batch set hone ke baad training dashboard yahan dikhega</p>
        </div>
      ) : (
        <>
          {/* ══════════ TODAY'S STATUS CARDS ══════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Strength" value={total}
              subtitle="Trainees in Active Batch"
              icon={<Users size={28} className="text-military-400" />}
              color="text-military-900" borderColor="border-t-military-700"
            />
            <StatCard
              title="Present Today" value={present}
              subtitle={total > 0 ? `${presentPct}% Available` : 'No trainees yet'}
              icon={<CheckCircle2 size={28} className="text-green-400" />}
              color="text-green-700" borderColor="border-t-green-500"
            />
            <StatCard
              title="Not Available" value={unavailable.length}
              subtitle={unavailable.length === 0 ? 'All Present ✓' : 'Click for breakdown'}
              icon={<UserX size={28} className="text-red-400" />}
              color={unavailable.length > 0 ? 'text-red-700' : 'text-green-700'}
              borderColor="border-t-red-500"
              clickable onClick={() => setUnavailModal(true)}
            />
            <StatCard
              title="Today's Training" value={todaySessions.length}
              subtitle={todaySessions.length ? `${doneCount} done · ${todaySessions.length - doneCount} left` : 'Nothing scheduled'}
              icon={<Target size={28} className="text-blue-400" />}
              color="text-blue-700" borderColor="border-t-blue-500"
              clickable onClick={() => document.getElementById('todays-schedule')?.scrollIntoView({ behavior: 'smooth' })}
            />
          </div>

          {/* ══════════ CURRENT / NEXT HIGHLIGHT ══════════ */}
          {currentSession ? (
            <div className="bg-green-900 border-l-8 border-green-500 px-4 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <PlayCircle size={34} className="text-green-400 animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">● Now In Progress · {currentSession.time}</p>
                  <p className="text-xl font-black text-white uppercase">{sessionLabel(currentSession)}</p>
                  <p className="text-[11px] text-green-200 font-bold flex items-center gap-3 mt-0.5 flex-wrap">
                    {currentSession.location && <span className="flex items-center gap-1"><MapPin size={11} />{currentSession.location}</span>}
                    {currentSession.platoon && <span className="flex items-center gap-1"><Users size={11} />{currentSession.platoon}</span>}
                    <span className="flex items-center gap-1"><Shield size={11} />{instructorLabel(currentSession)}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => navigate('/weekly-program')}
                className="bg-white text-green-900 px-4 py-2 text-[10px] font-black uppercase hover:bg-green-100 flex items-center gap-1.5">
                Open Programme <ArrowRight size={12} />
              </button>
            </div>
          ) : nextSession ? (
            <div className="bg-blue-900 border-l-8 border-blue-500 px-4 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <Clock size={34} className="text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest">
                    Next Up · {nextSession.time}
                    {nextSession._start !== null && nextSession._start > nowMin && (
                      <span className="ml-2 bg-blue-700 px-2 py-0.5 rounded-full">starts in {Math.floor((nextSession._start - nowMin) / 60) > 0 ? `${Math.floor((nextSession._start - nowMin) / 60)}h ` : ''}{(nextSession._start - nowMin) % 60}m</span>
                    )}
                  </p>
                  <p className="text-xl font-black text-white uppercase">{sessionLabel(nextSession)}</p>
                  <p className="text-[11px] text-blue-200 font-bold flex items-center gap-3 mt-0.5 flex-wrap">
                    {nextSession.location && <span className="flex items-center gap-1"><MapPin size={11} />{nextSession.location}</span>}
                    {nextSession.platoon && <span className="flex items-center gap-1"><Users size={11} />{nextSession.platoon}</span>}
                    <span className="flex items-center gap-1"><Shield size={11} />{instructorLabel(nextSession)}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => navigate('/weekly-program')}
                className="bg-white text-blue-900 px-4 py-2 text-[10px] font-black uppercase hover:bg-blue-100 flex items-center gap-1.5">
                View Details <ArrowRight size={12} />
              </button>
            </div>
          ) : todaySessions.length > 0 ? (
            <div className="bg-slate-100 border-l-8 border-green-600 px-4 py-4 flex items-center gap-4">
              <CheckCircle2 size={30} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-military-900 uppercase">Today's Training Complete</p>
                <p className="text-[11px] text-slate-500 font-bold">{doneCount} / {todaySessions.length} activities completed</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 border-l-8 border-slate-400 px-4 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <Calendar size={30} className="text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-black text-slate-600 uppercase">
                    {todayDayName === 'Sunday' ? 'Sunday — Off Day / Rest Day' : 'No Training Scheduled Today'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-bold">Weekly Programme se schedule check karein</p>
                </div>
              </div>
              <button onClick={() => navigate('/weekly-program')}
                className="bg-military-800 text-white px-4 py-2 text-[10px] font-black uppercase hover:bg-military-900">
                View Weekly Programme
              </button>
            </div>
          )}

          {/* ══════════ ATTENTION REQUIRED ══════════ */}
          <div className="bg-white border border-slate-300 shadow-flat">
            <div className="bg-military-900 px-4 py-2.5 flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-400" />
              <h2 className="text-xs font-black text-white uppercase tracking-widest">Attention Required</h2>
            </div>
            {attention.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs font-black text-green-700 uppercase flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> No issues requiring your attention
                </p>
              </div>
            ) : (
              <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attention.map((a, i) => (
                  <button key={i} onClick={a.onClick}
                    className={`border px-3 py-2.5 text-left flex items-center justify-between gap-2 hover:shadow-sm transition-shadow ${a.tone}`}>
                    <span className="text-[11px] font-bold">{a.label}</span>
                    <span className="text-lg font-black flex-shrink-0">{a.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══════════ TODAY'S TRAINING SCHEDULE ══════════ */}
          <div id="todays-schedule" className="bg-white border border-slate-300 shadow-flat">
            <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-white" />
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">
                    Today's Training Schedule — {todayDayName}
                  </h2>
                  {program && isProgramCurrent && (
                    <p className="text-[10px] text-military-300 mt-0.5">
                      {program.weekName} ({program.fromDate} to {program.toDate})
                    </p>
                  )}
                </div>
              </div>
              <span className="bg-military-800 text-white text-[10px] font-bold px-3 py-1 border border-military-600">
                {todaySessions.length} Activities
              </span>
            </div>

            {todaySessions.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500 uppercase">
                  {!program ? 'Koi Weekly Programme nahi mila'
                    : !isProgramCurrent ? 'Is hafte ka programme abhi nahi bana'
                    : todayDayName === 'Sunday' ? 'Sunday — Off Day / Rest Day'
                    : 'Aaj ka koi program set nahi hai'}
                </p>
                <button onClick={() => navigate('/weekly-program')}
                  className="mt-3 bg-military-800 text-white px-4 py-2 text-[10px] font-black uppercase hover:bg-military-900">
                  View Weekly Programme
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todaySessions.map((s, idx) => (
                  <div key={s.id || idx}
                    className={`px-4 py-3 flex items-center gap-4 flex-wrap ${s._status === 'NOW' ? 'bg-green-50 border-l-4 border-green-500' : s._status === 'DONE' ? 'opacity-55' : ''}`}>
                    <div className="w-24 flex-shrink-0">
                      <p className="font-mono text-sm font-black text-military-900">{s.time || '—'}</p>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-sm font-black text-slate-800 uppercase">{sessionLabel(s)}</p>
                      {s.lectureDetails?.topic && (
                        <p className="text-[10px] text-slate-500 font-bold">{s.lectureDetails.topic}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 flex-wrap">
                      {s.platoon && <span className="flex items-center gap-1"><Users size={11} />{s.platoon}</span>}
                      {s.location && <span className="flex items-center gap-1"><MapPin size={11} />{s.location}</span>}
                      <span className="flex items-center gap-1"><Shield size={11} />{instructorLabel(s)}</span>
                    </div>
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
                      s._status === 'NOW' ? 'bg-green-600 text-white'
                      : s._status === 'DONE' ? 'bg-slate-200 text-slate-500'
                      : s._status === 'UPCOMING' ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}>
                      {s._status === 'NOW' ? '● IN PROGRESS' : s._status === 'DONE' ? '✓ DONE' : s._status === 'UPCOMING' ? 'UPCOMING' : 'TIME N/A'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══════════ STRENGTH + UPCOMING (2-col) ══════════ */}
          <div className="grid lg:grid-cols-2 gap-4">

            {/* TRAINEE STRENGTH */}
            <div className="bg-white border border-slate-300 shadow-flat">
              <div className="bg-military-900 px-4 py-2.5 flex items-center gap-2">
                <Activity size={15} className="text-white" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Trainee Strength</h2>
              </div>
              <div className="p-4 space-y-3">
                {total === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-4 uppercase">Is batch me abhi koi trainee register nahi hua</p>
                ) : (
                  <>
                    {[
                      { label: 'Present', count: present, color: 'bg-green-500', text: 'text-green-700' },
                      ...Object.entries(breakdown).map(([k, v]) => ({
                        label: ABSENT_LABELS[k] || k, count: v,
                        color: k === 'A' ? 'bg-red-500' : k === 'H' ? 'bg-purple-500' : k === 'S' ? 'bg-orange-500' : k === 'L' ? 'bg-amber-500' : 'bg-blue-500',
                        text: k === 'A' ? 'text-red-700' : k === 'H' ? 'text-purple-700' : k === 'S' ? 'text-orange-700' : k === 'L' ? 'text-amber-700' : 'text-blue-700',
                      })),
                    ].map(row => (
                      <div key={row.label}>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                          <span className="text-slate-500">{row.label}</span>
                          <span className={row.text}>{row.count}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${row.color} rounded-full transition-all`}
                            style={{ width: `${total > 0 ? (row.count / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-[10px] font-black uppercase">
                      <span className="text-slate-500">Total</span>
                      <span className="text-military-900">{total}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* UPCOMING TRAINING */}
            <div className="bg-white border border-slate-300 shadow-flat flex flex-col">
              <div className="bg-military-900 px-4 py-2.5 flex items-center gap-2">
                <CalendarDays size={15} className="text-white" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Upcoming Training</h2>
              </div>
              <div className="p-4 flex-1 space-y-3">
                {upcomingDays.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-4 uppercase">
                    Is hafte aage ka koi training nahi mila
                  </p>
                ) : (
                  upcomingDays.map(d => (
                    <div key={d.day}>
                      <p className="text-[10px] font-black text-military-700 uppercase mb-1.5">{d.day}</p>
                      <div className="space-y-1">
                        {d.sessions.map((s, i) => (
                          <div key={s.id || i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5">
                            <span className="font-mono text-[11px] font-black text-military-800 w-20 flex-shrink-0">{s.time || '—'}</span>
                            <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">{sessionLabel(s)}</span>
                            {s.location && <span className="text-[9px] text-slate-400 font-bold hidden sm:flex items-center gap-1"><MapPin size={9} />{s.location}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-slate-200 p-3">
                <button onClick={() => navigate('/weekly-program')}
                  className="w-full bg-military-800 text-white py-2 text-[10px] font-black uppercase hover:bg-military-900 flex items-center justify-center gap-1.5">
                  View Full Weekly Programme <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ QUICK ACTIONS (existing authorized routes only) ══════════ */}
          <div className="bg-white border border-slate-300 shadow-flat p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Training Schedule", icon: Calendar, path: '/training-schedule' },
                { label: 'Staff List', icon: Users, path: '/staff' },
                { label: 'My Leave', icon: HeartPulse, path: '/staff-leave' },
                { label: 'Batch Progress', icon: Target, path: '/batch-progress' },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  className="border border-slate-300 bg-slate-50 hover:bg-military-800 hover:text-white text-slate-700 px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors">
                  <a.icon size={14} /> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* ══════════ UNAVAILABLE MODAL (operational info only — no diagnosis) ══════════ */}
          {unavailModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setUnavailModal(false)}>
              <div className="bg-white w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-300" onClick={e => e.stopPropagation()}>
                <div className="bg-red-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <UserX size={18} className="text-white" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Currently Unavailable</h3>
                      <p className="text-[10px] text-white/70">{unavailable.length} trainees · operational status only</p>
                    </div>
                  </div>
                  <button onClick={() => setUnavailModal(false)} className="text-white/80 hover:text-white"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {unavailable.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-500 uppercase">Sab Present hain — All Clear!</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Chest / Reg</th>
                          <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Platoon</th>
                          <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unavailable.map(t => (
                          <tr key={t.id} className="border-b border-slate-100">
                            <td className="px-4 py-2">
                              <span className="font-mono font-bold text-military-800">{t.chestNo || '—'}</span>
                              <span className="text-[9px] text-slate-400 ml-1">({t.regNo || '—'})</span>
                            </td>
                            <td className="px-4 py-2 font-bold text-slate-800">{t.name || '—'}</td>
                            <td className="px-4 py-2"><span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span></td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                                t.attn === 'A' ? 'bg-red-100 text-red-800 border-red-300'
                                : t.attn === 'H' ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : t.attn === 'S' ? 'bg-orange-100 text-orange-800 border-orange-300'
                                : t.attn === 'L' ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}>
                                {ABSENT_LABELS[t.attn || ''] || t.attn}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
