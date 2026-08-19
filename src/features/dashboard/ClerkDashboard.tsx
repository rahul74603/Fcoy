// src/features/dashboard/ClerkDashboard.tsx
// ═══════════════════════════════════════════════════════════
// 🗂️ CLERK DASHBOARD — OPERATIONAL COMMAND CENTER
//
// 5-second rule: Clerk login karte hi jaan le —
//   Company me abhi kya chal raha hai? Kitne available? Kaun hospital/
//   leave/light duty par? Documents me kya problem? Aaj ka program kya?
//   Mera pending kaam kya hai? Recently kya badla?
//
// DATA (sab EXISTING collections — batch-scoped queries):
//   trainees        → strength, attn (P/A/L/S/H/R), documents, chest
//   weeklyPrograms  → aaj ka program + ustad assignments
//   medicalRecords  → active hospital/sick cases (since dates)
//   absentRecords   → active leave + aaj wapas aane wale
//
// HIERARCHY: Header → Strength → NEEDS ATTENTION → Today's Program
//   → Document Control + Medical/Availability → Pending Work
//   → Recent Activity → Quick Actions
// Finance/Inventory ka yahan KUCH NAHI (Clerk boundary).
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from 'react';
import {
  Users, UserX, FileText, Shield, X, CheckCircle2,
  Activity, Layers, Loader2, RefreshCw, Calendar, AlertCircle,
  AlertTriangle, Search, ArrowRight, HeartPulse, BedDouble,
  UserPlus, ClipboardList, Stethoscope, Target, MapPin,
  FilePlus2, CalendarClock, History,
} from 'lucide-react';
import {
  collection, getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ReportButton } from '../../components/common/ReportButton';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface TraineeBasic {
  id: string;
  name?: string;
  chestNo?: string;
  regNo?: string;
  platoon?: string;
  section?: string;
  attn?: string;
  medStat?: string;
  mobileNo?: string;
  documents?: Record<string, any>;
  docsComplete?: boolean;
  docsRequiredTotal?: number;
  docsRequiredDone?: number;
  docsUpdatedDate?: string;
  lastMedicalUpdate?: string;
  chestAssignedAt?: string;
  createdAt?: string;
  batchId?: string;
  remarks?: string;
  rank?: string;
  photoURL?: string;
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
}

interface DaySchedule { day: string; sessions: TodaySession[]; }

interface WeeklyProgram {
  id: string;
  weekName: string;
  fromDate: string;
  toDate: string;
  remarks: string;
  schedule: DaySchedule[];
}

interface MedRecord {
  id: string;
  traineeId?: string;
  chestNo?: string;
  name?: string;
  category?: string;
  date?: string;
  status?: string;
  platoon?: string;
}

interface AbsRecord {
  id: string;
  traineeId?: string;
  chestNo?: string;
  traineeName?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  reason?: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const DAYS_MAP: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday',
};

