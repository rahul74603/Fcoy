// src/features/developer/CompanyMonitorScreen.tsx
// ═════════════════════════════════════════════════════════════
// 🏢 COMPANY MONITOR (Master Only — Read-Only)
// Master (F Coy) app se company apps (A Coy / bcoy...) ka
// LIVE Company Commander dashboard dekhne ki screen.
//
// Kaam kaise: customer record me saved bridge creds se company
// Firebase project me sign-in hota hai (secondary app instance),
// bas summary counts padhta hai — company ka data KABHI change
// nahi hota (read-only, bridge ka rule #1).
// ═════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Building2, Users, ShieldCheck, ClipboardList, Activity,
  RefreshCw, Loader2, Zap, CalendarDays, CheckCircle2,
  AlertTriangle, ChevronLeft, Crown, FlaskConical,
} from 'lucide-react';
import { listCustomersWithSub, CustomerWithSub } from './api/customers.api';
import {
  fetchCompanySnapshot, CompanySnapshot,
} from '../subscription/api/companyBridge.api';

// ── Chhota stat card ────────────────────────────
const Stat: React.FC<{
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ReactNode; cls: string;
}> = ({ label, value, sub, icon, cls }) => (
  <div className={`rounded-xl border p-4 ${cls}`}>
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</span>
      {icon}
    </div>
    <div className="mt-2 text-3xl font-black leading-none">{value}</div>
    {sub && <div className="mt-1 text-[11px] font-semibold opacity-70">{sub}</div>}
  </div>
);

