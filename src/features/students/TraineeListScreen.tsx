// src/features/students/TraineeListScreen.tsx
// ═══════════════════════════════════════════════════════════
// 📋 TRAINEE LIST — poore batch ke trainees EK SAATH, bina search ke
//
// KYUN BANAYA:
//   Profile screen sirf Chest No / Reg No se search karti hai — par
//   naye trainees ke paas registration ke waqt chest number hota hi
//   nahi. Chest issue hone par unhe dhoondhna impossible ho raha tha.
//
// YE SCREEN KYA DETI HAI:
//   • Active/selected batch ke SAARE trainees ki live list
//   • Naam / Reg / Chest / Platoon / Village kisi se bhi instant filter
//   • "Chest Pending" tab — jinko chest assign karna baaki hai
//   • Row se hi CHEST ASSIGN (uniqueness check + audit stamp ke saath)
//   • "Profile" button → full profile/edit (existing screen, deep-link)
//
// Data: wahi `trainees` collection, batch-scoped query. Koi naya
// collection nahi. Assignment wahi audit fields likhta hai jo
// TraineeProfileScreen likhta hai (chestAssignedAt/By).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, X, Hash, Loader2, AlertCircle, CheckCircle2,
  RefreshCw, ArrowRight, Target, UserSquare,
} from 'lucide-react';
import {
  collection, getDocs, query, where, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUnitConfig } from '../../contexts/UnitConfigContext';
import { printTraineeFullReport } from './traineeFullReport';
import { FileText } from 'lucide-react';

interface TraineeRow {
  id: string;
  name?: string;
  fatherName?: string;
  regNo?: string;
  chestNo?: string;
  platoon?: string;
  section?: string;
  village?: string;
  district?: string;
  attn?: string;
  photoURL?: string;
  docsComplete?: boolean;
  [key: string]: any;
}

type TabKey = 'all' | 'pending' | 'assigned';

