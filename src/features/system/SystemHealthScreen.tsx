// ============================================
// SYSTEM HEALTH DASHBOARD (Module 19 Audit ★ NEW)
// ============================================
// CC-only administration cockpit:
//   • Health pings (Firestore collections latency/availability)
//   • Security stats (24h login events + failed spikes)
//   • Error monitoring (error_logs feed)
//   • Activity pulse (aaj ke module-wise actions)
//   • Data size snapshot + storage advisory
//   • Feature Flags (maintenance mode, seed tools) — CC control
//   • Data retention policy (documented)
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, HeartPulse, ShieldAlert, Bug, Zap, Database,
  RefreshCw, Loader2, ToggleLeft, ToggleRight, AlertTriangle,
  CheckCircle2, XCircle, Construction, HardDrive,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAIHealth } from '../aiAgent/config/ai.config';
import {
  pingKeyCollections, PingResult,
  getSecurityStats, SecurityStats,
  getRecentErrors, ErrorLogEntry,
  getActivityPulse, ActivityPulse,
  getCollectionCounts,
  getSystemFlags, saveSystemFlags, SystemFlags, DEFAULT_FLAGS,
} from './systemHealth.api';

// ─── RETENTION POLICY (documented — M19 requirement) ──
const RETENTION_POLICIES = [
  { collection: 'login_history', keep: '90 days', action: 'Manual purge (Cloud Function Phase 3)', severity: 'info' },
  { collection: 'search_logs', keep: '90 days', action: 'Manual purge', severity: 'info' },
  { collection: 'notifications', keep: '30 days', action: 'Manual purge — Automation cleanup rule Future', severity: 'warn' },
  { collection: 'error_logs', keep: '60 days', action: 'Manual purge', severity: 'info' },
  { collection: 'automation_runs', keep: '90 days', action: 'Manual purge', severity: 'info' },
  { collection: 'staff_activity_logs', keep: '1 year', action: 'Archive before purge (Backup Center)', severity: 'info' },
];