export const CompanyMonitorScreen: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithSub[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<CustomerWithSub | null>(null);
  const [snap, setSnap] = useState<CompanySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ── Customers (bridge-linked companies) ──
  useEffect(() => {
    (async () => {
      setLoadingList(true);
      try {
        const list = await listCustomersWithSub();
        setCustomers(list);
      } catch (e) {
        console.error(e);
        setError('Customers load nahi hue — refresh karein.');
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  const linked = customers.filter(c => c.bridge && c.companyCode);

  const loadSnapshot = async (c: CustomerWithSub) => {
    if (!c.bridge) return;
    setBusy(true); setError(''); setSnap(null); setSelected(c);
    try {
      const s = await fetchCompanySnapshot(c.bridge);
      setSnap(s);
    } catch (e) {
      console.error(e);
      setError(`${c.unitName} ka data nahi mila — bridge sign-in fail (creds ya net check karein).`);
    } finally {
      setBusy(false);
    }
  };

  // ══════════ COMPANY LIST VIEW ══════════
  if (!selected) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600" /> Company Monitor
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bridge-linked company apps ka <b>LIVE read-only</b> dashboard — data sirf dekhta hai, kabhi badalta nahi.
          </p>
        </div>

        {loadingList && (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /> Companies load ho rahi hain…</div>
        )}
        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-semibold">{error}</div>}

        {!loadingList && linked.length === 0 && !error && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500">
            <Zap className="mx-auto mb-2 text-slate-400" />
            Koi bridge-linked company nahi mili. Pehle Practice Console se kisi customer ko company app se <b>LINK</b> karein.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {linked.map(c => (
            <button
              key={c.id}
              onClick={() => loadSnapshot(c)}
              className="text-left rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg text-slate-800">{c.unitName}</div>
                  <div className="text-xs text-slate-500">{c.customerId} · {c.commanderName}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
                  <Zap size={11} /> {c.companyCode}
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-400">Project: {c.bridge?.projectId}</div>
              <div className="mt-2 text-sm font-bold text-indigo-600">Live Dashboard kholein →</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ══════════ SNAPSHOT VIEW ══════════
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <button
        onClick={() => { setSelected(null); setSnap(null); setError(''); }}
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-indigo-600"
      >
        <ChevronLeft size={16} /> Sabhi Companies
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600" /> {selected.unitName}
            <span className="text-xs font-bold text-slate-400 align-middle">({selected.customerId})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Commander: {selected.commanderName} · Project: {selected.bridge?.projectId}
            {snap && <> · Updated {snap.fetchedAt}</>}
          </p>
        </div>
        <button
          onClick={() => loadSnapshot(selected)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {busy ? 'Padh raha hai…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-semibold">{error}</div>}

      {busy && !snap && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="animate-spin" size={22} /> {selected.unitName} ka live data aa raha hai…
        </div>
      )}

      {snap && (
        <>
          {/* 💳 Company app me synced plan (bridge se jo gaya) */}
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-2">
            <Crown size={16} className="text-amber-600" />
            <span className="text-sm font-black text-amber-800">
              Synced Plan: {snap.planName ?? '— koi plan push nahi hua —'}
            </span>
            {snap.planValidTill && (
              <span className="text-xs font-bold text-amber-700">valid till {snap.planValidTill}</span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Trainees" value={snap.trainees} icon={<Users size={16} />} cls="bg-blue-50 border-blue-200 text-blue-800" />
            <Stat label="Staff" value={snap.staff} icon={<ShieldCheck size={16} />} cls="bg-emerald-50 border-emerald-200 text-emerald-800" />
            <Stat label="On Leave (aaj)" value={snap.onLeaveNow} icon={<CalendarDays size={16} />} cls="bg-orange-50 border-orange-200 text-orange-800" />
            <Stat label="Duty (aaj)" value={snap.dutyToday} icon={<CheckCircle2 size={16} />} cls="bg-teal-50 border-teal-200 text-teal-800" />
            <Stat label="Pending Leaves" value={snap.pendingLeaves} icon={<ClipboardList size={16} />} cls="bg-rose-50 border-rose-200 text-rose-800" />
            <Stat label="Tests Conducted" value={snap.tests} icon={<Activity size={16} />} cls="bg-violet-50 border-violet-200 text-violet-800" />
            <Stat label="Batches" value={snap.batches.length} sub={snap.batches[0]?.name} icon={<FlaskConical size={16} />} cls="bg-slate-50 border-slate-200 text-slate-800" />
            <Stat label="Bridge" value="LIVE" sub="read-only" icon={<Zap size={16} />} cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Pending leave approvals */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-black text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-500" /> Leave Approvals Pending
              </h3>
              {snap.pendingLeaveNames.length === 0 ? (
                <p className="text-sm text-slate-400">Koi pending leave nahi ✓</p>
              ) : (
                <ul className="space-y-1.5">
                  {snap.pendingLeaveNames.map((n, i) => (
                    <li key={i} className="text-sm font-semibold text-slate-700 rounded-lg bg-rose-50 border border-rose-100 px-3 py-1.5">{n}</li>
                  ))}
                  {snap.pendingLeaves > snap.pendingLeaveNames.length && (
                    <li className="text-xs text-slate-400 pl-1">+{snap.pendingLeaves - snap.pendingLeaveNames.length} aur…</li>
                  )}
                </ul>
              )}
            </div>

            {/* Recent tests */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-black text-slate-700 mb-3 flex items-center gap-2">
                <Activity size={15} className="text-violet-500" /> Recent Tests
              </h3>
              {snap.recentTests.length === 0 ? (
                <p className="text-sm text-slate-400">Abhi koi test record nahi</p>
              ) : (
                <ul className="space-y-1.5">
                  {snap.recentTests.map((t, i) => (
                    <li key={i} className="flex items-center justify-between text-sm rounded-lg bg-violet-50 border border-violet-100 px-3 py-1.5">
                      <span className="font-semibold text-slate-700">{t.name}</span>
                      <span className="text-xs text-slate-500">{t.date} · <b className="text-emerald-600">{t.pass}P</b> / <b className="text-red-500">{t.fail}F</b></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            🏢 Master Monitor — read-only live view · company ka data kabhi modify nahi hota
          </p>
        </>
      )}
    </div>
  );
};

export default CompanyMonitorScreen;