const ABSENT_LABELS: Record<string, string> = {
  A: 'Absent', L: 'On Leave', S: 'Sick / MI Room', H: 'Hospital', R: 'Light Duty / Rest',
};
const ABSENT_COLORS: Record<string, string> = {
  A: 'bg-red-100 text-red-800 border-red-300',
  L: 'bg-amber-100 text-amber-800 border-amber-300',
  S: 'bg-orange-100 text-orange-800 border-orange-300',
  H: 'bg-purple-100 text-purple-800 border-purple-300',
  R: 'bg-blue-100 text-blue-800 border-blue-300',
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
const docLabel = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

// ─────────────────────────────────────────────
// SMALL UI PARTS
// ─────────────────────────────────────────────
const SectionHead: React.FC<{ icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode }> =
  ({ icon, title, sub, right }) => (
    <div className="bg-military-900 px-4 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-white flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-xs font-black text-white uppercase tracking-widest truncate">{title}</h2>
          {sub && <p className="text-[9.5px] text-military-300 truncate">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );

const EmptyLine: React.FC<{ icon?: React.ReactNode; text: string; action?: { label: string; onClick: () => void } }> =
  ({ icon, text, action }) => (
    <div className="p-6 text-center">
      <div className="text-slate-300 mx-auto mb-2 flex justify-center">{icon ?? <CheckCircle2 size={30} className="text-green-400" />}</div>
      <p className="text-[11px] font-bold text-slate-500 uppercase">{text}</p>
      {action && (
        <button onClick={action.onClick}
          className="mt-3 bg-military-800 text-white px-4 py-1.5 text-[10px] font-black uppercase hover:bg-military-900">
          {action.label}
        </button>
      )}
    </div>
  );

// List modal (existing pattern preserved)
interface ListModalProps {
  open: boolean; onClose: () => void; title: string; icon: React.ReactNode;
  headerColor: string; trainees: TraineeBasic[];
  columns: { label: string; render: (t: TraineeBasic) => React.ReactNode }[];
  emptyMessage?: string;
}
const ListModal: React.FC<ListModalProps> = ({ open, onClose, title, icon, headerColor, trainees, columns, emptyMessage }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-300" onClick={e => e.stopPropagation()}>
        <div className={`${headerColor} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
              <p className="text-[10px] text-white/70">{trainees.length} Records</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {trainees.length === 0 ? (
            <EmptyLine text={emptyMessage || 'Koi record nahi'} />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>{columns.map(c => <th key={c.label} className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {trainees.map(t => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    {columns.map(c => <td key={c.label} className="px-4 py-2">{c.render(t)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export const ClerkDashboard = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();
  const hasBatch = !!activeBatch;
  const navigate = useNavigate();

  const [trainees, setTrainees] = useState<TraineeBasic[]>([]);
  const [weeklyProgram, setWeeklyProgram] = useState<WeeklyProgram | null>(null);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [medActive, setMedActive] = useState<MedRecord[]>([]);
  const [absActive, setAbsActive] = useState<AbsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [modal, setModal] = useState<'' | 'unavail' | 'hospital' | 'leave' | 'light' | 'docs' | 'chest'>('');

  const todayDayName = DAYS_MAP[new Date().getDay()] || 'Sunday';
  const todayDate = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // ── FETCH (batch-scoped only) ──
  const fetchDashboardData = async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [tSnap, wpSnap, medSnap, absSnap] = await Promise.all([
        getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id))),
        getDocs(query(collection(db, 'weeklyPrograms'), where('batchId', '==', activeBatch.id), orderBy('fromDate', 'desc'))),
        getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', activeBatch.id), where('status', '==', 'Active'))),
        getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', activeBatch.id), where('status', '==', 'Active'))),
      ]);

      const tList: TraineeBasic[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as TraineeBasic));
      setTrainees(tList);

      const mList: MedRecord[] = [];
      medSnap.forEach(d => mList.push({ id: d.id, ...d.data() } as MedRecord));
      setMedActive(mList);

      const aList: AbsRecord[] = [];
      absSnap.forEach(d => aList.push({ id: d.id, ...d.data() } as AbsRecord));
      setAbsActive(aList);

      // Today's program
      let found: WeeklyProgram | null = null;
      wpSnap.forEach(d => {
        if (found) return;
        const raw = d.data();
        const p: WeeklyProgram = {
          id: d.id, weekName: raw.weekName || '', fromDate: raw.fromDate || '',
          toDate: raw.toDate || '', remarks: raw.remarks || '',
          schedule: (raw.schedule || []) as DaySchedule[],
        };
        if (todayDate >= p.fromDate && todayDate <= p.toDate) found = p;
      });
      setWeeklyProgram(found);
      const day = found ? (found as WeeklyProgram).schedule.find(s => s.day === todayDayName) : undefined;
      setTodaySessions(day?.sessions || []);

      setLastRefresh(new Date().toLocaleTimeString('en-IN'));
    } catch (err) {
      console.error('Clerk dashboard fetch error:', err);
      setError('Dashboard data load nahi hua — Retry karein.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeBatch?.id]);

  // ── STRENGTH ──
  const total = trainees.length;
  const byAttn = (k: string) => trainees.filter(t => t.attn === k);
  const hospital = byAttn('H');
  const leave = byAttn('L');
  const lightDuty = byAttn('R');
  const sick = byAttn('S');
  const absent = byAttn('A');
  const unavailable = trainees.filter(t => t.attn && t.attn !== 'P');
  const active = total - unavailable.length;

  const chestPending = trainees.filter(t => !String(t.chestNo ?? '').trim());

  // ── DOCUMENTS (dynamic — required docs across all trainees) ──
  const docStats = useMemo(() => {
    let required = 0, verified = 0, uploaded = 0, pending = 0, rejected = 0;
    const issues: { t: TraineeBasic; doc: string; status: string }[] = [];
    trainees.forEach(t => {
      const docs = t.documents || {};
      Object.entries(docs).forEach(([key, v]: [string, any]) => {
        if (!v || v.isRequired === false) return;
        required++;
        const st = v.status || 'Pending';
        if (st === 'Verified') verified++;
        else if (st === 'Uploaded') uploaded++;
        else if (st === 'Rejected') { rejected++; issues.push({ t, doc: docLabel(key), status: 'Rejected' }); }
        else { pending++; issues.push({ t, doc: docLabel(key), status: 'Pending' }); }
      });
    });
    // Rejected pehle, phir pending — max 8 rows dashboard par
    issues.sort((a, b) => (a.status === 'Rejected' ? -1 : 1) - (b.status === 'Rejected' ? -1 : 1));
    const pct = required > 0 ? Math.round(((verified + uploaded) / required) * 100) : 0;
    const noDocsYet = trainees.filter(t => !t.documents || Object.keys(t.documents).length === 0);
    return { required, verified, uploaded, pending, rejected, pct, issues, noDocsYet };
  }, [trainees]);

  const docIncompleteTrainees = trainees.filter(t => {
    if (t.docsComplete === true) return false;
    if (!t.documents || Object.keys(t.documents).length === 0) return true;
    return Object.values(t.documents).some((v: any) => v?.isRequired !== false && (v?.status === 'Pending' || v?.status === 'Rejected'));
  });

  // ── LEAVE RETURNS ──
  const returningToday = absActive.filter(a => a.type === 'L' && a.toDate === todayDate);
  const returningSoon = absActive.filter(a => a.type === 'L' && a.toDate && a.toDate > todayDate)
    .sort((a, b) => String(a.toDate).localeCompare(String(b.toDate))).slice(0, 4);

  // ── ATTENTION ITEMS (real, prioritized) ──
  type Alert = { level: 'CRITICAL' | 'TODAY' | 'PENDING'; text: string; count: number; action: string; onClick: () => void };
  const alerts: Alert[] = [];
  if (docStats.rejected > 0) alerts.push({ level: 'CRITICAL', text: 'Documents REJECTED — dobara verify/correct karo', count: docStats.rejected, action: 'Review Documents', onClick: () => navigate('/documents') });
  if (hospital.length > 0) alerts.push({ level: 'CRITICAL', text: 'Trainees hospital me — status review karo', count: hospital.length, action: 'Hospital Records', onClick: () => setModal('hospital') });
  if (returningToday.length > 0) alerts.push({ level: 'TODAY', text: 'Trainees AAJ leave se wapas expected', count: returningToday.length, action: 'Leave Records', onClick: () => navigate('/absent-management') });
  if (!weeklyProgram) alerts.push({ level: 'TODAY', text: 'Is hafte ka Weekly Program nahi bana', count: 1, action: 'Create Program', onClick: () => navigate('/weekly-program') });
  if (chestPending.length > 0) alerts.push({ level: 'PENDING', text: 'Trainees ko Chest Number assign karna baaki', count: chestPending.length, action: 'Assign Chest', onClick: () => navigate('/trainees') });
  if (docStats.pending > 0) alerts.push({ level: 'PENDING', text: 'Required documents abhi pending/upload baaki', count: docStats.pending, action: 'Document Cell', onClick: () => navigate('/documents') });
  if (docStats.noDocsYet.length > 0) alerts.push({ level: 'PENDING', text: 'Trainees ka document record shuru hi nahi hua', count: docStats.noDocsYet.length, action: 'Start Verification', onClick: () => navigate('/documents') });

  const levelStyle: Record<Alert['level'], { chip: string; border: string }> = {
    CRITICAL: { chip: 'bg-red-600 text-white', border: 'border-l-red-600 bg-red-50/60' },
    TODAY: { chip: 'bg-amber-500 text-white', border: 'border-l-amber-500 bg-amber-50/60' },
    PENDING: { chip: 'bg-slate-400 text-white', border: 'border-l-slate-400 bg-slate-50' },
  };

  // ── SEARCH (loaded batch data par instant) ──
  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2) return [];
    return trainees.filter(t =>
      [t.chestNo, t.name, t.regNo, t.mobileNo, t.platoon].filter(Boolean).join(' ').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchTerm, trainees]);

  // ── RECENT ACTIVITY (real trainee timestamps se derived — koi fake log nahi) ──
  const recentActivity = useMemo(() => {
    const ev: { at: string; icon: React.ReactNode; text: string; who: string }[] = [];
    trainees.forEach(t => {
      const who = `${t.chestNo ? 'Chest ' + t.chestNo : (t.regNo ? 'Reg ' + t.regNo : '')} • ${t.name || ''}`;
      if (t.createdAt) ev.push({ at: t.createdAt, icon: <UserPlus size={12} className="text-green-600" />, text: 'New trainee registered', who });
      if (t.chestAssignedAt) ev.push({ at: t.chestAssignedAt, icon: <Target size={12} className="text-indigo-600" />, text: 'Chest number assigned', who });
      if (t.docsUpdatedDate) ev.push({ at: t.docsUpdatedDate, icon: <FileText size={12} className="text-blue-600" />, text: 'Documents updated', who });
      if (t.lastMedicalUpdate) ev.push({ at: t.lastMedicalUpdate, icon: <HeartPulse size={12} className="text-red-600" />, text: 'Medical status updated', who });
    });
    ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return ev.slice(0, 8);
  }, [trainees]);

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const isToday = d.toISOString().split('T')[0] === todayDate;
    return isToday
      ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const medSince = (traineeId?: string) => {
    const rec = medActive.find(m => m.traineeId === traineeId);
    return rec?.date || '—';
  };

  // ═══════════ RENDER ═══════════
  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-military-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4 pb-8">

      {/* ══════════ 1 · HEADER ══════════ */}
      <div className="bg-military-900 px-4 py-4 shadow-flat">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Activity size={24} className="text-white" />
            <div>
              <h1 className="text-base font-black text-white uppercase tracking-widest">
                {greeting}, {user?.name || 'Clerk'}
              </h1>
              <p className="text-[10px] text-military-300 uppercase tracking-wider mt-0.5">
                F Coy {activeBatch ? `• ${activeBatch.batchNumber}` : ''} • {todayFormatted}
              </p>
              <p className="text-[9.5px] text-military-400 mt-0.5">Aaj ki company administration ka poora overview.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeBatch ? (
              <span className="bg-green-800 border border-green-600 text-white text-[10px] font-black px-3 py-1.5 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <Layers size={12} /> {activeBatch.batchNumber}
              </span>
            ) : (
              <span className="bg-red-800 border border-red-600 text-white text-[10px] font-black px-3 py-1.5 uppercase">No Active Batch</span>
            )}
            <button onClick={fetchDashboardData}
              className="bg-military-800 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-military-700 flex items-center gap-1.5 border border-military-600">
              <RefreshCw size={12} /> Refresh
            </button>
            <ReportButton />
          </div>
        </div>
        {lastRefresh && <p className="text-[9px] text-military-400 mt-1 text-right">Last updated: {lastRefresh}</p>}
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="bg-red-50 border border-red-300 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-red-700 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
          <button onClick={fetchDashboardData} className="bg-red-700 text-white px-3 py-1.5 text-[10px] font-black uppercase">Retry</button>
        </div>
      )}

      {!hasBatch ? (
        <div className="bg-white border border-slate-300 shadow-flat">
          <EmptyLine
            icon={<Layers size={36} className="text-slate-300" />}
            text="Koi active batch nahi — pehle Company Commander se batch activate karwao"
            action={{ label: 'Batch Management', onClick: () => navigate('/batches') }}
          />
        </div>
      ) : (
        <>
          {/* ══════════ 2 · COMPANY STRENGTH ══════════ */}
          <div className="bg-white border border-slate-300 shadow-flat">
            <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-slate-200">
              <div className="px-4 py-3">
                <p className="text-[9px] font-black text-slate-500 uppercase">Total</p>
                <p className="text-3xl font-black text-military-900 leading-tight">{total}</p>
                <p className="text-[9px] text-slate-400 font-bold">Trainees</p>
              </div>
              <div className="px-4 py-3 bg-green-50/60 cursor-pointer hover:bg-green-50" onClick={() => setModal('unavail')}>
                <p className="text-[9px] font-black text-green-700 uppercase">Active</p>
                <p className="text-3xl font-black text-green-700 leading-tight">{active}<span className="text-sm text-slate-400 font-bold"> / {total}</span></p>
                <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${total ? (active / total) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="px-4 py-3 cursor-pointer hover:bg-purple-50" onClick={() => setModal('hospital')}>
                <p className="text-[9px] font-black text-purple-700 uppercase">Hospital</p>
                <p className={`text-3xl font-black leading-tight ${hospital.length ? 'text-purple-700' : 'text-slate-300'}`}>{hospital.length}</p>
                <p className="text-[9px] text-slate-400 font-bold">{sick.length > 0 ? `+ ${sick.length} Sick/MI` : 'Sick: 0'}</p>
              </div>
              <div className="px-4 py-3 cursor-pointer hover:bg-amber-50" onClick={() => setModal('leave')}>
                <p className="text-[9px] font-black text-amber-700 uppercase">Leave</p>
                <p className={`text-3xl font-black leading-tight ${leave.length ? 'text-amber-700' : 'text-slate-300'}`}>{leave.length}</p>
                <p className="text-[9px] text-slate-400 font-bold">{returningToday.length > 0 ? `${returningToday.length} aaj wapas` : 'Return today: 0'}</p>
              </div>
              <div className="px-4 py-3 cursor-pointer hover:bg-blue-50" onClick={() => setModal('light')}>
                <p className="text-[9px] font-black text-blue-700 uppercase">Light Duty</p>
                <p className={`text-3xl font-black leading-tight ${lightDuty.length ? 'text-blue-700' : 'text-slate-300'}`}>{lightDuty.length}</p>
                <p className="text-[9px] text-slate-400 font-bold">Rest / Excused</p>
              </div>
              <div className="px-4 py-3 cursor-pointer hover:bg-indigo-50" onClick={() => setModal('chest')}>
                <p className="text-[9px] font-black text-indigo-700 uppercase">Chest Pending</p>
                <p className={`text-3xl font-black leading-tight ${chestPending.length ? 'text-indigo-700' : 'text-slate-300'}`}>{chestPending.length}</p>
                <p className="text-[9px] text-slate-400 font-bold">{total - chestPending.length} assigned</p>
              </div>
            </div>
          </div>

          {/* ══════════ 7 · FIND TRAINEE (top accessible) ══════════ */}
          <div className="bg-white border border-slate-300 shadow-flat p-3 relative">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black text-military-900 uppercase tracking-wider flex items-center gap-1.5"><Search size={13} /> Find Trainee</span>
              <div className="relative flex-1 min-w-[240px]">
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Chest Number, Name ya Mobile se dhoondo..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 focus:outline-none focus:border-military-700 font-semibold"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"><X size={13} /></button>
                )}
              </div>
              <button onClick={() => navigate('/trainees')}
                className="bg-slate-100 border border-slate-300 text-military-800 px-3 py-2 text-[10px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5">
                Full List <ArrowRight size={11} />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 divide-y divide-slate-100">
                {searchResults.map(t => (
                  <button key={t.id} onClick={() => navigate(`/profile?search=${encodeURIComponent(t.regNo || t.chestNo || '')}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-military-50 text-left">
                    {t.photoURL
                      ? <img src={t.photoURL} className="w-8 h-9 object-cover object-top border border-slate-200" alt="" />
                      : <div className="w-8 h-9 bg-slate-100 border border-dashed border-slate-300" />}
                    <span className="font-mono text-xs font-black text-military-800 w-14">{t.chestNo || '—'}</span>
                    <span className="text-xs font-bold text-slate-800 flex-1 truncate">{t.name}</span>
                    <span className="text-[9px] font-bold text-slate-400 hidden sm:block">{t.platoon || ''}</span>
                    <span className={`text-[8.5px] font-black px-1.5 py-0.5 border ${t.docsComplete ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      DOCS {t.docsComplete ? 'OK' : 'PENDING'}
                    </span>
                    <span className={`text-[8.5px] font-black px-1.5 py-0.5 border ${!t.attn || t.attn === 'P' ? 'bg-green-50 text-green-700 border-green-200' : ABSENT_COLORS[t.attn]}`}>
                      {!t.attn || t.attn === 'P' ? 'ACTIVE' : ABSENT_LABELS[t.attn]}
                    </span>
                    <ArrowRight size={12} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══════════ 3 · NEEDS YOUR ATTENTION (HERO) ══════════ */}
          <div className="bg-white border-2 border-military-800 shadow-flat">
            <SectionHead
              icon={<AlertTriangle size={16} className="text-amber-400" />}
              title="Needs Your Attention"
              sub="Issues that require Clerk action"
              right={alerts.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full">{alerts.length}</span>
              )}
            />
            {alerts.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 size={34} className="text-green-500 mx-auto mb-2" />
                <p className="text-sm font-black text-green-700 uppercase">All Clear</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">No urgent administrative action is currently required.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {alerts.map((a, i) => (
                  <div key={i} className={`px-4 py-3 border-l-4 flex items-center gap-3 flex-wrap ${levelStyle[a.level].border}`}>
                    <span className={`text-[8.5px] font-black px-2 py-0.5 uppercase flex-shrink-0 ${levelStyle[a.level].chip}`}>
                      {a.level === 'TODAY' ? 'ACTION TODAY' : a.level}
                    </span>
                    <span className="text-2xl font-black text-military-900 w-10 text-center flex-shrink-0">{a.count}</span>
                    <span className="text-xs font-bold text-slate-700 flex-1 min-w-[180px]">{a.text}</span>
                    <button onClick={a.onClick}
                      className="bg-military-800 text-white px-3 py-1.5 text-[9.5px] font-black uppercase hover:bg-military-900 flex items-center gap-1.5 flex-shrink-0">
                      {a.action} <ArrowRight size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══════════ 4 · TODAY'S PROGRAM ══════════ */}
          <div className="bg-white border border-slate-300 shadow-flat">
            <SectionHead
              icon={<Calendar size={16} />}
              title={`Today's Program — ${todayDayName}`}
              sub={weeklyProgram ? `${weeklyProgram.weekName} (${weeklyProgram.fromDate} → ${weeklyProgram.toDate})` : undefined}
              right={
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2.5 py-1 uppercase ${weeklyProgram ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
                    {weeklyProgram ? 'Active' : 'Not Available'}
                  </span>
                  <button onClick={() => navigate('/weekly-program')}
                    className="bg-military-800 border border-military-600 text-white px-2.5 py-1 text-[9px] font-black uppercase hover:bg-military-700 hidden sm:block">
                    Full Program
                  </button>
                </div>
              }
            />
            {!weeklyProgram ? (
              <EmptyLine
                icon={<Calendar size={34} className="text-slate-300" />}
                text="Is hafte ka program available nahi hai"
                action={{ label: 'Create / Update Weekly Program', onClick: () => navigate('/weekly-program') }}
              />
            ) : todaySessions.length === 0 ? (
              <EmptyLine
                icon={<Calendar size={34} className="text-slate-300" />}
                text={todayDayName === 'Sunday' ? 'Sunday — Off Day / Rest Day' : 'Aaj ke liye koi session set nahi hai'}
                action={{ label: 'Open Weekly Program', onClick: () => navigate('/weekly-program') }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Time</th>
                      <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Training / Subject</th>
                      <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Platoon</th>
                      <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Ustad / Instructor</th>
                      <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySessions.map((s, i) => (
                      <tr key={s.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-black text-military-900">{s.time || '—'}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800">{sessionLabel(s)}</td>
                        <td className="px-4 py-2.5"><span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{s.platoon || '—'}</span></td>
                        <td className="px-4 py-2.5 text-xs font-bold text-blue-800">{instructorLabel(s)}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500 font-semibold">{s.location ? <span className="flex items-center gap-1"><MapPin size={10} />{s.location}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {weeklyProgram.remarks && (
                  <p className="px-4 py-2 text-[10px] font-bold text-amber-800 bg-amber-50 border-t border-amber-200">
                    WEEK REMARKS: {weeklyProgram.remarks}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ══════════ 5+6 · DOCUMENT CONTROL + MEDICAL (2-col) ══════════ */}
          <div className="grid lg:grid-cols-2 gap-4">

            {/* DOCUMENT CONTROL */}
            <div className="bg-white border border-slate-300 shadow-flat flex flex-col">
              <SectionHead icon={<FileText size={15} />} title="Document Control"
                right={
                  <span className={`text-sm font-black ${docStats.pct >= 80 ? 'text-green-400' : docStats.pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {docStats.pct}%
                  </span>
                } />
              <div className="p-4 space-y-3 flex-1">
                {docStats.required === 0 ? (
                  <EmptyLine icon={<FileText size={30} className="text-slate-300" />}
                    text="Abhi kisi trainee ka document record shuru nahi hua"
                    action={{ label: 'Open Document Cell', onClick: () => navigate('/documents') }} />
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                        <span className="text-slate-500">Overall Completion ({docStats.verified + docStats.uploaded}/{docStats.required} required)</span>
                        <span className="text-military-900">{docStats.pct}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div className={`h-full rounded-full ${docStats.pct >= 80 ? 'bg-green-500' : docStats.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${docStats.pct}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'Verified', v: docStats.verified, cls: 'text-green-700 bg-green-50 border-green-200' },
                        { label: 'Uploaded', v: docStats.uploaded, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
                        { label: 'Pending', v: docStats.pending, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
                        { label: 'Rejected', v: docStats.rejected, cls: 'text-red-700 bg-red-50 border-red-200' },
                      ].map(x => (
                        <div key={x.label} className={`border px-1 py-1.5 ${x.cls}`}>
                          <p className="text-lg font-black leading-tight">{x.v}</p>
                          <p className="text-[8px] font-black uppercase">{x.label}</p>
                        </div>
                      ))}
                    </div>
                    {docStats.issues.length > 0 && (
                      <div>
                        <p className="text-[9.5px] font-black text-slate-500 uppercase mb-1">Immediate Document Issues</p>
                        <div className="border border-slate-200 divide-y divide-slate-100 max-h-44 overflow-y-auto">
                          {docStats.issues.slice(0, 8).map((iss, i) => (
                            <button key={i} onClick={() => navigate(`/documents?search=${encodeURIComponent(iss.t.regNo || iss.t.chestNo || '')}`)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 text-left">
                              <span className="font-mono text-[10px] font-black text-military-800 w-10">{iss.t.chestNo || '—'}</span>
                              <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">{iss.t.name}</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[110px]">{iss.doc}</span>
                              <span className={`text-[8.5px] font-black px-1.5 py-0.5 ${iss.status === 'Rejected' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                                {iss.status.toUpperCase()}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <button onClick={() => navigate('/documents')}
                className="border-t border-slate-200 py-2.5 text-[10px] font-black uppercase text-military-800 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                View All Document Issues <ArrowRight size={11} />
              </button>
            </div>

            {/* MEDICAL & AVAILABILITY */}
            <div className="bg-white border border-slate-300 shadow-flat flex flex-col">
              <SectionHead icon={<Stethoscope size={15} />} title="Medical & Availability Status" />
              <div className="p-4 space-y-3 flex-1">

                {/* Hospital */}
                <div className="border border-purple-200 bg-purple-50/40">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100">
                    <span className="text-[10px] font-black text-purple-800 uppercase flex items-center gap-1.5"><BedDouble size={12} /> Hospital</span>
                    <span className="text-xl font-black text-purple-800">{hospital.length}</span>
                  </div>
                  {hospital.length === 0 ? (
                    <p className="px-3 py-2 text-[10px] font-bold text-slate-400">Koi trainee hospital me nahi hai.</p>
                  ) : (
                    <div className="divide-y divide-purple-100">
                      {hospital.slice(0, 4).map(t => (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                          <span className="font-mono text-[10px] font-black text-military-800 w-10">{t.chestNo || '—'}</span>
                          <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">{t.name}</span>
                          <span className="text-[9px] text-slate-500 font-semibold">Since {medSince(t.id)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Leave */}
                <div className="border border-amber-200 bg-amber-50/40">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-amber-100">
                    <span className="text-[10px] font-black text-amber-800 uppercase flex items-center gap-1.5"><CalendarClock size={12} /> Leave</span>
                    <span className="text-xl font-black text-amber-800">{leave.length}</span>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    {returningToday.length > 0 ? (
                      <p className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-1">
                        ✓ {returningToday.length} trainee(s) AAJ wapas expected: {returningToday.map(r => r.traineeName || r.chestNo).filter(Boolean).slice(0, 3).join(', ')}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-400">Aaj koi return expected nahi.</p>
                    )}
                    {returningSoon.length > 0 && (
                      <p className="text-[9.5px] text-slate-500 font-semibold">
                        Jaldi wapas: {returningSoon.map(r => `${r.traineeName || r.chestNo} (${r.toDate})`).slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Light duty + Sick row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-blue-200 bg-blue-50/40 px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-800 uppercase">Light Duty / Rest</span>
                    <span className="text-xl font-black text-blue-800">{lightDuty.length}</span>
                  </div>
                  <div className="border border-orange-200 bg-orange-50/40 px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-orange-800 uppercase">Sick / MI Room</span>
                    <span className="text-xl font-black text-orange-800">{sick.length}</span>
                  </div>
                </div>
                {absent.length > 0 && (
                  <div className="border border-red-200 bg-red-50/50 px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-red-800 uppercase flex items-center gap-1.5"><UserX size={12} /> Absent (unauthorized)</span>
                    <span className="text-xl font-black text-red-800">{absent.length}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-slate-200 grid grid-cols-2 divide-x divide-slate-200">
                <button onClick={() => navigate('/medical-register')}
                  className="py-2.5 text-[10px] font-black uppercase text-military-800 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                  Hospital / Medical <ArrowRight size={11} />
                </button>
                <button onClick={() => navigate('/absent-management')}
                  className="py-2.5 text-[10px] font-black uppercase text-military-800 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                  Leave Records <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ 8 · PENDING WORK + 9 · RECENT ACTIVITY ══════════ */}
          <div className="grid lg:grid-cols-2 gap-4">

            {/* PENDING WORK */}
            <div className="bg-white border border-slate-300 shadow-flat">
              <SectionHead icon={<ClipboardList size={15} />} title="Your Pending Work" sub="Jo kaam abhi baaki hai" />
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Rejected documents — correct & re-verify', count: docStats.rejected, to: '/documents', urgent: true },
                  { label: 'Trainees with incomplete documents', count: docIncompleteTrainees.length, to: '/documents', urgent: false },
                  { label: 'Chest numbers to assign', count: chestPending.length, to: '/trainees', urgent: false },
                  { label: 'Hospital cases to review', count: hospital.length, to: '/medical-register', urgent: hospital.length > 0 },
                  { label: 'Leave returns to process today', count: returningToday.length, to: '/absent-management', urgent: returningToday.length > 0 },
                  { label: 'Weekly program', count: weeklyProgram ? 0 : 1, to: '/weekly-program', urgent: !weeklyProgram },
                ].filter(w => w.count > 0).length === 0 ? (
                  <EmptyLine text="Koi pending kaam nahi — sab up to date!" />
                ) : (
                  [
                    { label: 'Rejected documents — correct & re-verify', count: docStats.rejected, to: '/documents', urgent: true },
                    { label: 'Trainees with incomplete documents', count: docIncompleteTrainees.length, to: '/documents', urgent: false },
                    { label: 'Chest numbers to assign', count: chestPending.length, to: '/trainees', urgent: false },
                    { label: 'Hospital cases to review', count: hospital.length, to: '/medical-register', urgent: hospital.length > 0 },
                    { label: 'Leave returns to process today', count: returningToday.length, to: '/absent-management', urgent: returningToday.length > 0 },
                    { label: 'Weekly program not created', count: weeklyProgram ? 0 : 1, to: '/weekly-program', urgent: !weeklyProgram },
                  ].filter(w => w.count > 0).map((w, i) => (
                    <button key={i} onClick={() => navigate(w.to)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left">
                      <span className={`text-lg font-black w-8 text-center ${w.urgent ? 'text-red-700' : 'text-military-900'}`}>{w.count}</span>
                      <span className="text-xs font-bold text-slate-700 flex-1">{w.label}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="bg-white border border-slate-300 shadow-flat flex flex-col">
              <SectionHead icon={<History size={15} />} title="Recent Activity" sub="System me haal ke administrative badlav" />
              <div className="flex-1">
                {recentActivity.length === 0 ? (
                  <EmptyLine icon={<History size={30} className="text-slate-300" />} text="Abhi koi recent activity nahi" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentActivity.map((ev, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2">
                        <span className="flex-shrink-0">{ev.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-700">{ev.text}</p>
                          <p className="text-[9.5px] text-slate-400 font-semibold truncate">{ev.who}</p>
                        </div>
                        <span className="text-[9.5px] font-black text-slate-400 flex-shrink-0">{fmtWhen(ev.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══════════ 10 · QUICK ACTIONS ══════════ */}
          <div className="bg-white border border-slate-300 shadow-flat p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'Add Trainee', icon: UserPlus, to: '/profile' },
                { label: 'Trainee List', icon: Users, to: '/trainees' },
                { label: 'Verify Documents', icon: FilePlus2, to: '/documents' },
                { label: 'Weekly Program', icon: Calendar, to: '/weekly-program' },
                { label: 'Hospital Record', icon: HeartPulse, to: '/medical-register' },
                { label: 'Manage Leave', icon: CalendarClock, to: '/absent-management' },
              ].map(a => (
                <button key={a.to + a.label} onClick={() => navigate(a.to)}
                  className="border border-slate-300 bg-slate-50 hover:bg-military-800 hover:text-white text-slate-700 px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors">
                  <a.icon size={14} /> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* ══════════ MODALS ══════════ */}
          <ListModal
            open={modal === 'unavail'} onClose={() => setModal('')}
            title="Unavailable Trainees" icon={<UserX size={18} className="text-white" />}
            headerColor="bg-red-800" trainees={unavailable}
            emptyMessage="Sab Present hain — All Clear!"
            columns={[
              { label: 'Chest / Reg', render: t => <span className="font-mono font-bold text-military-800">{t.chestNo || '—'} <span className="text-[9px] text-slate-400">({t.regNo})</span></span> },
              { label: 'Name', render: t => <span className="font-bold text-slate-800">{t.rank || 'RCT'} {t.name}</span> },
              { label: 'Platoon', render: t => <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span> },
              { label: 'Status', render: t => <span className={`px-2 py-0.5 text-[10px] font-bold border ${ABSENT_COLORS[t.attn || 'A']}`}>{ABSENT_LABELS[t.attn || 'A']}</span> },
            ]}
          />
          <ListModal
            open={modal === 'hospital'} onClose={() => setModal('')}
            title="Hospital Cases" icon={<BedDouble size={18} className="text-white" />}
            headerColor="bg-purple-800" trainees={hospital}
            emptyMessage="Koi trainee hospital me nahi — All Clear!"
            columns={[
              { label: 'Chest / Reg', render: t => <span className="font-mono font-bold text-military-800">{t.chestNo || '—'} <span className="text-[9px] text-slate-400">({t.regNo})</span></span> },
              { label: 'Name', render: t => <span className="font-bold text-slate-800">{t.name}</span> },
              { label: 'Since', render: t => <span className="text-[10px] font-bold text-slate-600">{medSince(t.id)}</span> },
              { label: 'Med Status', render: t => <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 text-[10px] font-bold">{t.medStat || '—'}</span> },
            ]}
          />
          <ListModal
            open={modal === 'leave'} onClose={() => setModal('')}
            title="On Leave" icon={<CalendarClock size={18} className="text-white" />}
            headerColor="bg-amber-700" trainees={leave}
            emptyMessage="Koi trainee leave par nahi."
            columns={[
              { label: 'Chest / Reg', render: t => <span className="font-mono font-bold text-military-800">{t.chestNo || '—'} <span className="text-[9px] text-slate-400">({t.regNo})</span></span> },
              { label: 'Name', render: t => <span className="font-bold text-slate-800">{t.name}</span> },
              { label: 'Return Date', render: t => {
                const rec = absActive.find(a => a.traineeId === t.id && a.type === 'L');
                const isToday = rec?.toDate === todayDate;
                return <span className={`text-[10px] font-black ${isToday ? 'text-green-700' : 'text-slate-600'}`}>{rec?.toDate || '—'}{isToday ? ' (AAJ)' : ''}</span>;
              } },
              { label: 'Reason', render: t => {
                const rec = absActive.find(a => a.traineeId === t.id && a.type === 'L');
                return <span className="text-[10px] text-slate-500">{rec?.reason || '—'}</span>;
              } },
            ]}
          />
          <ListModal
            open={modal === 'light'} onClose={() => setModal('')}
            title="Light Duty / Rest" icon={<Shield size={18} className="text-white" />}
            headerColor="bg-blue-800" trainees={lightDuty}
            emptyMessage="Koi trainee light duty par nahi."
            columns={[
              { label: 'Chest / Reg', render: t => <span className="font-mono font-bold text-military-800">{t.chestNo || '—'} <span className="text-[9px] text-slate-400">({t.regNo})</span></span> },
              { label: 'Name', render: t => <span className="font-bold text-slate-800">{t.name}</span> },
              { label: 'Med Status', render: t => <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 text-[10px] font-bold">{t.medStat || '—'}</span> },
              { label: 'Remarks', render: t => <span className="text-[10px] text-slate-500">{t.medRemarks || t.remarks || '—'}</span> },
            ]}
          />
          <ListModal
            open={modal === 'chest'} onClose={() => setModal('')}
            title="Chest Number Pending" icon={<Target size={18} className="text-white" />}
            headerColor="bg-indigo-800" trainees={chestPending}
            emptyMessage="Sab trainees ko Chest No assigned hai — All Clear!"
            columns={[
              { label: 'Reg No', render: t => <span className="font-mono font-bold text-military-800">{t.regNo || '—'}</span> },
              { label: 'Name', render: t => <span className="font-bold text-slate-800">{t.rank || 'RCT'} {t.name}</span> },
              { label: 'Platoon', render: t => <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span> },
              { label: 'Action', render: () => (
                <button onClick={() => navigate(`/trainees`)}
                  className="bg-indigo-600 text-white px-2.5 py-1 text-[9px] font-black uppercase hover:bg-indigo-700">Assign</button>
              ) },
            ]}
          />
        </>
      )}
    </div>
  );
};
