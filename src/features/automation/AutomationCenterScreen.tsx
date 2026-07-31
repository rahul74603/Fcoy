// ============================================
// AUTOMATION CENTER SCREEN (Module 20 Audit ★ NEW)
// ============================================
// Rule-based smart automation ka cockpit:
//   • Status cards (rules, fired, notifications sent aaj)
//   • 7 automation rules — per-rule run + result badges
//   • "Run Full Scan" — saare rules ek saath
//   • Run history timeline (automation_runs audit trail)
//   • Live event-emitter coverage (M17 se — 4 emitters)
// Dedupe built-in: ek rule ek din mein max 1 notification.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  Bot, Play, FastForward, Loader2, RefreshCw, CheckCircle2,
  AlertTriangle, Zap, History, Bell, XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  AUTOMATION_RULES, runRule, runFullAutomationScan,
  fetchAutomationRuns, AutomationRun, RuleResult,
} from './automation.engine';

// ─── LIVE EVENT EMITTERS (M17 — already on-the-wire) ──
const LIVE_EMITTERS = [
  { event: 'Leave Approve / Reject', target: 'Clerk', source: 'leave.api.ts', status: 'LIVE' },
  { event: 'Schedule Reschedule / Postpone', target: 'Ustad + Clerk', source: 'schedule.api.ts', status: 'LIVE' },
  { event: 'Exam Results Published', target: 'CC + Clerk', source: 'testRecord.api.ts', status: 'LIVE' },
  { event: 'Medical Case (serious = HIGH)', target: 'Company Commander', source: 'MedicalRegisterScreen', status: 'LIVE' },
];

