// ═══════════════════════════════════════════════════════════
// TRAINEE BROWSER — "All Trainees" with operational filters
// ───────────────────────────────────────────────────────────
// Profile screen par pehle sirf chest/reg no se search hota tha —
// clerk ko poori list dekhne ka koi rasta nahi tha. Ab ek click me
// saare trainees, aur unhe operationally kaam ke filters se chhaanto:
//   FPT fail · kit pending · documents incomplete · toppers ·
//   medical/away · weekly exam fail · platoon-wise
//
// Click karte hi wahi trainee profile screen me khul jaata hai.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Users, Search, Loader2, X, Filter, ChevronDown, AlertCircle,
} from 'lucide-react';
import { db } from '../../config/firebase';

export interface BrowserTrainee {
  id: string;
  [key: string]: any;
}

// ─── Filter definitions ────────────────────────────────────
type FilterKey =
  | 'all' | 'fptFail' | 'fptPass' | 'toppers' | 'weeklyFail'
  | 'kitPending' | 'kitIssued' | 'docsIncomplete' | 'docsComplete'
  | 'medical' | 'away' | 'present' | 'relegated' | 'noPhoto';

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

const isFail = (result: any, score: any): boolean => {
  const r = String(result ?? '').trim().toLowerCase();
  if (r === 'fail' || r === 'failed' || r === 'f') return true;
  if (r === 'pass' || r === 'passed' || r === 'p') return false;
  const s = num(score);
  return Number.isFinite(s) ? s < 40 : false;
};

const isPass = (result: any, score: any): boolean => {
  const r = String(result ?? '').trim().toLowerCase();
  if (r === 'pass' || r === 'passed' || r === 'p') return true;
  if (r === 'fail' || r === 'failed' || r === 'f') return false;
  const s = num(score);
  return Number.isFinite(s) ? s >= 40 : false;
};

/** Registration ke zaroori documents. */
const REQUIRED_DOCS = ['aadhar', 'photo', 'education', 'medical', 'police'];

const docsMissing = (t: BrowserTrainee): number => {
  const d = t.documents || {};
  if (Object.keys(d).length === 0) return REQUIRED_DOCS.length;
  return REQUIRED_DOCS.filter(k => {
    const hit = Object.keys(d).find(x => x.toLowerCase().includes(k));
    if (!hit) return true;
    const v = d[hit];
    return !v || v === false || v === 'pending' || v === 'Pending';
  }).length;
};

const kitPending = (t: BrowserTrainee): boolean => {
  if (t.kitIssued === true) return false;
  const items = Array.isArray(t.issuedItems) ? t.issuedItems : [];
  return items.length === 0;
};

const attnCode = (t: BrowserTrainee): string =>
  String(t.attn ?? 'P').trim().toUpperCase() || 'P';

