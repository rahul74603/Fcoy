// D:\ALL PROJECTS\BSF COYs\frontend\src\features\dashboard\ClerkDashboard.tsx

import React, { useState, useEffect } from 'react';
import {
  Users, UserX, AlertTriangle, FileText, Shield, Clock,
  ChevronDown, ChevronUp, X, MapPin, Target, BookOpen,
  CheckCircle2, XCircle, ArrowRightLeft, Activity, Layers,
  TrendingUp, TrendingDown, Loader2, RefreshCw, Calendar,
  Heart, Award, Crosshair, AlertCircle, Eye
} from 'lucide-react';
import {
  collection, getDocs, query, where, orderBy
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { useNavigate } from 'react-router-dom';

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
  fptResult?: string;
  fptScore?: string;
  weeklyExamResult?: string;
  weeklyExamMarks?: string;
  documents?: Record<string, any>;
  docsComplete?: boolean;
  batchId?: string;
  remarks?: string;
  rank?: string;
  photoURL?: string;
  bloodGroup?: string;
  [key: string]: any;
}

interface UdhariRecord {
  id: string;
  ustadName: string;
  ustadRank: string;
  category: string;
  fromCoy: string;
  toCoy: string;
  reason: string;
  eventDetail: string;
  date: string;
  returnDate?: string;
  status: 'Active' | 'Returned';
  direction: 'given' | 'taken'; // ✅ NEW: Diya ya Liya
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
  ustadNames?: string[];
  lectureDetails?: {
    topic?: string;
    description?: string;
    duration?: string;
    materials?: string;
  };
}

interface DaySchedule {
  day: string;
  sessions: TodaySession[];
}

interface WeeklyProgram {
  id: string;
  weekName: string;
  fromDate: string;
  toDate: string;
  remarks: string;
  schedule: DaySchedule[];
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const DAYS_MAP: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday'
};

const ABSENT_TYPES = ['A', 'L', 'S', 'H', 'R'];

const ABSENT_LABELS: Record<string, string> = {
  'A': 'Absent',
  'L': 'On Leave',
  'S': 'Sick / MI Room',
  'H': 'Hospitalized',
  'R': 'Rest / Excused'
};

const ABSENT_COLORS: Record<string, string> = {
  'A': 'bg-red-100 text-red-800 border-red-300',
  'L': 'bg-amber-100 text-amber-800 border-amber-300',
  'S': 'bg-orange-100 text-orange-800 border-orange-300',
  'H': 'bg-purple-100 text-purple-800 border-purple-300',
  'R': 'bg-blue-100 text-blue-800 border-blue-300'
};

// ─────────────────────────────────────────────
// LIST MODAL COMPONENT
// ─────────────────────────────────────────────
interface ListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  headerColor: string;
  trainees: TraineeBasic[];
  columns: { label: string; render: (t: TraineeBasic) => React.ReactNode }[];
  emptyMessage?: string;
}

