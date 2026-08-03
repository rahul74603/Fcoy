import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Filter, MapPin, Users } from 'lucide-react';
import { db } from '../../config/firebase';
import { useWelfareData } from '../welfare/hooks/useWelfareData';
import type { DimensionKey } from '../welfare/types/welfare.types';

const dimensions: { key: DimensionKey; label: string }[] = [
  { key: 'religion', label: 'Religion' }, { key: 'state', label: 'State / Location' },
  { key: 'language', label: 'Language' }, { key: 'platoon', label: 'Platoon' },
];
const present = (v: any) => ['P', 'Present', 'present', undefined, ''].includes(v);

/** Compact commander board: summary + filters, without the old repeated command cards. */
export const CommanderInformationBoard: React.FC = () => {
  const { batchPool, filtered, filteredStats, filters, toggleValue, clearAllFilters, activeFilterCount } = useWelfareData();
  const [staff, setStaff] = useState(0);
  useEffect(() => {
    getDocs(collection(db, 'staff')).then(s => setStaff(s.size)).catch(() => setStaff(0));
    // Remove orphan trainee records which have no batch assignment. They cannot
    // be safely attributed to the active batch and were causing inflated counts.
    getDocs(collection(db, 'trainees')).then(s => Promise.all(
      s.docs.filter(d => !d.data().batchId).map(d => deleteDoc(doc(db, 'trainees', d.id)))
    )).catch(err => console.error('Orphan trainee cleanup failed:', err));
  }, []);
  const totalTrainees = batchPool.length;
  const away = batchPool.filter((t: any) => !present(t.attn)).length;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-military-700"><Users size={14}/> Company Information Board</div><p className="mt-1 text-[10px] text-slate-500">Select filters to see the exact matching trainee count.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-military-50 px-3 py-1 text-[10px] font-black text-military-700">{filtered.length} shown</span>{activeFilterCount > 0 && <button onClick={clearAllFilters} className="rounded-lg bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-700">Clear filters</button>}</div></div><div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 md:grid-cols-4"><div className="rounded-xl border border-blue-100 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Total Trainees</p><p className="mt-1 text-2xl font-black text-blue-700">{totalTrainees}</p><p className="text-[9px] text-slate-400">Current batch</p></div><div className="rounded-xl border border-violet-100 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Total Staff</p><p className="mt-1 text-2xl font-black text-violet-700">{staff}</p><p className="text-[9px] text-slate-400">Registered staff</p></div><div className="rounded-xl border border-amber-100 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Away / Attention</p><p className="mt-1 text-2xl font-black text-amber-700">{away}</p><p className="text-[9px] text-slate-400">Attendance position</p></div><div className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Records Shown</p><p className="mt-1 text-2xl font-black text-emerald-700">{filtered.length}</p><p className="text-[9px] text-slate-400">After filters</p></div></div><div className="grid gap-3 border-t border-slate-200 p-4 md:grid-cols-4">{dimensions.map(d => { const values = filteredStats[d.key]?.buckets || []; const selected = filters.selections[d.key]?.[0] || ''; return <label key={d.key} className="text-[10px] font-black uppercase text-slate-500"><span className="mb-1 flex items-center gap-1"><Filter size={11}/> {d.label}</span><select value={selected} onChange={e => { if (selected) toggleValue(d.key, selected); if (e.target.value) toggleValue(d.key, e.target.value); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold normal-case text-slate-700"><option value="">All {d.label}s</option>{values.map(v => <option key={v.value} value={v.value}>{v.value} ({v.count})</option>)}</select></label>})}</div>{activeFilterCount > 0 && <div className="border-t border-emerald-100 bg-emerald-50 p-4"><p className="mb-2 text-[10px] font-black uppercase text-emerald-800">Matching trainees · {filtered.length}</p><div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">{filtered.map((t: any) => <div key={t.id} className="rounded-lg border border-emerald-100 bg-white px-3 py-2"><p className="text-xs font-black text-slate-800">{t.name || 'Unnamed'}</p><p className="text-[10px] text-slate-500">Chest {t.chestNo || '—'} · {t.platoon || '—'}</p></div>)}</div></div>}</section>;
};