const FILTERS: {
  key: FilterKey; label: string; hint: string; color: string;
  test: (t: BrowserTrainee) => boolean;
}[] = [
  { key: 'all', label: 'All Trainees', hint: 'Poori list', color: 'bg-slate-700',
    test: () => true },
  { key: 'fptFail', label: 'FPT Fail', hint: 'Physical test fail', color: 'bg-red-600',
    test: t => isFail(t.fptResult, t.fptScore) },
  { key: 'fptPass', label: 'FPT Pass', hint: 'Physical test clear', color: 'bg-green-600',
    test: t => isPass(t.fptResult, t.fptScore) },
  { key: 'weeklyFail', label: 'Weekly Exam Fail', hint: 'Written test fail', color: 'bg-orange-600',
    test: t => isFail(t.weeklyExamResult, t.weeklyExamMarks) },
  { key: 'toppers', label: 'Toppers', hint: 'FPT/exam 80+ marks', color: 'bg-amber-500',
    test: t => {
      const f = num(t.fptScore); const w = num(t.weeklyExamMarks);
      return (Number.isFinite(f) && f >= 80) || (Number.isFinite(w) && w >= 80);
    } },
  { key: 'kitPending', label: 'Kit Pending', hint: 'Kit issue nahi hui', color: 'bg-purple-600',
    test: kitPending },
  { key: 'kitIssued', label: 'Kit Issued', hint: 'Kit mil chuki', color: 'bg-teal-600',
    test: t => !kitPending(t) },
  { key: 'docsIncomplete', label: 'Documents Incomplete', hint: 'Papers adhoore', color: 'bg-rose-600',
    test: t => docsMissing(t) > 0 },
  { key: 'docsComplete', label: 'Documents Complete', hint: 'Sab papers jama', color: 'bg-emerald-600',
    test: t => docsMissing(t) === 0 },
  { key: 'medical', label: 'Medical / MI Room', hint: 'Sick · hospital · rest', color: 'bg-pink-600',
    test: t => ['S', 'H', 'R', 'M'].includes(attnCode(t)) },
  { key: 'away', label: 'Away / Absent', hint: 'Field par nahi', color: 'bg-red-700',
    test: t => attnCode(t) !== 'P' },
  { key: 'present', label: 'On Field', hint: 'Aaj present', color: 'bg-green-700',
    test: t => attnCode(t) === 'P' },
  { key: 'relegated', label: 'Relegated', hint: 'RelID mila hua', color: 'bg-amber-700',
    test: t => String(t.trainingStatus ?? '') === 'relegated' },
  { key: 'noPhoto', label: 'Photo Missing', hint: 'Profile photo nahi', color: 'bg-slate-500',
    test: t => !t.photoURL },
];

interface Props {
  batchId?: string;
  batchLabel?: string;
  onSelect: (chestNo: string) => void;
}