export const SystemHealthScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pings, setPings] = useState<PingResult[]>([]);
  const [pingLoading, setPingLoading] = useState(false);
  const [security, setSecurity] = useState<SecurityStats | null>(null);
  const [errors, setErrors] = useState<{ total: number; entries: ErrorLogEntry[] }>({ total: 0, entries: [] });
  const [pulse, setPulse] = useState<ActivityPulse | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<SystemFlags>(DEFAULT_FLAGS);
  const [flagSaving, setFlagSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [sec, err, act, cnt, flg] = await Promise.all([
      getSecurityStats(), getRecentErrors(), getActivityPulse(), getCollectionCounts(), getSystemFlags(),
    ]);
    setSecurity(sec);
    setErrors(err);
    setPulse(act);
    setCounts(cnt);
    setFlags(flg);
    setLoading(false);
  };

  const runPings = async () => {
    setPingLoading(true);
    setPings(await pingKeyCollections());
    setPingLoading(false);
  };

  useEffect(() => {
    loadAll();
    runPings();
  }, []);

  if (user?.role !== 'Company Commander') {
    return <div className="p-4 text-red-600 font-bold uppercase">Restricted Area: Commander Clearance Required</div>;
  }

  const toggleFlag = async (patch: Partial<SystemFlags>) => {
    setFlagSaving(true);
    const next = { ...flags, ...patch };
    setFlags(next);
    try {
      await saveSystemFlags(patch, user?.email ?? 'CC');
    } catch {
      // revert on fail
      setFlags(flags);
      alert('Flag save failed — retry karein');
    } finally {
      setFlagSaving(false);
    }
  };

  const okPings = pings.filter(p => p.ok).length;
  const avgMs = pings.length > 0 ? Math.round(pings.reduce((s, p) => s + p.ms, 0) / pings.length) : 0;
  const aiHealth = getAIHealth();
  const totalDocs = Object.values(counts).reduce((s, c) => s + Math.max(0, c), 0);

  const healthCards = [
    {
      label: 'Firestore Health',
      value: pings.length === 0 ? '—' : `${okPings}/${pings.length}`,
      sub: pings.length === 0 ? 'ping pending' : `avg ${avgMs}ms latency`,
      icon: <HeartPulse size={18} />,
      ok: pings.length > 0 && okPings === pings.length,
      warn: okPings < pings.length,
    },
    {
      label: 'Security (24h)',
      value: security ? `${security.last24hFailed} failed` : '—',
      sub: security ? `${security.last24hSuccess} successful logins` : 'loading',
      icon: <ShieldAlert size={18} />,
      ok: (security?.last24hFailed ?? 0) < 5,
      warn: (security?.last24hFailed ?? 0) >= 5,
    },
    {
      label: 'Client Errors',
      value: String(errors.total),
      sub: 'recent error_logs entries',
      icon: <Bug size={18} />,
      ok: errors.total === 0,
      warn: errors.total > 10,
    },
    {
      label: "Today's Activity",
      value: String(pulse?.todayTotal ?? '—'),
      sub: `${pulse?.byModule.length ?? 0} modules active`,
      icon: <Zap size={18} />,
      ok: true,
      warn: false,
    },
    {
      label: 'AI Engine',
      value: aiHealth.groq || aiHealth.gemini ? 'ONLINE' : 'LOCAL',
      sub: `Groq ${aiHealth.groqKeys} keys · Gemini ${aiHealth.geminiKeys} keys`,
      icon: <Zap size={18} />,
      ok: aiHealth.groq || aiHealth.gemini,
      warn: false,
    },
    {
      label: 'Total Docs (24 col.)',
      value: totalDocs.toLocaleString('en-IN'),
      sub: 'Live database footprint',
      icon: <Database size={18} />,
      ok: true,
      warn: false,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider flex items-center gap-2">
            <Activity size={22} /> System Health & Administration
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Pings · Security · Errors · Flags · Retention</p>
        </div>
        <button onClick={() => { loadAll(); runPings(); }} disabled={loading || pingLoading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
          <RefreshCw size={12} className={loading || pingLoading ? 'animate-spin' : ''} /> Refresh All
        </button>
      </div>

      {/* ★ MAINTENANCE MODE STATUS (own view) */}
      {flags.maintenanceMode && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2.5 rounded text-xs font-bold uppercase flex items-center gap-2">
          <Construction size={14} /> Maintenance Mode ON — non-CC users ko abhi maintenance banner dikh raha hai
        </div>
      )}

      {/* HEALTH CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {healthCards.map(c => (
          <div key={c.label} className={`border rounded p-2.5 text-center ${c.warn ? 'bg-red-50 border-red-300' : c.ok ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`flex justify-center mb-1 ${c.warn ? 'text-red-600' : 'text-green-600'}`}>{c.icon}</div>
            <p className={`text-sm font-black ${c.warn ? 'text-red-700' : 'text-slate-800'}`}>{c.value}</p>
            <p className="text-[8px] text-slate-500 font-bold uppercase">{c.label}</p>
            <p className="text-[8px] text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── PING TABLE ── */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-military-900 flex items-center gap-2">
              <HeartPulse size={13} /> Firestore Pings (collection availability)
            </span>
            <button onClick={runPings} disabled={pingLoading} className="text-[10px] font-bold uppercase text-blue-700 hover:text-blue-900 flex items-center gap-1">
              {pingLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Re-Ping
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {pings.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400 font-bold uppercase">Ping chal raha hai…</p>
            ) : pings.map(p => (
              <div key={p.name} className="px-4 py-1.5 flex items-center justify-between hover:bg-slate-50">
                <span className="text-xs font-mono text-slate-700">{p.name}</span>
                <span className={`text-[10px] font-black flex items-center gap-1.5 ${p.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {p.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {p.ok ? `${p.ms}ms` : (p.error ?? 'FAIL')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECURITY CARD ── */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-military-900 flex items-center gap-2">
              <ShieldAlert size={13} /> Security Events (24h)
            </span>
            <button onClick={() => navigate('/users')} className="text-[10px] font-bold uppercase text-purple-700 hover:text-purple-900">
              Full Login History →
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 border border-green-200 rounded p-2.5 text-center">
                <p className="text-xl font-black text-green-700">{security?.last24hSuccess ?? '—'}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase">Successful</p>
              </div>
              <div className={`border rounded p-2.5 text-center ${(security?.last24hFailed ?? 0) >= 5 ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xl font-black ${(security?.last24hFailed ?? 0) >= 5 ? 'text-red-700' : 'text-slate-700'}`}>{security?.last24hFailed ?? '—'}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase">Failed</p>
              </div>
            </div>
            {security && security.failedByEmail.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-2.5">
                <p className="text-[10px] font-black text-red-700 uppercase mb-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> Top Failed Emails
                </p>
                {security.failedByEmail.map(f => (
                  <p key={f.email} className="text-[10px] font-mono text-red-800">{f.email} — {f.count}x</p>
                ))}
              </div>
            )}
            <div className="divide-y divide-slate-100 max-h-28 overflow-y-auto">
              {security?.recentEvents.slice(0, 6).map(ev => (
                <div key={ev.id} className="py-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-600 truncate max-w-[60%]">{ev.email}</span>
                  <span className={`text-[9px] font-black ${ev.status === 'SUCCESS' ? 'text-green-700' : 'text-red-600'}`}>
                    {ev.status} · {ev.at ? ev.at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ERROR MONITORING ── */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2">
            <span className="text-xs font-bold uppercase text-military-900 flex items-center gap-2">
              <Bug size={13} /> Error Monitoring (client crashes — error_logs)
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {errors.entries.length === 0 ? (
              <p className="py-8 text-center text-xs text-green-600 font-bold uppercase">✓ Koi client error log nahi — clean</p>
            ) : errors.entries.map(e => (
              <div key={e.id} className="px-4 py-2 hover:bg-slate-50">
                <div className="flex justify-between gap-2">
                  <span className="text-[10px] font-black text-red-700 uppercase">{e.source}</span>
                  <span className="text-[9px] text-slate-400">{e.at ? e.at.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <p className="text-[10px] text-slate-600 truncate">{e.message}</p>
                <p className="text-[9px] text-slate-400 font-mono">{e.url}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVITY PULSE ── */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2">
            <span className="text-xs font-bold uppercase text-military-900 flex items-center gap-2">
              <Zap size={13} /> Activity Pulse (aaj + recent)
            </span>
          </div>
          <div className="p-4 space-y-3">
            {pulse && pulse.byModule.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pulse.byModule.map(m => (
                  <span key={m.module} className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full uppercase">
                    {m.module}: {m.count}
                  </span>
                ))}
              </div>
            )}
            <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
              {pulse?.recent.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400 font-bold uppercase">Aaj abhi koi staff activity log nahi</p>
              )}
              {pulse?.recent.map(a => (
                <div key={a.id} className="py-1.5">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">{a.userName} <span className="text-slate-400">({a.role})</span></span>
                    <span className="text-[9px] text-slate-400">{a.at ? a.at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{a.module} → {a.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FEATURE FLAGS ── */}
      <div className="bg-white border-t-4 border-t-purple-800 border border-slate-300 shadow-flat p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-military-900 flex items-center border-b border-slate-200 pb-2">
          <Construction size={15} className="mr-2 text-purple-700" /> Feature Flags — Live Control ({flagSaving ? 'saving…' : 'saved instantly'})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MAINTENANCE MODE */}
          <div className={`border rounded p-4 ${flags.maintenanceMode ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-black text-slate-800 uppercase">Maintenance Mode</p>
                <p className="text-[10px] text-slate-500">ON hone par non-CC users ko banner dikhega (CC kaam karta rahega)</p>
              </div>
              <button onClick={() => toggleFlag({ maintenanceMode: !flags.maintenanceMode })} disabled={flagSaving}>
                {flags.maintenanceMode ? <ToggleRight size={30} className="text-amber-600" /> : <ToggleLeft size={30} className="text-slate-400" />}
              </button>
            </div>
            <textarea
              value={flags.maintenanceMessage}
              onChange={e => setFlags({ ...flags, maintenanceMessage: e.target.value })}
              onBlur={() => saveSystemFlags({ maintenanceMessage: flags.maintenanceMessage }, user?.email ?? 'CC')}
              rows={2}
              className="w-full border border-slate-300 px-2 py-1.5 text-xs rounded focus:outline-none focus:border-purple-600"
            />
          </div>

          {/* SEED TOOLS */}
          <div className={`border rounded p-4 ${flags.enableSeedTools ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-800 uppercase">Seed / Demo Tools</p>
                <p className="text-[10px] text-slate-500">Production mein OFF rakhein — seed screens (demo users, staff seed) block ho jaayengi</p>
              </div>
              <button onClick={() => toggleFlag({ enableSeedTools: !flags.enableSeedTools })} disabled={flagSaving}>
                {flags.enableSeedTools ? <ToggleRight size={30} className="text-green-600" /> : <ToggleLeft size={30} className="text-slate-400" />}
              </button>
            </div>
            <p className={`text-[10px] font-bold uppercase mt-2 ${flags.enableSeedTools ? 'text-green-700' : 'text-slate-400'}`}>
              {flags.enableSeedTools ? '✓ Tools enabled (dev mode)' : '⛔ Tools blocked (production-safe)'}
            </p>
          </div>
        </div>
        {flags.updatedAt && (
          <p className="text-[9px] text-slate-400">Last flag change: {flags.updatedBy} · {new Date(flags.updatedAt).toLocaleString('en-IN')}</p>
        )}
      </div>

      {/* ── DATA SIZE + RETENTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* COLLECTION COUNTS */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2">
            <span className="text-xs font-bold uppercase text-military-900 flex items-center gap-2">
              <HardDrive size={13} /> Data Footprint (top 24 collections)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-3 max-h-64 overflow-y-auto">
            {Object.entries(counts).sort(([, a], [, b]) => Math.max(0, b) - Math.max(0, a)).map(([col, count]) => (
              <div key={col} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                <span className="text-[9px] font-mono text-slate-600 truncate">{col}</span>
                <span className={`text-[9px] font-black ${count < 0 ? 'text-red-600' : 'text-slate-800'}`}>{count < 0 ? 'ERR' : count.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200">
            <p className="text-[10px] text-amber-800 font-semibold flex items-start gap-1.5">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              Storage Advisory: Bills abhi base64 mein Firestore docs mein hain (known design) — scale par Storage migration recommended. Trainee photos/documents already Storage mein hain.
            </p>
          </div>
        </div>

        {/* RETENTION POLICY */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2">
            <span className="text-xs font-bold uppercase text-military-900">Data Retention & Archive Policy (Documented)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {RETENTION_POLICIES.map(r => (
              <div key={r.collection} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="text-xs font-bold font-mono text-slate-800">{r.collection}</p>
                  <p className="text-[10px] text-slate-400">{r.action}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${r.severity === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {r.keep}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-200">
            <p className="text-[10px] text-blue-800 font-semibold">
              💡 Purge se pehle hamesha <strong>Masters & Backup → Full Backup</strong> download karein.
              Automated retention Cloud Function Phase 3 roadmap item hai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthScreen;
