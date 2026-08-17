import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Search, X, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { showDoc } from '../../utils/devDataFilter';
import { batchScopeRule } from '../../utils/batchScope';
import { useAuth } from '../../contexts/AuthContext';

interface Result { id: string; title: string; detail: string; collection: string; path: string; }
const access: Record<string, { name: string; path: string }[]> = {
  'Company Commander': [
    { name: 'trainees', path: '/profile' }, { name: 'staff', path: '/staff' }, { name: 'company_assets_expenses', path: '/company-assets-fund' }, { name: 'training_fund_expenses', path: '/training-fund' }, { name: 'mess_fund_expenses', path: '/mess-fund' }, { name: 'general_fund_expenses', path: '/general-fund' }, { name: 'vendor_entries', path: '/vendors' }, { name: 'issue_records', path: '/issue-kit' }, { name: 'batches', path: '/batches' }, { name: 'subject_master', path: '/subjects' },
  ],
  'Quarter Master': [
    { name: 'trainees', path: '/issue-kit' }, { name: 'company_assets_expenses', path: '/company-assets-fund' }, { name: 'training_fund_expenses', path: '/training-fund' }, { name: 'mess_fund_expenses', path: '/mess-fund' }, { name: 'general_fund_expenses', path: '/general-fund' }, { name: 'vendor_entries', path: '/vendors' }, { name: 'issue_records', path: '/issue-kit' }, { name: 'batches', path: '/batches' },
  ],
  // NOTE: collection names must match real Firestore collections —
  // pehle yahan 'attendance'/'absent_records'/'test_records' jaise galat naam
  // the jo kabhi kuch return nahi karte the.
  Clerk: [{ name: 'trainees', path: '/profile' }, { name: 'staff', path: '/staff' }, { name: 'batches', path: '/batches' }, { name: 'subject_master', path: '/subjects' }, { name: 'staff_subjects', path: '/subject-assignment' }, { name: 'staff_attendance', path: '/staff-attendance' }, { name: 'absentRecords', path: '/absent-management' }],
  Ustad: [{ name: 'trainees', path: '/ustad' }, { name: 'staff', path: '/staff' }, { name: 'subject_master', path: '/subjects' }, { name: 'staff_subjects', path: '/subject-assignment' }, { name: 'staff_attendance', path: '/staff-attendance' }, { name: 'training_tests', path: '/test-records' }, { name: 'training_schedule', path: '/training-schedule' }],
};
const stringify = (v: any) => typeof v === 'string' || typeof v === 'number' ? String(v) : '';

interface GlobalSearchProps {
  className?: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ className = '' }) => {
  const { user } = useAuth(); const navigate = useNavigate();
  const [value, setValue] = useState(''); const [results, setResults] = useState<Result[]>([]); const [loading, setLoading] = useState(false); const [open, setOpen] = useState(false);
  useEffect(() => {
    const term = value.trim().toLowerCase(); if (term.length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const allowed = access[user?.role || ''] || [];
        const found: Result[] = [];
        // Per-source failure fatal nahi — ek collection permission-denied ho
        // to baaki results phir bhi aane chahiye (Promise.all reject nahi hoga).
        await Promise.all(allowed.map(async source => {
          const snap = await getDocs(collection(db, source.name)).catch(() => null);
          if (!snap) return;
          snap.docs.forEach(d => { const data = d.data(); if (!showDoc(data) || !batchScopeRule(data)) return; /* 🧪 dev data + ⛓️ batch rule */ const text = Object.values(data).map(stringify).join(' ').toLowerCase(); if (text.includes(term)) { const title = stringify(data.name || data.itemName || data.traineeName || data.vendorName || data.subjectName || data.batchNumber || d.id); const detail = [data.chestNo, data.email, data.code, data.category, data.amount != null ? `₹${data.amount}` : '', data.quantity != null ? `Qty ${data.quantity}` : ''].filter(Boolean).join(' · '); found.push({ id: d.id, title: title || d.id, detail, collection: source.name, path: source.path }); } });
        }));
        setResults(found.slice(0, 30));
      } catch (e) { console.error('Global search error', e); } finally { setLoading(false); }
    }, 350); return () => window.clearTimeout(timer);
  }, [value, user?.role]);
  return <div className={`relative z-50 min-w-0 flex-1 ${className}`}>
    <div className={`flex items-center gap-2 rounded-lg border-2 bg-amber-50 px-3 py-2 shadow-sm transition-colors ${open ? 'border-amber-500 ring-2 ring-amber-100' : 'border-amber-300'}`}><Search size={17} className="shrink-0 text-amber-700"/><input aria-label="Global search" value={value} onFocus={() => setOpen(true)} onChange={e => setValue(e.target.value)} placeholder="Search everything you can access…" className="min-w-0 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-500"/>{loading ? <Loader2 size={15} className="shrink-0 animate-spin text-amber-700"/> : value && <button type="button" aria-label="Clear search" onClick={() => { setValue(''); setOpen(false); }}><X size={14}/></button>}</div>
    {open && value.trim().length >= 2 && <><div className="fixed inset-0 -z-10" onClick={() => setOpen(false)}/><div className="absolute left-0 right-0 mt-2 max-h-96 overflow-auto rounded-xl border border-amber-200 bg-white p-2 shadow-2xl">{!loading && results.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">No matching records found in your permitted sections.</p> : results.map(r => <button key={`${r.collection}-${r.id}`} onClick={() => { navigate(`${r.path}?search=${encodeURIComponent(r.title)}`); setOpen(false); setValue(''); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-amber-50"><span><b className="block text-sm text-slate-900">{r.title}</b><span className="text-[11px] text-slate-500">{r.collection} {r.detail && `· ${r.detail}`}</span></span><ArrowRight size={14} className="text-amber-600"/></button>)}</div></>}
  </div>;
};