export const TraineeBrowser: React.FC<Props> = ({ batchId, batchLabel, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BrowserTrainee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState<FilterKey>('all');
  const [platoon, setPlatoon] = useState('ALL');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open || !batchId || rows.length) return;
    setLoading(true); setError('');
    getDocs(query(collection(db, 'trainees'), where('batchId', '==', batchId)))
      .then(snap => {
        const list: BrowserTrainee[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) =>
          String(a.chestNo || '').localeCompare(String(b.chestNo || ''), undefined, { numeric: true }));
        setRows(list);
      })
      .catch(e => setError(e?.message || 'Trainee list load nahi hui'))
      .finally(() => setLoading(false));
  }, [open, batchId, rows.length]);

  const platoons = useMemo(
    () => ['ALL', ...Array.from(new Set(rows.map(r => r.platoon).filter(Boolean))).sort()],
    [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    FILTERS.forEach(f => { c[f.key] = rows.filter(f.test).length; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const f = FILTERS.find(x => x.key === active) || FILTERS[0];
    const needle = q.trim().toLowerCase();
    return rows
      .filter(f.test)
      .filter(r => platoon === 'ALL' || r.platoon === platoon)
      .filter(r => !needle
        || String(r.chestNo || '').toLowerCase().includes(needle)
        || String(r.name || '').toLowerCase().includes(needle)
        || String(r.regNo || '').toLowerCase().includes(needle));
  }, [rows, active, platoon, q]);

  return (
    <div className="bg-white border border-slate-300 shadow-flat">
      {/* Toggle header */}
      <button type="button" onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`group w-full flex items-center justify-between px-4 py-2.5 transition-colors ${
          open ? 'bg-white hover:bg-slate-50' : 'bg-military-50 hover:bg-military-100'
        }`}>
        <div className="flex items-center gap-2">
          <Users size={15} className={open ? 'text-slate-500' : 'text-military-700'} />
          <span className={`text-xs font-black uppercase tracking-wider ${open ? 'text-slate-700' : 'text-military-900'}`}>
            All Trainees — Browse & Filter
          </span>
          {rows.length > 0 && (
            <span className="rounded-full bg-military-700 px-2 py-0.5 text-[9px] font-black text-white">
              {rows.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden sm:flex items-center rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase ${
            open ? 'bg-slate-100 text-slate-600' : 'bg-military-700 text-white'
          }`}>
            {open ? 'Hide' : 'Click here for more'}
          </span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
            open ? 'bg-slate-100 text-slate-500 rotate-180' : 'bg-military-700 text-white'
          }`}>
            <ChevronDown size={15} />
          </div>
        </div>
      </button>

      {!open ? null : !batchId ? (
        <div className="border-t border-slate-200 p-6 text-center">
          <AlertCircle size={20} className="mx-auto text-amber-500 mb-1" />
          <p className="text-xs font-bold text-slate-500">Pehle batch select karo</p>
        </div>
      ) : (
        <div className="border-t border-slate-200">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-3">
            {FILTERS.map(f => (
              <button key={f.key} type="button" onClick={() => setActive(f.key)}
                title={f.hint}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                  active === f.key
                    ? `${f.color} text-white shadow-sm`
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
                }`}>
                {f.label}
                <span className={`ml-1.5 ${active === f.key ? 'text-white/80' : 'text-slate-400'}`}>
                  {counts[f.key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search + platoon */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Chest no / naam / reg no…"
                className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-7 text-xs" />
              {q && (
                <button type="button" onClick={() => setQ('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-slate-400" />
              <select value={platoon} onChange={e => setPlatoon(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold">
                {platoons.map(p => <option key={p} value={p}>{p === 'ALL' ? 'All Platoons' : p}</option>)}
              </select>
            </div>
            <span className="text-[10px] font-black text-slate-500">
              {visible.length} shown{batchLabel ? ` · ${batchLabel}` : ''}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8">
              <Loader2 size={18} className="animate-spin text-military-700" />
              <span className="text-xs font-bold text-slate-500">Trainees load ho rahe hain…</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs font-bold text-red-600">{error}</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-slate-400">
              Is filter me koi trainee nahi
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                  <tr>
                    {['Chest', 'Name', 'Platoon', 'Status', 'FPT', 'Weekly', 'Kit', 'Docs'].map(h => (
                      <th key={h} className="bg-slate-900 px-3 py-2 text-left text-[9px] font-black uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map(t => {
                    const code = attnCode(t);
                    const missing = docsMissing(t);
                    return (
                      <tr key={t.id}
                        onClick={() => onSelect(String(t.chestNo || ''))}
                        className="cursor-pointer hover:bg-military-50">
                        <td className="px-3 py-2 font-mono font-black text-military-800">{t.chestNo || '—'}</td>
                        <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{t.name || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{t.platoon || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                            code === 'P' ? 'bg-green-100 text-green-700'
                              : code === 'H' ? 'bg-purple-100 text-purple-700'
                              : code === 'A' ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>{code}</span>
                        </td>
                        <td className="px-3 py-2">
                          {isFail(t.fptResult, t.fptScore)
                            ? <span className="font-black text-red-600">FAIL {t.fptScore || ''}</span>
                            : isPass(t.fptResult, t.fptScore)
                              ? <span className="font-bold text-green-700">PASS {t.fptScore || ''}</span>
                              : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isFail(t.weeklyExamResult, t.weeklyExamMarks)
                            ? <span className="font-black text-orange-600">FAIL {t.weeklyExamMarks || ''}</span>
                            : isPass(t.weeklyExamResult, t.weeklyExamMarks)
                              ? <span className="font-bold text-green-700">{t.weeklyExamMarks || 'PASS'}</span>
                              : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {kitPending(t)
                            ? <span className="font-black text-purple-600">PENDING</span>
                            : <span className="text-teal-700">issued</span>}
                        </td>
                        <td className="px-3 py-2">
                          {missing > 0
                            ? <span className="font-black text-rose-600">{missing} missing</span>
                            : <span className="text-emerald-700">complete</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
            Kisi bhi row par click karo — us trainee ki profile khul jayegi.
          </p>
        </div>
      )}
    </div>
  );
};