export const AutomationCenterScreen: React.FC = () => {
  const { user } = useAuth();

  const [results, setResults] = useState<Record<string, RuleResult>>({});
  const [runningRule, setRunningRule] = useState<string | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [history, setHistory] = useState<AutomationRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistory(await fetchAutomationRuns(30));
    setHistoryLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  if (user?.role !== 'Company Commander') {
    return <div className="p-4 text-red-600 font-bold uppercase">Restricted Area: Commander Clearance Required</div>;
  }

  const handleRunRule = async (ruleId: string) => {
    const rule = AUTOMATION_RULES.find(r => r.id === ruleId);
    if (!rule) return;
    setRunningRule(ruleId);
    const res = await runRule(rule);
    setResults(prev => ({ ...prev, [ruleId]: res }));
    setRunningRule(null);
    loadHistory();
  };

  const handleFullScan = async () => {
    setScanRunning(true);
    setScanProgress('Starting scan…');
    const scanResults = await runFullAutomationScan((done, total, label) => {
      setScanProgress(`Running ${done}/${total}: ${label}`);
    });
    const map: Record<string, RuleResult> = {};
    scanResults.forEach(r => { map[r.ruleId] = r; });
    setResults(prev => ({ ...prev, ...map }));
    setScanProgress(`DONE: ${scanResults.filter(r => r.fired).length} rules fired · ${scanResults.filter(r => r.notified).length} notifications sent`);
    setScanRunning(false);
    loadHistory();
  };

  const firedCount = Object.values(results).filter(r => r.fired).length;
  const notifiedCount = Object.values(results).filter(r => r.notified).length;
  const todayNotified = history.filter(h => {
    if (!h.ranAt || !h.notified) return false;
    return h.ranAt.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
  }).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider flex items-center gap-2">
            <Bot size={22} /> Automation Center
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">
            Rule-based smart alerts · Auto notifications · Run audit trail
          </p>
        </div>
        <button onClick={handleFullScan} disabled={scanRunning || runningRule !== null}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase bg-military-800 text-white px-4 py-2 hover:bg-military-900 disabled:opacity-50 rounded">
          {scanRunning ? <Loader2 size={12} className="animate-spin" /> : <FastForward size={12} />}
          {scanRunning ? 'Scanning…' : 'Run Full Scan'}
        </button>
      </div>

      {/* SCAN PROGRESS */}
      {scanProgress && (
        <div className={`px-4 py-2.5 rounded text-xs font-bold uppercase flex items-center gap-2 border ${scanProgress.startsWith('DONE') ? 'bg-green-50 border-green-300 text-green-700' : 'bg-blue-50 border-blue-300 text-blue-700'}`}>
          {scanRunning && <Loader2 size={13} className="animate-spin" />}
          {scanProgress}
        </div>
      )}

      {/* STATUS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Automation Rules', value: AUTOMATION_RULES.length, sub: 'rule-based scanners', color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Fired (last scan)', value: firedCount, sub: 'conditions matched', color: firedCount > 0 ? 'text-amber-700' : 'text-green-700', bg: firedCount > 0 ? 'bg-amber-50' : 'bg-green-50' },
          { label: 'Notified (last scan)', value: notifiedCount, sub: 'alerts emitted', color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: "Today's Auto-Alerts", value: todayNotified, sub: 'dedupe per rule/day', color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-slate-200 rounded p-3 text-center`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase">{s.label}</p>
            <p className="text-[8px] text-slate-400 uppercase">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* RULES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AUTOMATION_RULES.map(rule => {
          const res = results[rule.id];
          const isRunning = runningRule === rule.id || scanRunning;
          return (
            <div key={rule.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${res?.fired ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="px-4 py-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{rule.icon}</span>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase flex items-center gap-2 flex-wrap">
                      {rule.label}
                      <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full uppercase">
                        → {rule.targetRole}
                      </span>
                      {res?.fired && (
                        <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full animate-pulse">
                          ⚠ FIRED
                        </span>
                      )}
                      {res?.notified && (
                        <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Bell size={7} /> NOTIFIED
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{rule.description}</p>
                  </div>
                </div>
                <button onClick={() => handleRunRule(rule.id)} disabled={isRunning}
                  className="flex items-center gap-1 bg-slate-700 text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded hover:bg-slate-800 disabled:opacity-40 flex-shrink-0">
                  {runningRule === rule.id ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                  Run
                </button>
              </div>
              {res && (
                <div className={`px-4 py-2.5 border-t text-[10px] font-semibold flex items-start gap-2 ${res.fired ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                  {res.fired ? <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" />}
                  <span className="flex-1">{res.message}</span>
                  <span className="text-[9px] text-slate-400 flex-shrink-0">{res.ms}ms</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LIVE EMITTERS COVERAGE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-green-50 border-b border-slate-200">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Zap size={13} className="text-green-600" /> Live Event Emitters (Module 17) — Hamesha ON
          </h3>
          <p className="text-[9px] text-slate-500 font-bold uppercase">Ye business actions ke saath automatically fire hote hain — scan ki zaroorat nahi</p>
        </div>
        <div className="divide-y divide-slate-100">
          {LIVE_EMITTERS.map(e => (
            <div key={e.event} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
              <div>
                <p className="text-xs font-bold text-slate-800">{e.event}</p>
                <p className="text-[10px] text-slate-400 font-mono">{e.source}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase">→ {e.target}</span>
                <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={9} /> {e.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RUN HISTORY */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-purple-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <History size={13} className="text-purple-600" /> Automation Run History (audit trail)
          </h3>
          <button onClick={loadHistory} disabled={historyLoading} className="text-[10px] font-bold uppercase text-purple-700 hover:text-purple-900 flex items-center gap-1">
            <RefreshCw size={10} className={historyLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {historyLoading ? (
            <div className="py-10 text-center"><Loader2 size={20} className="animate-spin text-slate-400 mx-auto" /></div>
          ) : history.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400 font-bold uppercase">
              Abhi tak koi automation run nahi — "Run Full Scan" dabayein
            </p>
          ) : (
            history.map(h => (
              <div key={h.id} className="px-4 py-2 hover:bg-slate-50 flex items-center gap-3">
                <span className="flex-shrink-0">
                  {h.fired ? <AlertTriangle size={13} className="text-amber-500" /> : <CheckCircle2 size={13} className="text-green-500" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[11px] font-bold text-slate-800">{h.label}</p>
                    <span className="text-[8px] font-mono text-slate-400">{h.ruleId}</span>
                    {h.notified && (
                      <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Bell size={7} /> notified
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">{h.message}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-slate-400">{h.ranAt ? h.ranAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  <p className="text-[8px] text-slate-300">{h.ms}ms</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
        <XCircle size={10} className="hidden" />
        Dedupe rule: ek rule ek din mein max 1 notification — notification spam nahi hogi. Scheduled auto-run Cloud Function Phase 3 mein hai.
      </p>
    </div>
  );
};

export default AutomationCenterScreen;