const ATTN_BADGE: Record<string, { label: string; cls: string }> = {
  P: { label: 'Present', cls: 'bg-green-100 text-green-700 border-green-300' },
  A: { label: 'Absent', cls: 'bg-red-100 text-red-700 border-red-300' },
  L: { label: 'Leave', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  S: { label: 'Sick', cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  H: { label: 'Hospital', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  R: { label: 'Rest', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
};

export const TraineeListScreen: React.FC = () => {
  const { currentBatch } = useBatch();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<TraineeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<TabKey>('all');

  // Inline chest assignment
  const [assignId, setAssignId] = useState('');       // kis row par input khula hai
  const [assignValue, setAssignValue] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  const fetchRows = async () => {
    if (!currentBatch) { setLoading(false); setRows([]); return; }
    setLoading(true); setError('');
    try {
      const snap = await getDocs(query(
        collection(db, 'trainees'),
        where('batchId', '==', currentBatch.id),
      ));
      const list: TraineeRow[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as TraineeRow));
      // Chest number ke hisab se sort (pending sabse upar within tab logic)
      list.sort((a, b) => {
        const ca = parseInt(String(a.chestNo ?? ''), 10);
        const cb = parseInt(String(b.chestNo ?? ''), 10);
        if (!Number.isNaN(ca) && !Number.isNaN(cb)) return ca - cb;
        if (!Number.isNaN(ca)) return -1;
        if (!Number.isNaN(cb)) return 1;
        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      });
      setRows(list);
    } catch (err) {
      console.error('Trainee list fetch error:', err);
      setError('Trainee list load nahi hui — Retry karein.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentBatch?.id]);

  const pending = rows.filter(r => !String(r.chestNo ?? '').trim());
  const assigned = rows.filter(r => String(r.chestNo ?? '').trim());

  const visible = useMemo(() => {
    let base = tab === 'pending' ? pending : tab === 'assigned' ? assigned : rows;
    const q = filter.trim().toLowerCase();
    if (!q) return base;
    return base.filter(r =>
      [r.name, r.fatherName, r.regNo, r.chestNo, r.platoon, r.section, r.village, r.district]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [rows, pending, assigned, tab, filter]);

  // ── CHEST ASSIGN (inline) — uniqueness + audit, same as Profile screen ──
  const saveAssign = async (row: TraineeRow) => {
    const chest = assignValue.trim();
    if (!chest) { setAssignMsg('ERROR: Chest No khaali hai'); return; }
    if (!currentBatch) return;
    setAssignBusy(true); setAssignMsg('');
    try {
      // Duplicate check — same batch me ye chest kisi aur ka to nahi?
      const dup = await getDocs(query(
        collection(db, 'trainees'),
        where('batchId', '==', currentBatch.id),
        where('chestNo', '==', chest),
      ));
      const clash = dup.docs.find(d => d.id !== row.id);
      if (clash) {
        setAssignMsg(`ERROR: Chest "${chest}" pehle se ${String(clash.data().name ?? clash.id)} ko assigned hai!`);
        setAssignBusy(false);
        return;
      }
      await updateDoc(doc(db, 'trainees', row.id), {
        chestNo: chest,
        chestAssignedAt: new Date().toISOString(),
        chestAssignedBy: user?.email ?? user?.name ?? 'Unknown',
        updatedAt: new Date().toISOString(),
      });
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, chestNo: chest } : r));
      setAssignId(''); setAssignValue(''); setAssignMsg('');
    } catch (err: any) {
      setAssignMsg(`ERROR: ${err.message}`);
    } finally {
      setAssignBusy(false);
    }
  };

  const openProfile = (r: TraineeRow) => {
    // Profile screen chest/reg se search karti hai — reg hamesha hota hai
    const key = r.regNo || r.chestNo || '';
    navigate(`/profile?search=${encodeURIComponent(key)}`);
  };

  // 📄 Row se hi FULL DOSSIER report (personal + saare events)
  const { unitConfig } = useUnitConfig();
  const [reportBusyId, setReportBusyId] = useState('');
  const handleRowReport = async (r: TraineeRow) => {
    setReportBusyId(r.id);
    try {
      await printTraineeFullReport(r, {
        unitLine: `${unitConfig.companyShort || 'F COY'} — ${unitConfig.parentUnit || 'BSF TRAINING CENTER'}`,
        preparedBy: user?.name || user?.email || 'System',
      });
    } catch (err) {
      console.error('Row report error:', err);
      alert('Report generate nahi hui — dobara try karein.');
    } finally {
      setReportBusyId('');
    }
  };

  // ═══════════ RENDER ═══════════
  return (
    <div className="w-full flex flex-col space-y-4 pb-8">

      {/* HEADER */}
      <div className="bg-military-900 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-military-700 p-2"><Users size={20} className="text-white" /></div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">Trainee List — Full Batch</h1>
            <p className="text-[10px] text-military-300">
              Saare trainees ek jagah · naam se dhoondo · chest assign karo · profile kholo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentBatch && (
            <span className="bg-military-800 text-white text-[10px] font-black px-3 py-1.5 border border-military-600 uppercase">
              {currentBatch.batchNumber} · {rows.length} Trainees
            </span>
          )}
          <button onClick={fetchRows}
            className="bg-military-800 text-white border border-military-600 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-military-700 flex items-center gap-1.5">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {!currentBatch ? (
        <div className="bg-red-900 border border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={14} className="text-red-300" />
          <span className="text-[10px] font-black text-red-300 uppercase">
            Koi Active Batch Nahi! Pehle Batch Management me batch activate karo.
          </span>
        </div>
      ) : (
        <>
          {/* SUMMARY + TABS + SEARCH */}
          <div className="bg-white border border-slate-300 shadow-flat p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tabs */}
              {([
                { key: 'all', label: `All (${rows.length})`, icon: Users },
                { key: 'pending', label: `Chest Pending (${pending.length})`, icon: Target },
                { key: 'assigned', label: `Chest Assigned (${assigned.length})`, icon: Hash },
              ] as { key: TabKey; label: string; icon: any }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1.5 border transition-colors ${
                    tab === t.key
                      ? t.key === 'pending'
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-military-800 text-white border-military-800'
                      : 'bg-white text-slate-500 border-slate-300 hover:border-military-600'
                  }`}>
                  <t.icon size={12} /> {t.label}
                </button>
              ))}

              {/* Search — naam se bhi (client-side, isliye partial match chalta hai) */}
              <div className="relative flex-1 min-w-[220px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Naam / Father / Reg No / Chest / Platoon / Village se dhoondo..."
                  className="w-full text-xs pl-8 pr-8 py-2 border border-slate-300 focus:outline-none focus:border-military-700 font-semibold"
                />
                {filter && (
                  <button onClick={() => setFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {tab === 'pending' && pending.length > 0 && (
              <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5">
                💡 In trainees ko chest number issue hone par yahin se ASSIGN karo — row me "Assign" dabao,
                number likho, save. Duplicate number system khud rok dega.
              </p>
            )}
          </div>

          {/* ERROR */}
          {error && (
            <div className="bg-red-50 border border-red-300 px-4 py-3 flex items-center justify-between">
              <p className="text-xs font-bold text-red-700 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
              <button onClick={fetchRows} className="bg-red-700 text-white px-3 py-1.5 text-[10px] font-black uppercase">Retry</button>
            </div>
          )}
          {assignMsg && (
            <div className="bg-red-50 border border-red-300 px-4 py-2">
              <p className="text-xs font-bold text-red-700">{assignMsg}</p>
            </div>
          )}

          {/* LIST */}
          <div className="bg-white border border-slate-300 shadow-flat overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center py-16">
                <Loader2 size={26} className="animate-spin text-military-700 mb-2" />
                <p className="text-[10px] font-black text-military-800 uppercase">Trainees load ho rahe hain...</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="p-10 text-center">
                <UserSquare size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500 uppercase">
                  {filter ? `"${filter}" se koi trainee nahi mila`
                    : tab === 'pending' ? 'Sab trainees ko chest number assigned hai — All Clear!'
                    : 'Is batch me abhi koi trainee register nahi hua'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b-2 border-military-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">#</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Photo</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Chest No</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Name / Father</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Reg No</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Platoon</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Status</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase">Docs</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => {
                    const hasChest = Boolean(String(r.chestNo ?? '').trim());
                    const attn = ATTN_BADGE[r.attn || 'P'] ?? ATTN_BADGE.P;
                    return (
                      <tr key={r.id} className={`border-b border-slate-100 hover:bg-slate-50 ${!hasChest ? 'bg-indigo-50/40' : ''}`}>
                        <td className="px-3 py-2 text-[10px] text-slate-400 font-bold">{i + 1}</td>

                        {/* PHOTO — Storage URL ya legacy base64 dono chalte hain */}
                        <td className="px-3 py-1.5">
                          {r.photoURL ? (
                            <img src={r.photoURL} alt={r.name || 'photo'}
                              className="w-9 h-11 object-cover object-top border border-slate-300 bg-slate-100" />
                          ) : (
                            <div className="w-9 h-11 border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                              <UserSquare size={14} className="text-slate-300" />
                            </div>
                          )}
                        </td>

                        {/* CHEST — assigned to number, pending to assign UI */}
                        <td className="px-3 py-2">
                          {assignId === r.id ? (
                            <div className="flex items-center gap-1.5">
                              <input autoFocus value={assignValue}
                                onChange={e => setAssignValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveAssign(r); if (e.key === 'Escape') { setAssignId(''); setAssignMsg(''); } }}
                                placeholder="Chest No"
                                className="w-20 border-2 border-indigo-500 px-2 py-1 text-xs font-mono font-black focus:outline-none" />
                              <button onClick={() => saveAssign(r)} disabled={assignBusy}
                                className="bg-green-600 text-white p-1 hover:bg-green-700 disabled:opacity-50">
                                {assignBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                              </button>
                              <button onClick={() => { setAssignId(''); setAssignMsg(''); }}
                                className="bg-slate-200 text-slate-600 p-1 hover:bg-slate-300"><X size={12} /></button>
                            </div>
                          ) : hasChest ? (
                            <span className="inline-flex items-center gap-1 font-mono text-sm font-black text-military-900">
                              <Hash size={12} className="text-amber-500" />{r.chestNo}
                            </span>
                          ) : (
                            <button
                              onClick={() => { setAssignId(r.id); setAssignValue(''); setAssignMsg(''); }}
                              className="bg-indigo-600 text-white px-2.5 py-1 text-[9px] font-black uppercase hover:bg-indigo-700 flex items-center gap-1">
                              <Target size={10} /> Assign
                            </button>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          <p className="font-bold text-slate-800">{r.name || '—'}</p>
                          <p className="text-[10px] text-slate-400">{r.fatherName ? `S/O ${r.fatherName}` : ''}</p>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-bold text-slate-600">{r.regNo || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{r.platoon || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-[9px] font-black border ${attn.cls}`}>{attn.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          {r.docsComplete
                            ? <span className="text-[9px] font-black text-green-700">✓ DONE</span>
                            : <span className="text-[9px] font-black text-amber-600">PENDING</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button onClick={() => handleRowReport(r)}
                              disabled={reportBusyId === r.id}
                              title="Full dossier report — personal + kit + medical + tests + documents sab"
                              className="bg-slate-100 text-military-800 border border-slate-300 px-2.5 py-1.5 text-[9px] font-black uppercase hover:bg-slate-200 inline-flex items-center gap-1 disabled:opacity-50">
                              {reportBusyId === r.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />} Report
                            </button>
                            <button onClick={() => openProfile(r)}
                              className="bg-military-800 text-white px-3 py-1.5 text-[9px] font-black uppercase hover:bg-military-900 inline-flex items-center gap-1.5">
                              Profile <ArrowRight size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TraineeListScreen;
