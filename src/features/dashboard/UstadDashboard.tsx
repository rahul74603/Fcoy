// src/features/dashboard/UstadDashboard.tsx
//
// USTAD DASHBOARD — "Aaj mera kya kaam hai?"
//
// Ye screen sirf wahi dikhati hai jo Ustad ke paas pehle se maujood data
// layer me hai. Koi naya collection, koi naya write nahi. Sab kuch
// read-only — Ustad yahan se kuch badal nahi sakta, sirf dekh sakta hai
// aur sahi screen par ja sakta hai.
//
// Ustad ke paas jo 7 routes hain: /staff /training-schedule /staff-leave
// /batch-progress /batches /reports /ustad

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Calendar, Users, ClipboardList, TrendingUp,
  Loader2, RefreshCw, AlertCircle, ArrowRight, Clock,
  MapPin, CheckCircle2, PlaneTakeoff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';

import { getSchedulesByDateRange } from '../ustad/api/schedule.api';
import { getDutiesByDate } from '../ustad/api/duty.api';
import { getStaffSummary } from '../ustad/api/staff.api';
import { getCurrentLeaves } from '../ustad/api/leave.api';

import type { TrainingSchedule } from '../ustad/types/schedule.types';
import type { StaffDuty } from '../ustad/types/duty.types';
import type { StaffLeave } from '../ustad/types/leave.types';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const isoDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const prettyDate = (d: Date) =>
  d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  });

const statusChip = (status: string) => {
  switch (status) {
    case 'completed':   return 'bg-green-100 text-green-700 border-green-300';
    case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'cancelled':   return 'bg-red-100 text-red-700 border-red-300';
    case 'postponed':   return 'bg-amber-100 text-amber-800 border-amber-300';
    default:            return 'bg-slate-100 text-slate-600 border-slate-300';
  }
};

const statusLabel = (status: string) =>
  status ? status.replace(/_/g, ' ').toUpperCase() : 'SCHEDULED';

interface SummaryState {
  total: number; active: number; onLeave: number;
  onTD: number; inHospital: number; onCourse: number; inactive: number;
}

