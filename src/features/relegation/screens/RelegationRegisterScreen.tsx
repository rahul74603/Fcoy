// src/features/relegation/screens/RelegationRegisterScreen.tsx
// RelID-based relegation: destination batch relegate ke time NAHI pata.
// Pool me wait, phir current batch RelID se add — chest + "R", data sync.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRightLeft, CheckCircle2, Copy, HeartPulse,
  Layers, Loader2, RefreshCw, Search, Shield, UserPlus, Users, X,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';
import { canManageTrainees } from '../../../config/permissions';
import { RELEGATION_REASONS, type RelegationRecord, type RelegationReason } from '../types/relegation.types';
import {
  cancelRelegation, listAllRelegations,
  lookupByRelegateId, rejoinByRelegateId, relegateTrainee,
} from '../api/relegation.api';
import { isOnStrength, normalizeRelegateId, rejoinChestNo } from '../utils/relegation.utils';

type Tab = 'pool' | 'outgoing' | 'incoming' | 'all';

const inputCls = 'w-full text-xs px-2 py-1.5 border border-slate-300 focus:outline-none focus:border-military-700 bg-white';
const labelCls = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1';

const statusBadge = (status: string) => {
  if (status === 'awaiting_rejoin') {
    return <span className="text-[9px] font-black px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">AWAITING</span>;
  }
  if (status === 'rejoined') {
    return <span className="text-[9px] font-black px-2 py-0.5 bg-green-100 text-green-800 border border-green-300">REJOINED</span>;
  }
  return <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300">CANCELLED</span>;
};