const ListModal: React.FC<ListModalProps> = ({
  open, onClose, title, icon, headerColor, trainees, columns, emptyMessage
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-300"
        onClick={e => e.stopPropagation()}>

        <div className={`${headerColor} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
              <p className="text-[10px] text-white/70">{trainees.length} Records</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {trainees.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500 uppercase">
                {emptyMessage || 'Koi record nahi hai — All Clear!'}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">S.No</th>
                  {columns.map((col, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainees.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                    {columns.map((col, i) => (
                      <td key={i} className="px-3 py-2">{col.render(t)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex justify-between items-center flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase">
            Total: {trainees.length} Records
          </span>
          <button onClick={onClose}
            className="bg-slate-700 text-white px-4 py-1.5 text-[10px] font-bold uppercase hover:bg-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// STAT CARD COMPONENT
// ─────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  onClick?: () => void;
  clickable?: boolean;
  badge?: string;
  badgeColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon, color, borderColor,
  onClick, clickable = false, badge, badgeColor
}) => (
  <div
    onClick={clickable ? onClick : undefined}
    className={`bg-white border border-slate-300 shadow-flat p-4 border-t-3 ${borderColor}
      ${clickable ? 'cursor-pointer hover:shadow-md hover:border-slate-400 transition-all group' : ''}
      relative`}
  >
    {clickable && (
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Eye size={14} className="text-slate-400" />
      </div>
    )}
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
        {subtitle && (
          <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{subtitle}</p>
        )}
        {badge && (
          <span className={`inline-block mt-1.5 text-[9px] font-bold uppercase px-2 py-0.5 ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="ml-3 flex-shrink-0">{icon}</div>
    </div>
    {clickable && (
      <p className="text-[8px] text-blue-500 font-bold mt-2 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
        Click to view details →
      </p>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════
export const ClerkDashboard: React.FC = () => {
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  // ── Data States ──
  const [trainees, setTrainees]             = useState<TraineeBasic[]>([]);
  const [todaySessions, setTodaySessions]   = useState<TodaySession[]>([]);
  const [weeklyProgram, setWeeklyProgram]   = useState<WeeklyProgram | null>(null);
  const [udhariRecords, setUdhariRecords]   = useState<UdhariRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [lastRefresh, setLastRefresh]       = useState<string>('');

  // ── Modal States ──
  const [absentModal, setAbsentModal]       = useState(false);
  const [failedExamModal, setFailedExamModal] = useState(false);
  const [fptModal, setFptModal]             = useState(false);
  const [incDocsModal, setIncDocsModal]     = useState(false);
  const [udhariModal, setUdhariModal]       = useState(false);
const navigate = useNavigate();
  // ── Today info ──
  const todayDayName = DAYS_MAP[new Date().getDay()] || 'Sunday';
  const todayDate    = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── Fetch All Data ──
  const fetchDashboardData = async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true);

    try {
      // 1. Fetch trainees of active batch
      const tq = query(
        collection(db, 'trainees'),
        where('batchId', '==', activeBatch.id)
      );
      const tSnap = await getDocs(tq);
      const tList: TraineeBasic[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as TraineeBasic));
      setTrainees(tList);

      // 2. Fetch weekly programs — find current week's program
      const wpq = query(
        collection(db, 'weeklyPrograms'),
        where('batchId', '==', activeBatch.id),
        orderBy('fromDate', 'desc')
      );
      const wpSnap = await getDocs(wpq);

      let foundProgram: WeeklyProgram | null = null;
      let foundSessions: TodaySession[] = [];

      wpSnap.forEach(d => {
        if (foundProgram) return; // pehla match le lo

        const raw = d.data();
        const prog: WeeklyProgram = {
          id:       d.id,
          weekName: raw.weekName || '',
          fromDate: raw.fromDate || '',
          toDate:   raw.toDate   || '',
          remarks:  raw.remarks  || '',
          schedule: (raw.schedule || []) as DaySchedule[],
        };

        // Check if today falls in this program's range
        if (todayDate >= prog.fromDate && todayDate <= prog.toDate) {
          foundProgram = prog;
        }
      });

      // Agar exact match nahi mila, latest le lo
      if (!foundProgram && !wpSnap.empty) {
        const firstDoc = wpSnap.docs[0];
        const raw = firstDoc.data();
        foundProgram = {
          id:       firstDoc.id,
          weekName: raw.weekName || '',
          fromDate: raw.fromDate || '',
          toDate:   raw.toDate   || '',
          remarks:  raw.remarks  || '',
          schedule: (raw.schedule || []) as DaySchedule[],
        };
      }

      if (foundProgram) {
        setWeeklyProgram(foundProgram);
        // Find today's day sessions
        const todaySchedule = foundProgram.schedule.find(
          (s: DaySchedule) => s.day === todayDayName
        );
        if (todaySchedule) {
          foundSessions = todaySchedule.sessions || [];
        }
      }
      setTodaySessions(foundSessions);

      // 3. Fetch Udhari records (active)
      const uq = query(
        collection(db, 'udhariRecords'),
        where('status', '==', 'Active')
      );
      const uSnap = await getDocs(uq);
      const uList: UdhariRecord[] = [];
      uSnap.forEach(d => {
        const data = d.data();
        uList.push({
          id:          d.id,
          ustadName:   data.ustadName   || '',
          ustadRank:   data.ustadRank   || '',
          category:    data.category    || '',
          fromCoy:     data.fromCoy     || '',
          toCoy:       data.toCoy       || '',
          reason:      data.reason      || '',
          eventDetail: data.eventDetail || '',
          date:        data.date        || '',
          returnDate:  data.returnDate  || '',
          status:      data.status      || 'Active',
          direction:   data.direction   || 'taken', // default
        } as UdhariRecord);
      });
      setUdhariRecords(uList);

      setLastRefresh(new Date().toLocaleTimeString('en-IN'));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeBatch]);

  // ── Computed Data ──
  const totalTrainees   = trainees.length;
  const presentTrainees = trainees.filter(t => t.attn === 'P' || !t.attn);
  const absentTrainees  = trainees.filter(t => t.attn && ABSENT_TYPES.includes(t.attn));

  const failedExam      = trainees.filter(t => t.weeklyExamResult === 'Fail');
  const fptFailed       = trainees.filter(t => t.fptResult === 'Fail');
  const fptPassed       = trainees.filter(t => t.fptResult === 'Pass');

  const incompleteDocTrainees = trainees.filter(t => {
    if (t.docsComplete === true) return false;
    if (t.docsComplete === false) return true;
    if (!t.documents) return true;
    const entries = Object.entries(t.documents);
    if (entries.length === 0) return true;
    const required = entries.filter(([, v]: any) => v?.isRequired);
    const pending  = required.filter(([, v]: any) =>
      v?.status === 'Pending' || v?.status === 'Rejected'
    );
    return pending.length > 0;
  });

  // Udhari: Given vs Taken
  const udhariGiven = udhariRecords.filter(r => r.direction === 'given');
  const udhariTaken = udhariRecords.filter(r => r.direction === 'taken');

  // ── Display Helpers ──
  const getDisplaySubject = (session: TodaySession) => {
    if (session.subject === 'Other (Manual)' && session.customSubject) {
      return session.customSubject;
    }
    return session.subject;
  };

  const renderPersons = (session: TodaySession) => {
    if (session.assignedPersons && Array.isArray(session.assignedPersons)) {
      const filled = session.assignedPersons.filter(p => p.name?.trim());
      if (filled.length === 0) return <span className="text-slate-400">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {filled.map(p => (
            <span key={p.id} className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5">
              <Shield size={7} className="text-military-600" />
              {p.rank && <span className="text-military-700">{p.rank}</span>}
              <span>{p.name}</span>
            </span>
          ))}
        </div>
      );
    }
    if (session.ustadName) {
      return <span className="font-bold text-blue-800 text-[10px]">{session.ustadName}</span>;
    }
    if (session.ustadNames && Array.isArray(session.ustadNames)) {
      return (
        <div className="flex flex-wrap gap-1">
          {session.ustadNames.filter(u => u.trim()).map((u, i) => (
            <span key={i} className="text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5">
              {u}
            </span>
          ))}
        </div>
      );
    }
    return <span className="text-slate-400">—</span>;
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-military-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4 pb-8">

      {/* ── NO BATCH WARNING ── */}
      {!hasBatch && (
        <div className="bg-red-900 border border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-300 flex-shrink-0 animate-pulse" />
          <span className="text-[11px] font-black text-red-200 uppercase tracking-wide">
            Koi Active Batch Nahi! Pehle Batch Management mein batch activate karo.
          </span>
        </div>
      )}

      {/* ── DASHBOARD HEADER ── */}
      <div className="bg-military-900 px-4 py-4 shadow-flat">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={22} className="text-white" />
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-widest">
                Clerk Dashboard — Daily Overview
              </h1>
              <p className="text-[10px] text-military-300 uppercase tracking-wider mt-0.5">
                {todayFormatted}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeBatch && (
              <span className="bg-green-800 border border-green-600 text-white text-[10px] font-black px-3 py-1 uppercase flex items-center gap-1.5">
                <Layers size={12} /> {activeBatch.batchNumber} — {activeBatch.batchName}
              </span>
            )}
            <button onClick={fetchDashboardData}
              className="bg-military-800 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-military-700 flex items-center gap-1.5 border border-military-600">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
        {lastRefresh && (
          <p className="text-[9px] text-military-400 mt-1 text-right">
            Last refreshed: {lastRefresh}
          </p>
        )}
      </div>

      {/* ── STAT CARDS ROW ── */}
      {hasBatch && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          <StatCard
            title="Total Strength"
            value={totalTrainees}
            subtitle={`${presentTrainees.length} Present`}
            icon={<Users size={28} className="text-military-400" />}
            color="text-military-900"
            borderColor="border-t-military-700"
          />

          <StatCard
  title="Absent / Away"
  value={absentTrainees.length}
  subtitle={absentTrainees.length === 0 ? 'All Present ✓' : 'Click to manage'}
  icon={<UserX size={28} className="text-red-400" />}
  color={absentTrainees.length > 0 ? 'text-red-700' : 'text-green-700'}
  borderColor="border-t-red-500"
  clickable
  onClick={() => navigate('/absent-management')}
  badge={absentTrainees.length > 0 ? `${absentTrainees.length} Away` : undefined}
  badgeColor="bg-red-100 text-red-700"
/>

          <StatCard
  title="Weekly Test Failed"
  value={failedExam.length}
  subtitle={failedExam.length === 0 ? 'All Passed ✓' : 'Click to manage'}
  icon={<Award size={28} className="text-amber-400" />}
  color={failedExam.length > 0 ? 'text-amber-700' : 'text-green-700'}
  borderColor="border-t-amber-500"
  clickable
  onClick={() => navigate('/weekly-test-tracker')}
/>

         {/* 4. FPT Failed — Navigate to FPTTracker */}
<StatCard
  title="FPT Failed"
  value={fptFailed.length}
  subtitle={`${fptPassed.length} Pass / ${fptFailed.length} Fail`}
  icon={<Crosshair size={28} className="text-orange-400" />}
  color={fptFailed.length > 0 ? 'text-orange-700' : 'text-green-700'}
  borderColor="border-t-orange-500"
  clickable
  onClick={() => navigate('/fpt-tracker')}
  badge={fptPassed.length > 0 ? `${fptPassed.length} Pass` : undefined}
  badgeColor="bg-green-100 text-green-700"
/>

          <StatCard
  title="Docs Incomplete"
  value={incompleteDocTrainees.length}
  subtitle={incompleteDocTrainees.length === 0 ? 'All Complete ✓' : 'Click to verify'}
  icon={<FileText size={28} className="text-purple-400" />}
  color={incompleteDocTrainees.length > 0 ? 'text-purple-700' : 'text-green-700'}
  borderColor="border-t-purple-500"
  clickable
  onClick={() => navigate('/documents')}
/>

          <StatCard
  title="Ustad Len-Den"
  value={udhariRecords.length}
  subtitle={
    udhariRecords.length === 0
      ? 'No active udhari'
      : `↗${udhariGiven.length} Diye  ↙${udhariTaken.length} Liye`
  }
  icon={<ArrowRightLeft size={28} className="text-cyan-400" />}
  color={udhariRecords.length > 0 ? 'text-cyan-700' : 'text-slate-500'}
  borderColor="border-t-cyan-500"
  clickable
  onClick={() => navigate('/deployment')}
/>
        </div>
      )}

      {/* ── TODAY'S PROGRAM SECTION ── */}
      {hasBatch && (
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-white" />
              <div>
                <h2 className="text-xs font-black text-white uppercase tracking-widest">
                  Today's Training Program — {todayDayName}
                </h2>
                {weeklyProgram && (
                  <p className="text-[10px] text-military-300 mt-0.5">
                    {weeklyProgram.weekName} ({weeklyProgram.fromDate} to {weeklyProgram.toDate})
                  </p>
                )}
              </div>
            </div>
            <span className="bg-military-800 text-white text-[10px] font-bold px-3 py-1 border border-military-600">
              {todaySessions.length} Classes Today
            </span>
          </div>

          {todaySessions.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500 uppercase">
                {todayDayName === 'Sunday'
                  ? 'Sunday — Off Day / Rest Day'
                  : 'Aaj ka koi program set nahi hai'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Weekly Program Screen se schedule banayein
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase w-8">S.No</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">
                      <Clock size={10} className="inline mr-1" />Time
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">
                      <Target size={10} className="inline mr-1" />Subject
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">
                      <Users size={10} className="inline mr-1" />Platoon
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">
                      <Shield size={10} className="inline mr-1" />Instructor(s)
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">
                      <MapPin size={10} className="inline mr-1" />Location
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todaySessions.map((session, idx) => (
                    <tr key={session.id || idx} className="hover:bg-slate-50 align-top">
                      <td className="px-3 py-2.5 text-slate-400 font-mono font-bold">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-military-700 whitespace-nowrap">
                        {session.time}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-slate-800">{getDisplaySubject(session)}</span>
                        {session.lectureDetails && (session.lectureDetails.topic || session.lectureDetails.description) && (
                          <div className="mt-1 bg-purple-50 border border-purple-200 p-1.5 rounded-sm">
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px]">
                              {session.lectureDetails.topic && (
                                <span><strong className="text-purple-700">Topic:</strong> {session.lectureDetails.topic}</span>
                              )}
                              {session.lectureDetails.duration && (
                                <span><strong className="text-purple-700">Duration:</strong> {session.lectureDetails.duration}</span>
                              )}
                              {session.lectureDetails.description && (
                                <span className="block w-full"><strong className="text-purple-700">Details:</strong> {session.lectureDetails.description}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 text-[10px] font-bold">
                          {session.platoon}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{renderPersons(session)}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-[10px]">{session.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {weeklyProgram?.remarks && (
            <div className="border-t border-slate-200 bg-amber-50 px-4 py-2">
              <p className="text-[10px] text-amber-800">
                <strong className="uppercase">Week Remarks:</strong> {weeklyProgram.remarks}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── NO BATCH PLACEHOLDER ── */}
      {!hasBatch && (
        <div className="bg-slate-50 border border-slate-200 p-12 text-center">
          <Shield size={48} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 uppercase">
            Dashboard activate karne ke liye pehle Batch create karo
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Batch Management → Create New Batch
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODALS
          ═══════════════════════════════════════ */}

      {/* 1. ABSENT */}
      <ListModal
        open={absentModal}
        onClose={() => setAbsentModal(false)}
        title="Absent / Not Present Trainees"
        icon={<UserX size={18} className="text-white" />}
        headerColor="bg-red-800"
        trainees={absentTrainees}
        emptyMessage="Sab Present hain — All Clear!"
        columns={[
          {
            label: 'Chest / Reg',
            render: t => (
              <div>
                <span className="font-mono font-bold text-military-800">{t.chestNo || '—'}</span>
                <span className="text-[9px] text-slate-400 ml-1">({t.regNo})</span>
              </div>
            )
          },
          {
            label: 'Rank & Name',
            render: t => <span className="font-bold text-slate-800">{t.rank || 'RCT'} {t.name}</span>
          },
          {
            label: 'Platoon',
            render: t => <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span>
          },
          {
            label: 'Status',
            render: t => {
              const attn = t.attn || 'A';
              return (
                <span className={`px-2 py-0.5 text-[10px] font-bold border ${ABSENT_COLORS[attn] || ABSENT_COLORS['A']}`}>
                  {ABSENT_LABELS[attn] || attn}
                </span>
              );
            }
          },
          {
            label: 'Remarks',
            render: t => <span className="text-[10px] text-slate-500">{t.remarks || '—'}</span>
          },
        ]}
      />

      {/* 2. WEEKLY TEST FAILED */}
      <ListModal
        open={failedExamModal}
        onClose={() => setFailedExamModal(false)}
        title="Weekly Test — Failed Trainees"
        icon={<Award size={18} className="text-white" />}
        headerColor="bg-amber-800"
        trainees={failedExam}
        emptyMessage="Sabne Pass kiya — All Clear!"
        columns={[
          {
            label: 'Chest / Reg',
            render: t => (
              <div>
                <span className="font-mono font-bold text-military-800">{t.chestNo || '—'}</span>
                <span className="text-[9px] text-slate-400 ml-1">({t.regNo})</span>
              </div>
            )
          },
          {
            label: 'Name',
            render: t => <span className="font-bold text-slate-800">{t.rank || 'RCT'} {t.name}</span>
          },
          {
            label: 'Platoon',
            render: t => <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span>
          },
          {
            label: 'Exam Marks',
            render: t => <span className="font-mono font-bold text-red-700">{t.weeklyExamMarks || 'N/A'}</span>
          },
          {
            label: 'FPT Status',
            render: t => (
              <span className={`px-2 py-0.5 text-[9px] font-bold ${
                t.fptResult === 'Pass' ? 'bg-green-100 text-green-700' :
                t.fptResult === 'Fail' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                FPT: {t.fptResult || 'Not Done'}
              </span>
            )
          },
          {
            label: 'Remarks',
            render: t => <span className="text-[10px] text-slate-500">{t.remarks || '—'}</span>
          },
        ]}
      />

      {/* 3. FPT FAILED */}
      <ListModal
        open={fptModal}
        onClose={() => setFptModal(false)}
        title="FPT — Failed Trainees"
        icon={<Crosshair size={18} className="text-white" />}
        headerColor="bg-orange-800"
        trainees={fptFailed}
        emptyMessage="Sabne FPT pass kiya — All Clear!"
        columns={[
          {
            label: 'Chest / Reg',
            render: t => (
              <div>
                <span className="font-mono font-bold text-military-800">{t.chestNo || '—'}</span>
                <span className="text-[9px] text-slate-400 ml-1">({t.regNo})</span>
              </div>
            )
          },
          {
            label: 'Name',
            render: t => <span className="font-bold text-slate-800">{t.rank || 'RCT'} {t.name}</span>
          },
          {
            label: 'Platoon',
            render: t => <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span>
          },
          {
            label: 'FPT Score',
            render: t => <span className="font-mono font-bold text-red-700">{t.fptScore || 'N/A'}</span>
          },
          {
            label: 'FPT Result',
            render: t => (
              <span className="bg-red-600 text-white px-2 py-0.5 text-[9px] font-bold uppercase">FAIL</span>
            )
          },
          {
            label: 'Weekly Exam',
            render: t => (
              <span className={`px-2 py-0.5 text-[9px] font-bold ${
                t.weeklyExamResult === 'Pass' ? 'bg-green-100 text-green-700' :
                t.weeklyExamResult === 'Fail' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {t.weeklyExamResult || 'Not Given'}
              </span>
            )
          },
        ]}
      />

      {/* 4. INCOMPLETE DOCUMENTS */}
      <ListModal
        open={incDocsModal}
        onClose={() => setIncDocsModal(false)}
        title="Incomplete Documents — Pending Trainees"
        icon={<FileText size={18} className="text-white" />}
        headerColor="bg-purple-800"
        trainees={incompleteDocTrainees}
        emptyMessage="Sabke documents complete hain — All Clear!"
        columns={[
          {
            label: 'Chest / Reg',
            render: t => (
              <div>
                <span className="font-mono font-bold text-military-800">{t.chestNo || '—'}</span>
                <span className="text-[9px] text-slate-400 ml-1">({t.regNo})</span>
              </div>
            )
          },
          {
            label: 'Name',
            render: t => <span className="font-bold text-slate-800">{t.rank || 'RCT'} {t.name}</span>
          },
          {
            label: 'Platoon',
            render: t => <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t.platoon || '—'}</span>
          },
          {
            label: 'Doc Status',
            render: t => {
              if (!t.documents) {
                return <span className="bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-bold">NO DOCS</span>;
              }
              const entries  = Object.entries(t.documents);
              const required = entries.filter(([, v]: any) => v?.isRequired);
              const done     = required.filter(([, v]: any) =>
                v?.status === 'Uploaded' || v?.status === 'Verified'
              );
              return (
                <span className="text-[10px] font-bold text-purple-700">{done.length}/{required.length} Done</span>
              );
            }
          },
          {
            label: 'Pending Docs',
            render: t => {
              if (!t.documents) return <span className="text-red-500 text-[9px]">All pending</span>;
              const pending = Object.entries(t.documents)
                .filter(([, v]: any) => v?.isRequired && (v?.status === 'Pending' || v?.status === 'Rejected'))
                .map(([k]) => k.replace(/([A-Z])/g, ' $1').trim());
              if (pending.length === 0) return <span className="text-slate-400 text-[9px]">—</span>;
              return (
                <div className="flex flex-wrap gap-1">
                  {pending.slice(0, 3).map((d, i) => (
                    <span key={i} className="text-[8px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5">{d}</span>
                  ))}
                  {pending.length > 3 && (
                    <span className="text-[8px] text-red-500 font-bold">+{pending.length - 3} more</span>
                  )}
                </div>
              );
            }
          },
        ]}
      />

      {/* 5. USTAD UDHARI MODAL — LENA + DENA */}
      {udhariModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setUdhariModal(false)}>
          <div className="bg-white w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-300"
            onClick={e => e.stopPropagation()}>

            <div className="bg-cyan-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-white" />
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Ustad Len-Den Register
                  </h3>
                  <p className="text-[10px] text-white/70">
                    {udhariRecords.length} Active | ↗ {udhariGiven.length} Diye | ↙ {udhariTaken.length} Liye
                  </p>
                </div>
              </div>
              <button onClick={() => setUdhariModal(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-0 border-b border-slate-200 flex-shrink-0">
              <div className="px-4 py-3 bg-slate-50 border-r border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Active</p>
                <p className="text-xl font-black text-cyan-700">{udhariRecords.length}</p>
              </div>
              <div className="px-4 py-3 bg-red-50 border-r border-slate-200 text-center">
                <p className="text-[10px] font-bold text-red-500 uppercase">↗ Diye (Given Out)</p>
                <p className="text-xl font-black text-red-700">{udhariGiven.length}</p>
                <p className="text-[9px] text-red-400">Apne Ustad dusri Coy ko diye</p>
              </div>
              <div className="px-4 py-3 bg-green-50 text-center">
                <p className="text-[10px] font-bold text-green-500 uppercase">↙ Liye (Taken In)</p>
                <p className="text-xl font-black text-green-700">{udhariTaken.length}</p>
                <p className="text-[9px] text-green-400">Dusri Coy se Ustad liye</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {udhariRecords.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500 uppercase">
                    Koi active udhari nahi — All Clear!
                  </p>
                </div>
              ) : (
                <>
                  {/* GIVEN OUT SECTION */}
                  {udhariGiven.length > 0 && (
                    <div>
                      <div className="bg-red-100 px-4 py-2 border-b border-red-200">
                        <h4 className="text-[10px] font-black text-red-800 uppercase flex items-center gap-1.5">
                          <TrendingUp size={12} /> Diye Gaye (Given Out) — Apne Ustad dusri Coy ko
                        </h4>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {['S.No', 'Rank & Name', 'Category', 'Hamari Coy', '→ Kis Coy Ko', 'Purpose', 'Date'].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {udhariGiven.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-red-50/30">
                              <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="px-3 py-2 font-bold text-slate-800">{r.ustadRank} {r.ustadName}</td>
                              <td className="px-3 py-2">
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 text-[9px] font-bold">{r.category}</span>
                              </td>
                              <td className="px-3 py-2 font-bold text-military-700">{r.fromCoy}</td>
                              <td className="px-3 py-2 font-bold text-red-600">→ {r.toCoy}</td>
                              <td className="px-3 py-2 text-slate-600 text-[10px]">{r.reason}</td>
                              <td className="px-3 py-2 font-mono text-[10px]">{r.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAKEN IN SECTION */}
                  {udhariTaken.length > 0 && (
                    <div>
                      <div className="bg-green-100 px-4 py-2 border-b border-green-200 border-t border-slate-200">
                        <h4 className="text-[10px] font-black text-green-800 uppercase flex items-center gap-1.5">
                          <TrendingDown size={12} /> Liye Gaye (Taken In) — Dusri Coy se hamare yahan aaye
                        </h4>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {['S.No', 'Rank & Name', 'Category', 'Kis Coy Se', '→ Hamari Coy', 'Purpose', 'Date'].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {udhariTaken.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-green-50/30">
                              <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="px-3 py-2 font-bold text-slate-800">{r.ustadRank} {r.ustadName}</td>
                              <td className="px-3 py-2">
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 text-[9px] font-bold">{r.category}</span>
                              </td>
                              <td className="px-3 py-2 font-bold text-green-600">{r.fromCoy}</td>
                              <td className="px-3 py-2 font-bold text-military-700">→ {r.toCoy}</td>
                              <td className="px-3 py-2 text-slate-600 text-[10px]">{r.reason}</td>
                              <td className="px-3 py-2 font-mono text-[10px]">{r.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex justify-between items-center flex-shrink-0">
              <p className="text-[9px] text-slate-500">
                Udhari manage karne ke liye <strong>Deployment Screen</strong> mein jaayein
              </p>
              <button onClick={() => setUdhariModal(false)}
                className="bg-slate-700 text-white px-4 py-1.5 text-[10px] font-bold uppercase hover:bg-slate-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};