// ─────────────────────────────────────────────
// SMALL PRESENTATIONAL PIECES
// ─────────────────────────────────────────────
const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: React.ReactNode;
  hint?: string; tone?: string; onClick?: () => void;
}> = ({ icon, label, value, hint, tone = 'text-military-800', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white border border-slate-300 shadow-flat p-4 ${
      onClick ? 'cursor-pointer hover:border-military-500 transition-colors' : ''
    }`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
        {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="text-slate-300">{icon}</div>
    </div>
  </div>
);

const SectionCard: React.FC<{
  title: string; subtitle?: string; icon: React.ReactNode;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}> = ({ title, subtitle, icon, action, children }) => (
  <div className="bg-white border border-slate-300 shadow-flat">
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-military-700">{icon}</span>
        <div>
          <h2 className="text-sm font-bold text-military-900 uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-[10px] font-bold uppercase text-military-700 hover:text-military-900"
        >
          {action.label} <ArrowRight size={12} />
        </button>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <p className="py-6 text-center text-xs text-slate-400">{text}</p>
);

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export const UstadDashboard: React.FC = () => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [today]                 = useState(() => new Date());

  const [todaySchedules, setTodaySchedules] = useState<TrainingSchedule[]>([]);
  const [weekSchedules, setWeekSchedules]   = useState<TrainingSchedule[]>([]);
  const [duties, setDuties]                 = useState<StaffDuty[]>([]);
  const [onLeaveNow, setOnLeaveNow]         = useState<StaffLeave[]>([]);
  const [summary, setSummary]               = useState<SummaryState | null>(null);

  const batchId = activeBatch?.id ?? '';

  const load = useCallback(async () => {
    if (!batchId) { setLoading(false); return; }

    setLoading(true);
    setError(null);

    const todayIso = isoDate(today);
    const weekEnd  = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Har call alag se — ek fail ho to baaki dashboard phir bhi bhare.
    const [schedRes, dutyRes, leaveRes, sumRes] = await Promise.allSettled([
      getSchedulesByDateRange(batchId, todayIso, isoDate(weekEnd)),
      getDutiesByDate(todayIso, batchId),
      getCurrentLeaves(),
      getStaffSummary(batchId),
    ]);

    if (schedRes.status === 'fulfilled') {
      const all = schedRes.value;
      setWeekSchedules(all);
      setTodaySchedules(
        all.filter(s => s.date && isoDate(new Date(s.date)) === todayIso)
      );
    }
    if (dutyRes.status === 'fulfilled')  setDuties(dutyRes.value);
    if (leaveRes.status === 'fulfilled') setOnLeaveNow(leaveRes.value);
    if (sumRes.status === 'fulfilled')   setSummary(sumRes.value);

    const failed = [schedRes, dutyRes, leaveRes, sumRes]
      .filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      setError(`${failed} section${failed > 1 ? 's' : ''} could not be loaded. Baaki data sahi hai.`);
    }

    setLoading(false);
  }, [batchId, today]);

  useEffect(() => { void load(); }, [load]);

  // ── Aaj mera apna kaam (agar naam match karta ho) ──
  const myName = (user?.name ?? '').trim().toLowerCase();
  const mySchedules = myName
    ? todaySchedules.filter(s => (s.ustadName ?? '').trim().toLowerCase() === myName)
    : [];
  const myDuties = myName
    ? duties.filter(d => (d.staffName ?? '').trim().toLowerCase() === myName)
    : [];

  const upcoming = weekSchedules
    .filter(s => {
      if (!s.date) return false;
      return isoDate(new Date(s.date)) > isoDate(today);
    })
    .sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return ad === bd ? a.startTime.localeCompare(b.startTime) : ad - bd;
    })
    .slice(0, 6);

  // ── HEADER ──
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-military-800 pb-2">
      <div>
        <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider">
          Ustad Command
        </h1>
        <p className="text-sm text-slate-500 font-semibold mt-1">
          {prettyDate(today)}
          {activeBatch?.batchNumber ? ` · Batch ${activeBatch.batchNumber}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 border border-slate-300 bg-white px-3 py-1 text-[10px] font-bold uppercase text-slate-600 hover:border-military-500 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <span className="flex items-center rounded-sm border border-military-300 bg-military-100 px-3 py-1 text-[10px] font-bold uppercase text-military-800">
          <Shield size={14} className="mr-1" /> Ustad Access
        </span>
      </div>
    </div>
  );

  // ── NO BATCH ──
  if (!batchId) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {header}
        <div className="border border-amber-300 bg-amber-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 text-amber-600" size={28} />
          <p className="text-sm font-bold text-amber-900">Koi batch select nahi hai</p>
          <p className="mt-1 text-xs text-amber-700">
            Upar se ek active batch chuniye — uske baad aaj ka programme, duty aur
            staff strength yahan dikhega.
          </p>
        </div>
      </div>
    );
  }

  // ── LOADING ──
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {header}
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="animate-spin" size={20} />
          <span className="text-xs font-bold uppercase">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {header}

      {error && (
        <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 px-4 py-2">
          <AlertCircle size={14} className="mt-0.5 text-amber-600" />
          <p className="text-xs text-amber-800">{error}</p>
        </div>
      )}

      {/* ── STAT STRIP ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Calendar size={22} />}
          label="Aaj ki classes"
          value={todaySchedules.length}
          hint={mySchedules.length > 0 ? `${mySchedules.length} aapki` : 'batch ki poori list'}
          onClick={() => navigate('/training-schedule')}
        />
        <StatCard
          icon={<ClipboardList size={22} />}
          label="Aaj ki duty"
          value={duties.length}
          hint={myDuties.length > 0 ? `${myDuties.length} aapki` : 'sab staff'}
        />
        <StatCard
          icon={<Users size={22} />}
          label="Staff available"
          value={summary ? summary.active : '—'}
          hint={summary ? `kul ${summary.total}` : undefined}
          tone="text-green-700"
          onClick={() => navigate('/staff')}
        />
        <StatCard
          icon={<PlaneTakeoff size={22} />}
          label="Abhi chutti par"
          value={onLeaveNow.length}
          hint="approved leave"
          tone={onLeaveNow.length > 0 ? 'text-amber-700' : 'text-military-800'}
          onClick={() => navigate('/staff-leave')}
        />
      </div>

      {/* ── AAJ KA PROGRAMME ── */}
      <SectionCard
        title="Aaj ka training programme"
        subtitle={`${todaySchedules.length} period${todaySchedules.length === 1 ? '' : 's'} scheduled`}
        icon={<Calendar size={16} />}
        action={{ label: 'Full schedule', onClick: () => navigate('/training-schedule') }}
      >
        {todaySchedules.length === 0 ? (
          <EmptyNote text="Aaj ke liye koi period schedule nahi hua hai." />
        ) : (
          <div className="space-y-2">
            {todaySchedules
              .slice()
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(s => {
                const mine = myName && (s.ustadName ?? '').trim().toLowerCase() === myName;
                return (
                  <div
                    key={s.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 px-3 py-2 ${
                      mine ? 'border-military-700 bg-military-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1 font-mono text-xs font-bold text-slate-700">
                      <Clock size={11} /> {s.startTime}–{s.endTime}
                    </span>
                    <span className="text-sm font-bold text-military-900">
                      {s.subjectName || 'Subject —'}
                    </span>
                    {s.subjectCode && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600">
                        {s.subjectCode}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{s.ustadName || '—'}</span>
                    {s.venue && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                        <MapPin size={10} /> {s.venue}
                      </span>
                    )}
                    {s.platoon && (
                      <span className="text-[10px] text-slate-400">{s.platoon}</span>
                    )}
                    {mine && (
                      <span className="rounded bg-military-700 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                        Aapki class
                      </span>
                    )}
                    <span
                      className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusChip(s.status)}`}
                    >
                      {statusLabel(s.status)}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── AAJ KI DUTY ── */}
        <SectionCard
          title="Aaj ki duty"
          subtitle={`${duties.length} assigned`}
          icon={<ClipboardList size={16} />}
        >
          {duties.length === 0 ? (
            <EmptyNote text="Aaj koi duty assign nahi hui hai." />
          ) : (
            <div className="space-y-1.5">
              {duties.slice(0, 8).map(d => {
                const mine = myName && (d.staffName ?? '').trim().toLowerCase() === myName;
                return (
                  <div
                    key={d.id}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
                      mine ? 'bg-military-50 font-bold' : ''
                    }`}
                  >
                    {d.status === 'completed'
                      ? <CheckCircle2 size={12} className="shrink-0 text-green-600" />
                      : <Clock size={12} className="shrink-0 text-slate-400" />}
                    <span className="font-semibold text-slate-700">{d.staffName || '—'}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{d.dutyTypeName || '—'}</span>
                    {mine && (
                      <span className="ml-auto rounded bg-military-700 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                        Aap
                      </span>
                    )}
                  </div>
                );
              })}
              {duties.length > 8 && (
                <p className="pt-1 text-[10px] text-slate-400">
                  +{duties.length - 8} aur…
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── STAFF STRENGTH ── */}
        <SectionCard
          title="Staff strength"
          subtitle="aaj ki sthiti"
          icon={<Users size={16} />}
          action={{ label: 'Staff list', onClick: () => navigate('/staff') }}
        >
          {!summary ? (
            <EmptyNote text="Strength load nahi ho paayi." />
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: 'Available', v: summary.active,     c: 'text-green-700' },
                { l: 'Chutti',    v: summary.onLeave,    c: 'text-amber-700' },
                { l: 'TD',        v: summary.onTD,       c: 'text-blue-700' },
                { l: 'Hospital',  v: summary.inHospital, c: 'text-red-700' },
                { l: 'Course',    v: summary.onCourse,   c: 'text-purple-700' },
                { l: 'Kul',       v: summary.total,      c: 'text-military-900' },
              ].map(x => (
                <div key={x.l} className="border border-slate-200 bg-slate-50 py-2">
                  <p className={`text-xl font-black ${x.c}`}>{x.v}</p>
                  <p className="text-[9px] font-bold uppercase text-slate-500">{x.l}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── AAGE KA HAFTA ── */}
      <SectionCard
        title="Aage ka hafta"
        subtitle="agle 6 din ke scheduled periods"
        icon={<TrendingUp size={16} />}
        action={{ label: 'Batch progress', onClick: () => navigate('/batch-progress') }}
      >
        {upcoming.length === 0 ? (
          <EmptyNote text="Aage koi period schedule nahi hua hai." />
        ) : (
          <div className="space-y-1.5">
            {upcoming.map(s => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-24 shrink-0 font-mono text-[10px] font-bold text-slate-500">
                  {s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                </span>
                <span className="w-24 shrink-0 font-mono text-[10px] text-slate-400">
                  {s.startTime}–{s.endTime}
                </span>
                <span className="font-semibold text-slate-700">{s.subjectName || '—'}</span>
                <span className="text-slate-400">· {s.ustadName || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <p className="pb-2 text-center text-[10px] text-slate-400">
        Ye screen sirf dikhati hai. Badlav apni-apni screen se hote hain.
      </p>
    </div>
  );
};