const fmt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const RelegationRegisterScreen: React.FC = () => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const canManage = canManageTrainees(user?.role || '');

  const [tab, setTab] = useState<Tab>('pool');
  const [records, setRecords] = useState<RelegationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [trainees, setTrainees] = useState<any[]>([]);
  const [showRelegate, setShowRelegate] = useState(false);
  const [showAdmit, setShowAdmit] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const [relForm, setRelForm] = useState({
    traineeId: '',
    reason: RELEGATION_REASONS[0] as RelegationReason,
    details: '',
    authority: '',
    orderNo: '',
    medicalNote: '',
    completedSubjects: '',
    remainingSubjects: '',
  });
  const [issuedId, setIssuedId] = useState('');

  const [admitId, setAdmitId] = useState('');
  const [preview, setPreview] = useState<RelegationRecord | null>(null);
  const [previewErr, setPreviewErr] = useState('');
  const [admitPlatoon, setAdmitPlatoon] = useState('Platoon 1');
  const [admitSection, setAdmitSection] = useState('Section A');
  const [admitChest, setAdmitChest] = useState('');
  const [admitRemarks, setAdmitRemarks] = useState('');
  const [lastRejoin, setLastRejoin] = useState<{ chest: string; name: string; from: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const errors: string[] = [];
    try {
      const all = await listAllRelegations();
      setRecords(all);
    } catch (err: any) {
      setRecords([]);
      errors.push(err.message || 'Relegation list fail');
    }
    try {
      if (activeBatch) {
        const tq = query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id));
        const tSnap = await getDocs(tq);
        const list: any[] = [];
        tSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setTrainees(list.filter(isOnStrength).sort((a, b) => String(a.chestNo || '').localeCompare(String(b.chestNo || ''))));
      } else {
        setTrainees([]);
      }
    } catch (err: any) {
      setTrainees([]);
      errors.push(err.message || 'Trainee list fail');
    }
    setMessage(errors.length ? `ERROR: ${errors.join(' | ')}` : '');
    setLoading(false);
  }, [activeBatch]);

  useEffect(() => { load(); }, [load]);

  const awaiting = useMemo(() => records.filter((r) => r.status === 'awaiting_rejoin'), [records]);
  const outgoing = useMemo(
    () => records.filter((r) => r.fromBatchId === activeBatch?.id),
    [records, activeBatch],
  );
  const incoming = useMemo(
    () => records.filter((r) => r.toBatchId === activeBatch?.id),
    [records, activeBatch],
  );

  const visible = tab === 'pool' ? awaiting
    : tab === 'outgoing' ? outgoing
    : tab === 'incoming' ? incoming
    : records;

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2000);
    } catch { /* ignore */ }
  };

  const handleRelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!relForm.traineeId) { setMessage('ERROR: Trainee select karo.'); return; }
    if (!relForm.reason) { setMessage('ERROR: Reason zaroori hai.'); return; }
    setBusy(true); setMessage(''); setIssuedId('');
    try {
      const rec = await relegateTrainee(relForm, {
        uid: user?.uid || '',
        name: user?.name || user?.email || 'Unknown',
      });
      setIssuedId(rec.relegateId);
      setMessage(`SUCCESS: ${rec.traineeName} relegated. RelID ${rec.relegateId} paper pe likh lo — destination batch baad me decide hoga.`);
      setRelForm({
        traineeId: '', reason: RELEGATION_REASONS[0], details: '', authority: '',
        orderNo: '', medicalNote: '', completedSubjects: '', remainingSubjects: '',
      });
      await load();
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const lookupAdmit = async () => {
    setPreview(null); setPreviewErr(''); setLastRejoin(null);
    const id = normalizeRelegateId(admitId);
    if (!id) { setPreviewErr('RelID daalo.'); return; }
    try {
      const rec = await lookupByRelegateId(id);
      if (!rec) { setPreviewErr(`RelID "${id}" nahi mila.`); return; }
      if (rec.status !== 'awaiting_rejoin') {
        setPreviewErr(
          rec.status === 'rejoined'
            ? `Ye RelID pehle se batch ${rec.toBatchNumber} me chest ${rec.toChestNo} pe add ho chuka hai.`
            : 'Ye RelID cancel ho chuka hai.',
        );
        return;
      }
      setPreview(rec);
      setAdmitChest(rejoinChestNo(rec.fromChestNo));
    } catch (err: any) {
      setPreviewErr(err.message);
    }
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !activeBatch || !preview) return;
    setBusy(true); setMessage('');
    try {
      const result = await rejoinByRelegateId(
        {
          relegateId: preview.relegateId,
          platoon: admitPlatoon,
          section: admitSection,
          chestNo: admitChest,
          remarks: admitRemarks,
        },
        { id: activeBatch.id, batchNumber: activeBatch.batchNumber, batchName: activeBatch.batchName },
        { uid: user?.uid || '', name: user?.name || user?.email || 'Unknown' },
      );
      setLastRejoin({ chest: result.newChestNo, name: result.traineeName, from: result.fromBatchNumber });
      setMessage(
        `SUCCESS: ${result.traineeName} batch ${result.toBatchNumber} me chest ${result.newChestNo} pe add. ` +
        `Purane batch ${result.fromBatchNumber} pe stamp lag gaya ki ye yahan aa gaya.`,
      );
      setPreview(null); setAdmitId(''); setAdmitChest(''); setAdmitRemarks('');
      await load();
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const admitFromPool = (rec: RelegationRecord) => {
    setShowAdmit(true);
    setAdmitId(rec.relegateId);
    setPreview(rec);
    setPreviewErr('');
    setAdmitChest(rejoinChestNo(rec.fromChestNo));
    setLastRejoin(null);
  };

  const handleCancel = async (rec: RelegationRecord) => {
    if (!canManage) return;
    const reason = window.prompt(`RelID ${rec.relegateId} cancel? Reason:`) || '';
    if (!window.confirm(`${rec.traineeName} ko wapas current batch ki strength me laana hai?`)) return;
    setBusy(true);
    try {
      await cancelRelegation(rec.id, { uid: user?.uid || '', name: user?.name || '' }, reason);
      setMessage(`SUCCESS: ${rec.relegateId} cancel. Trainee strength me wapas.`);
      await load();
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const selectedTrainee = trainees.find((t) => t.id === relForm.traineeId);

  return (
    <div className="w-full flex flex-col space-y-4 pb-8">
      {!activeBatch && (
        <div className="bg-red-900 border border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-300 flex-shrink-0 animate-pulse" />
          <span className="text-[11px] font-black text-red-200 uppercase">
            Koi Active Batch nahi — RelID se add karne ke liye pehle batch activate karo.
          </span>
        </div>
      )}

      <div className="bg-military-900 px-4 py-3 flex justify-between items-center shadow-flat">
        <div className="flex items-center gap-3">
          <ArrowRightLeft size={20} className="text-amber-400" />
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">Relegation Register</h1>
            <p className="text-[10px] text-military-300 uppercase">
              RelID · Destination batch baad me · Chest + R · Purana batch auto-stamp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeBatch && (
            <span className="bg-military-800 border border-military-700 text-white text-[10px] font-black px-3 py-1 uppercase flex items-center gap-1.5">
              <Layers size={12} /> {activeBatch.batchNumber}
            </span>
          )}
          <button onClick={load} className="bg-military-800 text-white px-3 py-1.5 text-[10px] font-bold uppercase border border-military-600 flex items-center gap-1">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border-l-4 border-amber-500 shadow-flat p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Awaiting Rejoin (Pool)</p>
          <p className="text-2xl font-black text-amber-600">{awaiting.length}</p>
          <p className="text-[9px] text-slate-400">Destination abhi unknown</p>
        </div>
        <div className="bg-white border-l-4 border-red-500 shadow-flat p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase">This Batch Outgoing</p>
          <p className="text-2xl font-black text-red-600">{outgoing.length}</p>
        </div>
        <div className="bg-white border-l-4 border-green-500 shadow-flat p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase">This Batch Incoming</p>
          <p className="text-2xl font-black text-green-700">{incoming.length}</p>
          <p className="text-[9px] text-slate-400">Chest No + R</p>
        </div>
        <div className="bg-white border-l-4 border-military-500 shadow-flat p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Total Records</p>
          <p className="text-2xl font-black text-military-800">{records.length}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 px-4 py-3 text-[11px] text-blue-800">
        <p className="font-black uppercase mb-1">Kaise kaam karta hai</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>Injury / medical / kisi wajah se trainee current batch ki training nahi puri kar sakta → <strong>Relegate</strong>. RelID milta hai (jaise REL-2026-25-K7M2). Paper pe likh lo.</li>
          <li>Us time next batch MALUM NAHI — kab fit honge, tab jo batch chal raha hoga.</li>
          <li>Naye batch me <strong>Add by RelID</strong> — full personal data auto-sync. Chest 25 → <strong>25R</strong> (duplicate nahi).</li>
          <li>Purane batch ke record pe automatic stamp: “ye trainee is batch me aa gaya, chest 25R”.</li>
        </ol>
      </div>

      {message && (
        <div className={`p-3 text-xs font-bold border flex items-center gap-2 ${message.includes('ERROR') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {message.includes('ERROR') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {message}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowRelegate(!showRelegate); setShowAdmit(false); setIssuedId(''); }}
            className="bg-red-700 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-red-800"
          >
            {showRelegate ? <><X size={12} /> Close</> : <><HeartPulse size={12} /> Relegate Trainee</>}
          </button>
          <button
            onClick={() => { setShowAdmit(!showAdmit); setShowRelegate(false); }}
            disabled={!activeBatch}
            className="bg-green-700 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-green-800 disabled:opacity-50"
          >
            {showAdmit ? <><X size={12} /> Close</> : <><UserPlus size={12} /> Add by RelID (this batch)</>}
          </button>
        </div>
      )}

      {showRelegate && canManage && (
        <form onSubmit={handleRelegate} className="bg-white border-2 border-red-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3 bg-red-50 border border-red-200 p-2 text-[10px] text-red-800 font-semibold">
            Destination batch ABHI choose nahi hota. RelID generate hoga — trainee jab fit ho, tab current batch me RelID se add hoga.
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Trainee (current batch, on strength) *</label>
            <select required value={relForm.traineeId} onChange={(e) => setRelForm({ ...relForm, traineeId: e.target.value })} className={inputCls}>
              <option value="">-- Select --</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>Chest {t.chestNo || '—'} — {t.name} ({t.platoon})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Reason *</label>
            <select value={relForm.reason} onChange={(e) => setRelForm({ ...relForm, reason: e.target.value as RelegationReason })} className={inputCls}>
              {RELEGATION_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Details / Injury note *</label>
            <input required value={relForm.details} onChange={(e) => setRelForm({ ...relForm, details: e.target.value })} className={inputCls} placeholder="e.g. Right tibia fracture — 8 weeks recovery unknown" />
          </div>
          <div>
            <label className={labelCls}>Authority</label>
            <input value={relForm.authority} onChange={(e) => setRelForm({ ...relForm, authority: e.target.value })} className={inputCls} placeholder="Coy Cdr / MO" />
          </div>
          <div>
            <label className={labelCls}>Order / File No</label>
            <input value={relForm.orderNo} onChange={(e) => setRelForm({ ...relForm, orderNo: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Medical note</label>
            <input value={relForm.medicalNote} onChange={(e) => setRelForm({ ...relForm, medicalNote: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Completed subjects</label>
            <input value={relForm.completedSubjects} onChange={(e) => setRelForm({ ...relForm, completedSubjects: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Remaining subjects</label>
            <input value={relForm.remainingSubjects} onChange={(e) => setRelForm({ ...relForm, remainingSubjects: e.target.value })} className={inputCls} />
          </div>
          {selectedTrainee && (
            <div className="md:col-span-3 text-[10px] text-slate-600 bg-slate-50 border p-2">
              Preview: Chest <strong>{selectedTrainee.chestNo}</strong> · {selectedTrainee.name} · next chest will be <strong>{rejoinChestNo(selectedTrainee.chestNo)}</strong> jab naya batch add kare.
            </div>
          )}
          <div className="md:col-span-3 flex items-center gap-3">
            <button type="submit" disabled={busy} className="bg-red-700 text-white px-6 py-2 text-xs font-black uppercase disabled:opacity-50">
              {busy ? 'Saving…' : 'Issue RelID & Relegate'}
            </button>
            {issuedId && (
              <button type="button" onClick={() => copyId(issuedId)} className="font-mono font-black text-amber-800 bg-amber-100 border border-amber-400 px-3 py-2 text-sm flex items-center gap-2">
                {issuedId} <Copy size={12} /> {copiedId === issuedId ? 'Copied' : 'Copy RelID'}
              </button>
            )}
          </div>
        </form>
      )}

      {showAdmit && canManage && (
        <form onSubmit={handleAdmit} className="bg-white border-2 border-green-200 p-4 space-y-3">
          <div className="bg-green-50 border border-green-200 p-2 text-[10px] text-green-800 font-semibold">
            RelID daalo → pura data (naam, pita, address, photo, documents, medical) auto-sync. Chest original + <strong>R</strong>. Purane batch pe automatic note.
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={labelCls}>RelID *</label>
              <input value={admitId} onChange={(e) => setAdmitId(e.target.value.toUpperCase())} className={`${inputCls} font-mono font-black`} placeholder="REL-2026-25-K7M2" />
            </div>
            <button type="button" onClick={lookupAdmit} className="bg-military-800 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-1">
              <Search size={12} /> Lookup
            </button>
          </div>
          {previewErr && <p className="text-[11px] text-red-600 font-bold">{previewErr}</p>}
          {preview && (
            <div className="border border-green-300 bg-green-50 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <div className="md:col-span-4 flex items-center gap-3">
                {preview.photoURL
                  ? <img src={preview.photoURL} alt="" className="w-12 h-14 object-cover border" />
                  : <div className="w-12 h-14 bg-slate-200 flex items-center justify-center"><Users size={16} /></div>}
                <div>
                  <p className="font-black text-slate-800 uppercase">{preview.traineeName}</p>
                  <p className="text-[10px] text-slate-500">Father: {preview.fatherName || '—'} · Reg {preview.regNo || '—'}</p>
                  <p className="text-[10px] font-mono">From batch {preview.fromBatchNumber} chest {preview.fromChestNo} → this batch chest {admitChest || rejoinChestNo(preview.fromChestNo)}</p>
                </div>
              </div>
              <div><p className="text-[9px] text-slate-400 uppercase">Reason</p><p className="font-bold">{preview.reason}</p></div>
              <div><p className="text-[9px] text-slate-400 uppercase">Relegated</p><p className="font-bold">{fmt(preview.relegatedAt)}</p></div>
              <div><p className="text-[9px] text-slate-400 uppercase">Details</p><p className="font-bold">{preview.details || '—'}</p></div>
              <div><p className="text-[9px] text-slate-400 uppercase">Remaining</p><p className="font-bold">{preview.remainingSubjects || '—'}</p></div>
              <div>
                <label className={labelCls}>Platoon *</label>
                <select value={admitPlatoon} onChange={(e) => setAdmitPlatoon(e.target.value)} className={inputCls}>
                  {['Platoon 1', 'Platoon 2', 'Platoon 3', 'Platoon 4'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Section *</label>
                <select value={admitSection} onChange={(e) => setAdmitSection(e.target.value)} className={inputCls}>
                  {['Section A', 'Section B', 'Section C', 'Section D'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>New Chest (auto +R)</label>
                <input value={admitChest} onChange={(e) => setAdmitChest(e.target.value.toUpperCase())} className={`${inputCls} font-mono font-black`} />
              </div>
              <div>
                <label className={labelCls}>Remarks</label>
                <input value={admitRemarks} onChange={(e) => setAdmitRemarks(e.target.value)} className={inputCls} />
              </div>
              <div className="md:col-span-4">
                <button type="submit" disabled={busy || !activeBatch} className="bg-green-700 text-white px-6 py-2 text-xs font-black uppercase disabled:opacity-50">
                  {busy ? 'Syncing…' : `Add to ${activeBatch?.batchNumber} & stamp old batch`}
                </button>
              </div>
            </div>
          )}
          {lastRejoin && (
            <div className="bg-green-100 border border-green-400 p-3 text-xs font-bold text-green-800 flex items-center gap-2">
              <CheckCircle2 size={16} /> {lastRejoin.name} → Chest <span className="font-mono bg-yellow-300 text-black px-1.5">{lastRejoin.chest}</span> · from {lastRejoin.from}
            </div>
          )}
        </form>
      )}

      <div className="bg-white border border-slate-300 shadow-flat">
        <div className="flex border-b border-slate-200 bg-slate-50">
          {([
            { id: 'pool', label: `Awaiting Pool (${awaiting.length})` },
            { id: 'outgoing', label: `Outgoing (${outgoing.length})` },
            { id: 'incoming', label: `Incoming (${incoming.length})` },
            { id: 'all', label: `All (${records.length})` },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-[10px] font-black uppercase border-b-2 ${tab === t.id ? 'border-military-700 text-military-900 bg-white' : 'border-transparent text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-10 text-center"><Loader2 size={24} className="animate-spin mx-auto text-military-700" /></div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  {['RelID', 'Name', 'From', 'Chest', 'Reason', 'Status', 'Joined where', 'When', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className={r.status === 'awaiting_rejoin' ? 'bg-amber-50/40' : ''}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => copyId(r.relegateId)} className="font-mono font-black text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 flex items-center gap-1">
                        {r.relegateId} <Copy size={10} />
                        {copiedId === r.relegateId && <span className="text-[8px] text-green-700">OK</span>}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-800">{r.traineeName}</td>
                    <td className="px-3 py-2 text-[10px]">{r.fromBatchNumber}</td>
                    <td className="px-3 py-2 font-mono font-black">{r.fromChestNo}</td>
                    <td className="px-3 py-2 text-[10px]">{r.reason}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2 text-[10px]">
                      {r.status === 'rejoined'
                        ? <span className="font-bold text-green-800">{r.toBatchNumber} · chest <span className="bg-yellow-200 px-1">{r.toChestNo}</span></span>
                        : r.status === 'awaiting_rejoin' ? <span className="text-amber-700 italic">not yet known</span>
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{fmt(r.rejoinedAt || r.relegatedAt)}</td>
                    <td className="px-3 py-2 flex gap-1">
                      {r.status === 'awaiting_rejoin' && canManage && activeBatch && r.fromBatchId !== activeBatch.id && (
                        <button onClick={() => admitFromPool(r)} className="bg-green-700 text-white px-2 py-1 text-[9px] font-black uppercase">Add here</button>
                      )}
                      {r.status === 'awaiting_rejoin' && canManage && (
                        <button onClick={() => handleCancel(r)} className="text-slate-500 hover:text-red-600 text-[9px] font-bold uppercase">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-400 italic font-bold">Koi record nahi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tab === 'incoming' && incoming.length > 0 && (
        <div className="bg-white border border-slate-200 p-3 text-[10px] text-slate-600">
          Incoming trainees is batch me chest ke saath Capital <strong>R</strong> dikhte hain — jaise 25R — taaki original batch ke chest 25 se clash na ho.
          Purane batch ke trainee profile pe <strong>rejoinedBatchNumber / rejoinedChestNo</strong> automatically pad jata hai.
        </div>
      )}

      {!canManage && (
        <p className="text-[10px] text-slate-400 flex items-center gap-1"><Shield size={10} /> Relegate / RelID-add sirf CC ya Clerk.</p>
      )}
    </div>
  );
};

export default RelegationRegisterScreen;
